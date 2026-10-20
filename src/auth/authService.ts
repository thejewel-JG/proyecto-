import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/database';

export interface UserSessionData {
  id: string;
  name: string;
  email: string;
  role: 'cliente' | 'tarotista' | 'admin';
  avatar: string;
  coverImage?: string;
  handle?: string;
  bio?: string;
  coinsBalance: number;
  isAgeVerified: boolean;
  spendingLimitDaily?: number | null;
  spendingLimitWeekly?: number | null;
  spentToday: number;
  spentThisWeek: number;
  createdAt: string;
}

export const SESSION_COOKIE_NAME = 'kabaly_session';
export const SESSION_DURATION_DAYS = 7;

export async function registerUser(params: {
  name: string;
  email: string;
  password: string;
  role?: string;
  isAgeVerified: boolean;
  userAgent?: string;
  ip?: string;
}): Promise<{ user: UserSessionData; sessionToken: string }> {
  const db = await getDb();
  const name = (params.name || '').trim();
  const email = (params.email || '').trim().toLowerCase();
  const password = params.password || '';

  // Validaciones
  if (!name || name.length < 2) {
    throw { status: 400, message: 'El nombre debe contener al menos 2 caracteres.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    throw { status: 400, message: 'Debe proporcionar un correo electrónico válido.' };
  }

  if (!password || password.length < 8) {
    throw { status: 400, message: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  if (!params.isAgeVerified) {
    throw { status: 400, message: 'Debe confirmar que es mayor de 18 años para utilizar KABALY.' };
  }

  // REQUISITO: "Impide que el registro o la edición de perfil concedan el rol administrador."
  let safeRole: 'cliente' | 'tarotista' = 'cliente';
  if (params.role === 'tarotista') {
    safeRole = 'tarotista';
  }

  // Comprobar correo único
  const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    throw { status: 400, message: 'El correo electrónico ya se encuentra registrado.' };
  }

  // Hash seguro de contraseña
  const passwordHash = await bcrypt.hash(password, 10);
  const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();
  const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200';

  await db.run(`
    INSERT INTO users (
      id, name, email, password_hash, role, avatar, coins_balance, is_age_verified, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    userId,
    name,
    email,
    passwordHash,
    safeRole,
    defaultAvatar,
    100, // Saldo de bienvenida de 100 monedas
    1,
    now,
    now
  ]);

  if (safeRole === 'tarotista') {
    const profileId = `tar_${Date.now()}`;
    await db.run(`
      INSERT INTO tarotista_profiles (
        id, user_id, professional_name, avatar, specialties, bio, experience_years,
        price_per_min_coins, price_per_min_eur, languages, country, is_verified, kyc_status,
        stripe_connect_status, rating_average, total_reviews, total_readings, followers_count,
        video_count, availability_status, custom_commission_percentage, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      profileId,
      userId,
      name,
      defaultAvatar,
      JSON.stringify(['Tarot', 'Astrología']),
      'Guía espiritual profesional verificado en KABALY.',
      1,
      15,
      1.50,
      JSON.stringify(['Español']),
      'España',
      0,
      'pendiente',
      'pendiente',
      5.0,
      0,
      0,
      0,
      0,
      'offline',
      20,
      now
    ]);
  }

  // Crear sesión segura
  const sessionToken = await createSession(userId, params.userAgent, params.ip);

  const user: UserSessionData = {
    id: userId,
    name,
    email,
    role: safeRole,
    avatar: defaultAvatar,
    coinsBalance: 100,
    isAgeVerified: true,
    spentToday: 0,
    spentThisWeek: 0,
    createdAt: now,
  };

  return { user, sessionToken };
}

export async function loginUser(params: {
  email: string;
  password: string;
  userAgent?: string;
  ip?: string;
}): Promise<{ user: UserSessionData; sessionToken: string }> {
  const db = await getDb();
  const email = (params.email || '').trim().toLowerCase();
  const password = params.password || '';
  const ip = params.ip || '127.0.0.1';
  const rateLimitIdentifier = `${ip}_${email}`;

  // REQUISITO: "Límites de intentos de acceso y mensajes que no revelen si existe una cuenta."
  const now = new Date();
  const rateRecord = await db.get<{ attempts: number; last_attempt: string; locked_until: string | null }>(
    'SELECT attempts, last_attempt, locked_until FROM login_attempts WHERE identifier = ?',
    [rateLimitIdentifier]
  );

  if (rateRecord && rateRecord.locked_until) {
    const lockedUntilDate = new Date(rateRecord.locked_until);
    if (lockedUntilDate > now) {
      const minutesRemaining = Math.ceil((lockedUntilDate.getTime() - now.getTime()) / 60000);
      throw {
        status: 429,
        message: `Demasiados intentos fallidos. Por seguridad, intente de nuevo en ${minutesRemaining} minuto(s).`
      };
    }
  }

  // Buscar usuario
  const row = await db.get<any>(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );

  let isPasswordValid = false;
  if (row) {
    isPasswordValid = await bcrypt.compare(password, row.password_hash);
  }

  if (!row || !isPasswordValid) {
    // Incrementar intentos fallidos
    const nextAttempts = rateRecord ? rateRecord.attempts + 1 : 1;
    let lockedUntil: string | null = null;
    
    // Si falla 5 veces consecutivas, bloquear por 15 minutos
    if (nextAttempts >= 5) {
      lockedUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    }

    await db.run(`
      INSERT INTO login_attempts (identifier, attempts, last_attempt, locked_until)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(identifier) DO UPDATE SET
        attempts = ?,
        last_attempt = ?,
        locked_until = ?
    `, [
      rateLimitIdentifier, nextAttempts, now.toISOString(), lockedUntil,
      nextAttempts, now.toISOString(), lockedUntil
    ]);

    // REQUISITO: Mensaje que no revele si existe una cuenta
    throw { status: 401, message: 'Credenciales incorrectas. Verifique su correo y contraseña.' };
  }

  // Restablecer intentos fallidos tras login exitoso
  await db.run('DELETE FROM login_attempts WHERE identifier = ?', [rateLimitIdentifier]);

  // Crear sesión
  const sessionToken = await createSession(row.id, params.userAgent, params.ip);

  const user: UserSessionData = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatar: row.avatar,
    coverImage: row.cover_image,
    handle: row.handle,
    bio: row.bio,
    coinsBalance: row.coins_balance,
    isAgeVerified: !!row.is_age_verified,
    spendingLimitDaily: row.spending_limit_daily,
    spendingLimitWeekly: row.spending_limit_weekly,
    spentToday: row.spent_today,
    spentThisWeek: row.spent_this_week,
    createdAt: row.created_at,
  };

  return { user, sessionToken };
}

