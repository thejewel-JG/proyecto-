import crypto from 'crypto';
import { getDb } from './database';
import { 
  TarotistaProfile, 
  Video, 
  Consultation, 
  Review, 
  LedgerTransaction, 
  Report, 
  WithdrawalRequest,
  Comment,
  Story,
  StoryGroup,
  StoryViewer,
  FollowUser,
  Conversation,
  PrivateChatMessage,
  BlockedUser,
  MessageReport,
  CosmicNotification,
  ProfileHighlight,
  PublicUserProfile,
} from '../types';

function mapVideoRow(r: any): Video {
  return {
    id: r.id,
    tarotistaId: r.tarotista_id,
    authorId: r.tarotista_id,
    tarotistaName: r.tarotista_name,
    tarotistaAvatar: r.tarotista_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
    isVerified: !!r.is_verified,
    title: r.title,
    videoUrl: r.video_url,
    thumbnailUrl: r.thumbnail_url || (r.media_type === 'image' ? r.video_url : ''),
    category: r.category,
    likes: r.likes || 0,
    commentsCount: r.comments_count || 0,
    sharesCount: r.shares_count || 0,
    soundTitle: r.sound_title || 'Audio Original',
    isPremium: !!r.is_premium,
    isExclusive: !!r.is_exclusive || !!r.is_premium,
    priceCoins: r.price_coins,
    unlockedByUserIds: [],
    mediaType: (r.media_type as 'video' | 'image') || 'video',
    mediaUrls: r.media_urls ? parseJson(r.media_urls, undefined) : undefined,
    isPinned: !!r.is_pinned,
    description: r.description || '',
    isWithdrawn: !!r.is_withdrawn,
    withdrawnAt: r.withdrawn_at || undefined,
    withdrawalReason: r.withdrawal_reason || undefined,
    createdAt: r.created_at,
  };
}

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`).toString('base64');
}

function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    const [createdAt, id] = raw.split('|');
    if (createdAt && id) return { createdAt, id };
    return null;
  } catch (e) {
    return null;
  }
}

export interface FeedOptions {
  limit?: number;
  cursor?: string;
  category?: string;
  authorId?: string;
  currentUserId?: string;
  feedType?: 'all' | 'following';
}

export interface FeedResult {
  items: Video[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function getFeedPosts(opts: FeedOptions = {}): Promise<FeedResult> {
  const db = await getDb();
  const limit = Math.min(Math.max(Number(opts.limit) || 10, 1), 50);

  const conditions: string[] = ['is_deleted = 0'];
  const params: any[] = [];

  // Pestaña "Siguiendo"
  if (opts.category === 'Siguiendo' || opts.feedType === 'following') {
    if (!opts.currentUserId) {
      return { items: [], nextCursor: null, hasMore: false };
    }
    conditions.push(`(
      tarotista_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
      OR tarotista_id IN (SELECT id FROM tarotista_profiles WHERE user_id IN (SELECT following_id FROM follows WHERE follower_id = ?))
      OR tarotista_id IN (SELECT user_id FROM tarotista_profiles WHERE id IN (SELECT following_id FROM follows WHERE follower_id = ?))
    )`);
    params.push(opts.currentUserId, opts.currentUserId, opts.currentUserId);
  } else if (opts.category && opts.category !== 'Para ti') {
    conditions.push('category = ?');
    params.push(opts.category);
  }

  if (opts.authorId) {
    conditions.push('tarotista_id = ?');
    params.push(opts.authorId);
  }

  if (opts.cursor) {
    const decoded = decodeCursor(opts.cursor);
    if (decoded) {
      conditions.push('(created_at < ? OR (created_at = ? AND id < ?))');
      params.push(decoded.createdAt, decoded.createdAt, decoded.id);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM videos ${whereClause} ORDER BY created_at DESC, id DESC LIMIT ?`;
  params.push(limit + 1);

  const rows = await db.query<any>(sql, params);
  const hasMore = rows.length > limit;
  const itemsRows = hasMore ? rows.slice(0, limit) : rows;

  // Consulta por lotes para Likes, Guardados y Desbloqueos del usuario autenticado
  let likedSet = new Set<string>();
  let savedSet = new Set<string>();
  let unlockedSet = new Set<string>();

  if (opts.currentUserId && itemsRows.length > 0) {
    const ids = itemsRows.map((r: any) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const [likedRows, savedRows, unlockedRows] = await Promise.all([
      db.query<any>(`SELECT video_id FROM post_likes WHERE user_id = ? AND video_id IN (${placeholders})`, [opts.currentUserId, ...ids]),
      db.query<any>(`SELECT video_id FROM saved_posts WHERE user_id = ? AND video_id IN (${placeholders})`, [opts.currentUserId, ...ids]),
      db.query<any>(`SELECT post_id FROM post_unlocks WHERE user_id = ? AND is_refunded = 0 AND post_id IN (${placeholders})`, [opts.currentUserId, ...ids]),
    ]);
    likedSet = new Set(likedRows.map((r: any) => r.video_id));
    savedSet = new Set(savedRows.map((r: any) => r.video_id));
    unlockedSet = new Set(unlockedRows.map((r: any) => r.post_id));
  }

  const items = itemsRows.map(r => {
    const post = mapVideoRow(r);
    post.isLikedByCurrentUser = likedSet.has(r.id);
    post.isSavedByCurrentUser = savedSet.has(r.id);

    // REQUISITO: Ocultar URLs originales para usuarios sin acceso confirmado
    const isAuthor = opts.currentUserId && (opts.currentUserId === r.tarotista_id || opts.currentUserId === r.author_id);
    const isPurchased = unlockedSet.has(r.id);
    const hasUnlocked = !post.isPremium || !post.priceCoins || post.priceCoins <= 0 || !!isAuthor || isPurchased;

    post.hasUnlocked = hasUnlocked;
    if (!hasUnlocked) {
      post.videoUrl = ''; // Ocultar URL original del contenido exclusivo
      post.mediaUrls = undefined;
    }

    return post;
  });

  let nextCursor: string | null = null;
  if (hasMore && itemsRows.length > 0) {
    const lastItem = itemsRows[itemsRows.length - 1];
    nextCursor = encodeCursor(lastItem.created_at, lastItem.id);
  }

  return { items, nextCursor, hasMore };
}

export interface CreatePostParams {
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  isVerified?: boolean;
  title: string;
  description?: string;
  category: string;
  videoUrl: string;
  mediaUrls?: string[];
  thumbnailUrl?: string;
  mediaType: 'video' | 'image';
  idempotencyKey?: string;
  isPremium?: boolean;
  priceCoins?: number | null;
}

