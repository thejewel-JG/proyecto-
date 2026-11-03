import Stripe from 'stripe';
import crypto from 'crypto';
import { getDb } from '../db/database';
import { CoinPackage, CoinOrder, LedgerTransaction, ReconciliationReport, ReconciliationDiscrepancy } from '../types';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// Modo de prueba obligatorio: Verificar que la clave nunca sea de producción en este entorno
export const IS_TEST_MODE = true;
if (STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.error('[STRIPE CRITICAL ERROR]: Se detectó una clave que no es de prueba (sk_test_). La FASE 6 opera EXCLUSIVAMENTE en modo de pruebas.');
}

export const stripeClient = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia' as any,
      typescript: true,
    })
  : null;

// ============================================================================
// 1. CATÁLOGO CANÓNICO DE PAQUETES DE MONEDAS DEL SERVIDOR
// ============================================================================

export async function getActiveCoinPackages(): Promise<CoinPackage[]> {
  const db = await getDb();
  const rows = await db.query<any>(
    'SELECT * FROM coin_packages WHERE is_active = 1 ORDER BY sort_order ASC'
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    coins: r.coins,
    priceEur: r.price_cents / 100,
    priceCents: r.price_cents,
    currency: r.currency || 'eur',
    badge: r.badge || undefined,
    icon: r.icon,
    popular: r.badge === 'Popular',
    isActive: !!r.is_active,
  }));
}

export async function getCoinPackageById(packageId: string): Promise<CoinPackage> {
  const db = await getDb();
  const row = await db.get<any>(
    'SELECT * FROM coin_packages WHERE id = ? AND is_active = 1',
    [packageId]
  );
  if (!row) {
    throw { status: 404, message: 'El paquete de monedas solicitado no existe o está desactivado.' };
  }
  return {
    id: row.id,
    name: row.name,
    coins: row.coins,
    priceEur: row.price_cents / 100,
    priceCents: row.price_cents,
    currency: row.currency || 'eur',
    badge: row.badge || undefined,
    icon: row.icon,
    popular: row.badge === 'Popular',
    isActive: !!row.is_active,
  };
}

// ============================================================================
// 2. LÍMITES DE GASTO RESPONSABLE Y RESERVAS DE PEDIDOS PENDIENTES
// ============================================================================

