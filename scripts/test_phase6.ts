// Native fetch and FormData in Node.js v24
import { getDb, initDatabase } from '../src/db/database';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3001';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

class SessionClient {
  private cookies: Map<string, string> = new Map();
  public user: any = null;

  constructor(public email: string, public name: string) {}

  private getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private saveCookies(res: any) {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
    if (raw && raw.length > 0) {
      for (const str of raw) {
        const parts = str.split(';')[0].split('=');
        if (parts.length >= 2) {
          this.cookies.set(parts[0].trim(), parts.slice(1).join('=').trim());
        }
      }
    }
  }

  async request(path: string, options: any = {}) {
    const headers = {
      ...(options.headers || {}),
      Cookie: this.getCookieHeader(),
    };
    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Buffer)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers, body });
    this.saveCookies(res);
    let data: any = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, ok: res.ok, data, headers: res.headers };
  }

  async register(password: string = 'Password123!', role: string = 'cliente') {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: {
        name: this.name,
        email: this.email,
        password,
        role,
        isAgeVerified: true,
      },
    });
    if (res.ok && res.data.user) {
      this.user = res.data.user;
    }
    return res;
  }

  async login(password: string = 'Password123!') {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: {
        email: this.email,
        password,
      },
    });
    if (res.ok && res.data.user) {
      this.user = res.data.user;
    }
    return res;
  }
}

