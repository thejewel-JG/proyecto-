/**
 * KABALY - Phase 8 Acceptance Tests
 * Test Suite for Private 1:1 Consultations, Hold Reserves, Settlements, Private Rooms & Reviews
 */

import { getDb, initDatabase } from '../src/db/database';
import {
  createConsultationBooking,
  acceptConsultation,
  rejectConsultation,
  cancelConsultation,
  startConsultation,
  completeConsultation,
  createConsultationDispute,
  resolveConsultationDispute,
  sendConsultationMessage,
  getConsultationMessages,
  getConsultationRoomCredentials,
  createConsultationReview,
  autoExpireConsultations,
} from '../src/services/consultationService';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:3001';

async function runPhase8Tests() {
  console.log('🔮 ========================================================');
  console.log('🔮 KABALY - FASE 8: SUITE DE PRUEBAS DE ACEPTACIÓN');
  console.log('🔮 ========================================================\n');

  await initDatabase();
  const db = await getDb();
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (detail) console.error(`     Detalle: ${detail}`);
      failedCount++;
      throw new Error(`Prueba fallida: ${testName}`);
    }
  }

  // --------------------------------------------------------------------------
  // PREPARACIÓN DE ENTIDADES DE PRUEBA
  // --------------------------------------------------------------------------
  console.log('📋 Preparando cuentas de prueba (Cliente A, Tarotista B, Ajeno C, Admin D)...');

  const idA = 'test_p8_client_a';
  const idB = 'test_p8_tarotista_b';
  const profileIdB = 'profile_p8_tarotista_b';
  const idC = 'test_p8_outsider_c';
  const idAdmin = 'test_p8_admin_d';

  // Limpiar datos previos si existen
  await db.run('DELETE FROM consultation_disputes WHERE consultation_id IN (SELECT id FROM consultations WHERE client_id = ? OR client_id = ?)', [idA, idC]);
  await db.run('DELETE FROM consultation_messages WHERE consultation_id IN (SELECT id FROM consultations WHERE client_id = ? OR client_id = ?)', [idA, idC]);
  await db.run('DELETE FROM reviews WHERE client_id = ? OR tarotista_id = ?', [idA, profileIdB]);
  await db.run('DELETE FROM ledger WHERE user_id IN (?, ?, ?, ?)', [idA, idB, idC, idAdmin]);
  await db.run('DELETE FROM live_streams WHERE tarotista_id = ?', [idB]);
  await db.run('DELETE FROM consultations WHERE client_id = ? OR tarotista_id = ?', [idA, profileIdB]);
  await db.run('DELETE FROM tarotista_profiles WHERE id = ?', [profileIdB]);
  await db.run('DELETE FROM users WHERE id IN (?, ?, ?, ?)', [idA, idB, idC, idAdmin]);

  const now = new Date().toISOString();

  // 1. Cliente A: 500 monedas disponibles
  await db.run(
    `INSERT INTO users (id, email, password_hash, name, role, coins_balance, coins_reserved, purchased_coins_balance, earnings_coins_balance, created_at, updated_at)
     VALUES (?, 'clientA@test.com', 'hash', 'Cliente A', 'cliente', 500, 0, 500, 0, ?, ?)`,
    [idA, now, now]
  );

  // 2. Tarotista B: 0 monedas, rol tarotista
  await db.run(
    `INSERT INTO users (id, email, password_hash, name, role, coins_balance, coins_reserved, purchased_coins_balance, earnings_coins_balance, created_at, updated_at)
     VALUES (?, 'tarotistaB@test.com', 'hash', 'Tarotista B', 'tarotista', 0, 0, 0, 0, ?, ?)`,
    [idB, now, now]
  );

  // Perfil profesional de Tarotista B: tarifa 20 monedas/min, 20% comisión
  await db.run(
    `INSERT INTO tarotista_profiles (id, user_id, professional_name, specialties, bio, price_per_min_coins, rating_average, total_reviews, availability_status, custom_commission_percentage, created_at, languages)
     VALUES (?, ?, 'Tarotista B Profesional', 'Tarot de Marsella', 'Tarotista profesional verificado', 20, 5.0, 0, 'available', 20, ?, 'Español')`,
    [profileIdB, idB, now]
  );

  // 3. Usuario Ajeno C: 500 monedas
  await db.run(
    `INSERT INTO users (id, email, password_hash, name, role, coins_balance, coins_reserved, purchased_coins_balance, earnings_coins_balance, created_at, updated_at)
     VALUES (?, 'outsiderC@test.com', 'hash', 'Usuario C Ajeno', 'cliente', 500, 0, 500, 0, ?, ?)`,
    [idC, now, now]
  );

  // 4. Administrador D
  await db.run(
    `INSERT INTO users (id, email, password_hash, name, role, coins_balance, coins_reserved, purchased_coins_balance, earnings_coins_balance, created_at, updated_at)
     VALUES (?, 'adminD@test.com', 'hash', 'Admin D', 'admin', 0, 0, 0, 0, ?, ?)`,
    [idAdmin, now, now]
  );

  console.log('✅ Cuentas de prueba creadas correctamente.\n');

  // ==========================================================================
  // PRUEBA 1: VALIDACIONES DE CONTRATACIÓN
  // ==========================================================================
  console.log('📌 PRUEBA 1: Validaciones de contratación y reserva...');

  // 1.1 Rechazar auto-contratación (tarotista no puede contratarse a sí mismo)
  try {
    await createConsultationBooking({
      clientId: idB,
      tarotistaId: profileIdB,
      durationMinutes: 15,
      modality: 'video',
    });
    assert(false, 'Auto-contratación debería ser rechazada');
  } catch (err: any) {
    assert(err.status === 400, 'Auto-contratación rechazada con HTTP 400', err.message);
  }

  // 1.2 Rechazar duración no soportada
  try {
    await createConsultationBooking({
      clientId: idA,
      tarotistaId: profileIdB,
      durationMinutes: 99 as any,
      modality: 'video',
    });
    assert(false, 'Duración no permitida debería ser rechazada');
  } catch (err: any) {
    assert(err.status === 400, 'Duración no válida rechazada con HTTP 400', err.message);
  }

  // 1.3 Rechazar si saldo insuficiente
  try {
    // 60 minutos * 20 monedas/min = 1200 monedas (Cliente A solo tiene 500)
    await createConsultationBooking({
      clientId: idA,
      tarotistaId: profileIdB,
      durationMinutes: 60,
      modality: 'video',
    });
    assert(false, 'Saldo insuficiente debería ser rechazado');
  } catch (err: any) {
    assert(err.status === 402, 'Saldo insuficiente rechazado con HTTP 402', err.message);
  }

  // ==========================================================================
  // PRUEBA 2: RESERVA ATÓMICA Y NO-ESCROW INTERNO
  // ==========================================================================
  console.log('\n📌 PRUEBA 2: Reserva atómica de saldo (Contabilidad interna sin doble gasto)...');

  // Cliente A contrata 15 minutos (15 * 20 = 300 monedas)
  const idemKey1 = 'idem_booking_1';
  const booking1 = await createConsultationBooking({
    clientId: idA,
    tarotistaId: profileIdB,
    durationMinutes: 15,
    modality: 'video',
    idempotencyKey: idemKey1,
    notes: 'Pregunta sobre amor y carrera',
  });

  assert(booking1.status === 'solicitada', 'Consulta creada en estado "solicitada"');
  assert(booking1.priceCoins === 300, 'Precio calculado por el servidor exactamente en 300 monedas');
  assert(booking1.ratePerMinuteCoins === 20, 'Tarifa registrada congelada a 20 monedas/min');
  assert(booking1.commissionPercentage === 20, 'Comisión registrada congelada al 20%');

  // Verificar saldo y reserva de Cliente A
  const clientAAfter1 = await db.get<any>('SELECT coins_balance, coins_reserved FROM users WHERE id = ?', [idA]);
  assert(clientAAfter1.coins_balance === 200, 'Saldo disponible de Cliente A disminuyó a 200 (500 - 300)');
  assert(clientAAfter1.coins_reserved === 300, 'Reserva interna en users.coins_reserved es de 300');

  // Verificar apunte en libro mayor
  const ledgerReserve = await db.get<any>(
    "SELECT * FROM ledger WHERE user_id = ? AND type = 'consultation_reserve' AND reference_id = ?",
    [idA, booking1.id]
  );
  assert(!!ledgerReserve, 'Registro de reserva contable creado en el libro mayor');
  assert(Math.abs(ledgerReserve.amount_coins) === 300, 'Importe de reserva en libro mayor es 300');

  // Idempotencia: reintentar con la misma idempotencyKey devuelve la consulta existente sin duplicar la reserva
  const booking1Retry = await createConsultationBooking({
    clientId: idA,
    tarotistaId: profileIdB,
    durationMinutes: 15,
    modality: 'video',
    idempotencyKey: idemKey1,
  });
  assert(booking1Retry.id === booking1.id, 'Idempotencia: reenvío devuelve la misma consulta');
  const clientAAfterRetry = await db.get<any>('SELECT coins_balance, coins_reserved FROM users WHERE id = ?', [idA]);
  assert(clientAAfterRetry.coins_reserved === 300, 'Idempotencia: no se duplicó la reserva de monedas');

  // Doble gasto: Cliente A intenta reservar otra consulta de 300 monedas teniendo solo 200 disponibles
  try {
    await createConsultationBooking({
      clientId: idA,
      tarotistaId: profileIdB,
      durationMinutes: 15,
      modality: 'chat',
    });
    assert(false, 'Doble gasto no fue bloqueado');
  } catch (err: any) {
    assert(err.status === 402, 'Doble gasto bloqueado con saldo insuficiente (402)', err.message);
  }

  // ==========================================================================
  // PRUEBA 3: RECHAZO POR TAROTISTA Y LIBERACIÓN EXACTA DE MONEDAS
  // ==========================================================================
  console.log('\n📌 PRUEBA 3: Rechazo de tarotista y liberación única de la reserva...');

  const rejectedBooking = await rejectConsultation({
    consultationId: booking1.id,
    tarotistaUserId: idB,
    reason: 'Tarotista indispuesto temporalmente',
  });

  assert(rejectedBooking.status === 'rechazada', 'Consulta transitó a "rechazada"');
  assert(rejectedBooking.isRefunded === true, 'Marcada como reembolsada');

  const clientAAfterReject = await db.get<any>('SELECT coins_balance, coins_reserved FROM users WHERE id = ?', [idA]);
  assert(clientAAfterReject.coins_balance === 500, 'Saldo de Cliente A restaurado íntegramente a 500');
  assert(clientAAfterReject.coins_reserved === 0, 'Reserva de Cliente A liberada a 0');

  // Verificar apunte de devolución en libro mayor
  const ledgerRefund1 = await db.get<any>(
    "SELECT * FROM ledger WHERE user_id = ? AND type = 'consultation_refund' AND reference_id = ?",
    [idA, booking1.id]
  );
  assert(!!ledgerRefund1, 'Registro de devolución generado en libro mayor');
  assert(ledgerRefund1.amount_coins === 300, 'Importe devuelto coincide exactamente con la reserva (300)');

  // Reintento de rechazo/cancelación no debe duplicar la devolución
  try {
    await rejectConsultation({
      consultationId: booking1.id,
      tarotistaUserId: idB,
      reason: 'Reintento de rechazo',
    });
    assert(false, 'No se debe permitir rechazar una consulta ya rechazada');
  } catch (err: any) {
    assert(err.status === 400, 'Reintento de rechazo rechazado (400)', err.message);
  }
  const clientAAfterDup = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [idA]);
  assert(clientAAfterDup.coins_balance === 500, 'Saldo no fue incrementado por segundo intento');

  // ==========================================================================
  // PRUEBA 4: CANCELACIÓN POR EL CLIENTE
  // ==========================================================================
  console.log('\n📌 PRUEBA 4: Cancelación por el cliente antes de la aceptación...');

  const booking2 = await createConsultationBooking({
    clientId: idA,
    tarotistaId: profileIdB,
    durationMinutes: 10, // 10 * 20 = 200 monedas
    modality: 'audio',
  });
  assert(booking2.priceCoins === 200, 'Segunda consulta contratada por 200 monedas');

  const cancelledBooking = await cancelConsultation({
    consultationId: booking2.id,
    userId: idA,
    reason: 'Cliente cambió de opinión',
  });
  assert(cancelledBooking.status === 'cancelada', 'Consulta transitó a "cancelada"');
  const clientAAfterCancel = await db.get<any>('SELECT coins_balance, coins_reserved FROM users WHERE id = ?', [idA]);
  assert(clientAAfterCancel.coins_balance === 500, 'Saldo de Cliente A restaurado a 500 tras cancelación');
  assert(clientAAfterCancel.coins_reserved === 0, 'Reserva liberada tras cancelación');

  // ==========================================================================
  // PRUEBA 5: TAREA JANITOR - AUTO-EXPIRACIÓN DE SOLICITUDES ABANDONADAS
  // ==========================================================================
  console.log('\n📌 PRUEBA 5: Tarea del servidor (Janitor) - Expiración por tiempo...');

  const booking3 = await createConsultationBooking({
    clientId: idA,
    tarotistaId: profileIdB,
    durationMinutes: 10,
    modality: 'chat',
  });
  // Simular que pasaron más de 15 minutos fijando expires_at en el pasado
  const pastTime = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  await db.run('UPDATE consultations SET expires_at = ? WHERE id = ?', [pastTime, booking3.id]);

  const janitorResult = await autoExpireConsultations();
  assert(janitorResult.expiredCount >= 1, 'Janitor detectó y procesó solicitud expirada');

  const booking3Exp = await db.get<any>('SELECT status, is_refunded FROM consultations WHERE id = ?', [booking3.id]);
  assert(booking3Exp.status === 'expirada', 'Consulta expirada pasó a status "expirada"');
  assert(booking3Exp.is_refunded === 1, 'Consulta expirada marcada como reembolsada');

  const clientAAfterExpire = await db.get<any>('SELECT coins_balance, coins_reserved FROM users WHERE id = ?', [idA]);
  assert(clientAAfterExpire.coins_balance === 500, 'Saldo restaurado tras expiración automática');
  assert(clientAAfterExpire.coins_reserved === 0, 'Reserva liberada tras expiración');

  // ==========================================================================
  // PRUEBA 6: BLOQUEO DE CONSULTAS SIMULTÁNEAS / SUPERPUESTAS
  // ==========================================================================
  console.log('\n📌 PRUEBA 6: Prevención de consultas simultáneas incompatibles...');

  // Cliente A reserva consulta 4 (15 min = 300 monedas)
  const booking4 = await createConsultationBooking({
    clientId: idA,
    tarotistaId: profileIdB,
    durationMinutes: 15,
    modality: 'video',
  });

  // Tarotista B acepta
  const accepted4 = await acceptConsultation(booking4.id, idB);
  assert(accepted4.status === 'aceptada', 'Tarotista B aceptó la consulta');

  // ==========================================================================
  // PRUEBA 7: AISLAMIENTO CON EMISIÓN PÚBLICA EN DIRECTO
  // ==========================================================================
  console.log('\n📌 PRUEBA 7: Aislamiento estricto con emisión pública en directo...');

  // Simular que el tarotista tiene un directo público activo en live_streams
  await db.run(
    `INSERT INTO live_streams (id, tarotista_id, tarotista_name, title, is_live, started_at)
     VALUES ('live_active_b', ?, 'Tarotista B Profesional', 'Directo Místico Público', 1, ?)`,
    [idB, now]
  );

  // Intentar iniciar la consulta privada mientras el directo está activo -> Bloqueado con 409
  try {
    await startConsultation(booking4.id, idB);
    assert(false, 'No debe iniciarse una consulta privada si el tarotista está emitiendo en directo');
  } catch (err: any) {
    assert(err.status === 409, 'Inicio bloqueado con 409 por directo público activo', err.message);
  }

  // Finalizar el directo público
  await db.run("UPDATE live_streams SET is_live = 0 WHERE id = 'live_active_b'");

  // Iniciar la consulta 4 -> en_curso
  const started4 = await startConsultation(booking4.id, idB);
  assert(started4.status === 'en_curso', 'Consulta 4 inició y está "en_curso"');

  // Usuario Ajeno C reserva consulta 5 con Tarotista B
  const booking5 = await createConsultationBooking({
    clientId: idC,
    tarotistaId: profileIdB,
    durationMinutes: 10,
    modality: 'chat',
  });

  // Tarotista B intenta aceptar la consulta 5 mientras la consulta 4 sigue en curso -> Bloqueado con 409
  try {
    await acceptConsultation(booking5.id, idB);
    assert(false, 'No se debe permitir aceptar consulta superpuesta');
  } catch (err: any) {
    assert(err.status === 409, 'Consulta superpuesta rechazada con HTTP 409 Conflict', err.message);
  }

  // Cancelar la consulta 5 de C para limpiar
  await cancelConsultation({ consultationId: booking5.id, userId: idC, reason: 'Limpieza' });

  // ==========================================================================
  // PRUEBA 8: SALA PRIVADA, CREDENCIALES Y BLOQUEO A TERCEROS
  // ==========================================================================
  console.log('\n📌 PRUEBA 8: Sala privada exclusiva y bloqueo a usuarios ajenos (C)...');

  // Cliente A y Tarotista B en consulta 4
  const credsA = await getConsultationRoomCredentials(booking4.id, idA);
  assert(credsA.participantRole === 'client', 'Cliente A obtiene credenciales de participante');
  assert(credsA.isReady === true, 'Sala privada lista con token seguro');

  const credsB = await getConsultationRoomCredentials(booking4.id, idB);
  assert(credsB.participantRole === 'tarotista', 'Tarotista B obtiene credenciales de participante');

  // Usuario Ajeno C intenta obtener credenciales -> 403 Forbidden
  try {
    await getConsultationRoomCredentials(booking4.id, idC);
    assert(false, 'Usuario C no debe obtener credenciales de la sala de A y B');
  } catch (err: any) {
    assert(err.status === 403, 'Acceso denegado a Usuario C con 403 Forbidden', err.message);
  }

  // Mensajería privada: Cliente A envía mensaje
  const msgA = await sendConsultationMessage({
    consultationId: booking4.id,
    senderId: idA,
    text: 'Hola Tarotista B, ¿qué me dicen las cartas hoy?',
  });
  assert(msgA.text.includes('Hola Tarotista B'), 'Mensaje del cliente guardado en sala privada');

  // Tarotista B responde y comparte una carta de tarot
  const msgB = await sendConsultationMessage({
    consultationId: booking4.id,
    senderId: idB,
    text: 'He sacado El Mago para ti.',
    cardShared: {
      id: 'the_magician',
      name: 'El Mago',
      image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23',
    },
  });
  assert(msgB.cardShared?.name === 'El Mago', 'Mensaje del tarotista con carta de tarot guardado');

  // Usuario C intenta leer mensajes -> 403 Forbidden
  try {
    await getConsultationMessages(booking4.id, idC);
    assert(false, 'Usuario C no debe poder leer mensajes privados');
  } catch (err: any) {
    assert(err.status === 403, 'Lectura de mensajes bloqueada a Usuario C con 403', err.message);
  }

  // Usuario C intenta enviar mensaje -> 403 Forbidden
  try {
    await sendConsultationMessage({
      consultationId: booking4.id,
      senderId: idC,
      text: 'Mensaje espía infiltrado',
    });
    assert(false, 'Usuario C no debe poder enviar mensajes');
  } catch (err: any) {
    assert(err.status === 403, 'Envío de mensaje bloqueado a Usuario C con 403', err.message);
  }

  // ==========================================================================
  // PRUEBA 9: RECARGA, SINCRONIZACIÓN DE TIMESTAMPS Y LIQUIDACIÓN ENTERA
  // ==========================================================================
  console.log('\n📌 PRUEBA 9: Timestamps del servidor y liquidación matemática exacta...');

  // Verificar timestamps de consulta 4
  const cons4Current = await db.get<any>('SELECT started_at, scheduled_end_at, duration_minutes FROM consultations WHERE id = ?', [booking4.id]);
  const startTime = new Date(cons4Current.started_at).getTime();
  const scheduledEndTime = new Date(cons4Current.scheduled_end_at).getTime();
  const diffMinutes = Math.round((scheduledEndTime - startTime) / (60 * 1000));
  assert(diffMinutes === 15, `Duración programada en servidor es exactamente ${diffMinutes} minutos`);

  // Finalizar y liquidar consulta 4
  // 300 monedas totales, 20% comisión:
  // platformFee = Math.round(300 * 0.20) = 60 monedas
  // tarotistaEarnings = 300 - 60 = 240 monedas
  // Suma total conservada: 60 + 240 = 300 monedas
  const completed4 = await completeConsultation(booking4.id, idB, 'Consulta finalizada con éxito');
  assert(completed4.status === 'completada', 'Consulta 4 completada con éxito');
  assert(completed4.isSettled === true, 'Consulta 4 marcada como liquidada');

  // Verificar saldos del Tarotista B
  const tarotistaBAfter = await db.get<any>('SELECT coins_balance, earnings_coins_balance, purchased_coins_balance FROM users WHERE id = ?', [idB]);
  assert(tarotistaBAfter.coins_balance === 240, 'Tarotista B recibió 240 monedas de saldo');
  assert(tarotistaBAfter.earnings_coins_balance === 240, 'Tarotista B tiene 240 monedas de ganancias registradas separadamente');
  assert(tarotistaBAfter.purchased_coins_balance === 0, 'Las ganancias no se mezclaron con monedas compradas (sigue en 0)');

  // Verificar reserva de Cliente A liberada por liquidación
  const clientAAfterSettle = await db.get<any>('SELECT coins_balance, coins_reserved FROM users WHERE id = ?', [idA]);
  assert(clientAAfterSettle.coins_reserved === 0, 'Reserva de Cliente A liquidada (0 monedas retenidas)');

  // Verificar apuntes en Libro Mayor
  const ledgerTarotista = await db.get<any>(
    "SELECT * FROM ledger WHERE user_id = ? AND type = 'consultation_settlement' AND reference_id = ?",
    [idB, booking4.id]
  );
  assert(!!ledgerTarotista, 'Apunte de liquidación registrado para el tarotista');
  assert(ledgerTarotista.amount_coins === 240, 'Importe acreditado en libro mayor es 240');

  const ledgerFee = await db.get<any>(
    "SELECT * FROM ledger WHERE type = 'platform_fee' AND reference_id = ?",
    [booking4.id]
  );
  assert(!!ledgerFee, 'Apunte de comisión de plataforma (platform_fee) registrado');
  assert(ledgerFee.amount_coins === 60, 'Comisión de plataforma es exactamente 60');

  // Idempotencia de liquidación: no volver a acreditar en reintentos
  const reComplete = await completeConsultation(booking4.id, idB);
  assert(reComplete.status === 'completada', 'Reintento de completado devuelve estado completada');
  const tarotistaBAfterRe = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [idB]);
  assert(tarotistaBAfterRe.coins_balance === 240, 'No hubo doble liquidación en reintentos');

  // ==========================================================================
  // PRUEBA 10: RESEÑAS VERIFICADAS Y EXCLUSIVAS
  // ==========================================================================
  console.log('\n📌 PRUEBA 10: Reseñas exclusivas de clientes tras consulta completada...');

  // Tarotista no puede auto-reseñarse
  try {
    await createConsultationReview({
      consultationId: booking4.id,
      clientId: idB,
      clientName: 'Tarotista B',
      clientAvatar: '',
      rating: 5,
      comment: 'Gran sesión conmigo mismo',
    });
    assert(false, 'Tarotista no debe poder auto-reseñarse');
  } catch (err: any) {
    assert(err.status === 403, 'Auto-reseña bloqueada con 403 Forbidden', err.message);
  }

  // Usuario Ajeno C no puede reseñar consulta de otros
  try {
    await createConsultationReview({
      consultationId: booking4.id,
      clientId: idC,
      clientName: 'Usuario C',
      clientAvatar: '',
      rating: 1,
      comment: 'No estuve pero opino',
    });
    assert(false, 'Tercero no debe poder reseñar');
  } catch (err: any) {
    assert(err.status === 403, 'Reseña de tercero bloqueada con 403 Forbidden', err.message);
  }

  // Cliente A deja reseña válida de 5 estrellas
  const reviewA = await createConsultationReview({
    consultationId: booking4.id,
    clientId: idA,
    clientName: 'Cliente A',
    clientAvatar: '',
    rating: 5,
    comment: '¡Increíble precisión! Muy recomendada la consulta.',
  });
  assert(reviewA.rating === 5, 'Reseña de 5 estrellas creada por Cliente A');

  // Cliente A intenta duplicar reseña en la misma consulta -> Bloqueado
  try {
    await createConsultationReview({
      consultationId: booking4.id,
      clientId: idA,
      clientName: 'Cliente A',
      clientAvatar: '',
      rating: 4,
      comment: 'Segunda reseña duplicada',
    });
    assert(false, 'No se debe permitir más de una reseña por consulta');
  } catch (err: any) {
    assert(err.status === 400, 'Reseña duplicada bloqueada con 400 Bad Request', err.message);
  }

  // Verificar recálculo de rating en el perfil del tarotista
  const tarotistaProfileAfter = await db.get<any>('SELECT rating_average, total_reviews FROM tarotista_profiles WHERE id = ?', [profileIdB]);
  assert(tarotistaProfileAfter.rating_average === 5, 'Rating medio del tarotista actualizado a 5.0');
  assert(tarotistaProfileAfter.total_reviews === 1, 'Contador de reseñas del tarotista incrementado a 1');

  // ==========================================================================
  // PRUEBA 11: DISPUTAS Y AJUSTE COMPENSATORIO ADMINISTRATIVO
  // ==========================================================================
  console.log('\n📌 PRUEBA 11: Disputas y resolución compensatoria administrativa...');

  // Cliente A abre disputa en la consulta 4 completada
  const dispute = await createConsultationDispute({
    consultationId: booking4.id,
    raisedById: idA,
    reason: 'Interrupciones técnicas en los últimos 5 minutos de la sesión',
  });
  assert(dispute.status === 'pending', 'Disputa abierta en estado pending');

  const cons4Disputed = await db.get<any>('SELECT status FROM consultations WHERE id = ?', [booking4.id]);
  assert(cons4Disputed.status === 'disputada', 'Consulta marcada como "disputada"');

  // Administrador resuelve con reembolso parcial de 100 monedas al cliente
  // Como ya se había liquidado al tarotista, se deduce compensatoriamente de su saldo
  const resolvedDispute = await resolveConsultationDispute({
    disputeId: dispute.id,
    adminUserId: idAdmin,
    resolution: 'resolved_refund_partial',
    refundAmountCoins: 100,
    adminNotes: 'Se reembolsan 100 monedas por compensación de calidad técnica',
  });

  assert(resolvedDispute.status === 'resolved_refund_partial', 'Disputa resuelta como resolved_refund_partial');
  assert(resolvedDispute.refundAmountCoins === 100, 'Reembolso parcial fijado en 100 monedas');

  // Verificar saldos tras resolución:
  // Cliente A tenía 200 de saldo disponible -> recibe +100 = 300
  const clientAAfterDispute = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [idA]);
  assert(clientAAfterDispute.coins_balance === 300, 'Cliente A recibió reembolso de 100 monedas (saldo 300)');

  // Tarotista B tenía 240 monedas de saldo y ganancias -> deducido en 100 = 140
  const tarotistaBAfterDispute = await db.get<any>('SELECT coins_balance, earnings_coins_balance FROM users WHERE id = ?', [idB]);
  assert(tarotistaBAfterDispute.coins_balance === 140, 'Saldo de Tarotista B deducido compensatoriamente a 140');
  assert(tarotistaBAfterDispute.earnings_coins_balance === 140, 'Ganancias de Tarotista B ajustadas a 140');

  // Verificar libro mayor para la compensación
  const disputeRefundLedger = await db.get<any>(
    "SELECT * FROM ledger WHERE user_id = ? AND description LIKE '%disputa%'",
    [idA]
  );
  assert(!!disputeRefundLedger, 'Asiento de compensación por disputa registrado en el libro mayor');

  // ==========================================================================
  // PRUEBA 12: PERSISTENCIA Y RECUPERACIÓN TRAS REINICIO
  // ==========================================================================
  console.log('\n📌 PRUEBA 12: Consistencia y persistencia de datos relacionales...');

  const finalCheck = await db.get<any>(`
    SELECT 
      (SELECT COUNT(*) FROM consultations) as total_cons,
      (SELECT COUNT(*) FROM consultation_messages) as total_msgs,
      (SELECT COUNT(*) FROM reviews) as total_revs,
      (SELECT COUNT(*) FROM ledger WHERE status = 'completed') as total_txs
  `);

  assert(finalCheck.total_cons >= 3, 'Persistencia de consultas verificada');
  assert(finalCheck.total_msgs >= 2, 'Persistencia de mensajes de sala verificada');
  assert(finalCheck.total_revs >= 1, 'Persistencia de reseñas verificada');
  assert(finalCheck.total_txs >= 5, 'Consistencia contable en libro mayor verificada');

  console.log('\n🔮 ========================================================');
  console.log(`🎉 TODAS LAS PRUEBAS DE LA FASE 8 PASARON EXITOSAMENTE!`);
  console.log(`   Pruebas ejecutadas: ${passedCount}`);
  console.log(`   Pruebas fallidas:   ${failedCount}`);
  console.log('🔮 ========================================================\n');
}

runPhase8Tests().catch((err) => {
  console.error('\n💥 ERROR FATAL EN PRUEBAS:', err);
  process.exit(1);
});
