import http from 'http';
import fs from 'fs';
import path from 'path';

process.env.NODE_ENV = 'test';
process.env.TEST_RUN = 'true';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(process.cwd(), 'test_kabaly_phase3.db');

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

// Helper de sesión usando fetch estándar y FormData
class SessionClient {
  public cookie: string = '';

  async apiRequest(url: string, options: {
    method?: string;
    body?: any;
    isFormData?: boolean;
    headers?: Record<string, string>;
  } = {}) {
    const headers: Record<string, string> = {
      ...(options.headers || {}),
    };

    if (this.cookie) {
      headers['Cookie'] = this.cookie;
    }

    let bodyData: any = undefined;
    if (options.body) {
      if (options.isFormData) {
        bodyData = options.body;
      } else {
        headers['Content-Type'] = 'application/json';
        bodyData = JSON.stringify(options.body);
      }
    }

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: bodyData,
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      // Extraer nombre=valor
      const cookieVal = setCookie.split(';')[0];
      this.cookie = cookieVal;
    }

    let data: any = null;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return { status: res.status, data, headers: res.headers };
  }

  async uploadFile(url: string, filename: string, mimeType: string, content: string | Buffer) {
    const formData = new FormData();
    const blob = new Blob([content], { type: mimeType });
    formData.append('file', blob, filename);

    return this.apiRequest(url, {
      method: 'POST',
      body: formData,
      isFormData: true,
    });
  }
}

