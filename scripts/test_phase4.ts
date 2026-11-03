import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

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
    const raw = res.headers.raw()['set-cookie'];
    if (raw) {
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
    if (options.body && typeof options.body === 'object' && !(options.body instanceof Buffer)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
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

  async registerOrLogin(password: string) {
    // Try login first
    let res = await this.request('/api/auth/login', {
      method: 'POST',
      body: { email: this.email, password },
    });
    if (res.ok && res.data.user) {
      this.user = res.data.user;
      return this.user;
    }

    // Otherwise register
    res = await this.request('/api/auth/register', {
      method: 'POST',
      body: {
        email: this.email,
        password,
        name: this.name,
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

async function runTests() {
  console.log('🔮 INICIANDO PRUEBAS DE ACEPTACIÓN FASE 4 - KABALY 🔮\n');

  const clientA = new SessionClient('luna_phase4@kabaly.com', 'Luna Astral Phase4');
  const clientB = new SessionClient('orion_phase4@kabaly.com', 'Orión Místico Phase4');

  const password = 'KabalySecretPassword2026!';

  // Step 1: Autenticación de dos cuentas reales
  console.log('1. Autenticación de 2 cuentas independientes (A y B)...');
  await clientA.registerOrLogin(password);
  await clientB.registerOrLogin(password);
  console.log(`   ✓ Cuenta A: ${clientA.user.name} (${clientA.user.id})`);
  console.log(`   ✓ Cuenta B: ${clientB.user.name} (${clientB.user.id})`);

  // Step 2: Cuenta A crea una publicación para las pruebas sociales
  console.log('\n2. Creación de publicación de prueba por Cuenta A...');
  const postRes = await clientA.request('/api/posts', {
    method: 'POST',
    body: {
      title: 'Portal de Luna Nueva en Escorpio',
      category: 'Tarot',
      mediaUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800',
      mediaType: 'image',
      description: 'Publicación de prueba para verificar interacciones sociales Fase 4',
      isPremium: false,
      idempotencyKey: `phase4_test_post_${Date.now()}`,
    },
  });
  assert(postRes.ok, `Fallo al crear publicación: ${JSON.stringify(postRes.data)}`);
  const testPost = postRes.data.post;
  console.log(`   ✓ Publicación creada con éxito: ${testPost.id} ("${testPost.title}")`);

  // Step 3: Likes persistentes y operaciones explícitas (POST y DELETE)
  console.log('\n3. Comprobación de Likes persistentes y unicidad...');
  // 3.1 Dar Like
  const like1 = await clientB.request(`/api/posts/${testPost.id}/like`, { method: 'POST' });
  if (!like1.ok) {
    console.error('like1 failed:', like1.status, like1.data);
  }
  assert(like1.ok && like1.data.isLikedByCurrentUser === true, `Fallo al dar like con Cuenta B: ${JSON.stringify(like1.data)}`);
  const initialLikes = like1.data.likes;
  console.log(`   ✓ Cuenta B dio Like. Contador: ${initialLikes}, isLiked: ${like1.data.isLikedByCurrentUser}`);

  // 3.2 Reintento de Dar Like (Idempotencia / Evitar duplicados por doble click)
  const likeRetry = await clientB.request(`/api/posts/${testPost.id}/like`, { method: 'POST' });
  assert(likeRetry.ok && likeRetry.data.likes === initialLikes, 'Reintento de Like incrementó indebidamente el contador');
  console.log(`   ✓ Reintento de Like no duplica: Contador se mantiene en ${likeRetry.data.likes}`);

  // 3.3 Quitar Like explícito (DELETE)
  const unlike1 = await clientB.request(`/api/posts/${testPost.id}/like`, { method: 'DELETE' });
  assert(unlike1.ok && unlike1.data.isLikedByCurrentUser === false && unlike1.data.likes === initialLikes - 1, 'Fallo al quitar like con Cuenta B');
  console.log(`   ✓ Cuenta B quitó Like. Contador: ${unlike1.data.likes}, isLiked: ${unlike1.data.isLikedByCurrentUser}`);

  // 3.4 Reintento de Quitar Like
  const unlikeRetry = await clientB.request(`/api/posts/${testPost.id}/like`, { method: 'DELETE' });
  assert(unlikeRetry.ok && unlikeRetry.data.likes === initialLikes - 1, 'Reintento de unlike alteró indebidamente el contador');
  console.log(`   ✓ Reintento de Quitar Like es idempotente: Contador permanece en ${unlikeRetry.data.likes}`);

  // Dejar el post con like para pruebas posteriores
  await clientB.request(`/api/posts/${testPost.id}/like`, { method: 'POST' });

  // Step 4: Comentarios reales, respuestas de 1 nivel, sanitización y permisos
  console.log('\n4. Comprobación de Comentarios reales e hilos...');
  // 4.1 Cuenta B crea comentario con intento de inyección HTML
  const xssContent = '<script>alert("hack")</script>Bendiciones de luz para tu tirada!';
  const comment1Res = await clientB.request(`/api/posts/${testPost.id}/comments`, {
    method: 'POST',
    body: { content: xssContent },
  });
  assert(comment1Res.ok, `Fallo al crear comentario: ${JSON.stringify(comment1Res.data)}`);
  const comment1 = comment1Res.data.comment;
  assert(!comment1.content.includes('<script>'), 'El servidor no sanitizó el HTML');
  console.log(`   ✓ Comentario creado con HTML sanitizado: "${comment1.content}"`);

  // 4.2 Límite de envío abusivo (Rate limiting < 1.5s)
  const spamRes = await clientB.request(`/api/posts/${testPost.id}/comments`, {
    method: 'POST',
    body: { content: 'Comentario spam inmediato' },
  });
  assert(spamRes.status === 429, `El servidor no aplicó rate limiting: status=${spamRes.status}`);
  console.log('   ✓ Rate limit activo: el envío abusivo fue rechazado con HTTP 429');

  // Esperar 1.6s para que pase el rate limit
  await new Promise(r => setTimeout(r, 1600));

  // 4.3 Cuenta A responde al comentario de Cuenta B (1 nivel de anidación)
  const replyRes = await clientA.request(`/api/posts/${testPost.id}/comments`, {
    method: 'POST',
    body: { content: 'Gracias por tu bendición sagrada Orión', parentId: comment1.id },
  });
  assert(replyRes.ok, `Fallo al responder comentario: ${JSON.stringify(replyRes.data)}`);
  const reply1 = replyRes.data.comment;
  console.log(`   ✓ Respuesta anidada creada: "${reply1.content}" (parentId: ${reply1.parentId})`);

  // 4.4 Verificar lectura de comentarios desde Cuenta B
  const listCommentsRes = await clientB.request(`/api/posts/${testPost.id}/comments`);
  assert(listCommentsRes.ok && listCommentsRes.data.comments.length >= 1, 'No se cargaron los comentarios');
  const rootComment = listCommentsRes.data.comments.find((c: any) => c.id === comment1.id);
  assert(rootComment && rootComment.replies.length >= 1, 'No se anidó la respuesta');
  console.log(`   ✓ Comentarios leídos con éxito: ${listCommentsRes.data.total} comentarios en hilo`);

  // 4.5 Rechazo de borrado de comentario ajeno (Cuenta B intenta borrar la respuesta de Cuenta A)
  const illegalDelete = await clientB.request(`/api/comments/${reply1.id}`, { method: 'DELETE' });
  assert(illegalDelete.status === 403, `Se permitió borrar comentario ajeno: status=${illegalDelete.status}`);
  console.log('   ✓ Seguridad comprobada: Intento de borrado de comentario ajeno rechazado con HTTP 403');

  // 4.6 Conservación de estructura de hilo al borrar padre (Soft delete marker)
  const parentDelete = await clientB.request(`/api/comments/${comment1.id}`, { method: 'DELETE' });
  assert(parentDelete.ok, 'Fallo al borrar propio comentario');
  const commentsAfterDelete = await clientA.request(`/api/posts/${testPost.id}/comments`);
  const deletedParent = commentsAfterDelete.data.comments.find((c: any) => c.id === comment1.id);
  assert(deletedParent && (deletedParent.isDeleted === true || deletedParent.isDeleted === 1), 'El comentario padre no fue marcado como eliminado');
  assert(deletedParent.replies.length >= 1, 'Las respuestas hijas se perdieron al borrar el padre');
  console.log(`   ✓ Estructura de hilo conservada: Padre marcado como "${deletedParent.content}", ${deletedParent.replies.length} respuestas preservadas`);

  // Step 5: Seguir y dejar de seguir (Follows) y Feed «Siguiendo»
  console.log('\n5. Comprobación de Seguir, Dejar de seguir y Feed Siguiendo...');
  // 5.1 Rechazo de auto-seguimiento
  const selfFollow = await clientA.request(`/api/users/${clientA.user.id}/follow`, { method: 'POST' });
  assert(selfFollow.status === 400, `Se permitió auto-seguimiento: status=${selfFollow.status}`);
  console.log('   ✓ Rechazo de auto-seguimiento comprobado (HTTP 400)');

  // 5.2 Cuenta B sigue a Cuenta A
  const followRes = await clientB.request(`/api/users/${clientA.user.id}/follow`, { method: 'POST' });
  assert(followRes.ok && followRes.data.isFollowing === true, 'Fallo al seguir a Cuenta A');
  console.log(`   ✓ Cuenta B ahora sigue a Cuenta A. Seguidores de A: ${followRes.data.followersCount}`);

  // 5.3 Feed «Siguiendo» de Cuenta B debe incluir el post de Cuenta A
  const feedFollowing = await clientB.request('/api/posts?category=Siguiendo');
  assert(feedFollowing.ok, 'Error al consultar feed Siguiendo');
  const postFound = feedFollowing.data.items.some((p: any) => p.id === testPost.id);
  assert(postFound, 'El post de la cuenta seguida no apareció en el feed Siguiendo');
  console.log(`   ✓ Feed «Siguiendo» muestra publicaciones de las cuentas seguidas (${feedFollowing.data.items.length} posts)`);

  // 5.4 Cuenta B deja de seguir a Cuenta A
  const unfollowRes = await clientB.request(`/api/users/${clientA.user.id}/follow`, { method: 'DELETE' });
  assert(unfollowRes.ok && unfollowRes.data.isFollowing === false, 'Fallo al dejar de seguir');
  console.log(`   ✓ Cuenta B dejó de seguir a Cuenta A. Seguidores de A: ${unfollowRes.data.followersCount}`);

  // 5.5 Feed «Siguiendo» sin cuentas seguidas (Estado Vacío útil, sin falsos destacados automáticos)
  const feedEmpty = await clientB.request('/api/posts?category=Siguiendo');
  assert(feedEmpty.ok && feedEmpty.data.items.length === 0, 'El feed Siguiendo incluyó posts cuando no se sigue a nadie');
  console.log('   ✓ Feed «Siguiendo» está vacío cuando no hay cuentas seguidas (sin perfiles forzados)');

  // Step 6: Guardar publicaciones (Colección privada)
  console.log('\n6. Comprobación de Guardar publicaciones y Privacidad...');
  // 6.1 Cuenta B guarda el post de Cuenta A
  const saveRes = await clientB.request(`/api/posts/${testPost.id}/save`, { method: 'POST' });
  assert(saveRes.ok && saveRes.data.isSavedByCurrentUser === true, 'Fallo al guardar post');
  console.log('   ✓ Cuenta B guardó la publicación en su colección');

  // 6.2 Cuenta B consulta sus guardados
  const savedB = await clientB.request('/api/posts/saved');
  if (!savedB.ok || !savedB.data.items.some((p: any) => p.id === testPost.id)) {
    console.error('savedB debug:', savedB.status, JSON.stringify(savedB.data), 'targetId:', testPost.id);
  }
  assert(savedB.ok && savedB.data.items.some((p: any) => p.id === testPost.id), 'El post guardado no aparece en la colección de B');
  console.log(`   ✓ Cuenta B tiene ${savedB.data.items.length} publicación guardada`);

  // 6.3 Privacidad estricta: Cuenta A consulta sus guardados y NO debe ver los de Cuenta B
  const savedA = await clientA.request('/api/posts/saved');
  const leakFound = savedA.data.items.some((p: any) => p.id === testPost.id);
  assert(!leakFound, 'Violación de privacidad: Cuenta A puede ver los guardados de Cuenta B');
  console.log('   ✓ Privacidad comprobada: Los guardados son 100% privados entre cuentas');

  // 6.4 Quitar de guardados
  const unsaveRes = await clientB.request(`/api/posts/${testPost.id}/save`, { method: 'DELETE' });
  assert(unsaveRes.ok && unsaveRes.data.isSavedByCurrentUser === false, 'Fallo al quitar de guardados');
  console.log('   ✓ Publicación retirada de guardados con éxito');

  // Step 7: Stories de 24 horas, visualización única, expiración y retirada
  console.log('\n7. Comprobación de Stories de 24 horas y seguridad...');
  // 7.1 Cuenta A publica una story
  const storyRes = await clientA.request('/api/stories', {
    method: 'POST',
    body: {
      mediaUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=600',
      mediaType: 'image',
      caption: 'Alineación de Júpiter y la Luna ✨',
    },
  });
  assert(storyRes.ok, `Fallo al publicar story: ${JSON.stringify(storyRes.data)}`);
  const story = storyRes.data.story;
  const createdAtMs = new Date(story.createdAt).getTime();
  const expiresAtMs = new Date(story.expiresAt).getTime();
  const diffHours = (expiresAtMs - createdAtMs) / (1000 * 60 * 60);
  assert(Math.abs(diffHours - 24) < 0.05, `La caducidad no fue de 24h: diff=${diffHours}h`);
  console.log(`   ✓ Story creada con caducidad en servidor a las 24 horas exactas (${story.expiresAt})`);

  // 7.2 Cuenta B visualiza la story de Cuenta A
  const view1 = await clientB.request(`/api/stories/${story.id}/view`, { method: 'POST' });
  assert(view1.ok && view1.data.isNewView === true && view1.data.totalViews === 1, 'Fallo al registrar visualización');
  console.log('   ✓ Visualización de Cuenta B registrada (1 vista)');

  // 7.3 Visualización duplicada de Cuenta B (debe ser idempotente, 1 vista por usuario)
  const viewRetry = await clientB.request(`/api/stories/${story.id}/view`, { method: 'POST' });
  assert(viewRetry.ok && viewRetry.data.isNewView === false && viewRetry.data.totalViews === 1, 'Visualización duplicada contó 2 veces');
  console.log('   ✓ Visualización única garantizada: el reintento no altera el contador');

  // 7.4 Privacidad de espectadores: Cuenta B intenta consultar quién vio la story de A
  const illegalViewers = await clientB.request(`/api/stories/${story.id}/views`);
  assert(illegalViewers.status === 403, `Usuario ajeno pudo ver la lista de espectadores: status=${illegalViewers.status}`);
  console.log('   ✓ Privacidad de viewers comprobada: Consulta de espectadores ajena rechazada con HTTP 403');

  // 7.5 El autor (Cuenta A) sí puede consultar sus espectadores
  const authorViewers = await clientA.request(`/api/stories/${story.id}/views`);
  assert(authorViewers.ok && authorViewers.data.viewers.some((v: any) => v.userId === clientB.user.id), 'El autor no pudo ver a Cuenta B en sus espectadores');
  console.log(`   ✓ El autor consulta sus espectadores: ${authorViewers.data.viewers.length} espectador verificado (${clientB.user.name})`);

  // 7.6 Retirada de story antes de que caduque por el autor
  const deleteStoryRes = await clientA.request(`/api/stories/${story.id}`, { method: 'DELETE' });
  assert(deleteStoryRes.ok, 'Fallo al retirar story');
  console.log('   ✓ Story retirada anticipadamente por su autor');

  // 7.7 Rechazo de acceso directo a story retirada o caducada por API
  const deadStoryRes = await clientB.request(`/api/stories/${story.id}`);
  assert(deadStoryRes.status === 404 || deadStoryRes.status === 410, `Acceso a story retirada no retornó 404: status=${deadStoryRes.status}`);
  console.log('   ✓ Acceso a story eliminada/caducada denegado por API con HTTP 404');

  // 7.8 Caducidad en servidor: story con expiresAt en el pasado
  const expiredStoryRes = await clientA.request('/api/stories', {
    method: 'POST',
    body: {
      mediaUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=600',
      mediaType: 'image',
      caption: 'Story para prueba de caducidad',
    },
  });
  assert(expiredStoryRes.ok, 'Fallo al crear story para caducidad');
  const expStoryId = expiredStoryRes.data.story.id;

  // Actualizar directamente en base de datos para simular paso de 24 horas
  const { initDatabase, getDb } = await import('../src/db/database.js');
  await initDatabase();
  const db = await getDb();
  await db.run("UPDATE stories SET expires_at = datetime('now', '-1 hour') WHERE id = ?", [expStoryId]);

  // Consulta por API debe retornar 404/410 aunque se conozca el id
  const getExpired = await clientB.request(`/api/stories/${expStoryId}`);
  assert(getExpired.status === 404 || getExpired.status === 410, `Acceso a story caducada no retornó 404: status=${getExpired.status}`);
  console.log('   ✓ Caducidad del servidor validada: Story caducada rechazada con HTTP 404');

  // Step 8: Persistencia de datos relacionales en disco SQLite
  console.log('\n8. Comprobación de persistencia de datos relacionales...');
  const [likesCnt, commentsCnt, followsCnt, savedCnt, storiesCnt, viewsCnt] = await Promise.all([
    db.get<{ c: number }>('SELECT COUNT(*) as c FROM post_likes'),
    db.get<{ c: number }>('SELECT COUNT(*) as c FROM comments'),
    db.get<{ c: number }>('SELECT COUNT(*) as c FROM follows'),
    db.get<{ c: number }>('SELECT COUNT(*) as c FROM saved_posts'),
    db.get<{ c: number }>('SELECT COUNT(*) as c FROM stories'),
    db.get<{ c: number }>('SELECT COUNT(*) as c FROM story_views'),
  ]);
  console.log(`   ✓ Registros persistidos en disco SQLite (kabaly.db):`);
  console.log(`     - post_likes: ${likesCnt?.c || 0} filas`);
  console.log(`     - comments: ${commentsCnt?.c || 0} filas`);
  console.log(`     - follows: ${followsCnt?.c || 0} filas`);
  console.log(`     - saved_posts: ${savedCnt?.c || 0} filas`);
  console.log(`     - stories: ${storiesCnt?.c || 0} filas`);
  console.log(`     - story_views: ${viewsCnt?.c || 0} filas`);

  console.log('\n======================================================');
  console.log('🌟 TODAS LAS PRUEBAS DE ACEPTACIÓN DE LA FASE 4 COMPLETADAS CON ÉXITO 🌟');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ ERROR DURANTE LAS PRUEBAS DE ACEPTACIÓN:', err);
  process.exit(1);
});