export async function createPost(params: CreatePostParams): Promise<{ post: Video; wasExisting: boolean }> {
  const db = await getDb();

  // Comprobar idempotencia
  if (params.idempotencyKey) {
    const existing = await db.get<any>(
      'SELECT * FROM videos WHERE idempotency_key = ? AND is_deleted = 0',
      [params.idempotencyKey]
    );
    if (existing) {
      return { post: mapVideoRow(existing), wasExisting: true };
    }
  }

  const id = `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();
  const isPrem = !!params.isPremium;
  const price = isPrem && typeof params.priceCoins === 'number' && params.priceCoins > 0 ? Math.floor(params.priceCoins) : null;
  const mediaUrlsJson = Array.isArray(params.mediaUrls) && params.mediaUrls.length > 0 ? JSON.stringify(params.mediaUrls) : null;

  await db.run(`
    INSERT INTO videos (
      id, tarotista_id, tarotista_name, tarotista_avatar, is_verified,
      title, video_url, media_urls, thumbnail_url, category, likes, comments_count,
      shares_count, sound_title, is_premium, is_exclusive, price_coins, media_type,
      description, is_deleted, idempotency_key, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `, [
    id,
    params.authorId,
    params.authorName,
    params.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
    params.isVerified ? 1 : 0,
    params.title,
    params.videoUrl,
    mediaUrlsJson,
    params.thumbnailUrl || (params.mediaType === 'image' ? params.videoUrl : ''),
    params.category || 'Tarot',
    params.mediaType === 'video' ? 'Audio Original' : 'Visual Sagrada',
    isPrem ? 1 : 0,
    isPrem ? 1 : 0,
    price,
    params.mediaType,
    params.description || '',
    params.idempotencyKey || null,
    now,
  ]);

  // Si tiene perfil de tarotista, actualizar video_count
  await db.run('UPDATE tarotista_profiles SET video_count = video_count + 1 WHERE user_id = ?', [params.authorId]);

  const created = await db.get<any>('SELECT * FROM videos WHERE id = ?', [id]);
  const post = mapVideoRow(created);
  post.hasUnlocked = true; // El autor siempre tiene acceso a su propia publicación
  return { post, wasExisting: false };
}

export async function getPostById(id: string, currentUserId?: string): Promise<Video | null> {
  const db = await getDb();
  const row = await db.get<any>('SELECT * FROM videos WHERE id = ? AND is_deleted = 0', [id]);
  if (!row) return null;
  const post = mapVideoRow(row);

  const isAuthor = currentUserId && (currentUserId === row.tarotista_id || currentUserId === row.author_id);
  let isPurchased = false;

  if (currentUserId) {
    const [likeRow, saveRow, unlockRow] = await Promise.all([
      db.get<any>('SELECT id FROM post_likes WHERE video_id = ? AND user_id = ?', [id, currentUserId]),
      db.get<any>('SELECT id FROM saved_posts WHERE video_id = ? AND user_id = ?', [id, currentUserId]),
      db.get<any>('SELECT id FROM post_unlocks WHERE post_id = ? AND user_id = ? AND is_refunded = 0', [id, currentUserId]),
    ]);
    post.isLikedByCurrentUser = !!likeRow;
    post.isSavedByCurrentUser = !!saveRow;
    isPurchased = !!unlockRow;
  }

  const hasUnlocked = !post.isPremium || !post.priceCoins || post.priceCoins <= 0 || !!isAuthor || isPurchased;
  post.hasUnlocked = hasUnlocked;
  if (!hasUnlocked) {
    post.videoUrl = ''; // Ocultar URL privada si no está desbloqueada
  }

  return post;
}

export async function updatePost(
  id: string,
  userId: string,
  updates: { title?: string; description?: string; category?: string; isPremium?: boolean; priceCoins?: number },
  isAdmin = false
): Promise<{ success: boolean; post?: Video; error?: string; status: number }> {
  const db = await getDb();
  const post = await db.get<any>('SELECT * FROM videos WHERE id = ?', [id]);

  if (!post || post.is_deleted) {
    return { success: false, error: 'Publicación no encontrada o ha sido retirada.', status: 404 };
  }

  if (post.tarotista_id !== userId && !isAdmin) {
    return { success: false, error: 'No tienes permiso para editar esta publicación.', status: 403 };
  }

  // REQUISITO FASE 9: "Si una publicación existente usa un archivo público, no permitas convertirla en exclusiva sin resolver su exposición anterior. Explica que una copia previamente descargada no puede recuperarse."
  if (updates.isPremium && !post.is_premium) {
    return {
      success: false,
      error: 'No es posible convertir una publicación pública existente en exclusiva porque su archivo original ya fue expuesto de forma pública y copias previamente descargadas no pueden recuperarse. Crea una nueva publicación exclusiva con portada separada y archivo privado.',
      status: 400
    };
  }

  // REQUISITO FASE 9: "Mantén el precio fijado mientras existan compras o implementa cambios que solo afecten a compras futuras, sin alterar el historial."
  let newPrice = post.price_coins;
  if (typeof updates.priceCoins === 'number' && updates.priceCoins > 0) {
    newPrice = Math.floor(updates.priceCoins);
  }

  const newTitle = updates.title !== undefined ? updates.title.trim() : post.title;
  const newDesc = updates.description !== undefined ? updates.description.trim() : post.description;
  const newCat = updates.category !== undefined ? updates.category : post.category;

  await db.run(`
    UPDATE videos
    SET title = ?, description = ?, category = ?, price_coins = ?
    WHERE id = ?
  `, [newTitle, newDesc, newCat, newPrice, id]);

  const updated = await db.get<any>('SELECT * FROM videos WHERE id = ?', [id]);
  return { success: true, post: mapVideoRow(updated), status: 200 };
}

export async function deletePost(
  id: string,
  userId: string,
  isAdmin = false
): Promise<{ success: boolean; error?: string; status: number }> {
  const db = await getDb();
  const post = await db.get<any>('SELECT * FROM videos WHERE id = ?', [id]);

  if (!post || post.is_deleted) {
    return { success: false, error: 'Publicación no encontrada o ya retirada.', status: 404 };
  }

  if (post.tarotista_id !== userId && !isAdmin) {
    return { success: false, error: 'No tienes permiso para retirar esta publicación.', status: 403 };
  }

  const now = new Date().toISOString();
  await db.run('UPDATE videos SET is_deleted = 1, deleted_at = ? WHERE id = ?', [now, id]);

  // Si tiene perfil de tarotista, decrementar video_count
  await db.run('UPDATE tarotista_profiles SET video_count = MAX(0, video_count - 1) WHERE user_id = ?', [post.tarotista_id]);

  return { success: true, status: 200 };
}

export async function getPublicVideos(currentUserId?: string): Promise<Video[]> {
  const res = await getFeedPosts({ limit: 50, currentUserId });
  return res.items;
}

export async function getPublicTarotistas(): Promise<TarotistaProfile[]> {
  const db = await getDb();
  const rows = await db.query<any>(`
    SELECT id, user_id, professional_name, avatar, banner, specialties, bio, experience_years,
           price_per_min_coins, price_per_min_eur, languages, country, is_verified, kyc_status,
           stripe_connect_status, rating_average, total_reviews, total_readings, followers_count,
           video_count, availability_status, custom_commission_percentage, created_at
    FROM tarotista_profiles
    ORDER BY is_verified DESC, rating_average DESC
  `);

  return rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    professionalName: r.professional_name,
    avatar: r.avatar,
    banner: r.banner,
    specialties: parseJson(r.specialties, ['Tarot']),
    bio: r.bio || '',
    experienceYears: r.experience_years,
    pricePerMinCoins: r.price_per_min_coins,
    pricePerMinEur: r.price_per_min_eur,
    languages: parseJson(r.languages, ['Español']),
    country: r.country,
    isVerified: !!r.is_verified,
    kycStatus: r.kyc_status,
    stripeConnectStatus: r.stripe_connect_status,
    ratingAverage: r.rating_average,
    totalReviews: r.total_reviews,
    totalReadings: r.total_readings,
    followersCount: r.followers_count,
    videoCount: r.video_count,
    availabilityStatus: r.availability_status,
    customCommissionPercentage: r.custom_commission_percentage,
    // docIdentityUrl SE OMITE intencionalmente para no filtrar documentos privados
  }));
}

export async function getPublicReviews(): Promise<Review[]> {
  const db = await getDb();
  const rows = await db.query<any>(`
    SELECT * FROM reviews ORDER BY created_at DESC LIMIT 50
  `);

  return rows.map(r => ({
    id: r.id,
    consultationId: r.consultation_id,
    tarotistaId: r.tarotista_id,
    clientId: r.client_id,
    clientName: r.client_name,
    clientAvatar: r.client_avatar,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
    isVerifiedPurchase: !!r.is_verified_purchase,
  }));
}

export async function getUserConsultations(userId: string, isAdmin = false): Promise<Consultation[]> {
  const db = await getDb();
  let sql = 'SELECT * FROM consultations WHERE client_id = ? OR tarotista_id = ? OR tarotista_user_id = ? ORDER BY created_at DESC';
  let params: any[] = [userId, userId, userId];

  if (isAdmin) {
    sql = 'SELECT * FROM consultations ORDER BY created_at DESC LIMIT 100';
    params = [];
  }

  const rows = await db.query<any>(sql, params);
  return rows.map(r => ({
    id: r.id,
    clientId: r.client_id,
    clientName: r.client_name,
    clientAvatar: r.client_avatar,
    tarotistaId: r.tarotista_id,
    tarotistaUserId: r.tarotista_user_id || undefined,
    tarotistaName: r.tarotista_name,
    tarotistaAvatar: r.tarotista_avatar,
    status: r.status,
    type: r.type,
    durationMinutes: r.duration_minutes,
    ratePerMinuteCoins: r.rate_per_minute_coins || 0,
    totalCoins: r.total_coins,
    platformCommissionCoins: r.platform_commission_coins || Math.round((r.total_coins || 0) * 0.2),
    tarotistaEarningsCoins: r.tarotista_earnings_coins || 0,
    commissionPercentage: r.commission_percentage || 20,
    createdAt: r.created_at,
    acceptedAt: r.accepted_at || undefined,
    startedAt: r.started_at || undefined,
    scheduledEndAt: r.scheduled_end_at || undefined,
    endedAt: r.ended_at || undefined,
    cancelledAt: r.cancelled_at || undefined,
    cancelledBy: r.cancelled_by || undefined,
    cancellationReason: r.cancellation_reason || undefined,
    isSettled: !!r.is_settled,
    isRefunded: !!r.is_refunded,
    roomToken: r.room_token || undefined,
    idempotencyKey: r.idempotency_key || undefined,
    notes: r.notes || undefined,
    expiresAt: r.expires_at || undefined,
    disputeReason: r.dispute_reason || undefined,
  }));
}

export async function getUserLedger(userId: string, isAdmin = false): Promise<LedgerTransaction[]> {
  const db = await getDb();
  let sql = 'SELECT * FROM ledger WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50';
  let params: any[] = [userId];

  if (isAdmin) {
    sql = 'SELECT * FROM ledger ORDER BY timestamp DESC LIMIT 200';
    params = [];
  }

  const rows = await db.query<any>(sql, params);
  return rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    amountCoins: r.amount_coins,
    amountEur: r.amount_eur,
    description: r.description,
    referenceId: r.reference_id,
    timestamp: r.timestamp,
    status: r.status,
  }));
}

export async function getReports(userId: string, isAdmin = false): Promise<Report[]> {
  if (!isAdmin) return [];
  const db = await getDb();
  const rows = await db.query<any>('SELECT * FROM reports ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id,
    reporterId: r.reporter_id,
    reporterName: r.reporter_name,
    reportedUserId: r.reported_user_id,
    reportedUserName: r.reported_user_name,
    contentType: r.content_type,
    contentId: r.content_id,
    reason: r.reason,
    description: r.description,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function getWithdrawals(userId: string, isAdmin = false, isTarotista = false): Promise<WithdrawalRequest[]> {
  const db = await getDb();
  let sql = '';
  let params: any[] = [];

  if (isAdmin) {
    sql = 'SELECT * FROM withdrawals ORDER BY requested_at DESC';
  } else if (isTarotista) {
    sql = 'SELECT * FROM withdrawals WHERE tarotista_id = ? ORDER BY requested_at DESC';
    params = [userId];
  } else {
    return [];
  }

  const rows = await db.query<any>(sql, params);
  return rows.map(r => ({
    id: r.id,
    tarotistaId: r.tarotista_id,
    tarotistaName: r.tarotista_name,
    amountEur: r.amount_eur,
    amountCoins: r.amount_coins,
    status: r.status,
    requestedAt: r.requested_at,
    vatNumber: r.vat_number,
    bankIban: r.bank_iban,
  }));
}

function parseJson(str: any, fallback: any) {
  if (Array.isArray(str)) return str;
  if (typeof str !== 'string') return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// =============================================================================
// FASE 4: INTERACCIONES SOCIALES Y STORIES FUNCIONALES
// =============================================================================

// 1. Likes Persistentes
export async function addPostLike(videoId: string, userId: string): Promise<{ likes: number; isLiked: boolean }> {
  const db = await getDb();
  const post = await db.get<any>('SELECT id, tarotista_id, title, is_deleted FROM videos WHERE id = ?', [videoId]);
  if (!post || post.is_deleted) {
    throw { status: 404, message: 'Publicación no encontrada o retirada.' };
  }

  const existing = await db.get<any>('SELECT id FROM post_likes WHERE video_id = ? AND user_id = ?', [videoId, userId]);
  if (!existing) {
    const likeId = `like_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    await db.run('INSERT INTO post_likes (id, video_id, user_id, created_at) VALUES (?, ?, ?, ?)', [
      likeId,
      videoId,
      userId,
      new Date().toISOString(),
    ]);

    // Notificar al autor si no es el propio usuario
    if (post.tarotista_id && post.tarotista_id !== userId) {
      const actor = await db.get<any>('SELECT name, avatar FROM users WHERE id = ?', [userId]);
      if (actor) {
        await createNotification({
          userId: post.tarotista_id,
          actorId: userId,
          actorName: actor.name,
          actorAvatar: actor.avatar || '',
          type: 'like',
          referenceId: videoId,
          message: `ha resonado con tu visión «${(post.title || '').slice(0, 40)}»`,
        }).catch(() => {});
      }
    }
  }

  const countRow = await db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM post_likes WHERE video_id = ?', [videoId]);
  const likesCount = countRow ? countRow.cnt : 0;
  await db.run('UPDATE videos SET likes = ? WHERE id = ?', [likesCount, videoId]);

  return { likes: likesCount, isLiked: true };
}

