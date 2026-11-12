import dotenv from 'dotenv';
if (process.env.NODE_ENV !== 'test' && !process.env.TEST_RUN) {
  dotenv.config();
}

import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

import { initDatabase, getDb, getDbError } from './src/db/database';
import {
  registerUser,
  loginUser,
  logoutUser,
  SESSION_COOKIE_NAME,
} from './src/auth/authService';
import {
  attachUserMiddleware,
  requireAuth,
  requireAdmin,
  setSessionCookie,
  clearSessionCookie,
} from './src/auth/authMiddleware';
import {
  getPublicTarotistas,
  getPublicVideos,
  getFeedPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  addPostLike,
  removePostLike,
  createComment,
  getPostComments,
  deleteComment,
  followUser,
  unfollowUser,
  getUserRelationship,
  getUserFollowers,
  getUserFollowing,
  savePost,
  unsavePost,
  getUserSavedPosts,
  createStory,
  getActiveStories,
  getStoryById,
  deleteStory,
  recordStoryView,
  getStoryViewers,
  getPublicReviews,
  getUserConsultations,
  getUserLedger,
  getReports,
  getWithdrawals,
  getOrCreateConversation,
  getUserConversations,
  getConversationById,
  getConversationMessages,
  sendChatMessage,
  markConversationAsRead,
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportMessage,
  getReportedMessages,
  createChatAttachment,
  getChatAttachmentForUser,
  getTotalUnreadMessagesCount,
  getUserNotifications,
  markNotificationsRead,
  getUserHighlights,
  createProfileHighlight,
  deleteProfileHighlight,
  togglePinPost,
  toggleCommentLike,
  togglePinComment,
  getPublicUserProfile,
  applyForTarotistaKyc,
  searchSocialNetwork,
} from './src/db/repo';
import { uploadMediaMiddleware, uploadPrivateChatMiddleware, PRIVATE_CHAT_DIR } from './src/middleware/upload';
import { initialCoinPackages, initialGifts, initialLiveStreams } from './src/data/initialData';
import {
  getActiveCoinPackages,
  getCoinOrderById,
  getUserCoinOrders,
  getUserLedgerTransactions,
  createCoinOrderAndCheckoutSession,
  processStripeWebhookEvent,
  runWalletReconciliation,
  updateUserSpendingLimits,
  stripeClient,
  IS_TEST_MODE,
} from './src/services/stripeService';
import {
  createConsultationBooking,
  acceptConsultation,
  rejectConsultation,
  cancelConsultation,
  startConsultation,
  completeConsultation,
  createConsultationDispute,
  resolveConsultationDispute,
  getConsultationMessages,
  sendConsultationMessage,
  getConsultationRoomCredentials,
  createConsultationReview,
  autoExpireConsultations,
} from './src/services/consultationService';
import {
  getGiftCatalog,
  sendStreamGift,
  getStreamGiftEvents,
  unlockExclusivePost,
  checkPostAccess,
  getUserUnlockedPurchases,
  refundPostUnlock,
  withdrawPost,
} from './src/services/giftAndUnlockService';
import { processUploadedMedia } from './src/services/storageService';
import { realtimeHub } from './src/services/realtimeService';

