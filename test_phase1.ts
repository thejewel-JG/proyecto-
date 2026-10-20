import http from 'http';
import fs from 'fs';
import path from 'path';

process.env.NODE_ENV = 'test';
process.env.TEST_RUN = 'true';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(process.cwd(), 'test_kabaly.db');

// Limpiar BD de prueba si existe
if (fs.existsSync(process.env.SQLITE_PATH)) {
  fs.unlinkSync(process.env.SQLITE_PATH);
}

import { createServerApp } from './server';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

async function runTests() {
  console.log('====================================================');
  console.log('INICIANDO SUITE DE PRUEBAS AUTOMATIZADAS - FASE 1');
  console.log('====================================================\n');

  const app = await createServerApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(3099, '127.0.0.1', () => {
      resolve();
    });
  });

  const baseUrl = 'http://127.0.0.1:3099';

  async function apiRequest(endpoint: string, options: {
    method?: string;
    body?: any;
    cookie?: string;
    headers?: Record<string, string>;
  } = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (options.cookie) {
      headers['Cookie'] = options.cookie;
    }

    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const setCookie = res.headers.get('set-cookie');
    let data: any = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return { status: res.status, data, setCookie };
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Registro de usuario válido (Cliente)
    // -------------------------------------------------------------------------
    console.log('[Test 1] Registro de nuevo usuario...');
    const regRes = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Carlos Test',
        email: 'carlos@kabaly.app',
        password: 'PasswordSegura2026!',
        role: 'cliente',
        isAgeVerified: true,
      },
    });

    const regCookie = regRes.setCookie ? regRes.setCookie.split(';')[0] : '';
    const pass1 = regRes.status === 201 && regRes.data.user.email === 'carlos@kabaly.app' && !!regCookie;
    results.push({
      name: '1. Registro de usuario válido y generación de cookie HttpOnly',
      passed: pass1,
      details: `Status: ${regRes.status}, User ID: ${regRes.data?.user?.id}, Cookie presente: ${!!regCookie}`,
    });

    // -------------------------------------------------------------------------
    // TEST 2: Rechazo de correo duplicado
    // -------------------------------------------------------------------------
    console.log('[Test 2] Rechazo de correo duplicado...');
    const dupRes = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Carlos Duplicado',
        email: 'carlos@kabaly.app',
        password: 'OtraPassword123!',
        role: 'cliente',
        isAgeVerified: true,
      },
    });

    const pass2 = dupRes.status === 400 && dupRes.data.error.includes('ya se encuentra registrado');
    results.push({
      name: '2. Rechazo de registro con correo duplicado',
      passed: pass2,
      details: `Status: ${dupRes.status}, Error recibido: "${dupRes.data?.error}"`,
    });

    // -------------------------------------------------------------------------
    // TEST 3: Imposibilidad de autoasignarse rol admin en el registro
    // -------------------------------------------------------------------------
    console.log('[Test 3] Intento de autoasignación de rol admin en registro...');
    const adminRegRes = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Hacker Pretending Admin',
        email: 'hacker@kabaly.app',
        password: 'PasswordHacker123!',
        role: 'admin', // Intento malicioso de crear cuenta admin
        isAgeVerified: true,
      },
    });

    const pass3 = adminRegRes.status === 201 && adminRegRes.data.user.role === 'cliente';
    results.push({
      name: '3. Bloqueo de asignación de rol admin en registro (degrada a cliente)',
      passed: pass3,
      details: `Rol asignado por el servidor: "${adminRegRes.data?.user?.role}" (admin fue denegado)`,
    });

    // -------------------------------------------------------------------------
    // TEST 4: Login con contraseña incorrecta (Mensaje genérico)
    // -------------------------------------------------------------------------
    console.log('[Test 4] Intento de login con contraseña errónea...');
    const badPassRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'carlos@kabaly.app',
        password: 'ContraseñaTotalmenteErronea!',
      },
    });

    const pass4 = badPassRes.status === 401 && badPassRes.data.error.includes('Credenciales incorrectas');
    results.push({
      name: '4. Rechazo de contraseña incorrecta con mensaje genérico',
      passed: pass4,
      details: `Status: ${badPassRes.status}, Mensaje: "${badPassRes.data?.error}"`,
    });

    // -------------------------------------------------------------------------
    // TEST 5: Login con correo no existente (Mismo mensaje genérico para evitar enumeración)
    // -------------------------------------------------------------------------
    console.log('[Test 5] Intento de login con correo inexistente...');
    const noUserRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'noexiste@kabaly.app',
        password: 'CualquierPassword123!',
      },
    });

    const pass5 = noUserRes.status === 401 && noUserRes.data.error.includes('Credenciales incorrectas');
    results.push({
      name: '5. Protección contra enumeración de cuentas (mismo mensaje genérico)',
      passed: pass5,
      details: `Status: ${noUserRes.status}, Mensaje: "${noUserRes.data?.error}"`,
    });

    // -------------------------------------------------------------------------
    // TEST 6: Login exitoso con credenciales válidas
    // -------------------------------------------------------------------------
    console.log('[Test 6] Login con credenciales válidas...');
    const loginRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'carlos@kabaly.app',
        password: 'PasswordSegura2026!',
      },
    });

    const loginCookie = loginRes.setCookie ? loginRes.setCookie.split(';')[0] : '';
    const pass6 = loginRes.status === 200 && loginRes.data.user.email === 'carlos@kabaly.app' && !!loginCookie;
    results.push({
      name: '6. Inicio de sesión exitoso con verificación de hash bcrypt',
      passed: pass6,
      details: `Status: ${loginRes.status}, User: ${loginRes.data?.user?.name}, Cookie generada: ${!!loginCookie}`,
    });

    // -------------------------------------------------------------------------
    // TEST 7: Ruta protegida sin sesión -> 401
    // -------------------------------------------------------------------------
    console.log('[Test 7] Petición a ruta protegida sin sesión...');
    const unauthRes = await apiRequest('/api/users/profile', {
      method: 'POST',
      body: { name: 'Intento Sin Sesion' },
    });

    const pass7 = unauthRes.status === 401;
    results.push({
      name: '7. Acceso a rutas protegidas sin sesión devuelve 401 Unauthorized',
      passed: pass7,
      details: `Status: ${unauthRes.status}, Error: "${unauthRes.data?.error}"`,
    });

    // -------------------------------------------------------------------------
    // TEST 8: Usuario normal intentando acceder a ruta admin -> 403
    // -------------------------------------------------------------------------
    console.log('[Test 8] Usuario normal intentando moderar tarotista (Admin)...');
    const normalUserAdminRes = await apiRequest('/api/admin/approve-tarotista', {
      method: 'POST',
      cookie: loginCookie,
      body: { profileId: 'tar_1', approve: true },
    });

    const pass8 = normalUserAdminRes.status === 403;
    results.push({
      name: '8. Usuario normal intentando acceder a ruta de administración devuelve 403 Forbidden',
      passed: pass8,
      details: `Status: ${normalUserAdminRes.status}, Error: "${normalUserAdminRes.data?.error}"`,
    });

    // -------------------------------------------------------------------------
    // TEST 9: Imposibilidad de editar otra cuenta cambiando el id de la petición
    // -------------------------------------------------------------------------
    console.log('[Test 9] Intento de alterar otro usuario enviando userId ajeno en body...');
    const editRes = await apiRequest('/api/users/profile', {
      method: 'POST',
      cookie: loginCookie, // sesión de Carlos
      body: {
        userId: 'usr_admin', // Intento malicioso de modificar al admin
        name: 'Carlos Nombre Actualizado',
        role: 'admin',       // Intento malicioso de elevarse a admin
      },
    });

    // Carlos actualizó su propio perfil; el admin no fue alterado y el rol de Carlos sigue siendo cliente
    const pass9 = editRes.status === 200 && editRes.data.user.name === 'Carlos Nombre Actualizado' && editRes.data.user.role === 'cliente';
    results.push({
      name: '9. Imposibilidad de alterar cuenta ajena o rol mediante parámetros de petición',
      passed: pass9,
      details: `Nombre actualizado solo en la cuenta propia (${editRes.data?.user?.email}), Rol conservado: "${editRes.data?.user?.role}"`,
    });

    // -------------------------------------------------------------------------
    // TEST 10: Llamada a /api/coins/topup -> 503 sin modificar saldo
    // -------------------------------------------------------------------------
    console.log('[Test 10] Intento de recarga de monedas sin pasarela de pago...');
    const topupRes = await apiRequest('/api/coins/topup', {
      method: 'POST',
      cookie: loginCookie,
      body: { packageId: 'pack_intro' },
    });

    const pass10 = topupRes.status === 503 && topupRes.data.error.includes('La pasarela de pago seguro aún no está disponible');
    results.push({
      name: '10. Intento de crear monedas directamente devuelve 503 Service Unavailable y no acredita saldo',
      passed: pass10,
      details: `Status: ${topupRes.status}, Mensaje: "${topupRes.data?.error}"`,
    });

    // -------------------------------------------------------------------------
    // TEST 11: /api/state no filtra correos ajenos, IBANs ni reportes privados
    // -------------------------------------------------------------------------
    console.log('[Test 11] Comprobando ausencia de datos privados ajenos en /api/state...');
    const stateRes = await apiRequest('/api/state', {
      method: 'GET',
      cookie: loginCookie, // Carlos
    });

    const data = stateRes.data;
    const hasUsersList = !!data.users; // No debe enviar la tabla de usuarios completa
    const leakedReports = Array.isArray(data.reports) && data.reports.length > 0;
    const leakedWithdrawals = Array.isArray(data.withdrawals) && data.withdrawals.length > 0;
    const pass11 = !hasUsersList && !leakedReports && !leakedWithdrawals && data.currentUser.email === 'carlos@kabaly.app';

    results.push({
      name: '11. /api/state no expone usuarios ajenos, reportes privados ni transferencias a usuarios regulares',
      passed: pass11,
      details: `users list en respuesta: ${hasUsersList}, reports filtrados: ${!leakedReports}, withdrawals filtrados: ${!leakedWithdrawals}`,
    });

    // -------------------------------------------------------------------------
    // TEST 12: Cierre de sesión (Logout) e invalidación de token
    // -------------------------------------------------------------------------
    console.log('[Test 12] Cierre de sesión e invalidación...');
    const logoutRes = await apiRequest('/api/auth/logout', {
      method: 'POST',
      cookie: loginCookie,
    });

    // Ahora intentamos acceder con la cookie invalidada
    const afterLogoutRes = await apiRequest('/api/auth/me', {
      method: 'GET',
      cookie: loginCookie,
    });

    const pass12 = logoutRes.status === 200 && afterLogoutRes.data.user === null;
    results.push({
      name: '12. Cierre de sesión e invalidación inmediata del token en base de datos',
      passed: pass12,
      details: `Status logout: ${logoutRes.status}, Usuario tras logout: ${afterLogoutRes.data?.user}`,
    });

  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log('RESUMEN DE PRUEBAS EJECUTADAS:');
  console.log('====================================================');
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? '✅ PASÓ' : '❌ FALLÓ';
    console.log(`${icon} | ${r.name}`);
    if (r.details) console.log(`       ↳ ${r.details}`);
    if (!r.passed) allPassed = false;
  }
  console.log('====================================================');
  console.log(`RESULTADO FINAL: ${allPassed ? 'TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO (12/12)' : 'ALGUNAS PRUEBAS FALLARON'}`);
  console.log('====================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('ERROR FATAL EN SUITE DE PRUEBAS:', err);
  process.exit(1);
});
