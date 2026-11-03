/**
 * KABALY - Phase 9 Service Layer
 * Live Stream Gifts, Post Unlocks, Private Storage and Compensatory Accounting
 */

import crypto from 'crypto';
import { getDb } from '../db/database';
import { Gift, GiftEvent, PostUnlock, Video } from '../types';

// ----------------------------------------------------------------------------
// 1. CATÁLOGO DE REGALOS OFICIAL DEL SERVIDOR
// ----------------------------------------------------------------------------

export async function getGiftCatalog(): Promise<Gift[]> {
  const db = await getDb();
  const rows = await db.query<any>(
    "SELECT id, name, icon, cost_coins, description FROM stream_gifts WHERE is_active = 1 ORDER BY sort_order ASC, cost_coins ASC"
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    costCoins: r.cost_coins,
    description: r.description || '',
  }));
}

// ----------------------------------------------------------------------------
// 2. VERIFICACIÓN DE LÍMITES DE GASTO EN MONEDAS
// ----------------------------------------------------------------------------

export async function checkCoinSpendingLimits(userId: string, coinsToSpend: number): Promise<void> {
  const db = await getDb();
  const user = await db.get<any>(
    'SELECT coins_balance, coins_reserved, financial_restriction, spending_limit_daily, spending_limit_weekly, spending_limit_daily_cents, spending_limit_weekly_cents FROM users WHERE id = ?',
    [userId]
  );

  if (!user) {
    throw { status: 404, message: 'Usuario no encontrado.' };
  }

  if (user.financial_restriction === 1) {
    throw {
      status: 403,
      message: 'Esta cuenta tiene una restricción financiera administrativa activa. No se permiten operaciones de gasto hasta su revisión.',
    };
  }

  // Comprobar saldo disponible real (saldo total - retenciones internas)
  const availableCoins = (user.coins_balance || 0) - (user.coins_reserved || 0);
  if (availableCoins < coinsToSpend) {
    throw {
      status: 402,
      code: 'INSUFFICIENT_COINS',
      message: `Saldo insuficiente. Dispones de ${availableCoins} monedas libres y la operación requiere ${coinsToSpend} monedas.`,
    };
  }

  // Límites diarios y semanales configurados por el usuario
  const dailyLimitEur = user.spending_limit_daily_cents ? user.spending_limit_daily_cents / 100 : user.spending_limit_daily;
  const weeklyLimitEur = user.spending_limit_weekly_cents ? user.spending_limit_weekly_cents / 100 : user.spending_limit_weekly;

  if (dailyLimitEur !== null && dailyLimitEur !== undefined && dailyLimitEur > 0) {
    // 1 moneda = 0.10 €
    const dailyLimitCoins = Math.round(dailyLimitEur * 10);
    const now = new Date();
    const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

    const spentTodayRow = await db.get<any>(
      "SELECT COALESCE(SUM(ABS(amount_coins)), 0) as total FROM ledger WHERE user_id = ? AND amount_coins < 0 AND timestamp >= ?",
      [userId, startOfDayUtc]
    );
    const spentTodayCoins = spentTodayRow ? spentTodayRow.total : 0;

    if (spentTodayCoins + coinsToSpend > dailyLimitCoins) {
      throw {
        status: 400,
        message: `Esta operación superaría tu límite de gasto diario configurado (${dailyLimitEur.toFixed(2)} € / ${dailyLimitCoins} monedas). Ya has gastado ${spentTodayCoins} monedas hoy.`,
      };
    }
  }

  if (weeklyLimitEur !== null && weeklyLimitEur !== undefined && weeklyLimitEur > 0) {
    const weeklyLimitCoins = Math.round(weeklyLimitEur * 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const spentWeeklyRow = await db.get<any>(
      "SELECT COALESCE(SUM(ABS(amount_coins)), 0) as total FROM ledger WHERE user_id = ? AND amount_coins < 0 AND timestamp >= ?",
      [userId, sevenDaysAgo]
    );
    const spentWeeklyCoins = spentWeeklyRow ? spentWeeklyRow.total : 0;

    if (spentWeeklyCoins + coinsToSpend > weeklyLimitCoins) {
      throw {
        status: 400,
        message: `Esta operación superaría tu límite de gasto semanal configurado (${weeklyLimitEur.toFixed(2)} € / ${weeklyLimitCoins} monedas). Ya has gastado ${spentWeeklyCoins} monedas en los últimos 7 días.`,
      };
    }
  }
}

// ----------------------------------------------------------------------------
// 3. ENVÍO DE REGALOS DURANTE EMISIONES EN DIRECTO
// ----------------------------------------------------------------------------

export async function sendStreamGift(params: {
  senderId: string;
  streamId: string;
  giftId: string;
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  isDuplicate?: boolean;
  transactionId: string;
  event: GiftEvent;
  balanceAfter: number;
  costCoins?: number;
  platformFeeCoins?: number;
  tarotistaEarningsCoins?: number;
}> {
  const db = await getDb();
  const { senderId, streamId, giftId, idempotencyKey } = params;

  // 1. Idempotencia: si ya se envió esta clave por este usuario, devolver resultado previo sin cobrar de nuevo
  if (idempotencyKey) {
    const existingTx = await db.get<any>(
      "SELECT * FROM stream_gift_transactions WHERE sender_id = ? AND idempotency_key = ?",
      [senderId, idempotencyKey]
    );
    if (existingTx) {
      const existingEvt = await db.get<any>(
        "SELECT * FROM stream_gift_events WHERE transaction_id = ?",
        [existingTx.id]
      );
      const sender = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [senderId]);
      return {
        success: true,
        isDuplicate: true,
        transactionId: existingTx.id,
        event: {
          id: existingEvt ? existingEvt.id : `evt_${existingTx.id}`,
          streamId: existingTx.stream_id,
          transactionId: existingTx.id,
          senderId: existingTx.sender_id,
          senderName: existingEvt ? existingEvt.sender_name : 'Usuario',
          senderAvatar: existingEvt ? existingEvt.sender_avatar : '',
          giftId: existingTx.gift_id,
          giftName: existingTx.gift_name,
          giftIcon: existingTx.gift_icon,
          giftCost: existingTx.coins_amount,
          timestamp: existingTx.created_at,
        },
        balanceAfter: sender ? sender.coins_balance : 0,
        costCoins: existingTx.coins_amount,
        platformFeeCoins: existingTx.platform_fee_coins,
        tarotistaEarningsCoins: existingTx.tarotista_earnings_coins,
      };
    }
  }

  // 2. Validar regalo en catálogo del servidor
  const gift = await db.get<any>(
    "SELECT * FROM stream_gifts WHERE id = ? AND is_active = 1",
    [giftId]
  );
  if (!gift) {
    throw { status: 400, message: 'El regalo seleccionado no existe o está desactivado.' };
  }
  const costCoins = gift.cost_coins;

  // 3. Validar emisión en directo activa
  const stream = await db.get<any>(
    "SELECT * FROM live_streams WHERE id = ?",
    [streamId]
  );
  if (!stream) {
    throw { status: 404, message: 'La emisión en directo no fue encontrada.' };
  }
  if (stream.is_live !== 1) {
    throw {
      status: 400,
      code: 'STREAM_NOT_LIVE',
      message: 'La emisión en directo ya ha finalizado. No se pueden enviar regalos a directos terminados.',
    };
  }

  // 4. Identificar al tarotista dueño de la emisión
  let tarotistaUserId = stream.tarotista_id;
  let tarotistaProfileId = stream.tarotista_id;
  let commissionPercentage = 20;

  const profile = await db.get<any>(
    "SELECT id, user_id, custom_commission_percentage FROM tarotista_profiles WHERE id = ? OR user_id = ?",
    [stream.tarotista_id, stream.tarotista_id]
  );
  if (profile) {
    tarotistaUserId = profile.user_id;
    tarotistaProfileId = profile.id;
    commissionPercentage = profile.custom_commission_percentage ?? 20;
  }

  // REQUISITO: Impedir regalarse a uno mismo
  if (senderId === tarotistaUserId || senderId === stream.tarotista_id) {
    throw { status: 400, code: 'CANNOT_GIFT_SELF', message: 'No puedes enviarte regalos a ti mismo.' };
  }

  // 5. Comprobar límites de gasto y saldo disponible
  await checkCoinSpendingLimits(senderId, costCoins);

  const senderUser = await db.get<any>(
    'SELECT id, name, avatar, coins_balance FROM users WHERE id = ?',
    [senderId]
  );
  if (!senderUser) {
    throw { status: 404, message: 'Usuario remitente no encontrado.' };
  }

  // REQUISITO: Distribución matemática entera conservando el total
  const platformFee = Math.round(costCoins * (commissionPercentage / 100));
  const tarotistaEarnings = costCoins - platformFee;
  // Invariante: platformFee + tarotistaEarnings === costCoins

  const txId = `tx_gift_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const eventId = `evt_gift_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  // 6. Transacción atómica contable
  await db.run('BEGIN TRANSACTION');
  try {
    // 6.1 Deducir saldo del remitente (protegido contra concurrencia con WHERE coins_balance >= costCoins)
    const deductRes = await db.run(
      `UPDATE users 
       SET coins_balance = coins_balance - ?, 
           updated_at = ?
       WHERE id = ? AND coins_balance >= ?`,
      [costCoins, now, senderId, costCoins]
    );

    if (deductRes.changes === 0) {
      await db.run('ROLLBACK');
      throw { status: 402, message: 'Saldo insuficiente o conflicto concurrente al procesar el regalo.' };
    }

    // 6.2 Acreditar ganancias profesionales al tarotista sin mezclar con compras
    await db.run(
      `UPDATE users 
       SET coins_balance = coins_balance + ?, 
           earnings_coins_balance = earnings_coins_balance + ?,
           updated_at = ?
       WHERE id = ?`,
      [tarotistaEarnings, tarotistaEarnings, now, tarotistaUserId]
    );

    // 6.3 Registrar transacción de regalo
    await db.run(
      `INSERT INTO stream_gift_transactions (
        id, stream_id, sender_id, tarotista_id, tarotista_user_id,
        gift_id, gift_name, gift_icon, coins_amount, platform_fee_coins,
        tarotista_earnings_coins, commission_percentage, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        txId,
        streamId,
        senderId,
        tarotistaProfileId,
        tarotistaUserId,
        gift.id,
        gift.name,
        gift.icon,
        costCoins,
        platformFee,
        tarotistaEarnings,
        commissionPercentage,
        idempotencyKey || null,
        now,
      ]
    );

    // 6.4 Publicar evento de regalo persistente para los clientes
    await db.run(
      `INSERT INTO stream_gift_events (
        id, stream_id, transaction_id, sender_id, sender_name, sender_avatar,
        gift_id, gift_name, gift_icon, coins, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        streamId,
        txId,
        senderId,
        senderUser.name,
        senderUser.avatar || null,
        gift.id,
        gift.name,
        gift.icon,
        costCoins,
        now,
      ]
    );

    // 6.5 Asientos en el Libro Mayor (Ledger)
    const updatedSender = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [senderId]);
    const updatedTarotista = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [tarotistaUserId]);

    // Asiento remitente (gasto)
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'gift_sent', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        `tx_ledger_s_${txId}`,
        senderId,
        -costCoins,
        updatedSender.coins_balance,
        `Regalo enviado: ${gift.name} (${costCoins} monedas) a ${stream.tarotista_name}`,
        txId,
        now,
      ]
    );

    // Asiento tarotista (ganancia profesional)
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'gift_received', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        `tx_ledger_t_${txId}`,
        tarotistaUserId,
        tarotistaEarnings,
        updatedTarotista.coins_balance,
        `Regalo recibido en directo: ${gift.name} (+${tarotistaEarnings} monedas) de ${senderUser.name}`,
        txId,
        now,
      ]
    );

    // Asiento plataforma (comisión)
    if (platformFee > 0) {
      await db.run(
        `INSERT INTO ledger (
          id, user_id, type, amount_coins, amount_cents, amount_eur,
          balance_after, description, reference_id, timestamp, status
        ) VALUES (?, 'platform', 'platform_fee', ?, 0, 0, 0, ?, ?, ?, 'completed')`,
        [
          `tx_ledger_p_${txId}`,
          platformFee,
          `Comisión plataforma (${commissionPercentage}%) por regalo en directo #${streamId}`,
          txId,
          now,
        ]
      );
    }

    await db.run('COMMIT');

    const giftEvent: GiftEvent = {
      id: eventId,
      streamId,
      transactionId: txId,
      senderId,
      senderName: senderUser.name,
      senderAvatar: senderUser.avatar || '',
      giftId: gift.id,
      giftName: gift.name,
      giftIcon: gift.icon,
      giftCost: costCoins,
      timestamp: now,
    };

    return {
      success: true,
      transactionId: txId,
      event: giftEvent,
      balanceAfter: updatedSender.coins_balance,
      costCoins,
      platformFeeCoins: platformFee,
      tarotistaEarningsCoins: tarotistaEarnings,
    };
  } catch (err) {
    try {
      await db.run('ROLLBACK');
    } catch {}
    throw err;
  }
}