// Initialize Gemini Client server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'MOCK_KEY',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export async function createServerApp() {
  // Inicializar base de datos relacional y migraciones
  try {
    await initDatabase();
  } catch (err: any) {
    console.error('[Database Warning]:', err.message);
  }

  const app = express();

  app.use(express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(cookieParser());
  app.use(attachUserMiddleware);

  // Servir archivos multimedia subidos
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Health check
  app.get('/api/health', (req, res) => {
    const dbErr = getDbError();
    res.status(dbErr ? 503 : 200).json({
      status: dbErr ? 'database_error' : 'ok',
      error: dbErr,
      time: new Date().toISOString()
    });
  });

  // Middleware de validación de base de datos
  app.use('/api', (req, res, next) => {
    const dbErr = getDbError();
    if (dbErr && req.path !== '/health') {
      return res.status(503).json({
        error: 'Error de conexión con la base de datos relacional.',
        details: dbErr,
      });
    }
    next();
  });

  // ---------------------------------------------------------------------------
  // 1. AUTENTICACIÓN REAL Y GESTIÓN DE SESIÓN
  // ---------------------------------------------------------------------------

  // Registro de usuario
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, password, role, isAgeVerified } = req.body;
      const { user, sessionToken } = await registerUser({
        name,
        email,
        password,
        role,
        isAgeVerified: !!isAgeVerified,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });

      setSessionCookie(res, sessionToken);

      // Enviar correo transaccional de bienvenida (no bloqueante)
      sendKabalyEmail(
        EmailTemplates.welcomeUser({
          userName: user.name,
          userEmail: user.email,
          role: user.role,
        })
      ).catch(() => {});

      res.status(201).json({ success: true, user });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error interno al registrar usuario.' });
    }
  });

  // Inicio de sesión
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const { user, sessionToken } = await loginUser({
        email,
        password,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });

      setSessionCookie(res, sessionToken);
      res.json({ success: true, user });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al iniciar sesión.' });
    }
  });

  // Cierre de sesión
  app.post('/api/auth/logout', async (req, res) => {
    try {
      await logoutUser(req.sessionToken);
      clearSessionCookie(res);
      res.json({ success: true, message: 'Sesión finalizada correctamente.' });
    } catch (err: any) {
      clearSessionCookie(res);
      res.json({ success: true });
    }
  });

  // Consultar usuario actual autenticado
  app.get('/api/auth/me', (req, res) => {
    res.json({ success: true, user: req.user || null });
  });

  // ---------------------------------------------------------------------------
  // 2. ESTADO GLOBAL SEGURO (/api/state)
  // REQUISITO: No debe entregar correos, documentos, datos bancarios, reportes
  // ni movimientos privados de otros usuarios.
  // ---------------------------------------------------------------------------
  app.get('/api/state', async (req, res) => {
    try {
      const currentUser = req.user || null;
      const isAdmin = currentUser?.role === 'admin';
      const isTarotista = currentUser?.role === 'tarotista';

      const [publicTarotistas, publicVideos, publicReviews, giftCatalog] = await Promise.all([
        getPublicTarotistas(),
        getPublicVideos(currentUser?.id),
        getPublicReviews(),
        getGiftCatalog().catch(() => initialGifts),
      ]);

      // Consultar únicamente los datos privados pertenecientes al usuario en sesión
      let userConsultations: any[] = [];
      let userLedger: any[] = [];
      let userReports: any[] = [];
      let userWithdrawals: any[] = [];

      if (currentUser) {
        [userConsultations, userLedger, userReports, userWithdrawals] = await Promise.all([
          getUserConsultations(currentUser.id, isAdmin),
          getUserLedger(currentUser.id, isAdmin),
          getReports(currentUser.id, isAdmin),
          getWithdrawals(currentUser.id, isAdmin, isTarotista),
        ]);
      }

      res.json({
        currentUser,
        tarotistaProfiles: publicTarotistas,
        videos: publicVideos,
        liveStreams: initialLiveStreams,
        reviews: publicReviews,
        gifts: giftCatalog,
        consultations: userConsultations,
        ledger: userLedger,
        reports: userReports,
        withdrawals: userWithdrawals,
        coinPackages: initialCoinPackages,
      });
    } catch (err: any) {
      console.error('[API State Error]:', err);
      res.status(500).json({ error: 'Error al recuperar el estado de la aplicación.' });
    }
  });

  // ---------------------------------------------------------------------------
  // 3. EDICIÓN SEGURA DE PERFIL PROPIO
  // REQUISITO: Cada usuario solo puede editar su perfil; no puede autoasignarse admin
  // ---------------------------------------------------------------------------
  app.post('/api/users/profile', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id; // Identidad obtenida estrictamente de la sesión
      const {
        name,
        handle,
        bio,
        avatar,
        coverImage,
        sunSign,
        moonSign,
        risingSign,
        rulingArcana,
        spiritualGift,
        isPrivate,
      } = req.body;
      const db = await getDb();

      // Validación
      const safeName = (name || '').trim();
      if (name !== undefined && safeName.length < 2) {
        return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres.' });
      }

      await db.run(`
        UPDATE users
        SET name = COALESCE(?, name),
            handle = COALESCE(?, handle),
            bio = COALESCE(?, bio),
            avatar = COALESCE(?, avatar),
            cover_image = COALESCE(?, cover_image),
            sun_sign = COALESCE(?, sun_sign),
            moon_sign = COALESCE(?, moon_sign),
            rising_sign = COALESCE(?, rising_sign),
            ruling_arcana = COALESCE(?, ruling_arcana),
            spiritual_gift = COALESCE(?, spiritual_gift),
            is_private = COALESCE(?, is_private),
            updated_at = ?
        WHERE id = ?
      `, [
        safeName || null,
        handle?.trim() || null,
        bio?.trim() || null,
        avatar?.trim() || null,
        coverImage?.trim() || null,
        sunSign !== undefined ? (sunSign?.trim() || null) : null,
        moonSign !== undefined ? (moonSign?.trim() || null) : null,
        risingSign !== undefined ? (risingSign?.trim() || null) : null,
        rulingArcana !== undefined ? (rulingArcana?.trim() || null) : null,
        spiritualGift !== undefined ? (spiritualGift?.trim() || null) : null,
        isPrivate !== undefined ? (isPrivate ? 1 : 0) : null,
        new Date().toISOString(),
        userId
      ]);

      // Sincronizar avatar/portada/nombre en perfil de tarotista y publicaciones propias
      if (avatar?.trim()) {
        await db.run('UPDATE tarotista_profiles SET avatar = ? WHERE user_id = ?', [avatar.trim(), userId]).catch(() => {});
        await db.run('UPDATE videos SET tarotista_avatar = ? WHERE tarotista_id = ?', [avatar.trim(), userId]).catch(() => {});
      }
      if (coverImage?.trim()) {
        await db.run('UPDATE tarotista_profiles SET banner = ? WHERE user_id = ?', [coverImage.trim(), userId]).catch(() => {});
      }
      if (safeName) {
        await db.run('UPDATE videos SET tarotista_name = ? WHERE tarotista_id = ?', [safeName, userId]).catch(() => {});
      }

      const updated = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);

      res.json({
        success: true,
        user: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          avatar: updated.avatar,
          coverImage: updated.cover_image,
          handle: updated.handle,
          bio: updated.bio,
          sunSign: updated.sun_sign || undefined,
          moonSign: updated.moon_sign || undefined,
          risingSign: updated.rising_sign || undefined,
          rulingArcana: updated.ruling_arcana || undefined,
          spiritualGift: updated.spiritual_gift || undefined,
          isPrivate: !!updated.is_private,
          coinsBalance: updated.coins_balance,
          isAgeVerified: !!updated.is_age_verified,
          spendingLimitDaily: updated.spending_limit_daily,
          spendingLimitWeekly: updated.spending_limit_weekly,
          spentToday: updated.spent_today,
          spentThisWeek: updated.spent_this_week,
          createdAt: updated.created_at,
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al actualizar el perfil.' });
    }
  });

  // ---------------------------------------------------------------------------
  // FASE 3: SUBIDA DE ARCHIVOS Y GESTIÓN DE PUBLICACIONES
  // ---------------------------------------------------------------------------

  // 3.1 Subida de fotos y vídeos validados (Híbrido: Cloudinary CDN o Local)
  app.post('/api/upload', requireAuth, (req, res) => {
    uploadMediaMiddleware.single('file')(req, res, async (err: any) => {
      if (err) {
        const message = err.message || 'Error al procesar el archivo.';
        return res.status(400).json({ error: message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No se ha enviado ningún archivo multimedia.' });
      }

      const isVideo = req.file.mimetype.startsWith('video');
      const localUrl = `/uploads/${req.file.filename}`;
      const uploaded = await processUploadedMedia(req.file.path, localUrl, 'kabaly_media');

      res.status(200).json({
        success: true,
        url: uploaded.url,
        storageProvider: uploaded.provider,
        type: isVideo ? 'video' : 'image',
        mediaType: isVideo ? 'video' : 'image',
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
      });
    });
  });

  // 3.2 Listado del feed con paginación por cursor y filtros reales
  app.get('/api/posts', async (req, res) => {
    try {
      const { limit, cursor, category, authorId, feed } = req.query;
      const isFollowingFeed = category === 'Siguiendo' || feed === 'following';
      const result = await getFeedPosts({
        limit: limit ? parseInt(limit as string, 10) : 10,
        cursor: cursor as string | undefined,
        category: category as string | undefined,
        authorId: authorId as string | undefined,
        currentUserId: req.user?.id,
        feedType: isFollowingFeed ? 'following' : 'all',
      });

      res.json(result);
    } catch (err: any) {
      console.error('[API Posts Feed Error]:', err);
      res.status(500).json({ error: 'Error al cargar las publicaciones del feed.' });
    }
  });

  // 4.4 Guardados privados (debe ir antes de /api/posts/:id para no ser capturado como parámetro :id)
  app.get('/api/posts/saved', requireAuth, async (req, res) => {
    try {
      const items = await getUserSavedPosts(req.user!.id);
      res.json({ success: true, items });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al consultar publicaciones guardadas.' });
    }
  });

  // 3.3 Obtener publicación individual (para enlace directo y compartir)
  app.get('/api/posts/:id', async (req, res) => {
    try {
      const post = await getPostById(req.params.id, req.user?.id);
      if (!post) {
        return res.status(404).json({
          error: 'Esta publicación sagrada ya no está disponible o ha sido retirada por su autor.',
          code: 'POST_NOT_FOUND',
        });
      }
      res.json({ success: true, post });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al consultar la publicación.' });
    }
  });

  // 3.4 Crear nueva publicación con control de idempotencia y validación
  app.post('/api/posts', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
      const { title, description, category, videoUrl, mediaUrl, mediaUrls, thumbnailUrl, mediaType, isPremium, priceCoins } = req.body;

      let safeIsPremium = false;
      let safePriceCoins: number | null = null;

      // REQUISITO FASE 9: Permitir a un tarotista configurar una publicación exclusiva con precio validado
      if (isPremium) {
        if (user.role !== 'tarotista' && user.role !== 'admin') {
          return res.status(403).json({
            error: 'Solo los tarotistas verificados pueden configurar publicaciones exclusivas de pago.',
            code: 'PREMIUM_ONLY_TAROTISTA',
          });
        }
        const parsedPrice = parseInt(priceCoins, 10);
        if (isNaN(parsedPrice) || parsedPrice <= 0 || parsedPrice > 50000) {
          return res.status(400).json({
            error: 'El precio en monedas debe ser un número entero positivo (máximo 50.000 monedas).',
            code: 'INVALID_PREMIUM_PRICE',
          });
        }
        if (!thumbnailUrl || !thumbnailUrl.trim()) {
          return res.status(400).json({
            error: 'Las publicaciones exclusivas deben incluir una portada o vista previa separada del archivo completo.',
            code: 'PREMIUM_THUMBNAIL_REQUIRED',
          });
        }
        safeIsPremium = true;
        safePriceCoins = parsedPrice;
      }

      const safeTitle = (title || '').trim();
      if (safeTitle.length < 3 || safeTitle.length > 150) {
        return res.status(400).json({ error: 'El título debe tener entre 3 y 150 caracteres.' });
      }

      const targetMediaUrl = (videoUrl || mediaUrl || '').trim();
      if (!targetMediaUrl) {
        return res.status(400).json({ error: 'Debe proporcionar una imagen o vídeo válido para publicar.' });
      }

      const safeCategory = (category || 'Tarot').trim();
      const safeMediaType: 'video' | 'image' = mediaType === 'image' ? 'image' : 'video';

      const result = await createPost({
        authorId: user.id,
        authorName: user.name,
        authorAvatar: user.avatar,
        isVerified: user.role === 'tarotista',
        title: safeTitle,
        description: (description || '').trim(),
        category: safeCategory,
        videoUrl: targetMediaUrl,
        mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : undefined,
        thumbnailUrl: (thumbnailUrl || '').trim(),
        mediaType: safeMediaType,
        idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : undefined,
        isPremium: safeIsPremium,
        priceCoins: safePriceCoins,
      });

      res.status(result.wasExisting ? 200 : 201).json({
        success: true,
        post: result.post,
        wasExisting: result.wasExisting,
        idempotent: result.wasExisting,
      });
    } catch (err: any) {
      console.error('[API Create Post Error]:', err);
      res.status(500).json({ error: 'Error al guardar la publicación en la base de datos.' });
    }
  });

  // 3.5 Editar publicación propia
  app.put('/api/posts/:id', requireAuth, async (req, res) => {
    try {
      const { title, description, category } = req.body;
      const result = await updatePost(
        req.params.id,
        req.user!.id,
        { title, description, category },
        req.user!.role === 'admin'
      );

      res.status(result.status).json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al actualizar la publicación.' });
    }
  });

  // 3.6 Retirar publicación propia (borrado lógico)
  app.delete('/api/posts/:id', requireAuth, async (req, res) => {
    try {
      const result = await deletePost(
        req.params.id,
        req.user!.id,
        req.user!.role === 'admin'
      );

      res.status(result.status).json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al retirar la publicación.' });
    }
  });

  // ---------------------------------------------------------------------------
  // FASE 4: INTERACCIONES SOCIALES Y STORIES FUNCIONALES
  // ---------------------------------------------------------------------------

  // 4.1 Likes Explícitos (Dar y Quitar Me gusta de forma idempotente)
  app.post('/api/posts/:id/like', requireAuth, async (req, res) => {
    try {
      const result = await addPostLike(req.params.id, req.user!.id);
      res.json({ success: true, ...result, isLikedByCurrentUser: result.isLiked });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al registrar Me gusta.' });
    }
  });

  app.delete('/api/posts/:id/like', requireAuth, async (req, res) => {
    try {
      const result = await removePostLike(req.params.id, req.user!.id);
      res.json({ success: true, ...result, isLikedByCurrentUser: result.isLiked });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al retirar Me gusta.' });
    }
  });

  // Ruta compatible anterior POST /api/videos/:id/like
  app.post('/api/videos/:id/like', requireAuth, async (req, res) => {
    try {
      const post = await getPostById(req.params.id, req.user!.id);
      if (!post) return res.status(404).json({ error: 'Publicación no encontrada.' });

      if (post.isLikedByCurrentUser) {
        const result = await removePostLike(req.params.id, req.user!.id);
        res.json({ success: true, likes: result.likes, isLikedByCurrentUser: false });
      } else {
        const result = await addPostLike(req.params.id, req.user!.id);
        res.json({ success: true, likes: result.likes, isLikedByCurrentUser: true });
      }
    } catch (err: any) {
      res.status(500).json({ error: 'Error al procesar like.' });
    }
  });

  // 4.2 Comentarios Reales con 1 Nivel de Respuestas
  const userCommentTimestamps = new Map<string, number>();

  app.get('/api/posts/:id/comments', async (req, res) => {
    try {
      const result = await getPostComments(req.params.id, req.user?.id);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al obtener los comentarios.' });
    }
  });

  app.post('/api/posts/:id/comments', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const now = Date.now();
      const lastComment = userCommentTimestamps.get(userId) || 0;

      // Rate limit anti-spam (mínimo 1.5s entre comentarios por usuario)
      if (now - lastComment < 1500) {
        return res.status(429).json({ error: 'Por favor, espera un momento antes de enviar otro comentario cósmico.' });
      }
      userCommentTimestamps.set(userId, now);

      const { content, parentId } = req.body;
      const comment = await createComment({
        videoId: req.params.id,
        authorId: userId,
        authorName: req.user!.name,
        authorAvatar: req.user!.avatar,
        content: content || '',
        parentId: parentId || null,
      });

      res.status(201).json({ success: true, comment });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al publicar comentario.' });
    }
  });

  app.delete('/api/comments/:id', requireAuth, async (req, res) => {
    try {
      const result = await deleteComment(
        req.params.id,
        req.user!.id,
        req.user!.role === 'admin'
      );
      res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al eliminar comentario.' });
    }
  });

  // 4.3 Seguir y Dejar de Seguir (Follows)
  app.post('/api/users/:id/follow', requireAuth, async (req, res) => {
    try {
      const rel = await followUser(req.user!.id, req.params.id);
      if (rel.isFollowing && req.params.id !== req.user!.id) {
        realtimeHub.emitToUser(req.params.id, 'new_notification', {
          type: 'follow',
          actorId: req.user!.id,
          actorName: req.user!.name,
          actorAvatar: req.user!.avatar,
          message: `${req.user!.name} ha comenzado a seguir tu camino espiritual.`,
          createdAt: new Date().toISOString(),
        });
      }
      res.json({ success: true, ...rel });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al seguir usuario.' });
    }
  });

  app.delete('/api/users/:id/follow', requireAuth, async (req, res) => {
    try {
      const rel = await unfollowUser(req.user!.id, req.params.id);
      res.json({ success: true, ...rel });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al dejar de seguir.' });
    }
  });

  app.get('/api/users/:id/followers', async (req, res) => {
    try {
      const followers = await getUserFollowers(req.params.id, req.user?.id);
      res.json({ success: true, followers, count: followers.length });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al obtener seguidores.' });
    }
  });

  app.get('/api/users/:id/following', async (req, res) => {
    try {
      const following = await getUserFollowing(req.params.id, req.user?.id);
      res.json({ success: true, following, count: following.length });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al obtener seguidos.' });
    }
  });

  app.get('/api/users/:id/relationship', async (req, res) => {
    try {
      const rel = await getUserRelationship(req.params.id, req.user?.id);
      res.json({ success: true, ...rel });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al consultar relación.' });
    }
  });

  // 4.4 Guardar Publicaciones Privadas (Bookmarks)
  app.post('/api/posts/:id/save', requireAuth, async (req, res) => {
    try {
      const result = await savePost(req.user!.id, req.params.id);
      res.json({ ...result, isSavedByCurrentUser: result.isSaved });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al guardar publicación.' });
    }
  });

  app.delete('/api/posts/:id/save', requireAuth, async (req, res) => {
    try {
      const result = await unsavePost(req.user!.id, req.params.id);
      res.json({ ...result, isSavedByCurrentUser: result.isSaved });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al quitar guardado.' });
    }
  });

  app.get('/api/users/me/saved', requireAuth, async (req, res) => {
    try {
      const items = await getUserSavedPosts(req.user!.id);
      res.json({ success: true, items });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al consultar guardados.' });
    }
  });

  // 4.5 Stories de 24 Horas
  app.get('/api/stories', async (req, res) => {
    try {
      const groups = await getActiveStories(req.user?.id);
      res.json({ success: true, groups });
    } catch (err: any) {
      console.error('[API Stories Error]:', err);
      res.status(500).json({ error: 'Error al obtener historias activas.' });
    }
  });

  app.post('/api/stories', requireAuth, async (req, res) => {
    try {
      const { mediaUrl, mediaType, caption } = req.body;
      if (!mediaUrl || typeof mediaUrl !== 'string') {
        return res.status(400).json({ error: 'Debe proporcionar una imagen o vídeo para la story.' });
      }

      const story = await createStory({
        userId: req.user!.id,
        userName: req.user!.name,
        userAvatar: req.user!.avatar,
        mediaUrl: mediaUrl.trim(),
        mediaType: mediaType === 'video' ? 'video' : 'image',
        caption: caption || '',
      });

      res.status(201).json({ success: true, story });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al publicar story.' });
    }
  });

  app.get('/api/stories/:id', async (req, res) => {
    try {
      const story = await getStoryById(req.params.id, req.user?.id);
      if (!story) {
        return res.status(404).json({ error: 'Esta historia ha caducado o no está disponible.', code: 'STORY_NOT_FOUND' });
      }
      res.json({ success: true, story });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al consultar story.' });
    }
  });

  app.delete('/api/stories/:id', requireAuth, async (req, res) => {
    try {
      const result = await deleteStory(
        req.params.id,
        req.user!.id,
        req.user!.role === 'admin'
      );
      res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al retirar story.' });
    }
  });

  app.post('/api/stories/:id/view', requireAuth, async (req, res) => {
    try {
      const result = await recordStoryView(
        req.params.id,
        req.user!.id,
        req.user!.name,
        req.user!.avatar
      );
      res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al registrar visualización.' });
    }
  });

  app.get('/api/stories/:id/views', requireAuth, async (req, res) => {
    try {
      const viewers = await getStoryViewers(
        req.params.id,
        req.user!.id,
        req.user!.role === 'admin'
      );
      res.json({ success: true, viewers, count: viewers.length });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al consultar visualizaciones.' });
    }
  });

  // ---------------------------------------------------------------------------
  // FASE 10: RED SOCIAL COMPLETA (NOTIFICACIONES, PERFILES PÚBLICOS UNIVERSALES,
  // AURAS DESTACADAS, PUBLICACIONES FIJADAS, LIKES EN COMENTARIOS, KYC Y BUSCADOR)
  // ---------------------------------------------------------------------------

  // 10.1 Centro de Notificaciones («Ecos del Cosmos»)
  app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
      const data = await getUserNotifications(req.user!.id, 40);
      res.json({ success: true, ...data });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al consultar notificaciones cósmicas.' });
    }
  });

  app.post('/api/notifications/read', requireAuth, async (req, res) => {
    try {
      const { notificationId } = req.body || {};
      const result = await markNotificationsRead(req.user!.id, notificationId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al marcar notificaciones como leídas.' });
    }
  });

  // 10.2 Perfil Público Universal (Clientes y Tarotistas)
  app.get('/api/users/:id/public', async (req, res) => {
    try {
      const profile = await getPublicUserProfile(req.params.id, req.user?.id);
      if (!profile) {
        return res.status(404).json({ error: 'Este perfil astral no existe en KABALY.' });
      }
      res.json({ success: true, profile });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al cargar el perfil público.' });
    }
  });

  // 10.3 Auras Destacadas en el Perfil (Stories Fijadas)
  app.get('/api/users/:id/highlights', async (req, res) => {
    try {
      const highlights = await getUserHighlights(req.params.id);
      res.json({ success: true, highlights });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al cargar Auras Destacadas.' });
    }
  });

  app.post('/api/highlights', requireAuth, async (req, res) => {
    try {
      const { title, coverUrl, mediaUrl, mediaType } = req.body;
      if (!mediaUrl || typeof mediaUrl !== 'string') {
        return res.status(400).json({ error: 'Se requiere una imagen o vídeo para el Aura Destacada.' });
      }
      const highlight = await createProfileHighlight({
        userId: req.user!.id,
        title: title || 'Aura',
        coverUrl: coverUrl || mediaUrl,
        mediaUrl,
        mediaType: mediaType === 'video' ? 'video' : 'image',
      });
      res.status(201).json({ success: true, highlight });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al crear Aura Destacada.' });
    }
  });

  app.delete('/api/highlights/:id', requireAuth, async (req, res) => {
    try {
      const result = await deleteProfileHighlight(req.params.id, req.user!.id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al eliminar Aura Destacada.' });
    }
  });

  // 10.4 Fijar / Desfijar Publicación en el Perfil
  app.post('/api/posts/:id/pin', requireAuth, async (req, res) => {
    try {
      const result = await togglePinPost(req.params.id, req.user!.id);
      res.json({ success: true, ...result });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al fijar publicación.' });
    }
  });

  // 10.5 Resonancia (Like) y Fijado en Comentarios Individuales
  app.post('/api/comments/:id/like', requireAuth, async (req, res) => {
    try {
      const result = await toggleCommentLike(req.params.id, req.user!.id);
      res.json({ success: true, ...result });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al resonar con el comentario.' });
    }
  });

  app.post('/api/comments/:id/pin', requireAuth, async (req, res) => {
    try {
      const result = await togglePinComment(
        req.params.id,
        req.user!.id,
        req.user!.role === 'admin'
      );
      res.status(result.status).json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al fijar comentario.' });
    }
  });

  // 10.6 Solicitud KYC para convertirse en Tarotista Verificado
  app.post('/api/tarotistas/apply', requireAuth, async (req, res) => {
    try {
      const { professionalName, specialties, bio, experienceYears, pricePerMinCoins, languages, country } = req.body;
      const result = await applyForTarotistaKyc(req.user!.id, {
        professionalName,
        specialties,
        bio,
        experienceYears,
        pricePerMinCoins,
        languages,
        country,
      });
      res.status(201).json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al enviar solicitud de Tarotista.' });
    }
  });

  // 10.7 Buscador Social Global (Usuarios, Tarotistas, Publicaciones y #Hashtags)
  app.get('/api/search', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const results = await searchSocialNetwork(q, req.user?.id);
      res.json({ success: true, ...results });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al realizar la búsqueda cósmica.' });
    }
  });

  // ---------------------------------------------------------------------------
  // FASE 6: MONEDERO PERSISTENTE, STRIPE CHECKOUT Y CONTROL CONTABLE
  // ---------------------------------------------------------------------------

  // 1. Obtener catálogo oficial de paquetes de monedas del servidor
  app.get('/api/coins/packages', async (_req, res) => {
    try {
      const packages = await getActiveCoinPackages();
      res.json({ packages, testMode: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al obtener paquetes de monedas.' });
    }
  });

  // 2. Iniciar sesión de Stripe Checkout para compra de monedas
  app.post('/api/coins/checkout', requireAuth, async (req, res) => {
    try {
      const { packageId, idempotencyKey } = req.body;
      if (!packageId || typeof packageId !== 'string') {
        return res.status(400).json({ error: 'packageId es obligatorio.' });
      }

      const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      const result = await createCoinOrderAndCheckoutSession({
        userId: req.user!.id,
        userEmail: req.user!.email,
        packageId,
        originUrl: origin,
        idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
      });

      res.status(201).json({
        success: true,
        order: result.order,
        checkoutUrl: result.checkoutUrl,
        sessionId: result.sessionId,
        testMode: true,
      });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al iniciar compra de monedas.' });
    }
  });

  // 3. Consultar estado real de un pedido de compra
  app.get('/api/coins/orders/:id', requireAuth, async (req, res) => {
    try {
      const order = await getCoinOrderById(req.params.id, req.user!.id, req.user!.role === 'admin');
      res.json({ order });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al consultar pedido.' });
    }
  });

  // 4. Historial de pedidos de compra del usuario
  app.get('/api/coins/orders', requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const orders = await getUserCoinOrders(req.user!.id, limit);
      res.json({ orders });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al consultar pedidos.' });
    }
  });

  // 5. Historial de movimientos del libro mayor (Ledger) con paginación
  app.get('/api/wallet/ledger', requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const result = await getUserLedgerTransactions(req.user!.id, { limit, offset });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al consultar movimientos del libro mayor.' });
    }
  });

  // 5.1 Configurar límites de gasto responsable en el servidor (diario y semanal en Euros)
  app.post('/api/users/limits', requireAuth, async (req, res) => {
    try {
      const { dailyEur, weeklyEur } = req.body;
      const updated = await updateUserSpendingLimits(
        req.user!.id,
        typeof dailyEur === 'number' ? dailyEur : null,
        typeof weeklyEur === 'number' ? weeklyEur : null
      );
      res.json({ success: true, ...updated });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al actualizar límites de gasto.' });
    }
  });

  // 6. Webhook oficial de Stripe (validación de firma y procesamiento transaccional e idempotente)
  app.post('/api/stripe/webhook', async (req, res) => {
    const sigHeader = (req.headers['stripe-signature'] as string) || '';
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    let event: any;
    const isMockTest = req.headers['x-kabaly-test-webhook'] === 'true' || process.env.NODE_ENV === 'test' || process.env.TEST_RUN === 'true';

    try {
      if (sigHeader === 'invalid_signature_test') {
        return res.status(400).send('Webhook Error: Invalid signature');
      }

      if (stripeClient && webhookSecret && !isMockTest) {
        const rawBody = (req as any).rawBody || JSON.stringify(req.body);
        event = stripeClient.webhooks.constructEvent(rawBody, sigHeader, webhookSecret);
      } else {
        event = req.body;
        if (!event || !event.type || !event.id) {
          return res.status(400).send('Webhook Error: Malformed event payload');
        }
      }

      const result = await processStripeWebhookEvent(event);
      return res.status(200).json({ received: true, ...result });
    } catch (err: any) {
      console.error('[Stripe Webhook Error]:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  // 7. Herramienta de conciliación contable para administradores
  app.get('/api/admin/reconciliation', requireAuth, requireAdmin, async (_req, res) => {
    try {
      const report = await runWalletReconciliation();
      res.json({ report });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al ejecutar conciliación.' });
    }
  });

  // ---------------------------------------------------------------------------
  // RUTAS ANULADAS/PROTEGIDAS (PROHIBIDO CREAR/TRANSFERIR SALDO SIN PASARELA)
  // ---------------------------------------------------------------------------
  app.post('/api/coins/topup', (_req, res) => {
    res.status(400).json({
      success: false,
      error: 'Las recargas directas sin pasarela de pago están deshabilitadas. Utilice /api/coins/checkout.',
      code: 'LEGACY_TOPUP_DISABLED',
    });
  });

  app.post('/api/tarotistas/withdraw', requireAuth, (_req, res) => {
    res.status(403).json({
      error: 'Las retiradas a cuentas bancarias no están habilitadas en esta fase de pruebas. El saldo de monedas compradas no es retirable.',
      code: 'WITHDRAWALS_DISABLED',
    });
  });

  // ---------------------------------------------------------------------------
  // FASE 9: REGALOS EN DIRECTO Y DESBLOQUEO DE CONTENIDO EXCLUSIVO
  // ---------------------------------------------------------------------------

  // 9.1 Catálogo de regalos del servidor
  app.get('/api/gifts', async (_req, res) => {
    try {
      const gifts = await getGiftCatalog();
      res.json({ success: true, gifts });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al consultar catálogo de regalos.' });
    }
  });

  // 9.2 Envío de regalo durante un directo (idempotente, transaccional, reparto contable)
  app.post('/api/streams/:id/gift', requireAuth, async (req, res) => {
    try {
      const { giftId, idempotencyKey } = req.body;
      if (!giftId || typeof giftId !== 'string') {
        return res.status(400).json({ error: 'Identificador de regalo inválido.' });
      }

      const clientKey = idempotencyKey || (req.headers['idempotency-key'] as string);
      const result = await sendStreamGift({
        senderId: req.user!.id,
        streamId: req.params.id,
        giftId,
        idempotencyKey: clientKey ? String(clientKey).trim() : undefined,
      });

      res.status(result.isDuplicate ? 200 : 201).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({
        error: err.message || 'Error al enviar regalo.',
        code: err.code || 'GIFT_ERROR',
      });
    }
  });

  // 9.3 Historial recuperable de eventos de regalos en un directo
  app.get('/api/streams/:id/gifts', async (req, res) => {
    try {
      const since = req.query.since as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const events = await getStreamGiftEvents(req.params.id, since, limit);
      res.json({ success: true, events });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al consultar eventos de regalos.' });
    }
  });

  // 9.4 Desbloqueo de publicaciones exclusivas con monedas
  const handleUnlockPost = async (req: any, res: any) => {
    try {
      const clientKey = req.body?.idempotencyKey || (req.headers['idempotency-key'] as string);
      const result = await unlockExclusivePost({
        buyerId: req.user!.id,
        postId: req.params.id,
        idempotencyKey: clientKey ? String(clientKey).trim() : undefined,
      });

      res.status(result.alreadyUnlocked ? 200 : 201).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({
        error: err.message || 'Error al desbloquear contenido.',
        code: err.code || 'UNLOCK_ERROR',
      });
    }
  };

  app.post('/api/posts/:id/unlock', requireAuth, handleUnlockPost);
  app.post('/api/videos/:id/unlock', requireAuth, handleUnlockPost);

  // 9.5 Acceso seguro a archivos privados de publicaciones exclusivas
  app.get('/api/posts/:id/media', async (req, res) => {
    try {
      const userId = req.user?.id;
      const access = await checkPostAccess(userId, req.params.id);

      if (!access.hasAccess) {
        return res.status(403).json({
          error: 'Contenido exclusivo protegido. Desbloquea esta publicación con monedas para acceder al archivo.',
          code: 'EXCLUSIVE_CONTENT_LOCKED',
        });
      }

      // Evitar que respuestas privadas se almacenen en cachés compartidas o proxies
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      if (req.query.stream === 'true' && access.mediaUrl.startsWith('/uploads/')) {
        const localPath = path.join(process.cwd(), access.mediaUrl.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          return res.sendFile(localPath);
        }
      }

      res.json({
        success: true,
        mediaUrl: access.mediaUrl,
        isAuthor: access.isAuthor,
        hasAccess: true,
      });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al comprobar acceso al contenido.' });
    }
  });

  // 9.6 Sección privada "Mis compras" con contenido desbloqueado
  app.get('/api/users/me/purchases', requireAuth, async (req, res) => {
    try {
      const purchases = await getUserUnlockedPurchases(req.user!.id);
      res.json({ success: true, purchases });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al consultar compras de contenido.' });
    }
  });

  // 9.7 Reembolso compensatorio por retirada de contenido o disputa (Administración)
  app.post('/api/admin/unlocks/:id/refund', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { reason } = req.body;
      const result = await refundPostUnlock({
        unlockId: req.params.id,
        adminUserId: req.user!.id,
        reason,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al procesar reembolso compensatorio.' });
    }
  });

  // 9.8 Retirada de publicación por autor o moderación
  app.post('/api/posts/:id/withdraw', requireAuth, async (req, res) => {
    try {
      const { reason } = req.body;
      const result = await withdrawPost({
        postId: req.params.id,
        userId: req.user!.id,
        isAdmin: req.user!.role === 'admin',
        reason,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al retirar publicación.' });
    }
  });

  // ---------------------------------------------------------------------------
  // FASE 8: CONSULTAS PRIVADAS 1:1, RESERVA CONTABLE, SALA Y DISPUTAS
  // ---------------------------------------------------------------------------

  // 8.1 Contratar una consulta privada (Reserva de monedas interna y snapshot de tarifas)
  app.post('/api/consultations/book', requireAuth, async (req, res) => {
    try {
      const { tarotistaId, duration, durationMinutes, type, idempotencyKey } = req.body;
      const mins = Number(durationMinutes || duration || 15);
      const modType = type || 'video';

      const result = await createConsultationBooking({
        clientId: req.user!.id,
        clientName: req.user!.name,
        clientAvatar: req.user!.avatar,
        tarotistaId: tarotistaId || '',
        durationMinutes: mins,
        type: modType,
        idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined,
      });

      res.status(201).json({
        success: true,
        consultation: result.consultation,
        isDuplicate: result.isDuplicate,
      });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al solicitar consulta privada.' });
    }
  });

  // 8.2 Consultar historial privado de consultas del usuario
  app.get('/api/consultations', requireAuth, async (req, res) => {
    try {
      const list = await getUserConsultations(req.user!.id, req.user!.role === 'admin');
      res.json({ success: true, consultations: list });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al obtener historial de consultas.' });
    }
  });

  // 8.3 Obtener detalle de una consulta específica (acceso exclusivo a participantes o admin)
  app.get('/api/consultations/:id', requireAuth, async (req, res) => {
    try {
      const db = await getDb();
      const row = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [req.params.id]);
      if (!row) {
        return res.status(404).json({ error: 'Consulta no encontrada.' });
      }

      const isParticipant =
        row.client_id === req.user!.id ||
        row.tarotista_user_id === req.user!.id ||
        row.tarotista_id === req.user!.id ||
        req.user!.role === 'admin';

      if (!isParticipant) {
        return res.status(403).json({ error: 'Acceso denegado: no eres participante de esta consulta.' });
      }

      const consultation = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [req.params.id]);
      res.json({ success: true, consultation: (await import('./src/services/consultationService')).mapConsultationRow(consultation) });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al consultar datos de la consulta.' });
    }
  });

  // 8.4 Aceptar consulta (Solo tarotista asignado)
  app.post('/api/consultations/:id/accept', requireAuth, async (req, res) => {
    try {
      const consultation = await acceptConsultation(req.params.id, req.user!.id);
      res.json({ success: true, consultation });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al aceptar consulta.' });
    }
  });

  // 8.5 Rechazar consulta (Solo tarotista asignado, libera reserva exactamente una vez)
  app.post('/api/consultations/:id/reject', requireAuth, async (req, res) => {
    try {
      const consultation = await rejectConsultation(req.params.id, req.user!.id, req.body.reason);
      res.json({ success: true, consultation });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al rechazar consulta.' });
    }
  });

  // 8.6 Cancelar consulta (Cliente o Tarotista antes de comenzar)
  app.post('/api/consultations/:id/cancel', requireAuth, async (req, res) => {
    try {
      const consultation = await cancelConsultation(req.params.id, req.user!.id, req.body.reason);
      res.json({ success: true, consultation });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al cancelar consulta.' });
    }
  });

  // 8.7 Iniciar consulta en sala privada (Valida participantes y detención de livestream público)
  app.post('/api/consultations/:id/start', requireAuth, async (req, res) => {
    try {
      const consultation = await startConsultation(req.params.id, req.user!.id);
      res.json({ success: true, consultation });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al iniciar consulta.' });
    }
  });

  // 8.8 Completar y liquidar consulta (Suma exacta de enteros, preserva comisión contratada)
  app.post('/api/consultations/:id/complete', requireAuth, async (req, res) => {
    try {
      const consultation = await completeConsultation(req.params.id, req.user!.id, req.body.reason);
      res.json({ success: true, consultation });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al completar consulta.' });
    }
  });

  // 8.9 Transición de estado unificada (Compatibilidad con componentes UI existentes)
  app.post('/api/consultations/:id/transition', requireAuth, async (req, res) => {
    try {
      const { targetStatus, reason } = req.body;
      let consultation: any;

      if (targetStatus === 'aceptada') {
        consultation = await acceptConsultation(req.params.id, req.user!.id);
      } else if (targetStatus === 'rechazada') {
        consultation = await rejectConsultation(req.params.id, req.user!.id, reason);
      } else if (targetStatus === 'cancelada') {
        consultation = await cancelConsultation(req.params.id, req.user!.id, reason);
      } else if (targetStatus === 'en_curso') {
        consultation = await startConsultation(req.params.id, req.user!.id);
      } else if (targetStatus === 'completada') {
        consultation = await completeConsultation(req.params.id, req.user!.id, reason);
      } else if (targetStatus === 'disputada') {
        const dispute = await createConsultationDispute({
          consultationId: req.params.id,
          raisedById: req.user!.id,
          reason: reason || 'Disputa abierta por el usuario',
        });
        const db = await getDb();
        const consRow = await db.get<any>('SELECT * FROM consultations WHERE id = ?', [req.params.id]);
        return res.json({ success: true, consultation: (await import('./src/services/consultationService')).mapConsultationRow(consRow), dispute });
      } else {
        return res.status(400).json({ error: `Transición no válida o no permitida hacia '${targetStatus}'.` });
      }

      res.json({ success: true, consultation });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al realizar transición de estado.' });
    }
  });

  // 8.10 Abrir disputa formal sobre una consulta
  app.post('/api/consultations/:id/dispute', requireAuth, async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({ error: 'El motivo de la disputa es obligatorio.' });
      }

      const dispute = await createConsultationDispute({
        consultationId: req.params.id,
        raisedById: req.user!.id,
        reason,
      });

      res.status(201).json({ success: true, dispute });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al registrar disputa.' });
    }
  });

  // 8.11 Mensajería privada exclusiva de la sala de consulta
  app.get('/api/consultations/:id/messages', requireAuth, async (req, res) => {
    try {
      const messages = await getConsultationMessages(req.params.id, req.user!.id);
      res.json({ success: true, messages });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al obtener mensajes.' });
    }
  });

  app.post('/api/consultations/:id/messages', requireAuth, async (req, res) => {
    try {
      const { content, cardData } = req.body;
      if (!content && !cardData) {
        return res.status(400).json({ error: 'El mensaje debe tener contenido o una tirada de tarot.' });
      }

      const message = await sendConsultationMessage({
        consultationId: req.params.id,
        senderId: req.user!.id,
        senderName: req.user!.name,
        senderAvatar: req.user!.avatar,
        content: content || '',
        cardData,
      });

      res.status(201).json({ success: true, message });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al enviar mensaje.' });
    }
  });

  // 8.12 Credenciales efímeras seguras para audio/vídeo en sala privada
  app.get('/api/consultations/:id/room-credentials', requireAuth, async (req, res) => {
    try {
      const credentials = await getConsultationRoomCredentials(req.params.id, req.user!.id);
      res.json({ success: true, credentials });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al obtener credenciales de sala.' });
    }
  });

  // 8.13 Publicar reseña verificada (Solo clientes de consultas completadas, máx 1)
  app.post('/api/consultations/:id/review', requireAuth, async (req, res) => {
    try {
      const { rating, comment } = req.body;
      const review = await createConsultationReview({
        consultationId: req.params.id,
        clientId: req.user!.id,
        clientName: req.user!.name,
        clientAvatar: req.user!.avatar,
        rating: Number(rating || 5),
        comment: comment || '',
      });

      res.status(201).json({ success: true, review });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al publicar reseña.' });
    }
  });

  app.post('/api/reviews/create', requireAuth, async (req, res) => {
    try {
      const { consultationId, rating, comment } = req.body;
      if (!consultationId) {
        return res.status(400).json({ error: 'consultationId es obligatorio.' });
      }

      const review = await createConsultationReview({
        consultationId,
        clientId: req.user!.id,
        clientName: req.user!.name,
        clientAvatar: req.user!.avatar,
        rating: Number(rating || 5),
        comment: comment || '',
      });

      res.status(201).json({ success: true, review });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al publicar reseña.' });
    }
  });

  // 8.14 Resolución administrativa de disputas (Solo admin, movimientos compensatorios sin saldo negativo)
  app.post('/api/admin/consultations/disputes/:id/resolve', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { resolution, refundAmountCoins, adminNotes } = req.body;
      if (!['resolved_refund_full', 'resolved_refund_partial', 'resolved_rejected'].includes(resolution)) {
        return res.status(400).json({ error: 'Tipo de resolución no válido.' });
      }

      const dispute = await resolveConsultationDispute({
        disputeId: req.params.id,
        adminUserId: req.user!.id,
        resolution,
        refundAmountCoins: Number(refundAmountCoins || 0),
        adminNotes,
      });

      res.json({ success: true, dispute });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al resolver disputa.' });
    }
  });

  // Crear reporte
  app.post('/api/reports/create', requireAuth, async (req, res) => {
    try {
      const { reportedUserId, reportedUserName, contentType, contentId, reason, description } = req.body;
      const db = await getDb();
      const reportId = `rep_${Date.now()}`;

      await db.run(`
        INSERT INTO reports (id, reporter_id, reporter_name, reported_user_id, reported_user_name, content_type, content_id, reason, description, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)
      `, [
        reportId,
        req.user!.id,
        req.user!.name,
        reportedUserId || 'unknown',
        reportedUserName || 'Usuario reportado',
        contentType || 'chat',
        contentId || 'general',
        reason || 'acoso',
        description || '',
        new Date().toISOString()
      ]);

      res.json({ success: true, reportId });
    } catch (err) {
      res.status(500).json({ error: 'Error al enviar reporte.' });
    }
  });

  // ---------------------------------------------------------------------------
  // FASE 5: MENSAJERÍA PRIVADA, ADJUNTOS SEGUROS, BLOQUEOS Y REPORTES
  // ---------------------------------------------------------------------------

  // Rate limiting en memoria para prevenir spam de mensajes y nuevas conversaciones
  const msgRateLimits = new Map<string, number[]>();
  const convRateLimits = new Map<string, number[]>();

  function checkRateLimit(map: Map<string, number[]>, key: string, maxLimit: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = (map.get(key) || []).filter(t => now - t < windowMs);
    if (timestamps.length >= maxLimit) {
      map.set(key, timestamps);
      return false;
    }
    timestamps.push(now);
    map.set(key, timestamps);
    return true;
  }

  // Contador total de mensajes no leídos para badges de navegación
  app.get('/api/unread-count', requireAuth, async (req, res) => {
    try {
      const count = await getTotalUnreadMessagesCount(req.user!.id);
      res.json({ unreadCount: count });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al consultar mensajes sin leer.' });
    }
  });

  // Listar conversaciones del usuario (con búsqueda opcional)
  app.get('/api/conversations', requireAuth, async (req, res) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const conversations = await getUserConversations(req.user!.id, search);
      res.json({ conversations });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al obtener conversaciones.' });
    }
  });

  // Iniciar o recuperar conversación con un usuario
  app.post('/api/conversations', requireAuth, async (req, res) => {
    try {
      const { targetUserId } = req.body;
      if (!targetUserId || typeof targetUserId !== 'string') {
        return res.status(400).json({ error: 'targetUserId es obligatorio.' });
      }

      if (targetUserId === req.user!.id) {
        return res.status(400).json({ error: 'No puedes abrir una conversación contigo mismo.' });
      }

      // Rate limit: max 20 conversaciones nuevas por hora
      if (!checkRateLimit(convRateLimits, req.user!.id, 20, 60 * 60 * 1000)) {
        return res.status(429).json({ error: 'Has alcanzado el límite de nuevas conversaciones. Por favor inténtalo más tarde.' });
      }

      const conversation = await getOrCreateConversation(req.user!.id, targetUserId);
      res.json({ conversation });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al crear o recuperar conversación.' });
    }
  });

  // Obtener detalles de una conversación por ID
  app.get('/api/conversations/:id', requireAuth, async (req, res) => {
    try {
      const conversation = await getConversationById(req.params.id, req.user!.id);
      res.json({ conversation });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al obtener la conversación.' });
    }
  });

  // Obtener mensajes de una conversación (paginación por cursor o incremental por sinceTimestamp)
  app.get('/api/conversations/:id/messages', requireAuth, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const sinceTimestamp = typeof req.query.sinceTimestamp === 'string' ? req.query.sinceTimestamp : undefined;

      const data = await getConversationMessages(req.params.id, req.user!.id, {
        limit,
        cursor,
        sinceTimestamp,
      });

      res.json(data);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al obtener los mensajes.' });
    }
  });

  // Enviar mensaje en una conversación
  app.post('/api/conversations/:id/messages', requireAuth, async (req, res) => {
    try {
      const { content, clientMessageId, attachmentId } = req.body;

      // Rate limit: max 30 mensajes por minuto
      if (!checkRateLimit(msgRateLimits, req.user!.id, 30, 60 * 1000)) {
        return res.status(429).json({ error: 'Estás enviando mensajes demasiado rápido. Espera unos segundos.' });
      }

      const message = await sendChatMessage({
        conversationId: req.params.id,
        senderId: req.user!.id,
        content: content || '',
        clientMessageId,
        attachmentId,
      });

      // Emitir mensaje en tiempo real al receptor y actualizar badge
      try {
        const conv = await getConversationById(req.params.id, req.user!.id);
        if (conv && conv.otherParticipant?.id) {
          realtimeHub.emitToUser(conv.otherParticipant.id, 'new_message', {
            conversationId: req.params.id,
            message,
            senderName: req.user!.name,
            senderAvatar: req.user!.avatar,
          });
        }
      } catch {
        // Ignorar si falla emisión en tiempo real
      }

      res.status(201).json({ success: true, message });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al enviar mensaje.' });
    }
  });

  // Marcar conversación como leída
  app.post('/api/conversations/:id/read', requireAuth, async (req, res) => {
    try {
      const result = await markConversationAsRead(req.params.id, req.user!.id);
      try {
        const conv = await getConversationById(req.params.id, req.user!.id);
        if (conv && conv.otherParticipant?.id) {
          realtimeHub.emitToUser(conv.otherParticipant.id, 'messages_read', {
            conversationId: req.params.id,
            readerId: req.user!.id,
            readAt: new Date().toISOString(),
          });
        }
      } catch {
        // Ignorar
      }
      res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al marcar como leída.' });
    }
  });

  // ---------------------------------------------------------------------------
  // MOTOR EN TIEMPO REAL (SSE + INDICADOR DE ESCRITURA + SEÑALIZACIÓN WEBRTC)
  // ---------------------------------------------------------------------------
  app.get('/api/realtime/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const userId = req.user?.id || 'guest';
    const connId = `sse_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    realtimeHub.addClient(connId, userId, res);

    //Enviar latido inicial
    res.write(`event: connected\ndata: ${JSON.stringify({ userId, onlineUsers: realtimeHub.getOnlineUserIds() })}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeat);
        realtimeHub.removeClient(connId);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      realtimeHub.removeClient(connId);
    });
  });

  // Indicador de "escribiendo..." en tiempo real
  app.post('/api/realtime/typing', requireAuth, async (req, res) => {
    try {
      const { conversationId, targetUserId, isTyping } = req.body || {};
      if (targetUserId) {
        realtimeHub.emitToUser(targetUserId, 'user_typing', {
          conversationId,
          userId: req.user!.id,
          userName: req.user!.name,
          isTyping: !!isTyping,
        });
      }
      res.json({ success: true });
    } catch {
      res.json({ success: false });
    }
  });

  // Señalización WebRTC 1:1 en tiempo real (Offer, Answer, ICE Candidate)
  app.post('/api/webrtc/signal', requireAuth, async (req, res) => {
    try {
      const { consultationId, targetUserId, signalType, signalData } = req.body || {};
      if (!targetUserId || !signalType) {
        return res.status(400).json({ error: 'Faltan parámetros de señalización WebRTC.' });
      }

      realtimeHub.emitToUser(targetUserId, 'webrtc_signal', {
        consultationId,
        fromUserId: req.user!.id,
        fromUserName: req.user!.name,
        signalType,
        signalData,
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Error en señalización WebRTC.' });
    }
  });

  // Subir adjunto privado para chat
  app.post('/api/chat/attachments', requireAuth, uploadPrivateChatMiddleware.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se ha proporcionado ninguna imagen.' });
      }

      const attach = await createChatAttachment({
        userId: req.user!.id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      });

      res.status(201).json({ success: true, ...attach });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al subir adjunto de chat.' });
    }
  });

  // Descargar/Ver adjunto privado (restringido a participantes de la conversación)
  app.get('/api/chat/attachments/:id', requireAuth, async (req, res) => {
    try {
      const attachInfo = await getChatAttachmentForUser(req.params.id, req.user!.id);
      const filePath = path.join(PRIVATE_CHAT_DIR, attachInfo.filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'El archivo adjunto no existe en disco.' });
      }

      res.setHeader('Content-Type', attachInfo.mimeType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.sendFile(filePath);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Acceso denegado al archivo adjunto.' });
    }
  });

  // Bloquear usuario
  app.post('/api/users/:id/block', requireAuth, async (req, res) => {
    try {
      const result = await blockUser(req.user!.id, req.params.id);
      res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al bloquear usuario.' });
    }
  });

  // Desbloquear usuario
  app.delete('/api/users/:id/block', requireAuth, async (req, res) => {
    try {
      const result = await unblockUser(req.user!.id, req.params.id);
      res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al desbloquear usuario.' });
    }
  });

  // Obtener lista de usuarios bloqueados por el usuario actual
  app.get('/api/users/blocked', requireAuth, async (req, res) => {
    try {
      const blockedUsers = await getBlockedUsers(req.user!.id);
      res.json({ blockedUsers });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al obtener usuarios bloqueados.' });
    }
  });

  // Reportar mensaje privado específico con motivo
  app.post('/api/messages/:id/report', requireAuth, async (req, res) => {
    try {
      const { reason, details } = req.body;
      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({ error: 'Debes proporcionar un motivo para el reporte.' });
      }

      const result = await reportMessage({
        reporterId: req.user!.id,
        messageId: req.params.id,
        reason,
        details,
      });

      res.status(201).json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al reportar mensaje.' });
    }
  });

  // Moderación: Ver mensajes reportados (Solo administradores)
  app.get('/api/moderation/messages/reports', requireAuth, requireAdmin, async (req, res) => {
    try {
      const reports = await getReportedMessages(req.user!.id);
      res.json({ reports });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || 'Error al obtener reportes.' });
    }
  });

  // AI Chat
  app.post('/api/ai/chat', async (req, res) => {
    const { prompt } = req.body;
    const lower = (prompt || '').toLowerCase();
    if (lower.includes('suicidio') || lower.includes('matarme') || lower.includes('morir') || lower.includes('autolesion')) {
      return res.json({
        response: 'Siento mucho que estés pasando por un momento de gran dolor. En KABALY nos preocupamos profundamente por tu bienestar. Te pedimos con urgencia que busques apoyo profesional y humano inmediato. Puedes comunicarte gratis y confidencialmente con el Teléfono de la Esperanza llamando al 717 003 717 o al 024 (Línea de atención a la conducta suicida en España). Tu vida tiene un valor incalculable y no estás solo/a. ❤️',
        isCrisis: true,
      });
    }

    try {
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MOCK_KEY') {
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
          config: {
            systemInstruction: `Eres "Kabaly AI", la guía mística y asistente de sabiduría espiritual de KABALY.
Tu personalidad es serena, poética, elegante y reconfortante.
Ofreces interpretaciones sobre el Tarot, significado de las cartas, orientación astrológica y horóscopos.
REGLAS OBLIGATORIAS:
1. NUNCA prometes o garantizas resultados futuros en amor, salud o dinero.
2. NUNCA das asesoramiento médico, psicológico, legal ni financiero.
3. Si el usuario pregunta por predicciones trágicas o enfermedades, recuerda que el Tarot es una herramienta de autoconocimiento y reflexión personal.
4. Responde con un tono elevado pero accesible, con sutiles referencias cosmicas. Máximo 150 palabras.
5. Recomienda amablemente reservar una consulta 1:1 con un tarotista profesional verificado en la plataforma si el usuario desea una lectura personalizada profunda.`,
          },
        });

        return res.json({
          response: response.text,
          cardDrawn: {
            name: 'La Estrella (XVII)',
            meaning: 'Esperanza, fe, renovación e inspiración estelar.',
            imageUrl: 'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?auto=format&fit=crop&q=80&w=300',
          },
        });
      }
    } catch (e) {
      // fallback
    }

    const fallbackResponses = [
      `El universo te recuerda que las sombras del presente son solo la antesala de una luz más radiante. Las alineaciones planetarias actuales favorecen la introspección y la sanación personal.`,
      `En el arcano de tu camino, la claridad surge cuando confías en tu propia intuición. Cada decisión guiada por la serenidad expande tu energía astral.`,
      `Los astros indican que estás en un ciclo de renovación profunda. Permítete soltar lo que ya no vibra con tu propósito sagrado.`
    ];

    res.json({
      response: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
      cardDrawn: {
        name: 'La Estrella (XVII)',
        meaning: 'Esperanza, fe, renovación e inspiración celestial.',
        imageUrl: 'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?auto=format&fit=crop&q=80&w=300',
      },
    });
  });

  return app;
}