export async function checkUserSpendingLimits(userId: string, newOrderCents: number): Promise<{
  allowed: boolean;
  reason?: string;
  spentTodayEur: number;
  spentWeeklyEur: number;
  pendingReservationEur: number;
  dailyLimitEur?: number;
  weeklyLimitEur?: number;
}> {
  const db = await getDb();
  const user = await db.get<any>(
    'SELECT spending_limit_daily, spending_limit_weekly, spending_limit_daily_cents, spending_limit_weekly_cents FROM users WHERE id = ?',
    [userId]
  );
  if (!user) {
    throw { status: 404, message: 'Usuario no encontrado.' };
  }

  // Límites en céntimos
  const dailyLimitCents = user.spending_limit_daily_cents ?? (user.spending_limit_daily ? Math.round(user.spending_limit_daily * 100) : null);
  const weeklyLimitCents = user.spending_limit_weekly_cents ?? (user.spending_limit_weekly ? Math.round(user.spending_limit_weekly * 100) : null);

  const now = new Date();
  // Inicio de día UTC
  const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  // Inicio de semana (últimos 7 días móviles)
  const sevenDaysAgoUtc = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  // 1. Gasto confirmado hoy
  const spentTodayRow = await db.get<{ sum: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) as sum FROM coin_orders 
     WHERE user_id = ? AND status = 'paid' AND paid_at >= ?`,
    [userId, startOfDayUtc]
  );
  const spentTodayCents = spentTodayRow ? spentTodayRow.sum : 0;

  // 2. Gasto confirmado últimos 7 días
  const spentWeeklyRow = await db.get<{ sum: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) as sum FROM coin_orders 
     WHERE user_id = ? AND status = 'paid' AND paid_at >= ?`,
    [userId, sevenDaysAgoUtc]
  );
  const spentWeeklyCents = spentWeeklyRow ? spentWeeklyRow.sum : 0;

  // 3. Reservas de pedidos pendientes activos (dentro de su ventana de caducidad)
  const pendingRow = await db.get<{ sum: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) as sum FROM coin_orders 
     WHERE user_id = ? AND status = 'pending' AND expires_at > ?`,
    [userId, nowIso]
  );
  const pendingCents = pendingRow ? pendingRow.sum : 0;

  // Comprobar límite diario
  if (dailyLimitCents !== null) {
    if (spentTodayCents + pendingCents + newOrderCents > dailyLimitCents) {
      return {
        allowed: false,
        reason: `Esta compra superaría tu límite de gasto diario configurado (${(dailyLimitCents / 100).toFixed(2)} €). Incluye compras activas y reservas pendientes de confirmación.`,
        spentTodayEur: spentTodayCents / 100,
        spentWeeklyEur: spentWeeklyCents / 100,
        pendingReservationEur: pendingCents / 100,
        dailyLimitEur: dailyLimitCents / 100,
        weeklyLimitEur: weeklyLimitCents !== null ? weeklyLimitCents / 100 : undefined,
      };
    }
  }

  // Comprobar límite semanal
  if (weeklyLimitCents !== null) {
    if (spentWeeklyCents + pendingCents + newOrderCents > weeklyLimitCents) {
      return {
        allowed: false,
        reason: `Esta compra superaría tu límite de gasto semanal configurado (${(weeklyLimitCents / 100).toFixed(2)} €). Incluye compras activas y reservas pendientes de confirmación.`,
        spentTodayEur: spentTodayCents / 100,
        spentWeeklyEur: spentWeeklyCents / 100,
        pendingReservationEur: pendingCents / 100,
        dailyLimitEur: dailyLimitCents !== null ? dailyLimitCents / 100 : undefined,
        weeklyLimitEur: weeklyLimitCents / 100,
      };
    }
  }

  return {
    allowed: true,
    spentTodayEur: spentTodayCents / 100,
    spentWeeklyEur: spentWeeklyCents / 100,
    pendingReservationEur: pendingCents / 100,
    dailyLimitEur: dailyLimitCents !== null ? dailyLimitCents / 100 : undefined,
    weeklyLimitEur: weeklyLimitCents !== null ? weeklyLimitCents / 100 : undefined,
  };
}

// ============================================================================
// 3. CREACIÓN DE PEDIDO Y SESIÓN DE STRIPE CHECKOUT (MODO TEST)
// ============================================================================

export async function createCoinOrderAndCheckoutSession(params: {
  userId: string;
  userEmail: string;
  packageId: string;
  originUrl: string;
  idempotencyKey?: string;
}): Promise<{ order: CoinOrder; checkoutUrl: string; sessionId: string }> {
  const db = await getDb();

  // Validar usuario y posible restricción financiera
  const user = await db.get<any>('SELECT id, email, financial_restriction FROM users WHERE id = ?', [params.userId]);
  if (!user) {
    throw { status: 404, message: 'Usuario no encontrado.' };
  }
  if (user.financial_restriction) {
    throw { status: 403, message: 'Tu cuenta tiene una restricción financiera activa debido a un reembolso pendiente de conciliación. Contacta con soporte.' };
  }

  // Obtener paquete oficial del servidor (NUNCA confiar en precios enviados por el cliente)
  const pkg = await getCoinPackageById(params.packageId);

  // Comprobar idempotencia por clave de reintento
  if (params.idempotencyKey) {
    const existingOrder = await db.get<any>(
      'SELECT * FROM coin_orders WHERE user_id = ? AND idempotency_key = ?',
      [params.userId, params.idempotencyKey]
    );
    if (existingOrder) {
      return {
        order: mapCoinOrderRow(existingOrder),
        checkoutUrl: `/wallet?order_id=${existingOrder.id}&session_id=${existingOrder.stripe_session_id || ''}`,
        sessionId: existingOrder.stripe_session_id || `sim_session_${existingOrder.id}`,
      };
    }
  }

  // Verificar límites de gasto (incluyendo reservas pendientes de otras compras simultáneas)
  const limitCheck = await checkUserSpendingLimits(params.userId, pkg.priceCents);
  if (!limitCheck.allowed) {
    throw { status: 422, message: limitCheck.reason };
  }

  const now = new Date();
  const orderId = `ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const orderNumber = `KB-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  // Caducidad de la sesión de Checkout: 30 minutos
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

  // Registrar pedido interno en estado 'pending'
  await db.run(
    `INSERT INTO coin_orders (
      id, order_number, user_id, package_id, package_name,
      coins, amount_cents, currency, status, idempotency_key,
      created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'eur', 'pending', ?, ?, ?)`,
    [
      orderId,
      orderNumber,
      params.userId,
      pkg.id,
      pkg.name,
      pkg.coins,
      pkg.priceCents,
      params.idempotencyKey || null,
      now.toISOString(),
      expiresAt.toISOString(),
    ]
  );

  let sessionId = `sess_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  let checkoutUrl = `${params.originUrl}/wallet?order_id=${orderId}&session_id=${sessionId}`;

  // Si existe credencial real de Stripe Testnet
  if (stripeClient && STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    try {
      const session = await stripeClient.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: orderId,
        customer_email: params.userEmail,
        line_items: [
          {
            price_data: {
              currency: 'eur',
              unit_amount: pkg.priceCents,
              product_data: {
                name: `${pkg.name} — ${pkg.coins} Monedas Astrales`,
                description: `Recarga de ${pkg.coins} monedas en KABALY (Modo Pruebas / Sandbox)`,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          orderId,
          userId: params.userId,
          packageId: pkg.id,
          coins: pkg.coins.toString(),
          testMode: 'true',
        },
        success_url: `${params.originUrl}/wallet?order_id=${orderId}&session_id={CHECKOUT_SESSION_ID}&payment_status=success`,
        cancel_url: `${params.originUrl}/wallet?order_id=${orderId}&status=cancelled`,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
      }, {
        idempotencyKey: params.idempotencyKey ? `stripe_${params.idempotencyKey}` : undefined,
      });

      if (session.id && session.url) {
        sessionId = session.id;
        checkoutUrl = session.url;
      }
    } catch (err: any) {
      console.error('[Stripe Checkout Error]:', err);
      // Fallback a simulación de modo de pruebas para entornos de desarrollo local sin red externa
      sessionId = `sess_test_${orderId}`;
      checkoutUrl = `${params.originUrl}/wallet?order_id=${orderId}&session_id=${sessionId}&sandbox=true`;
    }
  }

  // Vincular sessionId de Stripe con el pedido
  await db.run(
    'UPDATE coin_orders SET stripe_session_id = ? WHERE id = ?',
    [sessionId, orderId]
  );

  const updatedOrder = await db.get<any>('SELECT * FROM coin_orders WHERE id = ?', [orderId]);

  return {
    order: mapCoinOrderRow(updatedOrder),
    checkoutUrl,
    sessionId,
  };
}