export async function removePostLike(videoId: string, userId: string): Promise<{ likes: number; isLiked: boolean }> {
  const db = await getDb();
  const post = await db.get<any>('SELECT id, is_deleted FROM videos WHERE id = ?', [videoId]);
  if (!post || post.is_deleted) {
    throw { status: 404, message: 'Publicación no encontrada o retirada.' };
  }

  await db.run('DELETE FROM post_likes WHERE video_id = ? AND user_id = ?', [videoId, userId]);

  const countRow = await db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM post_likes WHERE video_id = ?', [videoId]);
  const likesCount = countRow ? countRow.cnt : 0;
  await db.run('UPDATE videos SET likes = ? WHERE id = ?', [likesCount, videoId]);

  return { likes: likesCount, isLiked: false };
}

// 2. Comentarios Reales con 1 Nivel de Respuestas
function sanitizeCommentContent(raw: string): string {
  return raw.replace(/<[^>]*>?/gm, '').trim();
}

export async function createComment(params: {
  videoId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  parentId?: string | null;
}): Promise<Comment> {
  const db = await getDb();
  const post = await db.get<any>('SELECT id, tarotista_id, title, is_deleted FROM videos WHERE id = ?', [params.videoId]);
  if (!post || post.is_deleted) {
    throw { status: 404, message: 'La publicación no está disponible para comentar.' };
  }

  const cleanContent = sanitizeCommentContent(params.content);
  if (cleanContent.length < 1 || cleanContent.length > 500) {
    throw { status: 400, message: 'El comentario debe tener entre 1 y 500 caracteres.' };
  }

  let finalParentId: string | null = null;
  let parentAuthorId: string | null = null;
  if (params.parentId) {
    const parent = await db.get<any>('SELECT id, video_id, parent_id, author_id FROM comments WHERE id = ?', [params.parentId]);
    if (!parent || parent.video_id !== params.videoId) {
      throw { status: 400, message: 'El comentario al que intentas responder no existe.' };
    }
    // Forzar 1 solo nivel de anidación
    finalParentId = parent.parent_id ? parent.parent_id : parent.id;
    parentAuthorId = parent.author_id;
  }

  const commentId = `cmt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  await db.run(`
    INSERT INTO comments (id, video_id, author_id, author_name, author_avatar, parent_id, content, is_deleted, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `, [
    commentId,
    params.videoId,
    params.authorId,
    params.authorName,
    params.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
    finalParentId,
    cleanContent,
    now,
    now,
  ]);

  const countRow = await db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM comments WHERE video_id = ? AND is_deleted = 0', [params.videoId]);
  const commentsCount = countRow ? countRow.cnt : 0;
  await db.run('UPDATE videos SET comments_count = ? WHERE id = ?', [commentsCount, params.videoId]);

  // Notificación al autor del post o al autor del comentario padre
  if (parentAuthorId && parentAuthorId !== params.authorId) {
    await createNotification({
      userId: parentAuthorId,
      actorId: params.authorId,
      actorName: params.authorName,
      actorAvatar: params.authorAvatar || '',
      type: 'reply',
      referenceId: params.videoId,
      message: `respondió a tu susurro: «${cleanContent.slice(0, 45)}»`,
    }).catch(() => {});
  } else if (post.tarotista_id && post.tarotista_id !== params.authorId) {
    await createNotification({
      userId: post.tarotista_id,
      actorId: params.authorId,
      actorName: params.authorName,
      actorAvatar: params.authorAvatar || '',
      type: 'comment',
      referenceId: params.videoId,
      message: `dejó una visión en tu oráculo: «${cleanContent.slice(0, 45)}»`,
    }).catch(() => {});
  }

  // Detectar menciones @usuario en el comentario y enviar notificación 'mention'
  const mentionMatches = cleanContent.match(/@([a-zA-Z0-9_.-]+)/g);
  if (mentionMatches && mentionMatches.length > 0) {
    for (const rawMention of mentionMatches.slice(0, 5)) {
      const cleanHandle = rawMention.toLowerCase();
      const stripHandle = rawMention.slice(1).toLowerCase();
      const mentionedUser = await db.get<any>(
        `SELECT id FROM users WHERE LOWER(handle) = ? OR LOWER(handle) = ? OR LOWER(REPLACE(name, ' ', '')) = ? LIMIT 1`,
        [cleanHandle, `@${stripHandle}`, stripHandle]
      );
      if (mentionedUser && mentionedUser.id !== params.authorId) {
        await createNotification({
          userId: mentionedUser.id,
          actorId: params.authorId,
          actorName: params.authorName,
          actorAvatar: params.authorAvatar || '',
          type: 'mention',
          referenceId: params.videoId,
          message: `te ha mencionado en el oráculo: «${cleanContent.slice(0, 45)}»`,
        }).catch(() => {});
      }
    }
  }

  return {
    id: commentId,
    videoId: params.videoId,
    authorId: params.authorId,
    authorName: params.authorName,
    authorAvatar: params.authorAvatar || '',
    parentId: finalParentId,
    content: cleanContent,
    likesCount: 0,
    isLikedByCurrentUser: false,
    isPinned: false,
    isDeleted: false,
    createdAt: now,
    replies: [],
  };
}

export async function getPostComments(videoId: string, currentUserId?: string): Promise<{ comments: Comment[]; total: number }> {
  const db = await getDb();
  const rows = await db.query<any>(`
    SELECT * FROM comments
    WHERE video_id = ?
    ORDER BY COALESCE(is_pinned, 0) DESC, created_at ASC
  `, [videoId]);

  let likedCommentIds = new Set<string>();
  if (currentUserId && rows.length > 0) {
    const ids = rows.map((r: any) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const likedRows = await db.query<any>(
      `SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${placeholders})`,
      [currentUserId, ...ids]
    );
    likedCommentIds = new Set(likedRows.map((r: any) => r.comment_id));
  }

  const activeCount = rows.filter(r => !r.is_deleted).length;

  const rootComments: Comment[] = [];
  const repliesMap = new Map<string, Comment[]>();

  for (const r of rows) {
    if (r.parent_id) {
      if (!repliesMap.has(r.parent_id)) {
        repliesMap.set(r.parent_id, []);
      }
      if (!r.is_deleted) {
        repliesMap.get(r.parent_id)!.push({
          id: r.id,
          videoId: r.video_id,
          authorId: r.author_id,
          authorName: r.author_name,
          authorAvatar: r.author_avatar || '',
          parentId: r.parent_id,
          content: r.content,
          likesCount: r.likes_count || 0,
          isLikedByCurrentUser: likedCommentIds.has(r.id),
          isPinned: !!r.is_pinned,
          isDeleted: false,
          createdAt: r.created_at,
        });
      }
    }
  }

  for (const r of rows) {
    if (!r.parent_id) {
      const replies = repliesMap.get(r.id) || [];
      if (r.is_deleted && replies.length === 0) {
        continue;
      }
      rootComments.push({
        id: r.id,
        videoId: r.video_id,
        authorId: r.author_id,
        authorName: r.author_name,
        authorAvatar: r.author_avatar || '',
        parentId: null,
        content: r.is_deleted ? '[Comentario eliminado por el autor]' : r.content,
        likesCount: r.likes_count || 0,
        isLikedByCurrentUser: likedCommentIds.has(r.id),
        isPinned: !!r.is_pinned,
        isDeleted: !!r.is_deleted,
        createdAt: r.created_at,
        replies,
      });
    }
  }

  return { comments: rootComments, total: activeCount };
}

export async function deleteComment(commentId: string, userId: string, isAdmin: boolean): Promise<{ success: boolean; softDeleted: boolean }> {
  const db = await getDb();
  const comment = await db.get<any>('SELECT * FROM comments WHERE id = ?', [commentId]);
  if (!comment) {
    throw { status: 404, message: 'Comentario no encontrado.' };
  }

  if (comment.author_id !== userId && !isAdmin) {
    throw { status: 403, message: 'No tienes permiso para borrar este comentario.' };
  }

  const repliesCount = await db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM comments WHERE parent_id = ? AND is_deleted = 0', [commentId]);
  const hasReplies = repliesCount && repliesCount.cnt > 0;

  if (hasReplies) {
    await db.run('UPDATE comments SET is_deleted = 1, content = ?, updated_at = ? WHERE id = ?', [
      '[Comentario eliminado por el autor]',
      new Date().toISOString(),
      commentId,
    ]);
  } else {
    await db.run('DELETE FROM comments WHERE id = ?', [commentId]);
  }

  const countRow = await db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM comments WHERE video_id = ? AND is_deleted = 0', [comment.video_id]);
  const commentsCount = countRow ? countRow.cnt : 0;
  await db.run('UPDATE videos SET comments_count = ? WHERE id = ?', [commentsCount, comment.video_id]);

  return { success: true, softDeleted: !!hasReplies };
}

// 3. Seguir y Dejar de Seguir (Follows)
export async function followUser(followerId: string, followingId: string): Promise<{ isFollowing: boolean; followersCount: number; followingCount: number }> {
  if (followerId === followingId) {
    throw { status: 400, message: 'No puedes seguirte a ti mismo en KABALY.' };
  }

  const db = await getDb();
  const targetUser = await db.get<any>('SELECT id FROM users WHERE id = ?', [followingId]);
  if (!targetUser) {
    throw { status: 404, message: 'Usuario no encontrado.' };
  }

  const existing = await db.get<any>('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);
  if (!existing) {
    const followId = `flw_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    await db.run('INSERT INTO follows (id, follower_id, following_id, created_at) VALUES (?, ?, ?, ?)', [
      followId,
      followerId,
      followingId,
      new Date().toISOString(),
    ]);

    const actor = await db.get<any>('SELECT name, avatar FROM users WHERE id = ?', [followerId]);
    if (actor) {
      await createNotification({
        userId: followingId,
        actorId: followerId,
        actorName: actor.name,
        actorAvatar: actor.avatar || '',
        type: 'follow',
        referenceId: followerId,
        message: 'se ha unido a tu círculo astral (ahora te sigue)',
      }).catch(() => {});
    }
  }

  const rel = await getUserRelationship(followingId, followerId);
  await db.run('UPDATE tarotista_profiles SET followers_count = ? WHERE user_id = ? OR id = ?', [
    rel.followersCount,
    followingId,
    followingId,
  ]);

  return rel;
}