// ----------------------------------------------------------------------------
// 4. HISTORIAL Y RECUPERACIÓN DE EVENTOS DE REGALOS EN DIRECTO
// ----------------------------------------------------------------------------

export async function getStreamGiftEvents(
  streamId: string,
  sinceIso?: string,
  limit: number = 30
): Promise<GiftEvent[]> {
  const db = await getDb();
  let query = 'SELECT * FROM stream_gift_events WHERE stream_id = ?';
  const params: any[] = [streamId];

  if (sinceIso) {
    query += ' AND created_at > ?';
    params.push(sinceIso);
  }

  query += ' ORDER BY created_at ASC LIMIT ?';
  params.push(Math.min(Math.max(limit, 1), 100));

  const rows = await db.query<any>(query, params);
  return rows.map((r) => ({
    id: r.id,
    streamId: r.stream_id,
    transactionId: r.transaction_id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    senderAvatar: r.sender_avatar || '',
    giftId: r.gift_id,
    giftName: r.gift_name,
    giftIcon: r.gift_icon,
    giftCost: r.coins,
    timestamp: r.created_at,
  }));
}

// ----------------------------------------------------------------------------
// 5. DESBLOQUEO DE PUBLICACIONES EXCLUSIVAS (COMPRAS DE CONTENIDO)
// ----------------------------------------------------------------------------