// ============================================================================
// 4. CONSULTA DE ESTADO Y MOVIMIENTOS AUDITABLES
// ============================================================================

export async function getCoinOrderById(orderId: string, userId: string, isAdmin = false): Promise<CoinOrder> {
  const db = await getDb();
  const orderRow = await db.get<any>('SELECT * FROM coin_orders WHERE id = ?', [orderId]);
  if (!orderRow) {
    throw { status: 404, message: 'Pedido no encontrado.' };
  }

  if (orderRow.user_id !== userId && !isAdmin) {
    throw { status: 403, message: 'No tienes permiso para consultar este pedido.' };
  }

  // Si está en estado pending y ha expirado su tiempo de vida
  if (orderRow.status === 'pending' && new Date(orderRow.expires_at).getTime() < Date.now()) {
    await db.run(
      "UPDATE coin_orders SET status = 'expired', failed_at = ? WHERE id = ?",
      [new Date().toISOString(), orderId]
    );
    orderRow.status = 'expired';
  }

  return mapCoinOrderRow(orderRow);
}

export async function getUserCoinOrders(userId: string, limit = 20): Promise<CoinOrder[]> {
  const db = await getDb();
  const rows = await db.query<any>(
    'SELECT * FROM coin_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]
  );
  return rows.map(mapCoinOrderRow);
}

