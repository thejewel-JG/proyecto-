import { initDatabase, getDb } from '../src/db/database';
import {
  getGiftCatalog,
  sendStreamGift,
  getStreamGiftEvents,
  unlockExclusivePost,
  checkPostAccess,
  getUserUnlockedPurchases,
  refundPostUnlock,
  withdrawPost,
} from '../src/services/giftAndUnlockService';
import { runWalletReconciliation } from '../src/services/stripeService';
import { createPost, getPostById, getFeedPosts } from '../src/db/repo';

async function main() {
  console.log('--- INICIANDO PRUEBAS DE ACEPTACIÓN FASE 9 DE KABALY ---');
  await initDatabase();
  const db = await getDb();

  const timeSuffix = Date.now().toString().slice(-6);
  const tarotistaId = `test_tarotista_${timeSuffix}`;
  const clientAId = `test_client_a_${timeSuffix}`;
  const clientBId = `test_client_b_${timeSuffix}`;
  const adminId = `test_admin_${timeSuffix}`;

  // 0. Setup: Registrar usuarios de prueba en la base de datos
  await db.run(`
    INSERT INTO users (id, name, email, role, password_hash, coins_balance, purchased_coins_balance, coins_reserved, earnings_coins_balance, is_age_verified, created_at, updated_at)
    VALUES 
      (?, 'Luna Astral', ?, 'tarotista', 'hash', 100, 100, 0, 0, 1, datetime('now'), datetime('now')),
      (?, 'Cliente Juan', ?, 'cliente', 'hash', 1000, 1000, 0, 0, 1, datetime('now'), datetime('now')),
      (?, 'Cliente Elena', ?, 'cliente', 'hash', 50, 50, 0, 0, 1, datetime('now'), datetime('now')),
      (?, 'Admin Supremo', ?, 'admin', 'hash', 0, 0, 0, 0, 1, datetime('now'), datetime('now'))
  `, [
    tarotistaId, `luna_${timeSuffix}@kabaly.local`,
    clientAId, `juan_${timeSuffix}@kabaly.local`,
    clientBId, `elena_${timeSuffix}@kabaly.local`,
    adminId, `admin_${timeSuffix}@kabaly.local`
  ]);

  // Crear perfil de tarotista
  await db.run(`
    INSERT INTO tarotista_profiles (id, user_id, professional_name, specialties, languages, bio, avatar, is_verified, video_count, created_at)
    VALUES (?, ?, 'Luna Astral', 'Tarot', 'Español', 'Lecturas sagradas', 'https://example.com/avatar.jpg', 1, 0, datetime('now'))
  `, [`prof_${tarotistaId}`, tarotistaId]);

  // Crear un directo activo para Luna
  const streamId = `live_stream_${timeSuffix}`;
  await db.run(`
    INSERT INTO live_streams (id, tarotista_id, tarotista_name, tarotista_avatar, title, category, viewer_count, is_live, started_at)
    VALUES (?, ?, 'Luna Astral', 'https://example.com/avatar.jpg', 'Directo de Luna Llena', 'Tarot', 150, 1, datetime('now'))
  `, [streamId, tarotistaId]);

  // Crear un directo FINALIZADO para comprobar rechazo
  const endedStreamId = `ended_stream_${timeSuffix}`;
  await db.run(`
    INSERT INTO live_streams (id, tarotista_id, tarotista_name, tarotista_avatar, title, category, viewer_count, is_live, started_at)
    VALUES (?, ?, 'Luna Astral', 'https://example.com/avatar.jpg', 'Directo Antiguo Finalizado', 'Tarot', 0, 0, datetime('now'))
  `, [endedStreamId, tarotistaId]);

  console.log('✓ Usuarios de prueba y directos creados correctamente.');

  // -------------------------------------------------------------------------
  // TEST 1: Catálogo de regalos del servidor
  // -------------------------------------------------------------------------
  const catalog = await getGiftCatalog();
  if (catalog.length < 4) throw new Error('El catálogo de regalos debe tener al menos 4 regalos.');
  const vela = catalog.find(g => g.id === 'gift_vela');
  const corona = catalog.find(g => g.id === 'gift_corona');
  if (!vela || vela.costCoins !== 10) throw new Error('Regalo Vela no configurado con 10 monedas.');
  if (!corona || corona.costCoins !== 500) throw new Error('Regalo Corona Imperial no configurado con 500 monedas.');
  console.log('✓ TEST 1: Catálogo de regalos verificado con precios enteros.');

  // -------------------------------------------------------------------------
  // TEST 2: Envío de regalo con reparto contable entero exacto
  // -------------------------------------------------------------------------
  const idempGift1 = `idemp_gift_1_${timeSuffix}`;
  const giftResult1 = await sendStreamGift({
    senderId: clientAId,
    streamId: streamId,
    giftId: 'gift_cristal', // Coste: 50 monedas. Comisión por defecto: 20%. Plataforma: 10, Tarotista: 40
    idempotencyKey: idempGift1,
  });

  if (giftResult1.costCoins !== 50) throw new Error('Coste incorrecto en envío de regalo.');
  if (giftResult1.platformFeeCoins !== 10) throw new Error(`Comisión de plataforma esperada 10, obtenida ${giftResult1.platformFeeCoins}`);
  if (giftResult1.tarotistaEarningsCoins !== 40) throw new Error(`Ganancia del tarotista esperada 40, obtenida ${giftResult1.tarotistaEarningsCoins}`);
  if (giftResult1.platformFeeCoins + giftResult1.tarotistaEarningsCoins !== giftResult1.costCoins) {
    throw new Error('Fallo de conservación contable entera en reparto de regalo.');
  }

  // Verificar saldos en BD
  const clientAAfterGift = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [clientAId]);
  const tarotistaAfterGift = await db.get<any>('SELECT coins_balance, purchased_coins_balance, earnings_coins_balance FROM users WHERE id = ?', [tarotistaId]);
  if (clientAAfterGift.coins_balance !== 950) throw new Error(`Saldo de Juan esperado 950, obtenido ${clientAAfterGift.coins_balance}`);
  // Las ganancias no se mezclan con monedas compradas:
  if (tarotistaAfterGift.purchased_coins_balance !== 100) throw new Error('El saldo de monedas compradas del tarotista no debe alterarse.');
  if (tarotistaAfterGift.earnings_coins_balance !== 40) throw new Error(`Ganancias profesionales esperadas 40, obtenidas ${tarotistaAfterGift.earnings_coins_balance}`);
  if (tarotistaAfterGift.coins_balance !== 140) throw new Error(`Saldo total esperado 140, obtenido ${tarotistaAfterGift.coins_balance}`);

  // Verificar asientos contables en ledger
  const giftLedgerRows = await db.query<any>('SELECT * FROM ledger WHERE reference_id = ?', [giftResult1.transactionId]);
  if (giftLedgerRows.length !== 3) throw new Error(`Se esperaban 3 asientos en libro mayor (gift_sent, gift_received, platform_fee), encontrados ${giftLedgerRows.length}`);
  console.log('✓ TEST 2: Envío de regalo con reparto contable exacto y separación de ganancias verificado.');

  // -------------------------------------------------------------------------
  // TEST 3: Saldo insuficiente
  // -------------------------------------------------------------------------
  try {
    await sendStreamGift({
      senderId: clientBId, // Tiene 50 monedas
      streamId: streamId,
      giftId: 'gift_corona', // Requiere 500 monedas
    });
    throw new Error('Debió fallar por saldo insuficiente.');
  } catch (err: any) {
    if (err.code !== 'INSUFFICIENT_COINS') throw new Error(`Código de error esperado INSUFFICIENT_COINS, obtenido: ${err.code || err.message}`);
  }
  console.log('✓ TEST 3: Rechazo por saldo insuficiente verificado.');

  // -------------------------------------------------------------------------
  // TEST 4: Rechazo de regalo a uno mismo
  // -------------------------------------------------------------------------
  try {
    await sendStreamGift({
      senderId: tarotistaId, // El propio tarotista dueño del directo
      streamId: streamId,
      giftId: 'gift_vela',
    });
    throw new Error('Debió rechazar regalarse a uno mismo.');
  } catch (err: any) {
    if (err.code !== 'CANNOT_GIFT_SELF') throw new Error(`Código esperado CANNOT_GIFT_SELF, obtenido ${err.code || err.message}`);
  }
  console.log('✓ TEST 4: Rechazo de regalo a uno mismo verificado.');

  // -------------------------------------------------------------------------
  // TEST 5: Rechazo de regalo a emisión finalizada
  // -------------------------------------------------------------------------
  try {
    await sendStreamGift({
      senderId: clientAId,
      streamId: endedStreamId, // Directo finalizado (is_live = 0)
      giftId: 'gift_vela',
    });
    throw new Error('Debió rechazar regalo a directo finalizado.');
  } catch (err: any) {
    if (err.code !== 'STREAM_NOT_LIVE') throw new Error(`Código esperado STREAM_NOT_LIVE, obtenido ${err.code || err.message}`);
  }
  console.log('✓ TEST 5: Rechazo de regalo a emisión inactiva/finalizada verificado.');

  // -------------------------------------------------------------------------
  // TEST 6: Idempotencia y reintento sin doble cobro
  // -------------------------------------------------------------------------
  const retryGiftResult = await sendStreamGift({
    senderId: clientAId,
    streamId: streamId,
    giftId: 'gift_cristal',
    idempotencyKey: idempGift1, // MISMA clave que TEST 2
  });
  if (!retryGiftResult.isDuplicate) throw new Error('El reintento con la misma clave debe marcarse como duplicado.');
  if (retryGiftResult.transactionId !== giftResult1.transactionId) throw new Error('El reintento debe devolver la misma transactionId.');

  const clientAAfterRetry = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [clientAId]);
  if (clientAAfterRetry.coins_balance !== 950) throw new Error('El reintento NO debió descontar monedas adicionales.');
  console.log('✓ TEST 6: Idempotencia en envío de regalos verificada (sin cobro duplicado).');

  // -------------------------------------------------------------------------
  // TEST 7: Peticiones concurrentes sin saldo negativo
  // -------------------------------------------------------------------------
  // Elena tiene 50 monedas. Dos peticiones simultáneas intentando enviar regalo de 50 monedas.
  const p1 = sendStreamGift({ senderId: clientBId, streamId, giftId: 'gift_cristal', idempotencyKey: `conc_1_${timeSuffix}` });
  const p2 = sendStreamGift({ senderId: clientBId, streamId, giftId: 'gift_cristal', idempotencyKey: `conc_2_${timeSuffix}` });
  const results = await Promise.allSettled([p1, p2]);

  const fulfilled = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');
  if (fulfilled.length !== 1 || rejected.length !== 1) {
    throw new Error(`En concurrencia exacta, solo una debió pasar. Aprobadas: ${fulfilled.length}, Rechazadas: ${rejected.length}`);
  }
  const clientBAfterConc = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [clientBId]);
  if (clientBAfterConc.coins_balance !== 0) throw new Error(`El saldo resultante debe ser 0, pero es ${clientBAfterConc.coins_balance}`);
  console.log('✓ TEST 7: Concurrencia transaccional sin saldo negativo verificada.');

  // -------------------------------------------------------------------------
  // TEST 8: Recuperación de eventos y deduplicación para clientes
  // -------------------------------------------------------------------------
  const events = await getStreamGiftEvents(streamId);
  if (events.length < 2) throw new Error('Deben existir al menos 2 eventos de regalo en el directo.');
  const txIds = new Set(events.map(e => e.transactionId));
  if (txIds.size !== events.length) throw new Error('Existen eventos duplicados por transactionId.');
  console.log('✓ TEST 8: Historial recuperable de eventos de regalo verificado.');

  // -------------------------------------------------------------------------
  // TEST 9: Publicaciones Exclusivas - Privacidad y Ocultamiento de URL original
  // -------------------------------------------------------------------------
  const rawPrivateUrl = 'https://storage.kabaly.local/private/video_sagrado_secreto.mp4';
  const publicCoverUrl = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500';

  const { post: exclusivePost } = await createPost({
    authorId: tarotistaId,
    authorName: 'Luna Astral',
    isVerified: true,
    title: 'Ritual Sagrado de Abundancia Estelar',
    description: 'Guía arcana en alta resolución disponible exclusivamente para iniciados.',
    category: 'Rituales',
    videoUrl: rawPrivateUrl,
    thumbnailUrl: publicCoverUrl,
    mediaType: 'video',
    isPremium: true,
    priceCoins: 120, // Precio validado en monedas
    idempotencyKey: `idemp_post_excl_${timeSuffix}`,
  });

  // Consultar desde feed como usuario público no comprador (Cliente A)
  const feedClientA = await getFeedPosts({ currentUserId: clientAId });
  const postInFeedA = feedClientA.items.find(p => p.id === exclusivePost.id);
  if (!postInFeedA) throw new Error('La publicación debe aparecer en el feed.');
  if (postInFeedA.hasUnlocked !== false) throw new Error('hasUnlocked debe ser false para cliente no comprador.');
  if (postInFeedA.videoUrl !== '') throw new Error(`La URL privada original fue expuesta en el feed: "${postInFeedA.videoUrl}"`);
  if (!postInFeedA.thumbnailUrl) throw new Error('La portada/vista previa separada debe estar presente.');

  // Consultar con getPostById
  const postByIdA = await getPostById(exclusivePost.id, clientAId);
  if (!postByIdA || postByIdA.videoUrl !== '') throw new Error('getPostById expuso la URL original a un usuario sin comprar.');

  // Acceso denegado en endpoint de media privado
  const accessBeforeA = await checkPostAccess(clientAId, exclusivePost.id);
  if (accessBeforeA.hasAccess) throw new Error('Cliente A no debe tener acceso al archivo antes de desbloquear.');
  console.log('✓ TEST 9: Protección de contenido exclusivo y ausencia de URLs privadas en respuestas públicas verificadas.');

  // -------------------------------------------------------------------------
  // TEST 10: El autor accede a su propio contenido sin pagar
  // -------------------------------------------------------------------------
  const feedAuthor = await getFeedPosts({ currentUserId: tarotistaId });
  const postInFeedAuthor = feedAuthor.items.find(p => p.id === exclusivePost.id);
  if (!postInFeedAuthor || !postInFeedAuthor.hasUnlocked) throw new Error('El autor debe tener hasUnlocked=true automáticamente.');
  if (postInFeedAuthor.videoUrl !== rawPrivateUrl) throw new Error('El autor debe recibir la URL completa de su obra.');

  const authorAccess = await checkPostAccess(tarotistaId, exclusivePost.id);
  if (!authorAccess.hasAccess || !authorAccess.isAuthor || authorAccess.mediaUrl !== rawPrivateUrl) {
    throw new Error('El autor no pudo acceder a su propio contenido privado gratis.');
  }
  console.log('✓ TEST 10: Autor accede a su propio contenido privado sin pagar verificado.');

  // -------------------------------------------------------------------------
  // TEST 11: Desbloqueo y reparto contable (Cliente A compra la publicación)
  // -------------------------------------------------------------------------
  // Juan tiene 950 monedas. La publicación cuesta 120 monedas. Comisión 20% -> 24 plataforma, 96 tarotista.
  const idempUnlock1 = `idemp_unlock_${timeSuffix}`;
  const unlockResult = await unlockExclusivePost({
    buyerId: clientAId,
    postId: exclusivePost.id,
    idempotencyKey: idempUnlock1,
  });

  if (unlockResult.priceCoins !== 120) throw new Error('Precio cobrado incorrecto.');
  if (unlockResult.mediaUrl !== rawPrivateUrl) throw new Error('El desbloqueo debe entregar la URL del medio.');

  const clientAAfterUnlock = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [clientAId]);
  const tarotistaAfterUnlock = await db.get<any>('SELECT coins_balance, purchased_coins_balance, earnings_coins_balance FROM users WHERE id = ?', [tarotistaId]);

  if (clientAAfterUnlock.coins_balance !== 830) throw new Error(`Saldo de Juan esperado 830, obtenido ${clientAAfterUnlock.coins_balance}`);
  if (tarotistaAfterUnlock.purchased_coins_balance !== 100) throw new Error('El saldo de monedas compradas del tarotista no debe alterarse.');
  if (tarotistaAfterUnlock.earnings_coins_balance !== 40 + 40 + 96) throw new Error(`Ganancias de tarotista esperadas 176, obtenidas ${tarotistaAfterUnlock.earnings_coins_balance}`);
  if (tarotistaAfterUnlock.coins_balance !== 276) throw new Error(`Saldo total de tarotista esperado 276, obtenido ${tarotistaAfterUnlock.coins_balance}`);

  // Verificar libro mayor
  const unlockLedgerRows = await db.query<any>('SELECT * FROM ledger WHERE reference_id = ?', [unlockResult.unlockId]);
  if (unlockLedgerRows.length !== 3) throw new Error('Se esperaban 3 asientos de ledger para el desbloqueo.');
  console.log('✓ TEST 11: Desbloqueo de publicación con reparto contable exacto verificado.');

  // -------------------------------------------------------------------------
  // TEST 12: Segundo intento de desbloqueo no vuelve a cobrar
  // -------------------------------------------------------------------------
  const retryUnlockResult = await unlockExclusivePost({
    buyerId: clientAId,
    postId: exclusivePost.id,
    idempotencyKey: `another_idemp_key_${timeSuffix}`,
  });
  if (!retryUnlockResult.alreadyUnlocked) throw new Error('El segundo intento debe indicar alreadyUnlocked.');

  const clientAAfterRetryUnlock = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [clientAId]);
  if (clientAAfterRetryUnlock.coins_balance !== 830) throw new Error('El segundo intento NO debió descontar monedas.');
  console.log('✓ TEST 12: Idempotencia y prevención de doble compra verificadas.');

  // -------------------------------------------------------------------------
  // TEST 13: Sección privada «Mis compras»
  // -------------------------------------------------------------------------
  const juanPurchases = await getUserUnlockedPurchases(clientAId);
  if (juanPurchases.length !== 1) throw new Error(`Se esperaba 1 compra para Juan, encontradas ${juanPurchases.length}`);
  if (juanPurchases[0].postId !== exclusivePost.id) throw new Error('El ID de publicación en compras no coincide.');
  if (juanPurchases[0].priceCoins !== 120) throw new Error('Precio en compras no coincide.');
  console.log('✓ TEST 13: Sección «Mis compras» verificada.');

  // -------------------------------------------------------------------------
  // TEST 14: Rechazo de acceso a usuario que no compró
  // -------------------------------------------------------------------------
  const elenaAccess = await checkPostAccess(clientBId, exclusivePost.id);
  if (elenaAccess.hasAccess) throw new Error('Elena no compró y no debe tener acceso.');
  console.log('✓ TEST 14: Rechazo de acceso a usuario no comprador verificado.');

  // -------------------------------------------------------------------------
  // TEST 15: Retirada de publicación y Reembolso compensatorio
  // -------------------------------------------------------------------------
  // El autor retira la publicación
  await withdrawPost({
    postId: exclusivePost.id,
    userId: tarotistaId,
    reason: 'Actualización litúrgica de arcanos',
  });

  const withdrawnPost = await db.get<any>('SELECT * FROM videos WHERE id = ?', [exclusivePost.id]);
  if (withdrawnPost.is_withdrawn !== 1) throw new Error('La publicación debió marcarse como retirada.');

  // Moderador / Admin ejecuta reembolso compensatorio
  const refundResult = await refundPostUnlock({
    unlockId: unlockResult.unlockId,
    adminUserId: adminId,
    reason: 'Retirada por autor solicitada por cliente',
  });

  if (refundResult.refundCoins !== 120) throw new Error('Monto reembolsado incorrecto.');

  const clientAAfterRefund = await db.get<any>('SELECT coins_balance FROM users WHERE id = ?', [clientAId]);
  if (clientAAfterRefund.coins_balance !== 950) throw new Error(`Juan debió recuperar sus 120 monedas (esperado 950, obtenido ${clientAAfterRefund.coins_balance})`);

  // Intento de doble reembolso debe ser rechazado
  try {
    await refundPostUnlock({
      unlockId: unlockResult.unlockId,
      adminUserId: adminId,
      reason: 'Intento de segundo reembolso',
    });
    throw new Error('Debió rechazar reembolso duplicado.');
  } catch (e: any) {
    if (e.code !== 'ALREADY_REFUNDED') throw new Error(`Código esperado ALREADY_REFUNDED, obtenido ${e.code || e.message}`);
  }
  console.log('✓ TEST 15: Retirada de contenido y reembolso compensatorio auditable sin duplicación verificado.');

  // -------------------------------------------------------------------------
  // TEST 16: Conciliación contable
  // -------------------------------------------------------------------------
  const recon = await runWalletReconciliation();
  if (!recon.isBalanced || recon.discrepancies.length > 0) {
    throw new Error(`Conciliación reportó discrepancias: ${JSON.stringify(recon.discrepancies)}`);
  }
  console.log('✓ TEST 16: Conciliación global del libro mayor exitosa sin descuadres ni saldos negativos.');

  console.log('\n======================================================');
  console.log('¡TODAS LAS PRUEBAS DE ACEPTACIÓN DE FASE 9 HAN PASADO!');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('\n❌ ERROR EN PRUEBAS DE ACEPTACIÓN:', err);
  process.exit(1);
});
