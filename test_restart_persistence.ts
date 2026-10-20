import http from 'http';
import fs from 'fs';
import path from 'path';

process.env.DB_CLIENT = 'sqlite';
const dbPath = path.join(process.cwd(), 'test_persistent.db');
process.env.SQLITE_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.TEST_RUN = 'true';

if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

async function testPersistenceAcrossRestart() {
  console.log('[Test Persistencia] 1. Arrancando primer servidor...');
  const { createServerApp } = await import('./server');
  
  const app1 = await createServerApp();
  const server1 = http.createServer(app1);
  await new Promise<void>(res => server1.listen(3098, '127.0.0.1', res));

  // Registrar usuario
  const regRes = await fetch('http://127.0.0.1:3098/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Usuario Persistente',
      email: 'persistente@kabaly.app',
      password: 'MiPasswordSuperSegura2026!',
      role: 'cliente',
      isAgeVerified: true
    })
  });

  const regData: any = await regRes.json();
  const cookieHeader = regRes.headers.get('set-cookie')?.split(';')[0];
  console.log('[Test Persistencia] Usuario registrado con ID:', regData.user.id);

  // Cerrar primer servidor
  await new Promise<void>(res => server1.close(() => res()));
  console.log('[Test Persistencia] Servidor 1 detenido. Simulando reinicio...');

  // Arrancar segundo servidor apuntando a la misma base de datos
  const app2 = await createServerApp();
  const server2 = http.createServer(app2);
  await new Promise<void>(res => server2.listen(3098, '127.0.0.1', res));

  // Verificar que la sesión sigue viva tras el reinicio
  const meRes = await fetch('http://127.0.0.1:3098/api/auth/me', {
    headers: { 'Cookie': cookieHeader || '' }
  });
  const meData: any = await meRes.json();

  const { getDb } = await import('./src/db/database');
  const db = await getDb();
  await db.close();

  server2.close();
  setTimeout(() => {
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    } catch {}
  }, 500);

  if (meData.user && meData.user.email === 'persistente@kabaly.app') {
    console.log('✅ PERSISTENCIA COMPROBADA TRAS REINICIO: El usuario y su sesión siguen activos y consistentes.');
  } else {
    console.error('❌ FALLÓ PERSISTENCIA TRAS REINICIO');
    process.exit(1);
  }
}

testPersistenceAcrossRestart().catch(e => {
  console.error(e);
  process.exit(1);
});