export async function getUserLedgerTransactions(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ transactions: LedgerTransaction[]; total: number }> {
  const db = await getDb();
  const limit = options.limit ? Math.min(Math.max(1, options.limit), 50) : 20;
  const offset = options.offset || 0;

  const countRow = await db.get<{ c: number }>('SELECT COUNT(*) as c FROM ledger WHERE user_id = ?', [userId]);
  const total = countRow ? countRow.c : 0;

  const rows = await db.query<any>(
    'SELECT * FROM ledger WHERE user_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?',
    [userId, limit, offset]
  );

  return {
    transactions: rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      type: r.type,
      amountCoins: r.amount_coins,
      amountCents: r.amount_cents || Math.round(r.amount_eur * 100),
      amountEur: r.amount_eur,
      balanceAfter: r.balance_after || undefined,
      description: r.description,
      referenceId: r.reference_id || undefined,
      timestamp: r.timestamp,
      status: r.status,
    })),
    total,
  };
}

function mapCoinOrderRow(r: any): CoinOrder {
  return {
    id: r.id,
    orderNumber: r.order_number,
    userId: r.user_id,
    packageId: r.package_id,
    packageName: r.package_name,
    coins: r.coins,
    amountCents: r.amount_cents,
    currency: r.currency,
    status: r.status,
    stripeSessionId: r.stripe_session_id || undefined,
    stripePaymentIntentId: r.stripe_payment_intent_id || undefined,
    idempotencyKey: r.idempotency_key || undefined,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    paidAt: r.paid_at || undefined,
    failedAt: r.failed_at || undefined,
    failureReason: r.failure_reason || undefined,
  };
}

// ============================================================================
// 5. PROCESAMIENTO TRANSACCIONAL DE EVENTOS Y WEBHOOKS DE STRIPE
// ============================================================================