export async function unfollowUser(followerId: string, followingId: string): Promise<{ isFollowing: boolean; followersCount: number; followingCount: number }> {
  const db = await getDb();
  await db.run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);

  const rel = await getUserRelationship(followingId, followerId);
  await db.run('UPDATE tarotista_profiles SET followers_count = ? WHERE user_id = ? OR id = ?', [
    rel.followersCount,
    followingId,
    followingId,
  ]);

  return rel;
}

export async function getUserRelationship(targetUserId: string, currentUserId?: string): Promise<{ isFollowing: boolean; followersCount: number; followingCount: number }> {
  const db = await getDb();
  const [followersRow, followingRow, isFollowingRow] = await Promise.all([
    db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM follows WHERE following_id = ?', [targetUserId]),
    db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM follows WHERE follower_id = ?', [targetUserId]),
    currentUserId ? db.get<any>('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', [currentUserId, targetUserId]) : null,
  ]);

  return {
    isFollowing: !!isFollowingRow,
    followersCount: followersRow ? followersRow.cnt : 0,
    followingCount: followingRow ? followingRow.cnt : 0,
  };
}

export async function getUserFollowers(userId: string, currentUserId?: string): Promise<FollowUser[]> {
  const db = await getDb();
  const rows = await db.query<any>(`
    SELECT u.id, u.name, u.avatar, u.role, u.handle
    FROM follows f
    JOIN users u ON f.follower_id = u.id
    WHERE f.following_id = ?
    ORDER BY f.created_at DESC
  `, [userId]);

  let followingSet = new Set<string>();
  if (currentUserId && rows.length > 0) {
    const ids = rows.map((r: any) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const relRows = await db.query<any>(`
      SELECT following_id FROM follows WHERE follower_id = ? AND following_id IN (${placeholders})
    `, [currentUserId, ...ids]);
    followingSet = new Set(relRows.map((r: any) => r.following_id));
  }

  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    avatar: r.avatar || '',
    role: r.role,
    handle: r.handle,
    isFollowing: followingSet.has(r.id),
  }));
}

export async function getUserFollowing(userId: string, currentUserId?: string): Promise<FollowUser[]> {
  const db = await getDb();
  const rows = await db.query<any>(`
    SELECT u.id, u.name, u.avatar, u.role, u.handle
    FROM follows f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = ?
    ORDER BY f.created_at DESC
  `, [userId]);

  let followingSet = new Set<string>();
  if (currentUserId && rows.length > 0) {
    const ids = rows.map((r: any) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const relRows = await db.query<any>(`
      SELECT following_id FROM follows WHERE follower_id = ? AND following_id IN (${placeholders})
    `, [currentUserId, ...ids]);
    followingSet = new Set(relRows.map((r: any) => r.following_id));
  }

  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    avatar: r.avatar || '',
    role: r.role,
    handle: r.handle,
    isFollowing: followingSet.has(r.id),
  }));
}

// 4. Guardados (Bookmarks)
export async function savePost(userId: string, videoId: string): Promise<{ success: boolean; isSaved: boolean }> {
  const db = await getDb();
  const post = await db.get<any>('SELECT id, is_deleted FROM videos WHERE id = ?', [videoId]);
  if (!post || post.is_deleted) {
    throw { status: 404, message: 'Publicación no disponible para guardar.' };
  }

  const existing = await db.get<any>('SELECT id FROM saved_posts WHERE user_id = ? AND video_id = ?', [userId, videoId]);
  if (!existing) {
    const saveId = `sav_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    await db.run('INSERT INTO saved_posts (id, user_id, video_id, created_at) VALUES (?, ?, ?, ?)', [
      saveId,
      userId,
      videoId,
      new Date().toISOString(),
    ]);
  }

  return { success: true, isSaved: true };
}

export async function unsavePost(userId: string, videoId: string): Promise<{ success: boolean; isSaved: boolean }> {
  const db = await getDb();
  await db.run('DELETE FROM saved_posts WHERE user_id = ? AND video_id = ?', [userId, videoId]);
  return { success: true, isSaved: false };
}

export async function getUserSavedPosts(userId: string): Promise<Video[]> {
  const db = await getDb();
  const rows = await db.query<any>(`
    SELECT v.*
    FROM saved_posts sp
    JOIN videos v ON sp.video_id = v.id
    WHERE sp.user_id = ? AND v.is_deleted = 0
    ORDER BY sp.created_at DESC
  `, [userId]);

  return rows.map(r => {
    const post = mapVideoRow(r);
    post.isSavedByCurrentUser = true;
    return post;
  });
}

// 5. Stories de 24 Horas
export async function createStory(params: {
  userId: string;
  userName: string;
  userAvatar?: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
}): Promise<Story> {
  const db = await getDb();
  const storyId = `sty_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date();
  const createdAt = now.toISOString();
  // Caducidad calculada en el servidor (24 horas exactas)
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  await db.run(`
    INSERT INTO stories (id, user_id, user_name, user_avatar, media_url, media_type, caption, created_at, expires_at, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `, [
    storyId,
    params.userId,
    params.userName,
    params.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
    params.mediaUrl,
    params.mediaType,
    params.caption?.trim() || null,
    createdAt,
    expiresAt,
  ]);

  return {
    id: storyId,
    userId: params.userId,
    userName: params.userName,
    userAvatar: params.userAvatar || '',
    mediaUrl: params.mediaUrl,
    mediaType: params.mediaType,
    caption: params.caption?.trim() || undefined,
    createdAt,
    expiresAt,
    viewsCount: 0,
    hasViewed: false,
  };
}

export async function getActiveStories(currentUserId?: string): Promise<StoryGroup[]> {
  const db = await getDb();
  const now = new Date().toISOString();
  const rows = await db.query<any>(`
    SELECT s.*, (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) as views_count
    FROM stories s
    WHERE s.expires_at > ? AND s.is_deleted = 0
    ORDER BY s.created_at ASC
  `, [now]);

  let viewedSet = new Set<string>();
  if (currentUserId && rows.length > 0) {
    const storyIds = rows.map((r: any) => r.id);
    const placeholders = storyIds.map(() => '?').join(',');
    const vRows = await db.query<any>(`
      SELECT story_id FROM story_views WHERE user_id = ? AND story_id IN (${placeholders})
    `, [currentUserId, ...storyIds]);
    viewedSet = new Set(vRows.map((r: any) => r.story_id));
  }

  const groupsMap = new Map<string, StoryGroup>();
  for (const r of rows) {
    if (!groupsMap.has(r.user_id)) {
      groupsMap.set(r.user_id, {
        userId: r.user_id,
        userName: r.user_name,
        userAvatar: r.user_avatar || '',
        hasUnseen: false,
        stories: [],
      });
    }
    const group = groupsMap.get(r.user_id)!;
    const hasViewed = viewedSet.has(r.id);
    if (!hasViewed) {
      group.hasUnseen = true;
    }
    group.stories.push({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userAvatar: r.user_avatar || '',
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      caption: r.caption || undefined,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      viewsCount: r.views_count || 0,
      hasViewed,
    });
  }

  const groups = Array.from(groupsMap.values());
  if (currentUserId) {
    groups.sort((a, b) => (a.userId === currentUserId ? -1 : b.userId === currentUserId ? 1 : 0));
  }

  return groups;
}

export async function getStoryById(storyId: string, currentUserId?: string): Promise<Story | null> {
  const db = await getDb();
  const now = new Date().toISOString();
  const row = await db.get<any>(`
    SELECT s.*, (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) as views_count
    FROM stories s
    WHERE s.id = ? AND s.expires_at > ? AND s.is_deleted = 0
  `, [storyId, now]);

  if (!row) return null;

  let hasViewed = false;
  if (currentUserId) {
    const v = await db.get<any>('SELECT id FROM story_views WHERE story_id = ? AND user_id = ?', [storyId, currentUserId]);
    hasViewed = !!v;
  }

  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userAvatar: row.user_avatar || '',
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    caption: row.caption || undefined,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    viewsCount: row.views_count || 0,
    hasViewed,
  };
}