async function runPhase3Tests() {
  console.log('========================================================');
  console.log(' INICIANDO SUITE DE PRUEBAS AUTOMATIZADAS - FASE 3');
  console.log(' Publicaciones, Reels, Feed Persistente y Gestión Propia');
  console.log('========================================================\n');

  let app = await createServerApp();
  let server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(3098, '127.0.0.1', () => resolve());
  });

  const baseUrl = 'http://127.0.0.1:3098';

  const user1 = new SessionClient();
  const user2 = new SessionClient();

  try {
    // 1. Registro de usuarios reales con confirmación de edad
    console.log('[1] Registrando Cuentas para Pruebas (Usuario 1 & Usuario 2)...');
    const r1 = await user1.apiRequest(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      body: {
        name: 'Sacerdotisa Selene',
        email: 'selene@kabaly.test',
        password: 'PasswordSegura123!',
        role: 'tarotista',
        isAgeVerified: true,
      },
    });
    const user1Data = r1.data.user;

    const r2 = await user2.apiRequest(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      body: {
        name: 'Carlos Buscador',
        email: 'carlos@kabaly.test',
        password: 'PasswordSegura123!',
        role: 'cliente',
        isAgeVerified: true,
      },
    });
    const user2Data = r2.data.user;

    results.push({
      name: 'Registro e Inicio de Sesión de Cuentas Reales (Tarotista y Cliente)',
      passed: r1.status === 201 && r2.status === 201 && !!user1Data && !!user2Data && !!user1.cookie && !!user2.cookie,
      details: `User1 ID: ${user1Data?.id}, User2 ID: ${user2Data?.id}`,
    });

    // 2. Subida de archivos (Foto y Vídeo)
    console.log('[2] Probando Subida de Archivo Foto (JPEG)...');
    const dummyImage = Buffer.from('fake-jpeg-binary-header-for-test');
    const upImg = await user1.uploadFile(`${baseUrl}/api/upload`, 'tirada.jpg', 'image/jpeg', dummyImage);
    
    results.push({
      name: 'Subida de Foto desde Dispositivo (POST /api/upload)',
      passed: upImg.status === 200 && upImg.data.success && upImg.data.type === 'image' && upImg.data.url.startsWith('/uploads/'),
      details: `URL devuelta: ${upImg.data.url}`,
    });

    console.log('[3] Probando Subida de Archivo Vídeo (MP4)...');
    const dummyVideo = Buffer.from('fake-mp4-video-stream-buffer');
    const upVid = await user1.uploadFile(`${baseUrl}/api/upload`, 'ritual.mp4', 'video/mp4', dummyVideo);

    results.push({
      name: 'Subida de Vídeo desde Dispositivo (POST /api/upload)',
      passed: upVid.status === 200 && upVid.data.success && upVid.data.type === 'video' && upVid.data.url.startsWith('/uploads/'),
      details: `URL devuelta: ${upVid.data.url}`,
    });

    console.log('[4] Probando Rechazo de Tipo de Archivo No Permitido (application/x-msdownload)...');
    const dummyExe = Buffer.from('mz-executable-bytes');
    const upBad = await user1.uploadFile(`${baseUrl}/api/upload`, 'virus.exe', 'application/x-msdownload', dummyExe);
    results.push({
      name: 'Rechazo de formato no admitido',
      passed: upBad.status === 400 && upBad.data.error !== undefined,
      details: upBad.data.error,
    });

    // 3. Creación de publicación vinculada a sesión
    console.log('[5] Creando Publicación de Tarot vinculada a la sesión...');
    const idempKey1 = 'test_idemp_' + Date.now();
    const createRes = await user1.apiRequest(`${baseUrl}/api/posts`, {
      method: 'POST',
      body: {
        title: 'Predicción de la Luna Llena en Escorpio',
        description: 'Tirada especial de revelación y transmutación.',
        category: 'Lunas',
        mediaUrl: upImg.data.url,
        mediaType: 'image',
        idempotencyKey: idempKey1,
      },
    });
    const createdPost = createRes.data.post;

    results.push({
      name: 'Creación de publicación vinculada a sesión de usuario',
      passed: createRes.status === 201 && createdPost && createdPost.authorId === user1Data.id,
      details: `ID Publicación: ${createdPost?.id}, Autor: ${createdPost?.authorId}`,
    });

    // 4. Clave de Idempotencia en Servidor (Evita duplicados)
    console.log('[6] Probando Idempotencia del Servidor (reintento con misma clave)...');
    const duplicateRes = await user1.apiRequest(`${baseUrl}/api/posts`, {
      method: 'POST',
      body: {
        title: 'Predicción de la Luna Llena en Escorpio (Reintento)',
        description: 'Tirada especial de revelación y transmutación.',
        category: 'Lunas',
        mediaUrl: upImg.data.url,
        mediaType: 'image',
        idempotencyKey: idempKey1, // Misma clave
      },
    });

    results.push({
      name: 'Control de Idempotencia en Servidor (Evita Duplicados)',
      passed: duplicateRes.status === 200 && duplicateRes.data.post.id === createdPost.id && duplicateRes.data.idempotent === true,
      details: `Mismo ID devuelto: ${duplicateRes.data.post?.id}`,
    });

    // 5. Bloqueo de monetización premium pendiente
    console.log('[7] Comprobando que la venta de contenido premium está bloqueada...');
    const premRes = await user1.apiRequest(`${baseUrl}/api/posts`, {
      method: 'POST',
      body: {
        title: 'Contenido VIP Secreto',
        category: 'Tarot',
        mediaUrl: upVid.data.url,
        mediaType: 'video',
        isPremium: true,
        priceCoins: 50,
        idempotencyKey: 'prem_test_' + Date.now(),
      },
    });

    results.push({
      name: 'Bloqueo de venta de contenido premium hasta fase de pagos',
      passed: premRes.status === 400 && premRes.data.error?.includes('deshabilitada'),
      details: premRes.data.error,
    });

    // 6. Feed Persistente con Paginación por Cursor y Filtrado
    console.log('[8] Creando varias publicaciones para probar paginación por cursor y categorías...');
    const catList = ['Tarot', 'Astrología', 'Tarot', 'Rituales', 'Tarot'];
    const createdIds: string[] = [createdPost.id];

    for (let i = 0; i < catList.length; i++) {
      const r = await user1.apiRequest(`${baseUrl}/api/posts`, {
        method: 'POST',
        body: {
          title: `Publicación ${i + 1} de ${catList[i]}`,
          category: catList[i],
          mediaUrl: upVid.data.url,
          mediaType: 'video',
          idempotencyKey: `auto_post_${i}_${Date.now()}`,
        },
      });
      if (r.status === 201) {
        createdIds.push(r.data.post.id);
      }
    }

    // Paginación por cursor: Página 1
    const page1Res = await user2.apiRequest(`${baseUrl}/api/posts?limit=3`);
    const page1Items = page1Res.data.items || [];
    const nextCursor1 = page1Res.data.nextCursor;

    // Paginación por cursor: Página 2
    const page2Res = await user2.apiRequest(`${baseUrl}/api/posts?limit=3&cursor=${encodeURIComponent(nextCursor1)}`);
    const page2Items = page2Res.data.items || [];

    // Comprobar que no hay duplicados entre páginas
    const set1 = new Set(page1Items.map((p: any) => p.id));
    const hasOverlap = page2Items.some((p: any) => set1.has(p.id));

    results.push({
      name: 'Paginación por Cursor Estable (Sin Duplicados ni Saltos)',
      passed: page1Items.length === 3 && page2Items.length > 0 && !hasOverlap && !!nextCursor1,
      details: `Pág 1: ${page1Items.length} items, Pág 2: ${page2Items.length} items, Solapamiento: ${hasOverlap}`,
    });

    // Filtrado por categoría
    console.log('[9] Probando filtrado real por categoría...');
    const tarotFilterRes = await user2.apiRequest(`${baseUrl}/api/posts?category=Tarot`);
    const allTarot = tarotFilterRes.data.items.length > 0 && tarotFilterRes.data.items.every((p: any) => p.category === 'Tarot');

    const emptyCategoryRes = await user2.apiRequest(`${baseUrl}/api/posts?category=Reiki`);
    const isReikiEmpty = emptyCategoryRes.data.items.length === 0;

    results.push({
      name: 'Filtrado Real por Categoría y Estado Vacío',
      passed: tarotFilterRes.data.items.length >= 3 && allTarot && isReikiEmpty,
      details: `Items Tarot: ${tarotFilterRes.data.items.length}, Items Reiki (vacío): ${emptyCategoryRes.data.items.length}`,
    });

    // 7. Edición y Gestión de Contenido Propio
    console.log('[10] Probando Edición de Publicación por el Propietario...');
    const editRes = await user1.apiRequest(`${baseUrl}/api/posts/${createdPost.id}`, {
      method: 'PUT',
      body: {
        title: 'Predicción de la Luna Llena (Título Editado)',
        description: 'Descripción actualizada con bendición.',
        category: 'Rituales',
      },
    });

    results.push({
      name: 'Edición de Publicación por el Propietario',
      passed: editRes.status === 200 && editRes.data.post.title.includes('Título Editado') && editRes.data.post.category === 'Rituales',
      details: `Nuevo título: ${editRes.data.post?.title}`,
    });

    console.log('[11] Probando Rechazo de Edición por Cuenta No Propietaria (User 2)...');
    const unauthorizedEdit = await user2.apiRequest(`${baseUrl}/api/posts/${createdPost.id}`, {
      method: 'PUT',
      body: {
        title: 'Intento de Hackeo por Usuario 2',
      },
    });

    results.push({
      name: 'Protección en Servidor: Rechazo de Edición por Otra Cuenta (403 Forbidden)',
      passed: unauthorizedEdit.status === 403,
      details: `Código devuelto: ${unauthorizedEdit.status} - ${unauthorizedEdit.data?.error}`,
    });

    // 8. Borrado Lógico (Retirada) y Comprobación de Enlace Directo
    console.log('[12] Probando Rechazo de Retirada por Otra Cuenta (User 2)...');
    const unauthorizedDelete = await user2.apiRequest(`${baseUrl}/api/posts/${createdPost.id}`, {
      method: 'DELETE',
    });

    results.push({
      name: 'Protección en Servidor: Rechazo de Retirada por Otra Cuenta (403 Forbidden)',
      passed: unauthorizedDelete.status === 403,
      details: `Código devuelto: ${unauthorizedDelete.status}`,
    });

    console.log('[13] Retirando Publicación por su Autor (Borrado Lógico)...');
    const deleteRes = await user1.apiRequest(`${baseUrl}/api/posts/${createdPost.id}`, {
      method: 'DELETE',
    });

    results.push({
      name: 'Retirada de Publicación con Borrado Lógico por el Propietario',
      passed: deleteRes.status === 200 && deleteRes.data.success === true,
      details: deleteRes.data.message,
    });

    // Verificar que la publicación ya NO aparece en el feed
    const feedAfterDelete = await user2.apiRequest(`${baseUrl}/api/posts?limit=50`);
    const isExludedFromFeed = !feedAfterDelete.data.items.some((p: any) => p.id === createdPost.id);

    // Verificar que la consulta directa devuelve 404 (retirada o no disponible)
    const directFetchDeleted = await user2.apiRequest(`${baseUrl}/api/posts/${createdPost.id}`);

    results.push({
      name: 'Ocultación en Feed y Pantalla de Contenido Retirado en Enlace Directo (404)',
      passed: isExludedFromFeed && directFetchDeleted.status === 404,
      details: `Oculto en feed: ${isExludedFromFeed}, Directo 404: ${directFetchDeleted.status === 404}`,
    });

    // Verificar que el archivo multimedia NO fue eliminado físicamente
    const filePath = path.join(process.cwd(), upImg.data.url.replace(/^\//, ''));
    const fileExistsOnDisk = fs.existsSync(filePath);

    results.push({
      name: 'Conservación Segura de Archivos (No destruye referencias compartidas)',
      passed: fileExistsOnDisk,
      details: `Archivo multimedia preservado en: ${filePath}`,
    });

    // 9. Persistencia tras Reinicio del Servidor
    console.log('[14] Reiniciando Servidor para Comprobar Persistencia...');
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // Iniciar nuevo servidor con la misma BD
    app = await createServerApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(3097, '127.0.0.1', () => resolve());
    });
    const restartedBaseUrl = 'http://127.0.0.1:3097';

    const restartFeed = await user2.apiRequest(`${restartedBaseUrl}/api/posts?limit=10`);
    const postsPersisted = restartFeed.data.items && restartFeed.data.items.length > 0;

    results.push({
      name: 'Persistencia Total de Publicaciones tras Reinicio de Servidor',
      passed: postsPersisted,
      details: `Publicaciones recuperadas intactas tras reinicio: ${restartFeed.data.items?.length}`,
    });

    await new Promise<void>((resolve) => server.close(() => resolve()));

  } catch (err: any) {
    console.error('Error durante la ejecución de pruebas:', err);
    results.push({
      name: 'Ejecución Global',
      passed: false,
      details: err.message,
    });
  }

  // Resumen final
  console.log('\n========================================================');
  console.log(' RESUMEN DE PRUEBAS DE ACEPTACIÓN - FASE 3');
  console.log('========================================================');
  let allPassed = true;
  for (const r of results) {
    const symbol = r.passed ? '✓ PASÓ' : '✗ FALLÓ';
    console.log(`[${symbol}] ${r.name}`);
    if (r.details) console.log(`        Detalles: ${r.details}`);
    if (!r.passed) allPassed = false;
  }
  console.log('========================================================');

  if (allPassed) {
    console.log('>>> TODAS LAS PRUEBAS AUTOMATIZADAS DE FASE 3 HAN PASADO CON ÉXITO <<<');
    process.exit(0);
  } else {
    console.error('>>> EXISTEN PRUEBAS QUE NO HAN PASADO <<<');
    process.exit(1);
  }
}

runPhase3Tests();