async function createSession(userId: string, userAgent?: string, ip?: string): Promise<string> {
  const db = await getDb();
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await db.run(`
    INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    sessionToken,
    userId,
    expiresAt.toISOString(),
    now.toISOString(),
    userAgent || null,
    ip || null
  ]);

  return sessionToken;
}

export async function getSessionUser(sessionToken: string | undefined): Promise<UserSessionData | null> {
  if (!sessionToken || typeof sessionToken !== 'string') return null;

  const db = await getDb();
  const session = await db.get<{ user_id: string; expires_at: string }>(
    'SELECT user_id, expires_at FROM sessions WHERE id = ?',
    [sessionToken]
  );

  if (!session) return null;

  const now = new Date();
  const expiresAt = new Date(session.expires_at);
  if (expiresAt <= now) {
    // Sesión expirada: invalidar y eliminar
    await db.run('DELETE FROM sessions WHERE id = ?', [sessionToken]);
    return null;
  }

  const row = await db.get<any>(
    'SELECT * FROM users WHERE id = ?',
    [session.user_id]
  );

  if (!row) {
    await db.run('DELETE FROM sessions WHERE id = ?', [sessionToken]);
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatar: row.avatar,
    coverImage: row.cover_image,
    handle: row.handle,
    bio: row.bio,
    coinsBalance: row.coins_balance,
    isAgeVerified: !!row.is_age_verified,
    spendingLimitDaily: row.spending_limit_daily,
    spendingLimitWeekly: row.spending_limit_weekly,
    spentToday: row.spent_today,
    spentThisWeek: row.spent_this_week,
    createdAt: row.created_at,
  };
}

export async function logoutUser(sessionToken: string | undefined): Promise<void> {
  if (!sessionToken) return;
  const db = await getDb();
  await db.run('DELETE FROM sessions WHERE id = ?', [sessionToken]);
}