export async function deleteStory(storyId: string, userId: string, isAdmin: boolean): Promise<{ success: boolean }> {
  const db = await getDb();
  const story = await db.get<any>('SELECT * FROM stories WHERE id = ?', [storyId]);
  if (!story) {
    throw { status: 404, message: 'Historia no encontrada.' };
  }

  if (story.user_id !== userId && !isAdmin) {
    throw { status: 403, message: 'No tienes permiso para retirar esta historia.' };
  }

  await db.run('UPDATE stories SET is_deleted = 1, deleted_at = ? WHERE id = ?', [
    new Date().toISOString(),
    storyId,
  ]);

  return { success: true };
}

export async function recordStoryView(storyId: string, userId: string, userName: string, userAvatar?: string): Promise<{ success: boolean; isNewView: boolean; viewsCount: number; totalViews: number }> {
  const db = await getDb();
  const now = new Date().toISOString();
  const story = await db.get<any>('SELECT id, user_id, expires_at, is_deleted FROM stories WHERE id = ?', [storyId]);
  if (!story || story.is_deleted || story.expires_at <= now) {
    throw { status: 404, message: 'Esta historia ha caducado o no está disponible.' };
  }

  const existing = await db.get<any>('SELECT id FROM story_views WHERE story_id = ? AND user_id = ?', [storyId, userId]);
  if (!existing) {
    const viewId = `stv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    await db.run('INSERT INTO story_views (id, story_id, user_id, user_name, user_avatar, viewed_at) VALUES (?, ?, ?, ?, ?, ?)', [
      viewId,
      storyId,
      userId,
      userName,
      userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      now,
    ]);
  }

  const isNewView = !existing;
  const cntRow = await db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM story_views WHERE story_id = ?', [storyId]);
  const totalViews = cntRow ? cntRow.cnt : 1;
  return { success: true, isNewView, viewsCount: totalViews, totalViews };
}

export async function getStoryViewers(storyId: string, requestingUserId: string, isAdmin: boolean): Promise<StoryViewer[]> {
  const db = await getDb();
  const story = await db.get<any>('SELECT user_id FROM stories WHERE id = ?', [storyId]);
  if (!story) {
    throw { status: 404, message: 'Historia no encontrada.' };
  }

  if (story.user_id !== requestingUserId && !isAdmin) {
    throw { status: 403, message: 'Solo el autor puede consultar las visualizaciones de su historia.' };
  }

  const rows = await db.query<any>(`
    SELECT user_id, user_name, user_avatar, viewed_at
    FROM story_views
    WHERE story_id = ?
    ORDER BY viewed_at DESC
  `, [storyId]);

  return rows.map((r: any) => ({
    userId: r.user_id,
    userName: r.user_name,
    userAvatar: r.user_avatar || '',
    viewedAt: r.viewed_at,
  }));
}

// ============================================================================
// FASE 5: MENSAJERÍA PRIVADA, BLOQUEOS Y REPORTES
// ============================================================================

export async function getOrCreateConversation(currentUserId: string, targetUserId: string): Promise<Conversation> {
  if (currentUserId === targetUserId) {
    throw { status: 400, message: 'No puedes iniciar una conversación contigo mismo.' };
  }

  const db = await getDb();

  // Comprobar que el usuario objetivo existe
  const targetUser = await db.get<any>('SELECT id, name, avatar, role, handle FROM users WHERE id = ?', [targetUserId]);
  if (!targetUser) {
    throw { status: 404, message: 'Usuario no encontrado.' };
  }

  // Orden canónico estricto para asegurar exactamente 1 conversación por pareja
  const userA = currentUserId < targetUserId ? currentUserId : targetUserId;
  const userB = currentUserId < targetUserId ? targetUserId : currentUserId;

  let convRow = await db.get<any>(
    'SELECT * FROM conversations WHERE user_a_id = ? AND user_b_id = ?',
    [userA, userB]
  );

  const now = new Date().toISOString();

  if (!convRow) {
    const convId = `conv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    try {
      await db.run(
        'INSERT INTO conversations (id, user_a_id, user_b_id, last_message_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [convId, userA, userB, now, now, now]
      );
      convRow = await db.get<any>('SELECT * FROM conversations WHERE id = ?', [convId]);
    } catch (err: any) {
      // Manejar carrera concurrente
      convRow = await db.get<any>(
        'SELECT * FROM conversations WHERE user_a_id = ? AND user_b_id = ?',
        [userA, userB]
      );
      if (!convRow) throw err;
    }
  }

  // Comprobar bloqueos
  const [blockedByMe, blockedMe] = await Promise.all([
    db.get<any>('SELECT id FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', [currentUserId, targetUserId]),
    db.get<any>('SELECT id FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', [targetUserId, currentUserId]),
  ]);

  // Mensajes no leídos
  const unreadRow = await db.get<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ? AND recipient_id = ? AND status != 'read'",
    [convRow.id, currentUserId]
  );

  // Último mensaje si existe
  let lastMessage: any = undefined;
  if (convRow.last_message_id) {
    const lastMsgRow = await db.get<any>('SELECT * FROM messages WHERE id = ?', [convRow.last_message_id]);
    if (lastMsgRow) {
      lastMessage = {
        id: lastMsgRow.id,
        senderId: lastMsgRow.sender_id,
        content: lastMsgRow.content,
        createdAt: lastMsgRow.created_at,
        status: lastMsgRow.status,
        hasAttachment: !!lastMsgRow.attachment_url,
      };
    }
  }

  return {
    id: convRow.id,
    otherUser: {
      id: targetUser.id,
      name: targetUser.name,
      avatar: targetUser.avatar || '',
      handle: targetUser.handle,
      role: targetUser.role,
    },
    lastMessage,
    unreadCount: unreadRow ? unreadRow.cnt : 0,
    isBlockedByMe: !!blockedByMe,
    hasBlockedMe: !!blockedMe,
    createdAt: convRow.created_at,
    updatedAt: convRow.updated_at,
  };
}

export async function getUserConversations(userId: string, search?: string): Promise<Conversation[]> {
  const db = await getDb();

  const convRows = await db.query<any>(
    'SELECT * FROM conversations WHERE user_a_id = ? OR user_b_id = ? ORDER BY last_message_at DESC',
    [userId, userId]
  );

  if (convRows.length === 0) return [];

  // Obtener IDs de los otros usuarios
  const otherUserIds = convRows.map(c => (c.user_a_id === userId ? c.user_b_id : c.user_a_id));
  const uniqueOtherIds = Array.from(new Set(otherUserIds));
  const placeholders = uniqueOtherIds.map(() => '?').join(',');

  const [usersRows, blocksRows] = await Promise.all([
    db.query<any>(`SELECT id, name, avatar, role, handle FROM users WHERE id IN (${placeholders})`, uniqueOtherIds),
    db.query<any>(
      `SELECT blocker_id, blocked_id FROM user_blocks WHERE blocker_id = ? OR blocked_id = ?`,
      [userId, userId]
    ),
  ]);

  const userMap = new Map(usersRows.map(u => [u.id, u]));
  const blockedByMeSet = new Set(blocksRows.filter(b => b.blocker_id === userId).map(b => b.blocked_id));
  const blockedMeSet = new Set(blocksRows.filter(b => b.blocked_id === userId).map(b => b.blocker_id));

  // Obtener unread counts en lote
  const convIds = convRows.map(c => c.id);
  const convPlaceholders = convIds.map(() => '?').join(',');
  const unreadRows = await db.query<{ conversation_id: string; cnt: number }>(
    `SELECT conversation_id, COUNT(*) as cnt FROM messages WHERE conversation_id IN (${convPlaceholders}) AND recipient_id = ? AND status != 'read' GROUP BY conversation_id`,
    [...convIds, userId]
  );
  const unreadMap = new Map(unreadRows.map(u => [u.conversation_id, u.cnt]));

  const result: Conversation[] = [];

  for (const c of convRows) {
    const otherId = c.user_a_id === userId ? c.user_b_id : c.user_a_id;
    const other = userMap.get(otherId);
    if (!other) continue;

    // Filtro de búsqueda
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      const nameMatch = (other.name || '').toLowerCase().includes(q);
      const handleMatch = (other.handle || '').toLowerCase().includes(q);
      const msgMatch = (c.last_message_text || '').toLowerCase().includes(q);
      if (!nameMatch && !handleMatch && !msgMatch) continue;
    }

    result.push({
      id: c.id,
      otherUser: {
        id: other.id,
        name: other.name,
        avatar: other.avatar || '',
        handle: other.handle,
        role: other.role,
      },
      lastMessage: c.last_message_id ? {
        id: c.last_message_id,
        senderId: '',
        content: c.last_message_text || '',
        createdAt: c.last_message_at,
        status: 'sent',
      } : undefined,
      unreadCount: unreadMap.get(c.id) || 0,
      isBlockedByMe: blockedByMeSet.has(otherId),
      hasBlockedMe: blockedMeSet.has(otherId),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    });
  }

  return result;
}