export async function unlockExclusivePost(params: {
  buyerId: string;
  postId: string;
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  alreadyUnlocked?: boolean;
  isAuthor?: boolean;
  unlockId: string;
  mediaUrl: string;
  priceCoins: number;
  balanceAfter: number;
}> {
  const db = await getDb();
  const { buyerId, postId, idempotencyKey } = params;

  // 1. Obtener publicación
  const post = await db.get<any>(
    'SELECT * FROM videos WHERE id = ? AND is_deleted = 0',
    [postId]
  );
  if (!post) {
    throw { status: 404, message: 'La publicación no fue encontrada o ha sido eliminada.' };
  }

  // Comprobar si ha sido retirada por moderación / autor
  if (post.is_withdrawn === 1) {
    throw {
      status: 410,
      message: `Esta publicación ha sido retirada por su autor o moderación. Motivo: ${post.withdrawal_reason || 'Contenido retirado'}.`,
    };
  }

  const authorProfileId = post.tarotista_id;
  const authorProfile = await db.get<any>(
    'SELECT id, user_id, custom_commission_percentage FROM tarotista_profiles WHERE id = ? OR user_id = ?',
    [authorProfileId, authorProfileId]
  );
  const authorUserId = authorProfile ? authorProfile.user_id : authorProfileId;
  const commissionPercentage = authorProfile?.custom_commission_percentage ?? 20;

  // REQUISITO: El autor puede acceder a su propio contenido sin pagar
  if (buyerId === authorUserId || buyerId === authorProfileId) {
    const user = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [buyerId]);
    return {
      success: true,
      alreadyUnlocked: true,
      isAuthor: true,
      unlockId: `author_${postId}`,
      mediaUrl: post.video_url,
      priceCoins: 0,
      balanceAfter: user ? user.coins_balance : 0,
    };
  }

  // Si no es premium / exclusiva, el acceso es público
  const priceCoins = post.is_premium ? (post.price_coins || 0) : 0;
  if (!post.is_premium || priceCoins <= 0) {
    const user = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [buyerId]);
    return {
      success: true,
      alreadyUnlocked: true,
      unlockId: `free_${postId}`,
      mediaUrl: post.video_url,
      priceCoins: 0,
      balanceAfter: user ? user.coins_balance : 0,
    };
  }

  // 2. Comprobar si ya la compró anteriormente (o idempotencia)
  const existingUnlock = await db.get<any>(
    'SELECT * FROM post_unlocks WHERE user_id = ? AND post_id = ? AND is_refunded = 0',
    [buyerId, postId]
  );
  if (existingUnlock) {
    const user = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [buyerId]);
    return {
      success: true,
      alreadyUnlocked: true,
      unlockId: existingUnlock.id,
      mediaUrl: post.video_url,
      priceCoins: existingUnlock.coins_paid,
      balanceAfter: user ? user.coins_balance : 0,
    };
  }

  // 3. Comprobar saldo y límites de gasto
  await checkCoinSpendingLimits(buyerId, priceCoins);

  const buyerUser = await db.get<any>(
    'SELECT id, name, avatar, coins_balance FROM users WHERE id = ?',
    [buyerId]
  );
  if (!buyerUser) {
    throw { status: 404, message: 'Usuario comprador no encontrado.' };
  }

  // Reparto contable entero
  const platformFee = Math.round(priceCoins * (commissionPercentage / 100));
  const tarotistaEarnings = priceCoins - platformFee;
  // Total conservado: platformFee + tarotistaEarnings === priceCoins

  const unlockId = `unl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  // 4. Transacción atómica contable
  await db.run('BEGIN TRANSACTION');
  try {
    // 4.1 Deducir monedas del comprador
    const deductRes = await db.run(
      `UPDATE users 
       SET coins_balance = coins_balance - ?, 
           updated_at = ?
       WHERE id = ? AND coins_balance >= ?`,
      [priceCoins, now, buyerId, priceCoins]
    );

    if (deductRes.changes === 0) {
      await db.run('ROLLBACK');
      throw { status: 402, message: 'Saldo insuficiente o conflicto concurrente al desbloquear la publicación.' };
    }

    // 4.2 Acreditar ganancias profesionales al autor
    await db.run(
      `UPDATE users 
       SET coins_balance = coins_balance + ?, 
           earnings_coins_balance = earnings_coins_balance + ?,
           updated_at = ?
       WHERE id = ?`,
      [tarotistaEarnings, tarotistaEarnings, now, authorUserId]
    );

    // 4.3 Registrar compra única en post_unlocks
    await db.run(
      `INSERT INTO post_unlocks (
        id, user_id, post_id, author_id, coins_paid, platform_fee_coins,
        tarotista_earnings_coins, commission_percentage, idempotency_key, unlocked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        unlockId,
        buyerId,
        postId,
        authorUserId,
        priceCoins,
        platformFee,
        tarotistaEarnings,
        commissionPercentage,
        idempotencyKey || null,
        now,
      ]
    );

    // 4.4 Asientos en el Libro Mayor (Ledger)
    const updatedBuyer = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [buyerId]);
    const updatedAuthor = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [authorUserId]);

    // Comprador (gasto)
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'post_unlock_buy', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        `tx_unl_b_${unlockId}`,
        buyerId,
        -priceCoins,
        updatedBuyer.coins_balance,
        `Desbloqueo exclusivo: "${post.title}" (${priceCoins} monedas)`,
        unlockId,
        now,
      ]
    );

    // Autor (ganancia profesional)
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'post_unlock_earn', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        `tx_unl_a_${unlockId}`,
        authorUserId,
        tarotistaEarnings,
        updatedAuthor.coins_balance,
        `Venta de contenido exclusivo: "${post.title}" (+${tarotistaEarnings} monedas) a ${buyerUser.name}`,
        unlockId,
        now,
      ]
    );

    // Plataforma (comisión)
    if (platformFee > 0) {
      await db.run(
        `INSERT INTO ledger (
          id, user_id, type, amount_coins, amount_cents, amount_eur,
          balance_after, description, reference_id, timestamp, status
        ) VALUES (?, 'platform', 'platform_fee', ?, 0, 0, 0, ?, ?, ?, 'completed')`,
        [
          `tx_unl_p_${unlockId}`,
          platformFee,
          `Comisión plataforma (${commissionPercentage}%) por desbloqueo #${unlockId}`,
          unlockId,
          now,
        ]
      );
    }

    await db.run('COMMIT');

    return {
      success: true,
      alreadyUnlocked: false,
      unlockId,
      mediaUrl: post.video_url,
      priceCoins,
      balanceAfter: updatedBuyer.coins_balance,
    };
  } catch (err) {
    try {
      await db.run('ROLLBACK');
    } catch {}
    throw err;
  }
}

