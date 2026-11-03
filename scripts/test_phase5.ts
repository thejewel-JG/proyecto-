// Native fetch, FormData and Blob are built-in globals in Node.js v24

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
    return { status: res.status, ok: res.ok, data };
  }

  async registerOrLogin(password: string, role: string = 'cliente') {
    // Intentar login primero
    let res = await this.request('/api/auth/login', {
      method: 'POST',
      body: { email: this.email, password },
    });
    if (res.ok && res.data.user) {
      this.user = res.data.user;
      return this.user;
    }

    // Si no existe, registrar
    res = await this.request('/api/auth/register', {
      method: 'POST',
      body: {
        email: this.email,
        password,
        name: this.name,
        role,
        isAgeVerified: true,
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to authenticate ${this.email}: ${JSON.stringify(res.data)}`);
    }
    this.user = res.data.user;
    return this.user;
  }
}

async function runPhase5Tests() {
  console.log('🔮 ============================================================== 🔮');
  console.log('       INICIANDO SUITE DE PRUEBAS DE ACEPTACIÓN - FASE 5 KABALY     ');
  console.log('       MENSAJERÍA PRIVADA, ADJUNTOS, BLOQUEOS Y REPORTES            ');
  console.log('🔮 ============================================================== 🔮\n');

  // Preparar 3 cuentas independientes
  // Cuenta A y B como participantes de la conversación
  // Cuenta C como usuario ajeno (espía/externo)
  const clientA = new SessionClient('luna_msg_a@kabaly.test', 'Luna Astral (Participante A)');
  const clientB = new SessionClient('orion_msg_b@kabaly.test', 'Orión Místico (Participante B)');
  const clientC = new SessionClient('sol_spy_c@kabaly.test', 'Sol Externo (Usuario C Ajeno)');
  const adminClient = new SessionClient('admin@kabaly.app', 'Administrador KABALY');

  const password = 'KabalySecretPassword2026!';
  const adminPassword = 'AdminKabaly2026!';

  // =========================================================================
  // 1. AUTENTICACIÓN DE 3 CUENTAS INDEPENDIENTES + ADMIN
  // =========================================================================
  console.log('1. Autenticación de Cuentas: A (Participante), B (Participante), C (Ajeno) y Admin...');
  await clientA.registerOrLogin(password, 'tarotista');
  await clientB.registerOrLogin(password, 'cliente');
  await clientC.registerOrLogin(password, 'cliente');
  await adminClient.registerOrLogin(adminPassword, 'admin');

  console.log(`   ✓ Cuenta A: ${clientA.user.name} (${clientA.user.id})`);
  console.log(`   ✓ Cuenta B: ${clientB.user.name} (${clientB.user.id})`);
  console.log(`   ✓ Cuenta C: ${clientC.user.name} (${clientC.user.id}) [Usuario Ajeno]`);
  console.log(`   ✓ Admin:    ${adminClient.user.name} (${adminClient.user.id}) [Moderación]`);

  // =========================================================================
  // 2. INICIO DE CONVERSACIÓN DESDE PERFIL Y GARANTÍA DE UNICIDAD CANÓNICA
  // =========================================================================
  console.log('\n2. Inicio de conversación y garantía de 1 única conversación por pareja...');
  // A inicia conversación con B
  const conv1Res = await clientA.request('/api/conversations', {
    method: 'POST',
    body: { targetUserId: clientB.user.id },
  });
  assert(conv1Res.ok, `Error al iniciar conversación A -> B: ${JSON.stringify(conv1Res.data)}`);
  const conversation = conv1Res.data.conversation;
  assert(!!conversation.id, 'No se generó ID de conversación');
  console.log(`   ✓ Conversación iniciada: ID=${conversation.id}`);

  // B intenta iniciar conversación con A (petición inversa) -> debe devolver exactamente la misma fila
  const conv2Res = await clientB.request('/api/conversations', {
    method: 'POST',
    body: { targetUserId: clientA.user.id },
  });
  assert(conv2Res.ok, 'Error al recuperar conversación inversa B -> A');
  assert(
    conv2Res.data.conversation.id === conversation.id,
    'Fallo de unicidad: Se creó una segunda conversación duplicada para la misma pareja'
  );
  console.log('   ✓ Unicidad canónica garantizada: B -> A recuperó exactamente la misma conversación');

  // Rechazo de conversación con uno mismo
  const selfConv = await clientA.request('/api/conversations', {
    method: 'POST',
    body: { targetUserId: clientA.user.id },
  });
  assert(selfConv.status === 400, 'El servidor permitió una conversación de un usuario consigo mismo');
  console.log('   ✓ Rechazo de conversación propia comprobado (HTTP 400)');

  // =========================================================================
  // 3. ENVÍO Y RECEPCIÓN DE MENSAJES DE TEXTO Y SANITIZACIÓN XSS
  // =========================================================================
  console.log('\n3. Envío y recepción de mensajes de texto seguros (Anti-XSS y longitud)...');
  const xssPayload = 'Hola Orión <script>alert("hack")</script> <b>Bendiciones</b>';
  const send1 = await clientA.request(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: {
      content: xssPayload,
      clientMessageId: 'cmsg_test_001',
    },
  });
  assert(send1.ok, `Error al enviar mensaje de texto: ${JSON.stringify(send1.data)}`);
  const msg1 = send1.data.message;
  assert(!msg1.content.includes('<script>'), 'Fallo de seguridad: El mensaje conservó etiquetas <script>');
  assert(msg1.content.includes('Bendiciones'), 'El texto sanitizado se perdió');
  assert(msg1.senderId === clientA.user.id, 'El remitente no coincide con la sesión del usuario');
  console.log(`   ✓ Mensaje sanitizado enviado: "${msg1.content}"`);

  // Rechazo de mensajes vacíos y excesivos (>2000 chars)
  const emptySend = await clientA.request(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: { content: '    ' },
  });
  assert(emptySend.status === 400, 'Se permitió enviar mensaje vacío');

  const longPayload = 'A'.repeat(2005);
  const longSend = await clientA.request(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: { content: longPayload },
  });
  assert(longSend.status === 400, 'Se permitió enviar mensaje superior a 2000 caracteres');
  console.log('   ✓ Validaciones de longitud comprobadas: vacío y >2000 caracteres rechazados (HTTP 400)');

  // =========================================================================
  // 4. IDEMPOTENCIA Y PREVENCIÓN DE DUPLICADOS EN REINTENTOS
  // =========================================================================
  console.log('\n4. Idempotencia: Prevención de duplicados por reintentos de red...');
  const retryClientMsgId = `idemp_${Date.now()}`;
  const firstSend = await clientA.request(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: {
      content: 'Mensaje con clave de idempotencia única',
      clientMessageId: retryClientMsgId,
    },
  });
  assert(firstSend.ok, 'Primer envío falló');
  const firstMsgId = firstSend.data.message.id;

  // Reintento idéntico simulando reenvío tras caída de red
  const retrySend = await clientA.request(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: {
      content: 'Mensaje con clave de idempotencia única',
      clientMessageId: retryClientMsgId,
    },
  });
  assert(retrySend.ok, 'Reintento falló con error');
  assert(
    retrySend.data.message.id === firstMsgId,
    'El reintento generó un nuevo mensaje duplicado en lugar de devolver el existente'
  );
  console.log('   ✓ Idempotencia validada: Mismo clientMessageId retornó el mensaje original sin duplicarlo');

  // =========================================================================
  // 5. ARCHIVOS ADJUNTOS PRIVADOS (ALMACENAMIENTO SEGURO Y CONTROL DE ACCESO)
  // =========================================================================
  console.log('\n5. Subida y control de acceso a archivos adjuntos privados...');
  // A sube una imagen privada
  const form = new FormData();
  const dummyImage = Buffer.from('RIFF....WEBPVP8 ...fake-image-bytes-for-kabaly-chat...');
  const blob = new Blob([dummyImage], { type: 'image/webp' });
  form.append('file', blob, 'carta_astral_secreta.webp');

  const uploadRes = await clientA.request('/api/chat/attachments', {
    method: 'POST',
    body: form,
  });
  assert(uploadRes.ok, `Error al subir adjunto de chat: ${JSON.stringify(uploadRes.data)}`);
  const attachmentId = uploadRes.data.id;
  const attachmentUrl = uploadRes.data.url;
  assert(!!attachmentId && !!attachmentUrl, 'No se generaron metadatos del adjunto');
  console.log(`   ✓ Adjunto subido a almacenamiento privado: ID=${attachmentId}, URL=${attachmentUrl}`);

  // A envía mensaje vinculando el adjunto
  const sendWithAttach = await clientA.request(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: {
      content: 'Aquí tienes la carta astral confidencial adjunta',
      attachmentId,
    },
  });
  assert(sendWithAttach.ok, 'Error al enviar mensaje con adjunto');
  console.log('   ✓ Mensaje con adjunto enviado y vinculado a la conversación');

  // B (participante autorizado) descarga el adjunto privado -> debe retornar HTTP 200
  const dlByB = await clientB.request(`/api/chat/attachments/${attachmentId}`);
  assert(dlByB.status === 200, `Participante B no pudo descargar adjunto: status=${dlByB.status}`);
  console.log('   ✓ Participante B accedió correctamente al archivo privado (HTTP 200)');

  // =========================================================================
  // 6. PRIVACIDAD ESTRICTA: RECHAZO DE ACCESO DEL USUARIO AJENO (CUENTA C)
  // =========================================================================
  console.log('\n6. Privacidad y Permisos: Verificación de rechazo a Usuario C (Espía/Ajeno)...');
  // C intenta ver la conversación de A y B
  const spyConv = await clientC.request(`/api/conversations/${conversation.id}`);
  assert(spyConv.status === 403, `Usuario C pudo inspeccionar conversación ajena: status=${spyConv.status}`);
  console.log('   ✓ Acceso a conversación ajena rechazado con HTTP 403 Forbidden');

  // C intenta leer los mensajes de la conversación de A y B
  const spyMsgs = await clientC.request(`/api/conversations/${conversation.id}/messages`);
  assert(spyMsgs.status === 403, `Usuario C pudo leer mensajes ajenos: status=${spyMsgs.status}`);
  console.log('   ✓ Acceso a mensajes ajenos rechazado con HTTP 403 Forbidden');

  // C intenta inyectar un mensaje en la conversación de A y B
  const spySend = await clientC.request(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: { content: 'Soy un intruso' },
  });
  assert(spySend.status === 403, `Usuario C pudo enviar mensaje en conversación ajena: status=${spySend.status}`);
  console.log('   ✓ Envío no autorizado rechazado con HTTP 403 Forbidden');

  // C intenta descargar el adjunto privado de A y B
  const spyAttachment = await clientC.request(`/api/chat/attachments/${attachmentId}`);
  assert(spyAttachment.status === 403, `Usuario C pudo descargar adjunto privado ajeno: status=${spyAttachment.status}`);
  console.log('   ✓ Descarga de adjunto privado por tercero ajeno rechazada con HTTP 403 Forbidden');

  // =========================================================================
  // 7. HISTORIAL PAGINADO, MENSAJES SIN LEER Y LECTURA REAL
  // =========================================================================
  console.log('\n7. Historial paginado, indicadores de no leídos y confirmación de lectura...');
  // B consulta su contador total de no leídos
  const unreadB = await clientB.request('/api/unread-count');
  assert(unreadB.ok && unreadB.data.unreadCount > 0, `Contador de no leídos de B incorrecto: ${unreadB.data.unreadCount}`);
  console.log(`   ✓ Cuenta B tiene ${unreadB.data.unreadCount} mensaje(s) sin leer`);

  // B lista sus conversaciones y busca por nombre
  const convList = await clientB.request(`/api/conversations?search=${encodeURIComponent(clientA.user.name.slice(0, 4))}`);
  assert(convList.ok, 'Error al listar conversaciones con búsqueda');
  assert(convList.data.conversations.length >= 1, 'Búsqueda de conversaciones no retornó resultados');
  console.log(`   ✓ Búsqueda de conversaciones funcionando (${convList.data.conversations.length} encontrada)`);

  // B marca la conversación como leída
  const readRes = await clientB.request(`/api/conversations/${conversation.id}/read`, {
    method: 'POST',
  });
  assert(readRes.ok, 'Error al marcar conversación como leída');

  // Verificar que el unreadCount pasa a 0 para B
  const unreadBAfter = await clientB.request('/api/unread-count');
  assert(unreadBAfter.ok && unreadBAfter.data.unreadCount === 0, `unreadCount no bajó a 0: ${unreadBAfter.data.unreadCount}`);
  console.log('   ✓ Conversación marcada como leída: Contador de no leídos actualizado a 0');

  // Paginación por cursor de mensajes
  const pagedMsgs = await clientB.request(`/api/conversations/${conversation.id}/messages?limit=2`);
  assert(pagedMsgs.ok && pagedMsgs.data.messages.length <= 2, 'Paginación por limit falló');
  console.log(`   ✓ Paginación estable: devueltos ${pagedMsgs.data.messages.length} mensajes con nextCursor=${pagedMsgs.data.nextCursor || 'null'}`);

  // =========================================================================
  // 8. BLOQUEO BIDIRECCIONAL EFECTIVO
  // =========================================================================
  console.log('\n8. Bloqueo bidireccional y conservación de historial previo...');
  // B bloquea a A
  const blockRes = await clientB.request(`/api/users/${clientA.user.id}/block`, {
    method: 'POST',
  });
  assert(blockRes.ok && blockRes.data.isBlocked === true, 'Error al bloquear usuario');
  console.log('   ✓ Cuenta B bloqueó a Cuenta A');

  // A intenta enviar un mensaje a B -> debe ser rechazado con HTTP 403
  const blockedSendFromA = await clientA.request(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: { content: '¿Sigues ahí?' },
  });
  assert(blockedSendFromA.status === 403, `A pudo enviar mensaje a quien le bloqueó: status=${blockedSendFromA.status}`);
  console.log('   ✓ Intento de envío de A rechazado por bloqueo (HTTP 403)');

  // B también tiene bloqueado el envío hacia A (bidireccional)
  const blockedSendFromB = await clientB.request(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: { content: 'Mensaje desde quien bloqueó' },
  });
  assert(blockedSendFromB.status === 403, `B pudo enviar mensaje estando el bloqueo activo: status=${blockedSendFromB.status}`);
  console.log('   ✓ Intento de envío de B rechazado por bloqueo bidireccional (HTTP 403)');

  // Historial previo sigue siendo legible para ambos
  const histAfterBlockA = await clientA.request(`/api/conversations/${conversation.id}/messages`);
  const histAfterBlockB = await clientB.request(`/api/conversations/${conversation.id}/messages`);
  assert(histAfterBlockA.ok && histAfterBlockA.data.messages.length > 0, 'A no puede leer su historial previo');
  assert(histAfterBlockB.ok && histAfterBlockB.data.messages.length > 0, 'B no puede leer su historial previo');
  console.log('   ✓ Historial previo conservado íntegro para ambas partes durante el bloqueo');

  // B desbloquea a A
  const unblockRes = await clientB.request(`/api/users/${clientA.user.id}/block`, {
    method: 'DELETE',
  });
  assert(unblockRes.ok && unblockRes.data.isBlocked === false, 'Error al desbloquear');
  console.log('   ✓ Cuenta B desbloqueó a Cuenta A');

  // A ahora puede enviar mensajes de nuevo
  const sendAfterUnblock = await clientA.request(`/api/conversations/${conversation.id}/messages`, {
    method: 'POST',
    body: { content: '¡Mensaje tras desbloqueo exitoso!' },
  });
  assert(sendAfterUnblock.ok, 'Error al enviar mensaje tras desbloquear');
  console.log('   ✓ Envío restablecido con éxito tras el desbloqueo');

  // =========================================================================
  // 9. REPORTES PRIVADOS Y RESTRICCIÓN DE ACCESO A MODERACIÓN
  // =========================================================================
  console.log('\n9. Reporte confidencial de mensaje y acceso exclusivo a moderación...');
  // B reporta el primer mensaje de A
  const reportRes = await clientB.request(`/api/messages/${msg1.id}/report`, {
    method: 'POST',
    body: {
      reason: 'acoso',
      details: 'Mensaje de prueba para revisión de moderación',
    },
  });
  assert(reportRes.ok && reportRes.data.reportId, `Fallo al reportar mensaje: ${JSON.stringify(reportRes.data)}`);
  console.log(`   ✓ Reporte generado confidencialmente: ID=${reportRes.data.reportId}`);

  // C (ajeno a la conversación) intenta reportar un mensaje de A y B -> HTTP 403
  const spyReport = await clientC.request(`/api/messages/${msg1.id}/report`, {
    method: 'POST',
    body: { reason: 'spam' },
  });
  assert(spyReport.status === 403, `Usuario C ajeno pudo reportar mensaje: status=${spyReport.status}`);
  console.log('   ✓ Reporte por tercero no participante rechazado con HTTP 403 Forbidden');

  // C (usuario no admin) intenta ver la cola de mensajes reportados -> HTTP 403
  const userReportsQueue = await clientC.request('/api/moderation/messages/reports');
  assert(userReportsQueue.status === 403, `Usuario normal pudo ver cola de reportes: status=${userReportsQueue.status}`);
  console.log('   ✓ Cola de reportes protegida contra usuarios normales (HTTP 403)');

  // Administrador oficial consulta la cola de reportes de mensajes
  const adminReportsQueue = await adminClient.request('/api/moderation/messages/reports');
  assert(adminReportsQueue.ok, `Admin no pudo consultar cola de reportes: status=${adminReportsQueue.status}`);
  const foundReport = adminReportsQueue.data.reports.find((r: any) => r.id === reportRes.data.reportId);
  assert(foundReport, 'El reporte generado no apareció en la vista de moderación del administrador');
  assert(foundReport.messageContent === msg1.content, 'El contenido del mensaje reportado no coincide');
  console.log(`   ✓ Moderación admin: Reporte verificado en cola con motivo "${foundReport.reason}"`);

  // =========================================================================
  // 10. COMPROBACIÓN DE PERSISTENCIA EN DISCO SQLITE (KABALY.DB)
  // =========================================================================
  console.log('\n10. Comprobación de persistencia física en base de datos SQLite...');
  const { initDatabase, getDb } = await import('../src/db/database');
  await initDatabase();
  const db = await getDb();

  const [dbConv, dbMsgs, dbAttach, dbReports] = await Promise.all([
    db.get<{ c: number }>('SELECT COUNT(*) as c FROM conversations'),
    db.get<{ c: number }>('SELECT COUNT(*) as c FROM messages'),
    db.get<{ c: number }>('SELECT COUNT(*) as c FROM chat_attachments'),
    db.get<{ c: number }>('SELECT COUNT(*) as c FROM message_reports'),
  ]);

  console.log(`   ✓ Registros persistidos en disco SQLite (kabaly.db):`);
  console.log(`     - conversations:    ${dbConv?.c || 0} filas`);
  console.log(`     - messages:         ${dbMsgs?.c || 0} filas`);
  console.log(`     - chat_attachments: ${dbAttach?.c || 0} filas`);
  console.log(`     - message_reports:  ${dbReports?.c || 0} filas`);

  assert((dbConv?.c || 0) >= 1, 'No se persistieron conversaciones');
  assert((dbMsgs?.c || 0) >= 3, 'No se persistieron mensajes');
  assert((dbAttach?.c || 0) >= 1, 'No se persistieron adjuntos');
  assert((dbReports?.c || 0) >= 1, 'No se persistieron reportes');

  console.log('\n======================================================================');
  console.log('🌟 TODAS LAS 10 PRUEBAS DE ACEPTACIÓN DE LA FASE 5 COMPLETADAS CON ÉXITO 🌟');
  console.log('======================================================================\n');
}

runPhase5Tests().catch((err) => {
  console.error('\n❌ ERROR DURANTE LAS PRUEBAS DE ACEPTACIÓN DE FASE 5:', err);
  process.exit(1);
});