export async function getConversationById(conversationId: string, userId: string): Promise<Conversation> {
  const db = await getDb();
  const c = await db.get<any>('SELECT * FROM conversations WHERE id = ?', [conversationId]);
  if (!c) {
    throw { status: 404, message: 'Conversación no encontrada.' };
  }

  if (c.user_a_id !== userId && c.user_b_id !== userId) {
    throw { status: 403, message: 'No tienes permiso para acceder a esta conversación.' };
  }

  const otherId = c.user_a_id === userId ? c.user_b_id : c.user_a_id;
  const other = await db.get<any>('SELECT id, name, avatar, role, handle FROM users WHERE id = ?', [otherId]);

  const [blockedByMe, blockedMe, unreadRow] = await Promise.all([
    db.get<any>('SELECT id FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', [userId, otherId]),
    db.get<any>('SELECT id FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', [otherId, userId]),
    db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ? AND recipient_id = ? AND status != 'read'",
      [conversationId, userId]
    ),
  ]);

  return {
    id: c.id,
    otherUser: {
      id: other?.id || otherId,
      name: other?.name || 'Usuario Kabaly',
      avatar: other?.avatar || '',
      handle: other?.handle,
      role: other?.role || 'cliente',
    },
    lastMessage: c.last_message_id ? {
      id: c.last_message_id,
      senderId: '',
      content: c.last_message_text || '',
      createdAt: c.last_message_at,
      status: 'sent',
    } : undefined,
    unreadCount: unreadRow ? unreadRow.cnt : 0,
    isBlockedByMe: !!blockedByMe,
    hasBlockedMe: !!blockedMe,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

export async function getConversationMessages(
  conversationId: string,
  userId: string,
  options: { limit?: number; cursor?: string; sinceTimestamp?: string } = {}
): Promise<{ messages: PrivateChatMessage[]; nextCursor?: string; hasMore: boolean }> {
  const db = await getDb();

  // Validar pertenencia a la conversación
  const conv = await db.get<any>('SELECT user_a_id, user_b_id FROM conversations WHERE id = ?', [conversationId]);
  if (!conv) {
    throw { status: 404, message: 'Conversación no encontrada.' };
  }
  if (conv.user_a_id !== userId && conv.user_b_id !== userId) {
    throw { status: 403, message: 'No tienes permiso para ver los mensajes de esta conversación.' };
  }

  const limit = options.limit ? Math.min(Math.max(1, options.limit), 100) : 50;

  // Si consulta incremental por polling
  if (options.sinceTimestamp) {
    const rows = await db.query<any>(
      'SELECT * FROM messages WHERE conversation_id = ? AND created_at > ? ORDER BY created_at ASC',
      [conversationId, options.sinceTimestamp]
    );
    return {
      messages: rows.map(mapMessageRow),
      hasMore: false,
    };
  }

  let query = 'SELECT * FROM messages WHERE conversation_id = ?';
  const params: any[] = [conversationId];

  // Si paginación por cursor hacia atrás (mensajes anteriores)
  if (options.cursor) {
    query += ' AND created_at < ?';
    params.push(options.cursor);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit + 1);

  const rows = await db.query<any>(query, params);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  // Devolver en orden cronológico ascendente para renderizar chat de arriba hacia abajo
  const chronological = items.reverse();
  const nextCursor = hasMore ? items[0].created_at : undefined;

  return {
    messages: chronological.map(mapMessageRow),
    nextCursor,
    hasMore,
  };
}

function mapMessageRow(r: any): PrivateChatMessage {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    recipientId: r.recipient_id,
    content: r.content,
    clientMessageId: r.client_message_id || undefined,
    attachmentId: r.attachment_id || undefined,
    attachmentUrl: r.attachment_url || undefined,
    attachmentType: r.attachment_type || undefined,
    status: r.status,
    readAt: r.read_at || undefined,
    createdAt: r.created_at,
  };
}

export async function sendChatMessage(params: {
  conversationId: string;
  senderId: string;
  content: string;
  clientMessageId?: string;
  attachmentId?: string;
}): Promise<PrivateChatMessage> {
  const db = await getDb();

  // 1. Validar conversación y participantes
  const conv = await db.get<any>('SELECT * FROM conversations WHERE id = ?', [params.conversationId]);
  if (!conv) {
    throw { status: 404, message: 'Conversación no encontrada.' };
  }
  if (conv.user_a_id !== params.senderId && conv.user_b_id !== params.senderId) {
    throw { status: 403, message: 'No tienes permiso para enviar mensajes en esta conversación.' };
  }

  const recipientId = conv.user_a_id === params.senderId ? conv.user_b_id : conv.user_a_id;

  // 2. Comprobar bloqueo bidireccional
  const blockRow = await db.get<any>(
    'SELECT id, blocker_id FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
    [params.senderId, recipientId, recipientId, params.senderId]
  );
  if (blockRow) {
    throw { status: 403, message: 'No es posible enviar mensajes debido a un bloqueo activo entre usuarios.' };
  }

  // 3. Comprobar idempotencia (Evitar duplicados por doble clic o pérdida de red)
  if (params.clientMessageId) {
    const existing = await db.get<any>(
      'SELECT * FROM messages WHERE conversation_id = ? AND client_message_id = ?',
      [params.conversationId, params.clientMessageId]
    );
    if (existing) {
      return mapMessageRow(existing);
    }
  }

  // 4. Validar adjunto si existe
  let attachmentUrl: string | undefined = undefined;
  let attachmentType: 'image' | undefined = undefined;
  if (params.attachmentId) {
    const attach = await db.get<any>('SELECT * FROM chat_attachments WHERE id = ?', [params.attachmentId]);
    if (!attach || attach.user_id !== params.senderId) {
      throw { status: 400, message: 'Adjunto no válido o no autorizado.' };
    }
    attachmentUrl = `/api/chat/attachments/${attach.id}`;
    attachmentType = 'image';
  }

  // 5. Validar longitud del texto (1 a 2000 chars, o vacío si lleva adjunto)
  const rawText = (params.content || '').trim();
  if (!rawText && !attachmentUrl) {
    throw { status: 400, message: 'El mensaje no puede estar vacío.' };
  }
  if (rawText.length > 2000) {
    throw { status: 400, message: 'El mensaje no puede exceder los 2000 caracteres.' };
  }

  // Sanitizar HTML
  const cleanContent = rawText
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();

  const msgId = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO messages (
      id, conversation_id, sender_id, recipient_id, content,
      client_message_id, attachment_id, attachment_url, attachment_type,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msgId,
      params.conversationId,
      params.senderId,
      recipientId,
      cleanContent || (attachmentUrl ? '[Imagen adjunta]' : ''),
      params.clientMessageId || null,
      params.attachmentId || null,
      attachmentUrl || null,
      attachmentType || null,
      'sent',
      now,
    ]
  );

  // Reclamar adjunto
  if (params.attachmentId) {
    await db.run(
      'UPDATE chat_attachments SET conversation_id = ?, message_id = ?, is_claimed = 1 WHERE id = ?',
      [params.conversationId, msgId, params.attachmentId]
    );
  }

  // Actualizar metadatos de la conversación
  const snippet = cleanContent.length > 60 ? cleanContent.slice(0, 60) + '...' : cleanContent || '[Imagen adjunta]';
  await db.run(
    'UPDATE conversations SET last_message_id = ?, last_message_text = ?, last_message_at = ?, updated_at = ? WHERE id = ?',
    [msgId, snippet, now, now, params.conversationId]
  );

  return {
    id: msgId,
    conversationId: params.conversationId,
    senderId: params.senderId,
    recipientId,
    content: cleanContent || '[Imagen adjunta]',
    clientMessageId: params.clientMessageId,
    attachmentId: params.attachmentId,
    attachmentUrl,
    attachmentType,
    status: 'sent',
    createdAt: now,
  };
}

export async function markConversationAsRead(conversationId: string, userId: string): Promise<{ success: boolean; count: number }> {
  const db = await getDb();
  const conv = await db.get<any>('SELECT user_a_id, user_b_id FROM conversations WHERE id = ?', [conversationId]);
  if (!conv || (conv.user_a_id !== userId && conv.user_b_id !== userId)) {
    throw { status: 403, message: 'No autorizado.' };
  }

  const now = new Date().toISOString();
  await db.run(
    "UPDATE messages SET status = 'read', read_at = ? WHERE conversation_id = ? AND recipient_id = ? AND status != 'read'",
    [now, conversationId, userId]
  );

  return { success: true, count: 1 };
}