// ----------------------------------------------------------------------------
// 6. VERIFICACIÓN DE ACCESO SEGURO A MEDIOS PRIVADOS
// ----------------------------------------------------------------------------

export async function checkPostAccess(
  userId: string | null | undefined,
  postId: string
): Promise<{
  hasAccess: boolean;
  isAuthor: boolean;
  isPurchased: boolean;
  post: any;
  mediaUrl: string | null;
}> {
  const db = await getDb();
  const post = await db.get<any>(
    'SELECT * FROM videos WHERE id = ? AND is_deleted = 0',
    [postId]
  );
  if (!post) {
    throw { status: 404, message: 'Publicación no encontrada.' };
  }

  // Si no es premium / exclusiva, tiene acceso público
  if (!post.is_premium || !post.price_coins || post.price_coins <= 0) {
    return {
      hasAccess: true,
      isAuthor: false,
      isPurchased: false,
      post,
      mediaUrl: post.video_url,
    };
  }

  if (!userId) {
    return {
      hasAccess: false,
      isAuthor: false,
      isPurchased: false,
      post,
      mediaUrl: null, // REQUISITO: Ocultar URL original del archivo a no autenticados
    };
  }

  // Comprobar si es el autor o admin
  const user = await db.get<any>('SELECT role FROM users WHERE id = ?', [userId]);
  const isAdmin = user?.role === 'admin';

  let authorUserId = post.tarotista_id;
  const authorProfile = await db.get<any>(
    'SELECT user_id FROM tarotista_profiles WHERE id = ? OR user_id = ?',
    [post.tarotista_id, post.tarotista_id]
  );
  if (authorProfile) authorUserId = authorProfile.user_id;

  const isAuthor = userId === authorUserId || userId === post.tarotista_id;
  if (isAuthor || isAdmin) {
    return {
      hasAccess: true,
      isAuthor,
      isPurchased: false,
      post,
      mediaUrl: post.video_url,
    };
  }

  // Comprobar si compró la publicación
  const unlock = await db.get<any>(
    'SELECT * FROM post_unlocks WHERE user_id = ? AND post_id = ? AND is_refunded = 0',
    [userId, postId]
  );

  const isPurchased = !!unlock;
  return {
    hasAccess: isPurchased,
    isAuthor: false,
    isPurchased,
    post,
    mediaUrl: isPurchased ? post.video_url : null,
  };
}