export async function processStripeWebhookEvent(
  rawEvent: Stripe.Event | { id: string; type: string; data: { object: any } }
): Promise<{ success: boolean; action: string; orderId?: string; alreadyProcessed?: boolean }> {
  const db = await getDb();
  const eventId = rawEvent.id;
  const eventType = rawEvent.type;

  // 1. Comprobación de idempotencia: Si el evento ya fue procesado, no repetir operaciones
  const existingEvent = await db.get<any>(
    'SELECT id, status FROM processed_stripe_events WHERE id = ?',
    [eventId]
  );
  if (existingEvent && existingEvent.status === 'processed') {
    return { success: true, action: 'already_processed', alreadyProcessed: true };
  }

  const obj = rawEvent.data.object as any;
  const now = new Date().toISOString();

  // 2. Manejo de Eventos de Pago Completado o Asíncrono Confirmado
  if (
    eventType === 'checkout.session.completed' ||
    eventType === 'checkout.session.async_payment_succeeded'
  ) {
    const clientRefId = obj.client_reference_id;
    const sessionId = obj.id;
    const paymentIntentId = obj.payment_intent;
    const amountTotal = obj.amount_total;
    const currency = (obj.currency || 'eur').toLowerCase();

    // Localizar pedido por client_reference_id o por stripe_session_id
    let order = await db.get<any>(
      'SELECT * FROM coin_orders WHERE id = ? OR stripe_session_id = ?',
      [clientRefId || '', sessionId || '']
    );

    if (!order) {
      throw new Error(`[Stripe Webhook] Pedido no encontrado para sesión ${sessionId} / ref ${clientRefId}`);
    }

    // Verificar moneda y monto exacto en céntimos
    if (currency !== 'eur') {
      throw new Error(`[Stripe Webhook] Moneda no esperada: ${currency}`);
    }
    if (amountTotal !== undefined && amountTotal !== order.amount_cents) {
      throw new Error(`[Stripe Webhook] Discrepancia de monto: recibido ${amountTotal} céntimos, pedido esperado ${order.amount_cents}`);
    }

    // Si ya está pagado, no volver a acreditar (idempotencia en pedido)
    if (order.status === 'paid') {
      await db.run(
        "INSERT OR REPLACE INTO processed_stripe_events (id, event_type, status, processed_at) VALUES (?, ?, 'processed', ?)",
        [eventId, eventType, now]
      );
      return { success: true, action: 'order_already_paid', orderId: order.id, alreadyProcessed: true };
    }

    // Resolver pago tardío si la reserva ya había caducado:
    // NUNCA ignorar un pago confirmado por Stripe. Acreditar y registrar nota compensatoria.
    const isLatePayment = order.status === 'expired';

    // Obtener saldo actual para snapshot de libro mayor
    const userRow = await db.get<any>('SELECT coins_balance, purchased_coins_balance FROM users WHERE id = ?', [order.user_id]);
    const currentBalance = userRow ? userRow.coins_balance : 0;
    const currentPurchased = userRow ? userRow.purchased_coins_balance : 0;
    const newBalance = currentBalance + order.coins;
    const newPurchased = currentPurchased + order.coins;

    // Actualizar estado del pedido
    await db.run(
      `UPDATE coin_orders SET 
        status = 'paid', 
        paid_at = ?, 
        stripe_payment_intent_id = ?,
        metadata = ?
      WHERE id = ?`,
      [
        now,
        paymentIntentId || order.stripe_payment_intent_id,
        isLatePayment ? 'PAGO_TARDIO_CONFIRMADO' : null,
        order.id
      ]
    );

    // Acreditar monedas enteras al usuario
    await db.run(
      `UPDATE users SET 
        coins_balance = coins_balance + ?,
        purchased_coins_balance = purchased_coins_balance + ?,
        spent_today = spent_today + ?,
        spent_this_week = spent_this_week + ?,
        updated_at = ?
      WHERE id = ?`,
      [
        order.coins,
        order.coins,
        order.amount_cents / 100,
        order.amount_cents / 100,
        now,
        order.user_id
      ]
    );

    // Asentar en Libro Mayor (Ledger) con balance_after auditable
    const ledgerId = `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const desc = isLatePayment
      ? `Recarga tardía confirmada: ${order.coins} monedas (${order.package_name} #${order.order_number})`
      : `Recarga de monedas: ${order.coins} monedas (${order.package_name} #${order.order_number})`;

    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'topup', ?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [
        ledgerId,
        order.user_id,
        order.coins,
        order.amount_cents,
        order.amount_cents / 100,
        newBalance,
        desc,
        order.id,
        now
      ]
    );

    // Registrar evento de Stripe como procesado
    await db.run(
      "INSERT OR REPLACE INTO processed_stripe_events (id, event_type, status, processed_at) VALUES (?, ?, 'processed', ?)",
      [eventId, eventType, now]
    );

    return { success: true, action: 'order_credited', orderId: order.id };
  }

  // 3. Manejo de Fallo de Pago Asíncrono o Caducidad de Sesión
  if (eventType === 'checkout.session.async_payment_failed' || eventType === 'checkout.session.expired') {
    const sessionId = obj.id;
    const clientRefId = obj.client_reference_id;

    const order = await db.get<any>(
      'SELECT * FROM coin_orders WHERE id = ? OR stripe_session_id = ?',
      [clientRefId || '', sessionId || '']
    );

    if (order && order.status === 'pending') {
      const newStatus = eventType === 'checkout.session.expired' ? 'expired' : 'failed';
      await db.run(
        'UPDATE coin_orders SET status = ?, failed_at = ?, failure_reason = ? WHERE id = ?',
        [newStatus, now, eventType, order.id]
      );
    }

    await db.run(
      "INSERT OR REPLACE INTO processed_stripe_events (id, event_type, status, processed_at) VALUES (?, ?, 'processed', ?)",
      [eventId, eventType, now]
    );

    return { success: true, action: 'order_status_updated', orderId: order?.id };
  }

  // 4. Manejo de Reembolsos (charge.refunded)
  if (eventType === 'charge.refunded') {
    const refundObj = obj.refunds?.data?.[0] || obj;
    const stripeRefundId = refundObj.id || `ref_${eventId}`;
    const paymentIntentId = obj.payment_intent;
    const amountRefundedCents = refundObj.amount || obj.amount_refunded || 0;

    // Buscar pedido original asociado al payment_intent
    const order = await db.get<any>(
      'SELECT * FROM coin_orders WHERE stripe_payment_intent_id = ? OR id = ?',
      [paymentIntentId || '', obj.metadata?.orderId || '']
    );

    if (order) {
      const user = await db.get<any>('SELECT coins_balance, purchased_coins_balance FROM users WHERE id = ?', [order.user_id]);
      const currentBalance = user ? user.coins_balance : 0;
      const coinsToDeduct = order.coins;

      // Restricción: No generar saldos negativos silenciosos
      let coinsDeducted = coinsToDeduct;
      let unrecoveredCoins = 0;
      let requiresManualReview = false;

      if (currentBalance < coinsToDeduct) {
        coinsDeducted = Math.max(0, currentBalance);
        unrecoveredCoins = coinsToDeduct - coinsDeducted;
        requiresManualReview = true;
      }

      const newBalance = currentBalance - coinsDeducted;

      // Actualizar saldo de usuario
      await db.run(
        `UPDATE users SET 
          coins_balance = ?, 
          purchased_coins_balance = MAX(0, purchased_coins_balance - ?),
          financial_restriction = CASE WHEN ? = 1 THEN 1 ELSE financial_restriction END,
          updated_at = ?
         WHERE id = ?`,
        [newBalance, coinsDeducted, requiresManualReview ? 1 : 0, now, order.user_id]
      );

      // Movimiento compensatorio en libro mayor
      const compLedgerId = `comp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await db.run(
        `INSERT INTO ledger (
          id, user_id, type, amount_coins, amount_cents, amount_eur,
          balance_after, description, reference_id, timestamp, status
        ) VALUES (?, ?, 'refund', ?, ?, ?, ?, ?, ?, ?, 'completed')`,
        [
          compLedgerId,
          order.user_id,
          -coinsDeducted,
          -amountRefundedCents,
          -(amountRefundedCents / 100),
          newBalance,
          `Ajuste por reembolso de Stripe (${order.package_name} #${order.order_number})`,
          order.id,
          now
        ]
      );

      // Registrar caso en refund_disputes
      const disputeId = `rfd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      await db.run(
        `INSERT OR IGNORE INTO refund_disputes (
          id, order_id, user_id, stripe_refund_id, amount_cents,
          coins_to_deduct, coins_deducted, unrecovered_coins, status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          disputeId,
          order.id,
          order.user_id,
          stripeRefundId,
          amountRefundedCents,
          coinsToDeduct,
          coinsDeducted,
          unrecoveredCoins,
          requiresManualReview ? 'pending_manual_review' : 'processed',
          requiresManualReview ? `Saldo insuficiente al reembolsar: quedaron ${unrecoveredCoins} monedas sin recuperar.` : null,
          now
        ]
      );
    }

    await db.run(
      "INSERT OR REPLACE INTO processed_stripe_events (id, event_type, status, processed_at) VALUES (?, ?, 'processed', ?)",
      [eventId, eventType, now]
    );

    return { success: true, action: 'refund_processed', orderId: order?.id };
  }

  // Otros eventos
  await db.run(
    'INSERT OR REPLACE INTO processed_stripe_events (id, event_type, status, processed_at) VALUES (?, ?, "ignored", ?)',
    [eventId, eventType, now]
  );

  return { success: true, action: 'ignored' };
}