export async function blockUser(blockerId: string, targetUserId: string): Promise<{ success: boolean; isBlocked: boolean }> {
  if (blockerId === targetUserId) {
    throw { status: 400, message: 'No puedes bloquearte a ti mismo.' };
  }

  const db = await getDb();
  const target = await db.get<any>('SELECT id FROM users WHERE id = ?', [targetUserId]);
  if (!target) {
    throw { status: 404, message: 'Usuario no encontrado.' };
  }

  const blockId = `blk_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  await db.run(
    'INSERT OR IGNORE INTO user_blocks (id, blocker_id, blocked_id, created_at) VALUES (?, ?, ?, ?)',
    [blockId, blockerId, targetUserId, now]
  );

  return { success: true, isBlocked: true };
}

export async function unblockUser(blockerId: string, targetUserId: string): Promise<{ success: boolean; isBlocked: boolean }> {
  const db = await getDb();
  await db.run('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', [blockerId, targetUserId]);
  return { success: true, isBlocked: false };
}

export async function getBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const db = await getDb();
  const rows = await db.query<any>(
    `SELECT b.id, u.id as user_id, u.name, u.avatar, u.role, u.handle, b.created_at as blocked_at
     FROM user_blocks b
     JOIN users u ON b.blocked_id = u.id
     WHERE b.blocker_id = ?
     ORDER BY b.created_at DESC`,
    [userId]
  );

  return rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    avatar: r.avatar || '',
    role: r.role,
    handle: r.handle,
    blockedAt: r.blocked_at,
  }));
}

export async function reportMessage(params: {
  reporterId: string;
  messageId: string;
  reason: string;
  details?: string;
}): Promise<{ success: boolean; reportId: string }> {
  const db = await getDb();
  const msg = await db.get<any>('SELECT * FROM messages WHERE id = ?', [params.messageId]);
  if (!msg) {
    throw { status: 404, message: 'Mensaje no encontrado.' };
  }

  // Solo participantes de la conversación pueden reportar el mensaje
  const conv = await db.get<any>('SELECT user_a_id, user_b_id FROM conversations WHERE id = ?', [msg.conversation_id]);
  if (!conv || (conv.user_a_id !== params.reporterId && conv.user_b_id !== params.reporterId)) {
    throw { status: 403, message: 'No autorizado para reportar este mensaje.' };
  }

  const reportId = `mrp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  await db.run(
    `INSERT INTO message_reports (
      id, reporter_id, message_id, conversation_id, reported_user_id,
      message_content, reason, details, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reportId,
      params.reporterId,
      params.messageId,
      msg.conversation_id,
      msg.sender_id,
      msg.content,
      params.reason,
      params.details || null,
      'pending',
      now,
    ]
  );

  return { success: true, reportId };
}

export async function getReportedMessages(adminUserId: string): Promise<MessageReport[]> {
  const db = await getDb();
  const admin = await db.get<any>('SELECT role FROM users WHERE id = ?', [adminUserId]);
  if (!admin || admin.role !== 'admin') {
    throw { status: 403, message: 'Acceso restringido a moderadores y administradores.' };
  }

  const rows = await db.query<any>(
    'SELECT * FROM message_reports ORDER BY created_at DESC'
  );

  return rows.map(r => ({
    id: r.id,
    reporterId: r.reporter_id,
    messageId: r.message_id,
    conversationId: r.conversation_id,
    reportedUserId: r.reported_user_id,
    messageContent: r.message_content,
    reason: r.reason,
    details: r.details || undefined,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function createChatAttachment(params: {
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}): Promise<{ id: string; url: string }> {
  const db = await getDb();
  const attachId = `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  await db.run(
    'INSERT INTO chat_attachments (id, user_id, filename, original_name, mime_type, size, is_claimed, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
    [attachId, params.userId, params.filename, params.originalName, params.mimeType, params.size, now]
  );

  return {
    id: attachId,
    url: `/api/chat/attachments/${attachId}`,
  };
}

export async function getChatAttachmentForUser(attachmentId: string, userId: string): Promise<{ filename: string; mimeType: string }> {
  const db = await getDb();
  const attach = await db.get<any>('SELECT * FROM chat_attachments WHERE id = ?', [attachmentId]);
  if (!attach) {
    throw { status: 404, message: 'Archivo adjunto no encontrado.' };
  }

  // Si está reclamado y asociado a una conversación, validar que el usuario pertenece a esa conversación
  if (attach.conversation_id) {
    const conv = await db.get<any>('SELECT user_a_id, user_b_id FROM conversations WHERE id = ?', [attach.conversation_id]);
    if (!conv || (conv.user_a_id !== userId && conv.user_b_id !== userId)) {
      throw { status: 403, message: 'Acceso denegado a este archivo privado.' };
    }
  } else {
    // Si aún no está reclamado, solo el propietario puede verlo
    if (attach.user_id !== userId) {
      throw { status: 403, message: 'Acceso denegado a este archivo privado.' };
    }
  }

  return {
    filename: attach.filename,
    mimeType: attach.mime_type,
  };
}

export async function getTotalUnreadMessagesCount(userId: string): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM messages WHERE recipient_id = ? AND status != 'read'",
    [userId]
  );
  return row ? row.cnt : 0;
}

// =============================================================================
// FASE 10: RED SOCIAL COMPLETA (NOTIFICACIONES, PERFILES PÚBLICOS UNIVERSALES,
// AURAS DESTACADAS, PUBLICACIONES FIJADAS, KYC TAROTISTA Y BUSCADOR GLOBAL)
// =============================================================================

export async function createNotification(params: {
  userId: string;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  type: CosmicNotification['type'];
  referenceId?: string;
  message: string;
}): Promise<void> {
  if (!params.userId || params.userId === params.actorId) return;
  const db = await getDb();
  const id = `not_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  await db.run(
    `INSERT INTO notifications (id, user_id, actor_id, actor_name, actor_avatar, type, reference_id, message, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      id,
      params.userId,
      params.actorId,
      params.actorName,
      params.actorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      params.type,
      params.referenceId || null,
      params.message,
      new Date().toISOString(),
    ]
  );
}

export async function getUserNotifications(userId: string, limit = 40): Promise<{ notifications: CosmicNotification[]; unreadCount: number }> {
  const db = await getDb();
  const [rows, countRow] = await Promise.all([
    db.query<any>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    ),
    db.get<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0',
      [userId]
    ),
  ]);

  const notifications: CosmicNotification[] = rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    actorId: r.actor_id,
    actorName: r.actor_name,
    actorAvatar: r.actor_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
    type: r.type,
    referenceId: r.reference_id || undefined,
    message: r.message,
    isRead: !!r.is_read,
    createdAt: r.created_at,
  }));

  return {
    notifications,
    unreadCount: countRow ? countRow.cnt : 0,
  };
}

export async function markNotificationsRead(userId: string, notificationId?: string): Promise<{ success: boolean }> {
  const db = await getDb();
  if (notificationId) {
    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [notificationId, userId]);
  } else {
    await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
  }
  return { success: true };
}

export async function getUserHighlights(userId: string): Promise<ProfileHighlight[]> {
  const db = await getDb();
  const rows = await db.query<any>(
    'SELECT * FROM profile_highlights WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    coverUrl: r.cover_url,
    mediaUrl: r.media_url,
    mediaType: (r.media_type as 'image' | 'video') || 'image',
    createdAt: r.created_at,
  }));
}

export async function createProfileHighlight(params: {
  userId: string;
  title: string;
  coverUrl: string;
  mediaUrl: string;
  mediaType?: 'image' | 'video';
}): Promise<ProfileHighlight> {
  const db = await getDb();
  const id = `hl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();
  const safeTitle = (params.title || 'Aura').trim().slice(0, 32);
  const safeMedia = (params.mediaUrl || '').trim();
  const safeCover = (params.coverUrl || safeMedia).trim();

  await db.run(
    `INSERT INTO profile_highlights (id, user_id, title, cover_url, media_url, media_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, params.userId, safeTitle, safeCover, safeMedia, params.mediaType === 'video' ? 'video' : 'image', now]
  );

  return {
    id,
    userId: params.userId,
    title: safeTitle,
    coverUrl: safeCover,
    mediaUrl: safeMedia,
    mediaType: params.mediaType === 'video' ? 'video' : 'image',
    createdAt: now,
  };
}

export async function deleteProfileHighlight(highlightId: string, userId: string): Promise<{ success: boolean }> {
  const db = await getDb();
  await db.run('DELETE FROM profile_highlights WHERE id = ? AND user_id = ?', [highlightId, userId]);
  return { success: true };
}

export async function togglePinPost(postId: string, userId: string): Promise<{ isPinned: boolean }> {
  const db = await getDb();
  const post = await db.get<any>('SELECT id, tarotista_id, is_pinned FROM videos WHERE id = ? AND is_deleted = 0', [postId]);
  if (!post) {
    throw { status: 404, message: 'Publicación no encontrada.' };
  }
  if (post.tarotista_id !== userId) {
    throw { status: 403, message: 'Solo puedes fijar o desfijar tus propias publicaciones.' };
  }

  const nextPinned = post.is_pinned ? 0 : 1;
  await db.run('UPDATE videos SET is_pinned = ? WHERE id = ?', [nextPinned, postId]);
  return { isPinned: !!nextPinned };
}