// ----------------------------------------------------------------------------
// 7. HISTORIAL "MIS COMPRAS" (CONTENIDO DESBLOQUEADO PRIVADO)
// ----------------------------------------------------------------------------

export async function getUserUnlockedPurchases(userId: string): Promise<PostUnlock[]> {
  const db = await getDb();
  const rows = await db.query<any>(
    `SELECT u.*, 
            v.title as post_title, 
            v.thumbnail_url as post_thumbnail, 
            v.video_url, 
            v.media_type, 
            v.tarotista_name as author_name,
            v.is_withdrawn,
            v.withdrawal_reason
     FROM post_unlocks u
     JOIN videos v ON u.post_id = v.id
     WHERE u.user_id = ? AND u.is_refunded = 0
     ORDER BY u.unlocked_at DESC`,
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    postId: r.post_id,
    authorId: r.author_id,
    coinsPaid: r.coins_paid,
    priceCoins: r.coins_paid,
    platformFeeCoins: r.platform_fee_coins,
    tarotistaEarningsCoins: r.tarotista_earnings_coins,
    unlockedAt: r.unlocked_at,
    isRefunded: !!r.is_refunded,
    refundedAt: r.refunded_at || undefined,
    refundReason: r.refund_reason || undefined,
    postTitle: r.post_title,
    postThumbnail: r.post_thumbnail,
    authorName: r.author_name,
    mediaType: r.media_type,
    videoUrl: r.video_url, // Disponible porque este endpoint es privado y solo devuelve las compras validadas del usuario
  }));
}