// ============================================================================
// 6. HERRAMIENTA DE CONCILIACIÓN CONTABLE Y AUDITORÍA
// ============================================================================

export async function runWalletReconciliation(): Promise<ReconciliationReport> {
  const db = await getDb();
  const discrepancies: ReconciliationDiscrepancy[] = [];

  // 1. Verificar que todos los pedidos con status='paid' tengan su correspondiente asiento en ledger
  const paidOrders = await db.query<any>(
    "SELECT id, order_number, user_id, coins, amount_cents FROM coin_orders WHERE status = 'paid'"
  );

  let totalOrdersAmountCents = 0;
  let totalCoinsCredited = 0;

  for (const ord of paidOrders) {
    totalOrdersAmountCents += ord.amount_cents;
    totalCoinsCredited += ord.coins;

    const ledgerEntries = await db.query<any>(
      "SELECT id, amount_coins FROM ledger WHERE reference_id = ? AND type = 'topup'",
      [ord.id]
    );

    if (ledgerEntries.length === 0) {
      discrepancies.push({
        type: 'UNCREDITED_PAID_ORDER',
        orderId: ord.id,
        userId: ord.user_id,
        details: `El pedido pagado ${ord.order_number} (${ord.coins} monedas) no tiene ningún asiento en el libro mayor.`,
        severity: 'high',
      });
    } else if (ledgerEntries.length > 1) {
      discrepancies.push({
        type: 'DUPLICATE_ORDER_CREDIT',
        orderId: ord.id,
        userId: ord.user_id,
        details: `El pedido ${ord.order_number} tiene ${ledgerEntries.length} asientos duplicados en el libro mayor.`,
        severity: 'high',
      });
    }
  }

  // 2. Auditar coherencia de saldo de usuarios vs suma de transacciones en libro mayor
  const users = await db.query<any>('SELECT id, name, coins_balance, purchased_coins_balance FROM users');

  for (const u of users) {
    if (u.coins_balance < 0) {
      discrepancies.push({
        type: 'NEGATIVE_BALANCE',
        userId: u.id,
        details: `El usuario ${u.name} (${u.id}) tiene un saldo negativo inadmisible: ${u.coins_balance}`,
        severity: 'high',
      });
    }

    // Sumar movimientos en libro mayor para este usuario
    const txSumRow = await db.get<{ sumCoins: number }>(
      "SELECT COALESCE(SUM(amount_coins), 0) as sumCoins FROM ledger WHERE user_id = ? AND status = 'completed'",
      [u.id]
    );
    const ledgerSum = txSumRow ? txSumRow.sumCoins : 0;

    // Si el usuario tiene transacciones en el libro mayor y su saldo difiere del acumulado
    // (toleramos usuarios nuevos iniciales sin movimientos previos)
    const hasTransactions = await db.get<any>('SELECT id FROM ledger WHERE user_id = ? LIMIT 1', [u.id]);
    if (hasTransactions && Math.abs(u.coins_balance - ledgerSum) > 0) {
      discrepancies.push({
        type: 'BALANCE_LEDGER_MISMATCH',
        userId: u.id,
        details: `Descuadre contable para ${u.name} (${u.id}): saldo actual en users=${u.coins_balance}, acumulado en ledger=${ledgerSum}`,
        severity: 'medium',
      });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalOrdersPaid: paidOrders.length,
    totalOrdersAmountCents,
    totalCoinsCredited,
    totalUsersAudited: users.length,
    discrepancies,
    isBalanced: discrepancies.length === 0,
  };
}

export async function updateUserSpendingLimits(
  userId: string,
  dailyEur: number | null,
  weeklyEur: number | null
): Promise<{ spendingLimitDaily: number | null; spendingLimitWeekly: number | null }> {
  const db = await getDb();
  const dailyCents = dailyEur !== null && dailyEur !== undefined ? Math.round(dailyEur * 100) : null;
  const weeklyCents = weeklyEur !== null && weeklyEur !== undefined ? Math.round(weeklyEur * 100) : null;

  if (dailyCents !== null && dailyCents < 0) {
    throw { status: 400, message: 'El límite diario no puede ser negativo.' };
  }
  if (weeklyCents !== null && weeklyCents < 0) {
    throw { status: 400, message: 'El límite semanal no puede ser negativo.' };
  }
  if (dailyCents !== null && weeklyCents !== null && dailyCents > weeklyCents) {
    throw { status: 400, message: 'El límite diario no puede ser superior al límite semanal.' };
  }

  await db.run(
    `UPDATE users 
     SET spending_limit_daily = ?, 
         spending_limit_weekly = ?, 
         spending_limit_daily_cents = ?, 
         spending_limit_weekly_cents = ? 
     WHERE id = ?`,
    [
      dailyEur !== null ? dailyEur : null,
      weeklyEur !== null ? weeklyEur : null,
      dailyCents,
      weeklyCents,
      userId
    ]
  );

  return {
    spendingLimitDaily: dailyEur,
    spendingLimitWeekly: weeklyEur,
  };
}