export async function toggleCommentLike(commentId: string, userId: string): Promise<{ likesCount: number; isLiked: boolean }> {
  const db = await getDb();
  const comment = await db.get<any>('SELECT id, video_id, author_id, content FROM comments WHERE id = ? AND is_deleted = 0', [commentId]);
  if (!comment) {
    throw { status: 404, message: 'Comentario no encontrado.' };
  }

  const existing = await db.get<any>('SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?', [commentId, userId]);
  let isLiked = false;

  if (existing) {
    await db.run('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?', [commentId, userId]);
    isLiked = false;
  } else {
    const id = `cml_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    await db.run('INSERT INTO comment_likes (id, comment_id, user_id, created_at) VALUES (?, ?, ?, ?)', [
      id,
      commentId,
      userId,
      new Date().toISOString(),
    ]);
    isLiked = true;
  }

  const countRow = await db.get<{ cnt: number }>('SELECT COUNT(*) as cnt FROM comment_likes WHERE comment_id = ?', [commentId]);
  const likesCount = countRow ? countRow.cnt : 0;
  await db.run('UPDATE comments SET likes_count = ? WHERE id = ?', [likesCount, commentId]);

  return { likesCount, isLiked };
}

export async function getPublicUserProfile(targetIdentifier: string, currentUserId?: string): Promise<PublicUserProfile | null> {
  const db = await getDb();
  // Buscar por user.id, tarotista_profile.id o handle
  let userRow = await db.get<any>('SELECT * FROM users WHERE id = ? OR handle = ?', [targetIdentifier, targetIdentifier]);
  let tarRow = await db.get<any>('SELECT * FROM tarotista_profiles WHERE id = ? OR user_id = ?', [targetIdentifier, userRow ? userRow.id : targetIdentifier]);

  if (!userRow && tarRow) {
    userRow = await db.get<any>('SELECT * FROM users WHERE id = ?', [tarRow.user_id]);
  }

  if (!userRow && !tarRow) {
    return null;
  }

  const resolvedUserId = userRow ? userRow.id : tarRow.user_id;
  const [rel, highlights, feedRes] = await Promise.all([
    getUserRelationship(resolvedUserId, currentUserId),
    getUserHighlights(resolvedUserId),
    getFeedPosts({ authorId: resolvedUserId, currentUserId, limit: 30 }),
  ]);

  // Ordenar posts fijados primero
  const sortedPosts = [...feedRes.items].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

  let mappedTarotista: TarotistaProfile | null = null;
  if (tarRow) {
    mappedTarotista = {
      id: tarRow.id,
      userId: tarRow.user_id,
      professionalName: tarRow.professional_name,
      avatar: tarRow.avatar || userRow?.avatar || '',
      banner: tarRow.banner || userRow?.cover_image || '',
      specialties: parseJson(tarRow.specialties, ['Tarot']),
      bio: tarRow.bio || userRow?.bio || '',
      experienceYears: tarRow.experience_years || 1,
      pricePerMinCoins: tarRow.price_per_min_coins || 15,
      pricePerMinEur: tarRow.price_per_min_eur || 1.5,
      languages: parseJson(tarRow.languages, ['Español']),
      country: tarRow.country || 'España',
      isVerified: !!tarRow.is_verified,
      kycStatus: tarRow.kyc_status,
      stripeConnectStatus: tarRow.stripe_connect_status,
      ratingAverage: tarRow.rating_average || 5.0,
      totalReviews: tarRow.total_reviews || 0,
      totalReadings: tarRow.total_readings || 0,
      followersCount: rel.followersCount,
      videoCount: sortedPosts.length,
      availabilityStatus: tarRow.availability_status || 'online',
      customCommissionPercentage: tarRow.custom_commission_percentage || 20,
    };
  }

  const displayName = userRow?.name || tarRow?.professional_name || 'Iniciado Kabaly';
  const defaultHandle = `@${displayName.toLowerCase().replace(/\s+/g, '_')}`;

  return {
    id: resolvedUserId,
    name: displayName,
    handle: userRow?.handle || defaultHandle,
    role: userRow?.role || 'tarotista',
    avatar: userRow?.avatar || tarRow?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
    coverImage: userRow?.cover_image || tarRow?.banner || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200',
    bio: userRow?.bio || tarRow?.bio || 'Viajero astral en KABALY ✨',
    sunSign: userRow?.sun_sign || undefined,
    moonSign: userRow?.moon_sign || undefined,
    risingSign: userRow?.rising_sign || undefined,
    rulingArcana: userRow?.ruling_arcana || undefined,
    spiritualGift: userRow?.spiritual_gift || undefined,
    isPrivate: !!userRow?.is_private,
    followersCount: rel.followersCount,
    followingCount: rel.followingCount,
    postsCount: sortedPosts.length,
    isFollowing: rel.isFollowing,
    tarotistaProfile: mappedTarotista,
    highlights,
    posts: sortedPosts,
    createdAt: userRow?.created_at || tarRow?.created_at || new Date().toISOString(),
  };
}

export async function applyForTarotistaKyc(userId: string, params: {
  professionalName: string;
  specialties: string[];
  bio: string;
  experienceYears: number;
  pricePerMinCoins: number;
  languages?: string[];
  country?: string;
}): Promise<{ success: boolean; profileId: string }> {
  const db = await getDb();
  const user = await db.get<any>('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    throw { status: 404, message: 'Usuario no encontrado.' };
  }

  const safeProfName = (params.professionalName || user.name).trim();
  const safeBio = (params.bio || user.bio || 'Guía espiritual en KABALY').trim();
  const safeSpecs = Array.isArray(params.specialties) && params.specialties.length > 0 ? params.specialties : ['Tarot'];
  const safeExp = Math.max(1, Number(params.experienceYears) || 1);
  const safePriceCoins = Math.max(5, Math.min(500, Math.floor(Number(params.pricePerMinCoins) || 15)));
  const safePriceEur = Number((safePriceCoins * 0.1).toFixed(2));
  const now = new Date().toISOString();

  const existing = await db.get<any>('SELECT id FROM tarotista_profiles WHERE user_id = ?', [userId]);
  let profileId = existing ? existing.id : `tar_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  if (existing) {
    await db.run(
      `UPDATE tarotista_profiles
       SET professional_name = ?, specialties = ?, bio = ?, experience_years = ?,
           price_per_min_coins = ?, price_per_min_eur = ?, kyc_status = 'pendiente'
       WHERE user_id = ?`,
      [safeProfName, JSON.stringify(safeSpecs), safeBio, safeExp, safePriceCoins, safePriceEur, userId]
    );
  } else {
    await db.run(
      `INSERT INTO tarotista_profiles (
        id, user_id, professional_name, avatar, banner, specialties, bio, experience_years,
        price_per_min_coins, price_per_min_eur, languages, country, is_verified, kyc_status,
        stripe_connect_status, rating_average, total_reviews, total_readings, followers_count,
        video_count, availability_status, custom_commission_percentage, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pendiente', 'pendiente', 5.0, 0, 0, 0, 0, 'online', 20, ?)`,
      [
        profileId,
        userId,
        safeProfName,
        user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
        user.cover_image || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200',
        JSON.stringify(safeSpecs),
        safeBio,
        safeExp,
        safePriceCoins,
        safePriceEur,
        JSON.stringify(params.languages || ['Español']),
        params.country || 'España',
        now,
      ]
    );
  }

  await db.run("UPDATE users SET role = 'tarotista', updated_at = ? WHERE id = ? AND role = 'cliente'", [now, userId]);
  return { success: true, profileId };
}

export async function searchSocialNetwork(query: string, currentUserId?: string): Promise<{
  users: FollowUser[];
  tarotistas: TarotistaProfile[];
  posts: Video[];
  hashtags: { tag: string; count: number }[];
}> {
  const db = await getDb();
  const q = (query || '').trim().toLowerCase();
  const likeParam = `%${q}%`;

  const [userRows, allTarotistas, feedRes] = await Promise.all([
    q
      ? db.query<any>(
          'SELECT id, name, avatar, role, handle FROM users WHERE LOWER(name) LIKE ? OR LOWER(COALESCE(handle, "")) LIKE ? OR LOWER(COALESCE(bio, "")) LIKE ? LIMIT 25',
          [likeParam, likeParam, likeParam]
        )
      : db.query<any>('SELECT id, name, avatar, role, handle FROM users ORDER BY created_at DESC LIMIT 15'),
    getPublicTarotistas(),
    getFeedPosts({ limit: 40, currentUserId }),
  ]);

  const filteredTarotistas = q
    ? allTarotistas.filter(
        t =>
          t.professionalName.toLowerCase().includes(q) ||
          t.bio.toLowerCase().includes(q) ||
          t.specialties.some(s => s.toLowerCase().includes(q))
      )
    : allTarotistas;

  const filteredPosts = q
    ? feedRes.items.filter(
        p =>
          p.title.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.tarotistaName.toLowerCase().includes(q)
      )
    : feedRes.items;

  // Extraer #hashtags de todas las publicaciones activas
  const tagCounts = new Map<string, number>();
  for (const p of feedRes.items) {
    const text = `${p.title} ${p.description || ''} #${p.category.replace(/\s+/g, '')}`;
    const matches = text.match(/#[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9_]+/g) || [];
    for (const rawTag of matches) {
      const normalized = rawTag.toLowerCase();
      if (!q || normalized.includes(q.replace(/^#/, ''))) {
        tagCounts.set(rawTag, (tagCounts.get(rawTag) || 0) + 1);
      }
    }
  }

  const hashtags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    users: userRows.map((r: any) => ({
      id: r.id,
      name: r.name,
      avatar: r.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      role: r.role,
      handle: r.handle || `@${r.name.toLowerCase().replace(/\s+/g, '_')}`,
    })),
    tarotistas: filteredTarotistas,
    posts: filteredPosts,
    hashtags,
  };
}

export async function togglePinComment(
  commentId: string,
  userId: string,
  isAdmin = false
): Promise<{ success: boolean; isPinned?: boolean; error?: string; status: number }> {
  const db = await getDb();
  const comment = await db.get<any>('SELECT * FROM comments WHERE id = ? AND is_deleted = 0', [commentId]);
  if (!comment) {
    return { success: false, error: 'Comentario no encontrado.', status: 404 };
  }

  const video = await db.get<any>('SELECT * FROM videos WHERE id = ?', [comment.video_id]);
  if (!video) {
    return { success: false, error: 'Publicación no encontrada.', status: 404 };
  }

  const tarProfile = await db.get<any>('SELECT id FROM tarotista_profiles WHERE user_id = ?', [userId]);
  const isPostAuthor = video.tarotista_id === userId || (tarProfile && video.tarotista_id === tarProfile.id);

  if (!isPostAuthor && !isAdmin) {
    return { success: false, error: 'Solo el autor de la visión puede fijar un comentario en su oráculo.', status: 403 };
  }

  const nextPinned = comment.is_pinned ? 0 : 1;
  if (nextPinned === 1) {
    // Desfijar otros comentarios de la misma publicación para dejar el fijado en la cima
    await db.run('UPDATE comments SET is_pinned = 0 WHERE video_id = ?', [comment.video_id]);
  }
  await db.run('UPDATE comments SET is_pinned = ? WHERE id = ?', [nextPinned, commentId]);

  return { success: true, isPinned: nextPinned === 1, status: 200 };
}