async function sendWebhookEvent(event: any, signature: string = 'mock_valid_signature') {
  const res = await fetch(`${BASE_URL}/api/stripe/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
      'x-kabaly-test-webhook': 'true',
    },
    body: JSON.stringify(event),
  });
  let data: any = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`⏳ Running: ${name}... `);
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ PASSED`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message, details: err.stack });
    console.log(`❌ FAILED: ${err.message}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('  KABALY - SUITE DE PRUEBAS DE ACEPTACIÓN FASE 6');
  console.log('  Monedero Persistente, Stripe Checkout y Control Contable');
  console.log('================================================================\n');

  await initDatabase();
  const db = await getDb();

  const timestamp = Date.now();
  const clientA = new SessionClient(`phase6_userA_${timestamp}@kabaly.test`, 'Usuario Alpha');
  const clientB = new SessionClient(`phase6_userB_${timestamp}@kabaly.test`, 'Usuario Beta');
  const adminClient = new SessionClient(`phase6_admin_${timestamp}@kabaly.test`, 'Admin Supremo');

  let testPackage: any = null;
  let orderA: any = null;

  // TEST 1: Registro de usuarios y verificación de saldo inicial exacto = 0 monedas
  await runTest('1. Usuarios nuevos inician con monedero vacío (0 monedas reales)', async () => {
    const regA = await clientA.register();
    assert(regA.ok, `No se pudo registrar clientA: ${JSON.stringify(regA.data)}`);
    assert(regA.data.user.coinsBalance === 0, `El saldo inicial debe ser 0, pero fue ${regA.data.user.coinsBalance}`);

    const regB = await clientB.register();
    assert(regB.ok, `No se pudo registrar clientB: ${JSON.stringify(regB.data)}`);
    assert(regB.data.user.coinsBalance === 0, `El saldo de clientB debe ser 0`);

    const regAdmin = await adminClient.register('Password123!', 'cliente');
    assert(regAdmin.ok, `No se pudo registrar adminClient: ${JSON.stringify(regAdmin.data)}`);

    // Promover cuenta de administración para test de conciliación auditada
    await db.run("UPDATE users SET role = 'admin' WHERE id = ?", [adminClient.user.id]);
  });

  // TEST 2: Bloqueo de rutas antiguas y no autorizadas (anti-creación de saldo fraudulento)
  await runTest('2. Rutas antiguas o no auditadas deben estar bloqueadas (400/403)', async () => {
    const topupRes = await clientA.request('/api/coins/topup', {
      method: 'POST',
      body: { packageId: 'pack_bronze', amount: 100 },
    });
    assert(topupRes.status === 400, `Topup legacy debió devolver 400, devolvió ${topupRes.status}`);

    const withdrawRes = await clientA.request('/api/tarotistas/withdraw', {
      method: 'POST',
      body: { amount: 50 },
    });
    assert(withdrawRes.status === 403, `Withdrawal no autorizado debió devolver 403, devolvió ${withdrawRes.status}`);

    const giftRes = await clientA.request('/api/streams/stream_1/gift', {
      method: 'POST',
      body: { giftId: 'gift_lotus' },
    });
    assert(giftRes.status === 403, `Gift deshabilitado debió devolver 403, devolvió ${giftRes.status}`);

    const unlockRes = await clientA.request('/api/videos/vid_1/unlock', {
      method: 'POST',
    });
    assert(unlockRes.status === 403, `Unlock deshabilitado debió devolver 403, devolvió ${unlockRes.status}`);

    const bookRes = await clientA.request('/api/consultations/book', {
      method: 'POST',
      body: { tarotistaId: 'tarot_1', minutes: 15 },
    });
    assert(bookRes.status === 403, `Book consulta deshabilitada debió devolver 403, devolvió ${bookRes.status}`);
  });

  // TEST 3: Catálogo oficial de paquetes gestionado exclusivamente en servidor
  await runTest('3. Catálogo de paquetes oficial obtenido desde el servidor con precios y enteros', async () => {
    const res = await clientA.request('/api/coins/packages');
    assert(res.ok, 'No se pudo obtener el catálogo');
    assert(Array.isArray(res.data.packages), 'packages debe ser un array');
    assert(res.data.packages.length >= 4, `Debe haber al menos 4 paquetes, hay ${res.data.packages.length}`);
    assert(res.data.testMode === true, 'El catálogo debe indicar modo de prueba');

    testPackage = res.data.packages.find((p: any) => p.id === 'pack_iniciacion');
    assert(testPackage, 'Debe existir el paquete pack_iniciacion');
    assert(Number.isInteger(testPackage.coins), 'Las monedas del paquete deben ser enteras');
    assert(Number.isInteger(testPackage.priceCents), 'El precio en céntimos debe ser entero');
    assert(testPackage.coins === 100, `pack_iniciacion debe tener 100 monedas, tiene ${testPackage.coins}`);
    assert(testPackage.priceCents === 999, `pack_iniciacion debe costar 999 céntimos, cuesta ${testPackage.priceCents}`);
  });

  // TEST 4: Rechazo de manipulación de paquete o precio por el navegador
  await runTest('4. Rechazar pedidos con packageId inexistente o manipulado', async () => {
    const fakeRes = await clientA.request('/api/coins/checkout', {
      method: 'POST',
      body: {
        packageId: 'pack_hacker_manipulated_123',
        priceCents: 1, // Manipulación del cliente ignorada o rechazada
        coins: 999999,
      },
    });
    assert(
      fakeRes.status === 400 || fakeRes.status === 404,
      `Debió rechazar paquete inexistente con 400 o 404, dio ${fakeRes.status}`
    );
  });

  // TEST 5: Creación de sesión de Stripe Checkout y pedido pendiente con snapshot inmutable
  await runTest('5. Creación de pedido en servidor con snapshot inmutable e idempotencia', async () => {
    const idempotencyKey = `idem_${timestamp}_1`;
    const res = await clientA.request('/api/coins/checkout', {
      method: 'POST',
      body: {
        packageId: testPackage.id,
        idempotencyKey,
      },
    });

    assert(res.status === 201, `Checkout debió responder 201, devolvió ${res.status}: ${JSON.stringify(res.data)}`);
    assert(res.data.order, 'Debe devolver el objeto order');
    assert(res.data.order.status === 'pending', 'El pedido nuevo debe estar en pending');
    assert(res.data.order.coins === testPackage.coins, 'Snapshot de monedas debe coincidir exactamente');
    assert(res.data.order.amountCents === testPackage.priceCents, 'Snapshot de céntimos debe coincidir');
    assert(res.data.sessionId, 'Debe devolver el sessionId de Stripe');
    assert(res.data.checkoutUrl, 'Debe devolver la URL de Stripe Checkout');

    orderA = res.data.order;

    // Probar idempotencia de checkout: enviar la misma clave debe devolver la misma orden sin duplicar
    const retryRes = await clientA.request('/api/coins/checkout', {
      method: 'POST',
      body: {
        packageId: testPackage.id,
        idempotencyKey,
      },
    });
    assert(retryRes.status === 201, 'Reintento con misma idempotencyKey debe responder 201');
    assert(retryRes.data.order.id === orderA.id, 'Debe devolver el mismo pedido existente');
  });

  // TEST 6: Acceso directo a la página de retorno sin confirmación de webhook (NO crea monedas)
  await runTest('6. Acceso directo a /api/coins/orders/:id sin pago confirmado NO acredita monedas', async () => {
    const checkRes = await clientA.request(`/api/coins/orders/${orderA.id}`);
    assert(checkRes.ok, 'Debe permitir consultar el estado del pedido');
    assert(checkRes.data.order.status === 'pending', 'El pedido debe continuar en pending');

    // Verificar en /api/state que el saldo sigue en 0
    const stateRes = await clientA.request('/api/state');
    assert(stateRes.data.currentUser.coinsBalance === 0, 'El saldo del usuario NO debe haber aumentado');
  });

  // TEST 7: Rechazo de webhook con firma inválida
  await runTest('7. Rechazo de webhook de Stripe con firma inválida (400 Bad Request)', async () => {
    const invalidEvent = {
      id: `evt_invalid_${timestamp}`,
      type: 'checkout.session.completed',
      data: { object: { id: orderA.stripeSessionId } },
    };
    const res = await sendWebhookEvent(invalidEvent, 'invalid_signature_test');
    assert(res.status === 400, `Debió responder 400 ante firma inválida, dio ${res.status}`);
  });

  // TEST 8: Acreditación exacta y coherente tras webhook exitoso (checkout.session.completed)
  let successfulCompletedEvent: any = null;
  await runTest('8. Confirmación vía webhook: acreditación exacta, registro en ledger y processed_stripe_events', async () => {
    successfulCompletedEvent = {
      id: `evt_comp_${timestamp}_1`,
      type: 'checkout.session.completed',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: orderA.stripeSessionId,
          payment_status: 'paid',
          amount_total: orderA.amountCents,
          currency: 'eur',
          payment_intent: `pi_test_${timestamp}_1`,
          metadata: {
            orderId: orderA.id,
            userId: clientA.user.id,
            packageId: testPackage.id,
          },
        },
      },
    };

    const webhookRes = await sendWebhookEvent(successfulCompletedEvent);
    assert(webhookRes.ok, `Webhook debió responder ok, devolvió ${webhookRes.status}: ${JSON.stringify(webhookRes.data)}`);

    // Comprobar estado del pedido
    const orderCheck = await clientA.request(`/api/coins/orders/${orderA.id}`);
    assert(orderCheck.data.order.status === 'paid', `El pedido debe estar 'paid', está '${orderCheck.data.order.status}'`);

    // Comprobar saldo del usuario
    const stateRes = await clientA.request('/api/state');
    assert(
      stateRes.data.currentUser.coinsBalance === testPackage.coins,
      `El saldo debe ser exactamente ${testPackage.coins}, es ${stateRes.data.currentUser.coinsBalance}`
    );
    assert(
      stateRes.data.currentUser.purchasedCoinsBalance === testPackage.coins,
      `El saldo de monedas compradas debe ser ${testPackage.coins}`
    );

    // Comprobar entrada en el libro mayor (Ledger)
    const ledgerRes = await clientA.request('/api/wallet/ledger?limit=10');
    assert(ledgerRes.ok, 'Debe obtener movimientos del ledger');
    assert(ledgerRes.data.transactions.length >= 1, 'Debe haber al menos 1 transacción en el ledger');
    const tx = ledgerRes.data.transactions[0];
    assert(tx.type === 'topup', `El tipo de movimiento debe ser 'topup', fue '${tx.type}'`);
    assert(tx.amountCoins === testPackage.coins, `Las monedas registradas deben ser ${testPackage.coins}`);
    assert(tx.amountCents === testPackage.priceCents, `El importe en céntimos debe ser ${testPackage.priceCents}`);
    assert(tx.balanceAfter === testPackage.coins, `El balance_after debe ser ${testPackage.coins}`);
  });

  // TEST 9: Idempotencia estricta ante eventos repetidos, concurrentes o reintentos
  await runTest('9. Idempotencia: eventos repetidos y concurrentes NO acreditan monedas duplicadas', async () => {
    // 1. Reintento simple del mismo evento
    const duplicateRes = await sendWebhookEvent(successfulCompletedEvent);
    assert(duplicateRes.ok, 'El reintento del webhook debe ser respondido con éxito');
    assert(
      duplicateRes.data.alreadyProcessed === true || duplicateRes.data.action === 'already_processed' || duplicateRes.data.action === 'order_already_paid',
      'El servidor debe señalar que el evento ya estaba procesado'
    );

    // 2. Disparo concurrente múltiple
    await Promise.all([
      sendWebhookEvent(successfulCompletedEvent),
      sendWebhookEvent(successfulCompletedEvent),
      sendWebhookEvent(successfulCompletedEvent),
    ]);

    // Verificar que el saldo NO se duplicó ni triplicó
    const stateRes = await clientA.request('/api/state');
    assert(
      stateRes.data.currentUser.coinsBalance === testPackage.coins,
      `El saldo debe seguir inmutablemente en ${testPackage.coins}, pero es ${stateRes.data.currentUser.coinsBalance}`
    );

    // Verificar que el ledger sigue conteniendo solo 1 recarga
    const ledgerRes = await clientA.request('/api/wallet/ledger?limit=10');
    const purchases = ledgerRes.data.transactions.filter((t: any) => t.type === 'topup');
    assert(purchases.length === 1, `Debe haber exactamente 1 transacción de recarga, hay ${purchases.length}`);
  });

  // TEST 10: Soporte de pagos con confirmación diferida (async_payment_succeeded)
  let orderB: any = null;
  await runTest('10. Pagos con confirmación diferida (checkout.session.async_payment_succeeded)', async () => {
    // Iniciar compra para clientB
    const checkoutB = await clientB.request('/api/coins/checkout', {
      method: 'POST',
      body: { packageId: 'pack_iniciacion' }, // 100 monedas, 999 céntimos
    });
    assert(checkoutB.status === 201, `Checkout para clientB debe responder 201: ${JSON.stringify(checkoutB.data)}`);
    orderB = checkoutB.data.order;

    const asyncEvent = {
      id: `evt_async_${timestamp}`,
      type: 'checkout.session.async_payment_succeeded',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: orderB.stripeSessionId,
          payment_status: 'paid',
          amount_total: orderB.amountCents,
          currency: 'eur',
          payment_intent: `pi_async_${timestamp}`,
          metadata: {
            orderId: orderB.id,
            userId: clientB.user.id,
            packageId: orderB.packageId,
          },
        },
      },
    };

    const res = await sendWebhookEvent(asyncEvent);
    assert(res.ok, 'Webhook diferido debe procesarse correctamente');

    const stateB = await clientB.request('/api/state');
    assert(stateB.data.currentUser.coinsBalance === 100, `El saldo de clientB debe ser 100, fue ${stateB.data.currentUser.coinsBalance}`);
  });

  // TEST 11: Abandono y caducidad de pedido (checkout.session.expired)
  await runTest('11. Abandono o expiración de pedido libera la reserva sin acreditar saldo', async () => {
    const expiredCheckout = await clientB.request('/api/coins/checkout', {
      method: 'POST',
      body: { packageId: 'pack_iniciacion' },
    });
    const expOrder = expiredCheckout.data.order;

    const expiredEvent = {
      id: `evt_exp_${timestamp}`,
      type: 'checkout.session.expired',
      data: {
        object: {
          id: expOrder.stripeSessionId,
          metadata: { orderId: expOrder.id, userId: clientB.user.id },
        },
      },
    };

    const expRes = await sendWebhookEvent(expiredEvent);
    assert(expRes.ok, 'Webhook de expiración debe ser procesado');

    const orderCheck = await clientB.request(`/api/coins/orders/${expOrder.id}`);
    assert(orderCheck.data.order.status === 'expired', `El pedido debe estar marcado como expired, está ${orderCheck.data.order.status}`);

    const stateB = await clientB.request('/api/state');
    assert(stateB.data.currentUser.coinsBalance === 100, 'El saldo no debe haber cambiado tras la caducidad');
  });

  // TEST 12: Límites de gasto responsable en servidor con reservas activas
  await runTest('12. Límites de gasto diario/semanal en UTC y control de reservas concurrentes', async () => {
    // Configurar límite diario de 10 € en clientA (que ya gastó 9.99 € hoy en el Test 8)
    const limitSet = await clientA.request('/api/users/limits', {
      method: 'POST',
      body: { dailyEur: 10, weeklyEur: 50 },
    });
    assert(limitSet.ok, 'Debe configurar los límites de gasto');

    // Intentar comprar un segundo paquete de 9.99 € (pack_iniciacion).
    // Gasto acumulado hoy: 9.99 € + 9.99 € = 19.98 € > 10.00 € límite -> Debe ser RECHAZADO por el servidor
    const overLimitRes = await clientA.request('/api/coins/checkout', {
      method: 'POST',
      body: { packageId: 'pack_iniciacion' },
    });
    assert(
      overLimitRes.status === 422 || overLimitRes.status === 400,
      `Debió rechazar por límite diario superado (422/400), dio ${overLimitRes.status}`
    );
    assert(
      overLimitRes.data.error.includes('límite de gasto diario'),
      `El mensaje de error debe mencionar el límite diario: ${overLimitRes.data.error}`
    );

    // Incrementar el límite diario a 30 €
    const limitUpdate = await clientA.request('/api/users/limits', {
      method: 'POST',
      body: { dailyEur: 30, weeklyEur: 50 },
    });
    assert(limitUpdate.ok, 'Debe actualizar el límite diario');

    // Ahora la compra sí debe ser permitida
    const allowedRes = await clientA.request('/api/coins/checkout', {
      method: 'POST',
      body: { packageId: 'pack_iniciacion' },
    });
    assert(allowedRes.status === 201, `Ahora con límite ampliado debió responder 201, devolvió ${allowedRes.status}`);
  });

  // TEST 13: Privacidad y estricto aislamiento entre usuarios
  await runTest('13. Aislamiento de privacidad: un usuario no puede ver pedidos ni movimientos ajenos', async () => {
    // clientB intenta ver el pedido de clientA
    const unauthorizedOrderRes = await clientB.request(`/api/coins/orders/${orderA.id}`);
    assert(unauthorizedOrderRes.status === 403, `Consulta de pedido ajeno debió dar 403, dio ${unauthorizedOrderRes.status}`);

    // clientB solo ve sus propios movimientos de monedero
    const bLedger = await clientB.request('/api/wallet/ledger');
    assert(bLedger.ok, 'ClientB puede ver su ledger');
    const allUserIds = bLedger.data.transactions.map((t: any) => t.userId);
    const hasOtherUsers = allUserIds.some((id: string) => id !== clientB.user.id);
    assert(!hasOtherUsers, 'El libro mayor no debe exponer movimientos de otros usuarios');
  });

  // TEST 14: Reembolso simulado (charge.refunded) con movimiento compensatorio y prevención de saldos negativos
  await runTest('14. Reembolso: descuento compensatorio idempotente, protección contra saldos negativos y restricción financiera', async () => {
    // clientB tiene 100 monedas de pack_iniciacion. Simulamos reembolso de su pedido
    const refundEvent = {
      id: `evt_ref_${timestamp}`,
      type: 'charge.refunded',
      data: {
        object: {
          id: `ch_test_${timestamp}`,
          payment_intent: `pi_async_${timestamp}`,
          amount_refunded: 999,
          currency: 'eur',
        },
      },
    };

    const refundRes = await sendWebhookEvent(refundEvent);
    assert(refundRes.ok, `El reembolso debe ser procesado con 200: ${JSON.stringify(refundRes.data)}`);

    // Comprobar que a clientB se le restaron exactamente las 100 monedas (saldo = 0, no negativo)
    const stateB = await clientB.request('/api/state');
    assert(stateB.data.currentUser.coinsBalance === 0, `El saldo debe haber quedado en 0 tras reembolso, es ${stateB.data.currentUser.coinsBalance}`);

    // Comprobar movimiento compensatorio en ledger
    const bLedger = await clientB.request('/api/wallet/ledger');
    const refundTx = bLedger.data.transactions.find((t: any) => t.type === 'refund');
    assert(refundTx, 'Debe existir una transacción de tipo refund en el ledger');
    assert(refundTx.amountCoins === -100, `El importe en monedas debe ser -100, fue ${refundTx.amountCoins}`);

    // Idempotencia del reembolso: si Stripe reintenta el evento de reembolso, no debe descontar saldo otra vez
    const dupRefundRes = await sendWebhookEvent(refundEvent);
    assert(dupRefundRes.ok, 'Reintento de reembolso debe responder 200');
    assert(
      dupRefundRes.data.alreadyProcessed === true || dupRefundRes.data.action === 'already_processed',
      'Debe detectar evento de reembolso duplicado'
    );
    const stateB2 = await clientB.request('/api/state');
    assert(stateB2.data.currentUser.coinsBalance === 0, 'El saldo no debe volverse negativo tras reintento');
  });

  // TEST 15: Conciliación contable para auditores y administradores
  await runTest('15. Herramienta de conciliación contable (Reconciliation Engine)', async () => {
    // Comprobar que usuario no-admin no puede acceder a la conciliación
    const nonAdminRes = await clientA.request('/api/admin/reconciliation');
    assert(nonAdminRes.status === 403, `Usuario estándar debió recibir 403, recibió ${nonAdminRes.status}`);

    // Consultar conciliación como administrador
    const adminRes = await adminClient.request('/api/admin/reconciliation');
    assert(adminRes.ok, `Admin debió obtener el informe de conciliación: ${JSON.stringify(adminRes.data)}`);
    const report = adminRes.data.report;
    assert(report, 'Debe devolver el informe de conciliación');
    assert(report.totalUsersAudited > 0, 'Debe haber auditado usuarios');
    assert(report.isBalanced === true, `El sistema contable debe estar equilibrado: ${JSON.stringify(report.discrepancies)}`);
    assert(report.discrepancies.length === 0, `No debe haber discrepancias contables, hay ${report.discrepancies.length}`);
  });

  // TEST 16: Persistencia directa en base de datos SQLite tras operaciones
  await runTest('16. Persistencia en base de datos SQLite y auditoría de tablas de la Fase 6', async () => {
    const ordersCount = await db.get<{ c: number }>('SELECT count(*) as c FROM coin_orders');
    assert(ordersCount && ordersCount.c >= 3, `Debe haber al menos 3 pedidos registrados en SQLite, hay ${ordersCount?.c}`);

    const ledgerCount = await db.get<{ c: number }>('SELECT count(*) as c FROM ledger');
    assert(ledgerCount && ledgerCount.c >= 2, `Debe haber al menos 2 movimientos en ledger, hay ${ledgerCount?.c}`);

    const eventsCount = await db.get<{ c: number }>('SELECT count(*) as c FROM processed_stripe_events');
    assert(eventsCount && eventsCount.c >= 3, `Debe haber al menos 3 eventos de Stripe en processed_stripe_events, hay ${eventsCount?.c}`);
  });

  // RESUMEN FINAL
  console.log('\n================================================================');
  console.log('  RESUMEN DE PRUEBAS DE ACEPTACIÓN - FASE 6');
  console.log('================================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  for (const r of results) {
    console.log(`${r.passed ? '  ✅' : '  ❌'} ${r.name}`);
    if (r.error) {
      console.log(`     Error: ${r.error}`);
    }
  }

  console.log(`\nTotal: ${results.length} | Aprobadas: ${passed} | Fallidas: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 ¡TODAS LAS PRUEBAS DE LA FASE 6 HAN SIDO SATISFECHAS EXITOSAMENTE!\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