// ----------------------------------------------------------------------------
// 8. DEVOLUCIONES COMPENSATORIAS Y POLÍTICA DE RETIRADA
// ----------------------------------------------------------------------------

export async function refundPostUnlock(params: {
  unlockId: string;
  adminUserId: string;
  reason: string;
}): Promise<{
  success: boolean;
  refundAmountCoins: number;
  refundCoins: number;
  buyerBalanceAfter: number;
  authorBalanceAfter: number;
}> {
  const db = await getDb();
  const { unlockId, adminUserId, reason } = params;

  const unlock = await db.get<any>('SELECT * FROM post_unlocks WHERE id = ?', [unlockId]);
  if (!unlock) {
    throw { status: 404, message: 'Registro de compra no encontrado.' };
  }

  if (unlock.is_refunded === 1) {
    throw { status: 400, code: 'ALREADY_REFUNDED', message: 'Esta compra ya fue reembolsada con anterioridad.' };
  }

  const coinsToRefund = unlock.coins_paid;
  const authorEarnings = unlock.tarotista_earnings_coins;
  const now = new Date().toISOString();

  await db.run('BEGIN TRANSACTION');
  try {
    // 1. Deducir compensatoriamente del autor sin saldo negativo
    const author = await db.get<any>('SELECT coins_balance, earnings_coins_balance FROM users WHERE id = ?', [unlock.author_id]);
    const currentAuthorBal = author ? author.coins_balance : 0;
    const deductAuthor = Math.min(currentAuthorBal, authorEarnings);

    await db.run(
      `UPDATE users 
       SET coins_balance = MAX(0, coins_balance - ?),
           earnings_coins_balance = MAX(0, earnings_coins_balance - ?),
           financial_restriction = CASE WHEN ? > coins_balance THEN 1 ELSE financial_restriction END,
           updated_at = ?
       WHERE id = ?`,
      [deductAuthor, deductAuthor, authorEarnings, now, unlock.author_id]
    );

    // 2. Restaurar monedas al comprador
    await db.run(
      'UPDATE users SET coins_balance = coins_balance + ?, updated_at = ? WHERE id = ?',
      [coinsToRefund, now, unlock.user_id]
    );

    // 3. Marcar como reembolsado
    await db.run(
      'UPDATE post_unlocks SET is_refunded = 1, refunded_at = ?, refund_reason = ? WHERE id = ?',
      [now, `${reason} (por admin ${adminUserId})`, unlockId]
    );

    const updatedBuyer = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [unlock.user_id]);
    const updatedAuthor = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [unlock.author_id]);

    // 4. Asientos compensatorios en el Libro Mayor
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'post_unlock_refund', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        `tx_ref_b_${unlockId}`,
        unlock.user_id,
        coinsToRefund,
        updatedBuyer.coins_balance,
        `Reembolso compensatorio por compra #${unlockId}: ${reason}`,
        unlockId,
        now,
      ]
    );

    if (deductAuthor > 0) {
      await db.run(
        `INSERT INTO ledger (
          id, user_id, type, amount_coins, amount_cents, amount_eur,
          balance_after, description, reference_id, timestamp, status
        ) VALUES (?, ?, 'compensatory_adjustment', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
        [
          `tx_ref_a_${unlockId}`,
          unlock.author_id,
          -deductAuthor,
          updatedAuthor.coins_balance,
          `Ajuste compensatorio por devolución de compra #${unlockId}`,
          unlockId,
          now,
        ]
      );
    }

    await db.run('COMMIT');

    return {
      success: true,
      refundAmountCoins: coinsToRefund,
      refundCoins: coinsToRefund,
      buyerBalanceAfter: updatedBuyer.coins_balance,
      authorBalanceAfter: updatedAuthor ? updatedAuthor.coins_balance : 0,
    };
  } catch (err) {
    try {
      await db.run('ROLLBACK');
    } catch {}
    throw err;
  }
}

