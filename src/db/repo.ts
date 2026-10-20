import { getDb } from './database';
import { TarotistaProfile, Video, Consultation, Review, LedgerTransaction, Report, WithdrawalRequest } from '../types';

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

export async function getPublicVideos(): Promise<Video[]> {
  const db = await getDb();
  const rows = await db.query<any>(`
    SELECT * FROM videos ORDER BY created_at DESC
  `);

  return rows.map(r => ({
    id: r.id,
    tarotistaId: r.tarotista_id,
    tarotistaName: r.tarotista_name,
    tarotistaAvatar: r.tarotista_avatar,
    isVerified: !!r.is_verified,
    title: r.title,
    videoUrl: r.video_url,
    thumbnailUrl: r.thumbnail_url,
    category: r.category,
    likes: r.likes,
    commentsCount: r.comments_count,
    sharesCount: r.shares_count,
    soundTitle: r.sound_title,
    isPremium: !!r.is_premium,
    priceCoins: r.price_coins,
    unlockedByUserIds: [],
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
  let sql = 'SELECT * FROM consultations WHERE client_id = ? OR tarotista_id = ? ORDER BY created_at DESC';
  let params: any[] = [userId, userId];

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
    tarotistaName: r.tarotista_name,
    tarotistaAvatar: r.tarotista_avatar,
    status: r.status,
    type: r.type,
    durationMinutes: r.duration_minutes,
    totalCoins: r.total_coins,
    platformCommissionCoins: Math.round((r.total_coins || 0) * 0.2),
    tarotistaEarningsCoins: r.tarotista_earnings_coins,
    scheduledFor: r.scheduled_for,
    createdAt: r.created_at,
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