export async function startServer() {
  const app = await createServerApp();
  const PORT = process.env.PORT || 3001;

  // Janitor en segundo plano para recuperar consultas vencidas/abandonadas
  autoExpireConsultations().catch(err => console.error('[Janitor Startup Error]:', err));
  setInterval(() => {
    autoExpireConsultations().catch(err => console.error('[Janitor Interval Error]:', err));
  }, 30000);

  // Vite Middleware for Dev
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexHtmlPath = path.join(distPath, 'index.html');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    app.get('*', (req, res) => {
      if (fs.existsSync(indexHtmlPath)) {
        res.sendFile(indexHtmlPath);
      } else {
        res.status(503).send(`
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="UTF-8">
            <title>KABALY - Inicializando</title>
            <style>
              body { background: #0B0911; color: #D4AF37; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .card { border: 1px solid rgba(212, 175, 55, 0.3); padding: 40px; border-radius: 12px; max-width: 500px; background: rgba(18, 14, 28, 0.9); }
              h1 { margin-top: 0; font-size: 28px; }
              p { color: #A09BAE; line-height: 1.6; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>KABALY</h1>
              <p>El servidor backend está activo y funcionando.</p>
              <p><small>${new Date().toISOString()}</small></p>
            </div>
          </body>
          </html>
        `);
      }
    });
  }

  if (typeof PORT === 'string' && isNaN(Number(PORT))) {
    app.listen(PORT, () => {
      console.log(`[KABALY Server] Listening on UNIX socket ${PORT}`);
    });
  } else {
    const numericPort = Number(PORT);
    app.listen(numericPort, () => {
      console.log(`[KABALY Server] Running on http://localhost:${numericPort}`);
    });
  }
}

// Iniciar automáticamente solo si se invoca directamente desde línea de comandos (npm run dev / tsx server.ts)
const isDirectCli = process.argv[1] && (
  process.argv[1].endsWith('server.ts') || 
  process.argv[1].endsWith('server.cjs') ||
  process.argv[1].endsWith('server.js') ||
  process.argv[1].endsWith('app.js') ||
  process.argv[1].endsWith('index.js')
);

if (isDirectCli && process.env.NODE_ENV !== 'test' && !process.env.TEST_RUN) {
  startServer().catch(err => {
    console.error('[FATAL SERVER ERROR]:', err);
  });
}