// ----------------------------------------------------------------------------
// 9. RETIRADA CONTROLADA DE PUBLICACIÓN
// ----------------------------------------------------------------------------

export async function withdrawPost(params: {
  postId: string;
  userId: string;
  reason?: string;
  isAdmin?: boolean;
}): Promise<{ withdrawn: boolean; postId: string; withdrawnAt: string; reason: string }> {
  const db = await getDb();
  const { postId, userId, reason, isAdmin } = params;

  const post = await db.get<any>('SELECT * FROM videos WHERE id = ? AND is_deleted = 0', [postId]);
  if (!post) {
    throw { status: 404, message: 'Publicación no encontrada.' };
  }

  let authorUserId = post.tarotista_id;
  const authorProfile = await db.get<any>(
    'SELECT user_id FROM tarotista_profiles WHERE id = ? OR user_id = ?',
    [post.tarotista_id, post.tarotista_id]
  );
  if (authorProfile) authorUserId = authorProfile.user_id;

  if (userId !== authorUserId && userId !== post.tarotista_id && !isAdmin) {
    throw { status: 403, message: 'Solo el autor o un administrador pueden retirar esta publicación.' };
  }

  const now = new Date().toISOString();
  const safeReason = reason || 'Retirada por el autor';
  await db.run(
    'UPDATE videos SET is_withdrawn = 1, withdrawn_at = ?, withdrawal_reason = ? WHERE id = ?',
    [now, safeReason, postId]
  );

  return {
    withdrawn: true,
    postId,
    withdrawnAt: now,
    reason: safeReason,
  };
}
