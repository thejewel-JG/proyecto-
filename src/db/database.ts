import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

// @ts-ignore
const req = typeof require !== 'undefined' ? require : createRequire(path.resolve(process.cwd(), 'package.json'));

let sqliteConstructor: any = null;
function getSqliteConstructor() {
  if (!sqliteConstructor) {
    try {
      // Carga dinámica para no fallar en entornos Linux compartidos donde better-sqlite3 no compila
      sqliteConstructor = req('better-sqlite3');
    } catch (e: any) {
      console.warn('[Database SQLite Loader]:', e.message);
      throw new Error('[Database Error] better-sqlite3 no está instalado o compilado. En producción configure DB_CLIENT=mysql para usar MySQL.');
    }
  }
  return sqliteConstructor;
}

export interface IDatabase {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  get<T = any>(sql: string, params?: any[]): Promise<T | null>;
  run(sql: string, params?: any[]): Promise<{ lastInsertId?: number | string; changes?: number }>;
  close(): Promise<void>;
}

class SqliteDatabase implements IDatabase {
  private db: any;

  constructor(filePath: string) {
    const Sqlite = getSqliteConstructor();
    this.db = new Sqlite(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params);
    return (row as T) || null;
  }

  async run(sql: string, params: any[] = []): Promise<{ lastInsertId?: number | string; changes?: number }> {
    const stmt = this.db.prepare(sql);
    const info = stmt.run(...params);
    return { lastInsertId: Number(info.lastInsertRowid), changes: info.changes };
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

class MysqlDatabase implements IDatabase {
  private pool: mysql.Pool;

  constructor(pool: mysql.Pool) {
    this.pool = pool;
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    // Translate SQLite placeholders if any (? is standard in both)
    const [rows] = await this.pool.query(sql, params);
    return rows as T[];
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const [rows]: any = await this.pool.query(sql, params);
    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0] as T;
    }
    return null;
  }

  async run(sql: string, params: any[] = []): Promise<{ lastInsertId?: number | string; changes?: number }> {
    const [result]: any = await this.pool.query(sql, params);
    return {
      lastInsertId: result.insertId,
      changes: result.affectedRows,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

let dbInstance: IDatabase | null = null;
let lastDbError: string | null = null;

export function getDbError(): string | null {
  return lastDbError;
}

export async function getDb(): Promise<IDatabase> {
  if (dbInstance) return dbInstance;
  throw new Error(lastDbError || 'La base de datos no está inicializada. Verifique la conexión relacional.');
}

export async function initDatabase(customPath?: string): Promise<IDatabase> {
  const isProd = process.env.NODE_ENV === 'production';
  const hasMysqlConfig = !!(process.env.DB_PASSWORD && process.env.DB_PASSWORD !== 'TU_PASSWORD_AQUI');
  const dbClient = process.env.DB_CLIENT || (isProd || hasMysqlConfig ? 'mysql' : 'sqlite');

  if (dbClient === 'mysql') {
    const host = process.env.DB_HOST || '127.0.0.1';
    const user = process.env.DB_USER || 'u141101294_kabaly';
    const password = process.env.DB_PASSWORD || 'Wattpad_3317';
    const database = process.env.DB_NAME || 'u141101294_kabaly';
    const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306;

    try {
      console.log(`[Database] Conectando a MySQL (${database}@${host}:${port})...`);
      const pool = mysql.createPool({
        host,
        user,
        password,
        database,
        port,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 5000,
      });

      // Validar conexión real
      const conn = await pool.getConnection();
      conn.release();
      console.log(`[Database] Conectado exitosamente a MySQL (${database}@${host})`);
      dbInstance = new MysqlDatabase(pool);
      lastDbError = null;
    } catch (err: any) {
      const errMsg = `[Database Error] No se pudo conectar a la base de datos MySQL (${host}:${port}): ${err.message}.`;
      console.error(errMsg);
      lastDbError = errMsg;
      throw new Error(errMsg);
    }
  } else {
    // SQLite Relacional
    const sqlitePath = customPath || process.env.SQLITE_PATH || path.join(process.cwd(), 'kabaly.db');
    console.log(`[Database] Inicializando base de datos relacional SQLite en: ${sqlitePath}`);
    dbInstance = new SqliteDatabase(sqlitePath);
    lastDbError = null;
  }

  // Ejecutar migraciones reproducibles
  await runMigrations(dbInstance);

  return dbInstance;
}

export async function runMigrations(db: IDatabase): Promise<void> {
  console.log('[Database] Ejecutando migraciones de esquemas...');

  // 1. Tabla de control de migraciones
  await db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(64) PRIMARY KEY,
      applied_at DATETIME NOT NULL
    );
  `);

  const applied = await db.query<{ id: string }>('SELECT id FROM schema_migrations');
  const appliedSet = new Set(applied.map(m => m.id));

  // Migración 001: Esquema FASE 1 (Cuentas, Sesiones, Rate Limiting, Perfiles, Transacciones)
  if (!appliedSet.has('001_phase1_auth_schema')) {
    console.log('[Database] Aplicando migración: 001_phase1_auth_schema...');

    // Tabla de usuarios
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'cliente',
        avatar TEXT,
        cover_image TEXT,
        handle VARCHAR(64),
        bio TEXT,
        coins_balance INT NOT NULL DEFAULT 100,
        is_age_verified INT NOT NULL DEFAULT 0,
        spending_limit_daily REAL DEFAULT NULL,
        spending_limit_weekly REAL DEFAULT NULL,
        spent_today REAL NOT NULL DEFAULT 0,
        spent_this_week REAL NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      );
    `);

    // Tabla de sesiones seguras
    await db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL,
        user_agent TEXT,
        ip VARCHAR(64)
      );
    `);

    // Tabla de control de intentos de login (Fuerza bruta)
    await db.run(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        identifier VARCHAR(255) PRIMARY KEY,
        attempts INT NOT NULL DEFAULT 1,
        last_attempt DATETIME NOT NULL,
        locked_until DATETIME DEFAULT NULL
      );
    `);

    // Tabla de perfiles profesionales de tarotista
    await db.run(`
      CREATE TABLE IF NOT EXISTS tarotista_profiles (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL UNIQUE,
        professional_name VARCHAR(255) NOT NULL,
        avatar TEXT,
        banner TEXT,
        specialties TEXT NOT NULL,
        bio TEXT,
        experience_years INT NOT NULL DEFAULT 1,
        price_per_min_coins INT NOT NULL DEFAULT 15,
        price_per_min_eur REAL NOT NULL DEFAULT 1.50,
        languages TEXT NOT NULL,
        country VARCHAR(64) NOT NULL DEFAULT 'España',
        is_verified INT NOT NULL DEFAULT 0,
        kyc_status VARCHAR(32) NOT NULL DEFAULT 'pendiente',
        stripe_connect_status VARCHAR(32) NOT NULL DEFAULT 'pendiente',
        rating_average REAL NOT NULL DEFAULT 5.0,
        total_reviews INT NOT NULL DEFAULT 0,
        total_readings INT NOT NULL DEFAULT 0,
        followers_count INT NOT NULL DEFAULT 0,
        video_count INT NOT NULL DEFAULT 0,
        availability_status VARCHAR(32) NOT NULL DEFAULT 'offline',
        custom_commission_percentage INT NOT NULL DEFAULT 20,
        created_at DATETIME NOT NULL
      );
    `);

    // Tabla de publicaciones / vídeos del feed
    await db.run(`
      CREATE TABLE IF NOT EXISTS videos (
        id VARCHAR(64) PRIMARY KEY,
        tarotista_id VARCHAR(64) NOT NULL,
        tarotista_name VARCHAR(255) NOT NULL,
        tarotista_avatar TEXT,
        is_verified INT NOT NULL DEFAULT 0,
        title VARCHAR(255) NOT NULL,
        video_url TEXT NOT NULL,
        thumbnail_url TEXT,
        category VARCHAR(64) NOT NULL DEFAULT 'Tarot',
        likes INT NOT NULL DEFAULT 0,
        comments_count INT NOT NULL DEFAULT 0,
        shares_count INT NOT NULL DEFAULT 0,
        sound_title VARCHAR(255),
        is_premium INT NOT NULL DEFAULT 0,
        price_coins INT DEFAULT NULL,
        created_at DATETIME NOT NULL
      );
    `);

    // Tabla de transacciones / movimientos contables
    await db.run(`
      CREATE TABLE IF NOT EXISTS ledger (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        type VARCHAR(64) NOT NULL,
        amount_coins INT NOT NULL,
        amount_eur REAL NOT NULL,
        description TEXT NOT NULL,
        reference_id VARCHAR(64),
        timestamp DATETIME NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'completed'
      );
    `);

    // Tabla de consultas 1:1
    await db.run(`
      CREATE TABLE IF NOT EXISTS consultations (
        id VARCHAR(64) PRIMARY KEY,
        client_id VARCHAR(64) NOT NULL,
        client_name VARCHAR(255) NOT NULL,
        client_avatar TEXT,
        tarotista_id VARCHAR(64) NOT NULL,
        tarotista_name VARCHAR(255) NOT NULL,
        tarotista_avatar TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'solicitada',
        type VARCHAR(32) NOT NULL DEFAULT 'chat',
        duration_minutes INT NOT NULL DEFAULT 10,
        total_coins INT NOT NULL DEFAULT 150,
        tarotista_earnings_coins INT NOT NULL DEFAULT 120,
        scheduled_for DATETIME NOT NULL,
        created_at DATETIME NOT NULL
      );
    `);

    // Tabla de reseñas de consultas
    await db.run(`
      CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR(64) PRIMARY KEY,
        consultation_id VARCHAR(64) NOT NULL,
        tarotista_id VARCHAR(64) NOT NULL,
        client_id VARCHAR(64) NOT NULL,
        client_name VARCHAR(255) NOT NULL,
        client_avatar TEXT,
        rating INT NOT NULL DEFAULT 5,
        comment TEXT NOT NULL,
        is_verified_purchase INT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL
      );
    `);

    // Tabla de reportes de moderación
    await db.run(`
      CREATE TABLE IF NOT EXISTS reports (
        id VARCHAR(64) PRIMARY KEY,
        reporter_id VARCHAR(64) NOT NULL,
        reporter_name VARCHAR(255) NOT NULL,
        reported_user_id VARCHAR(64) NOT NULL,
        reported_user_name VARCHAR(255) NOT NULL,
        content_type VARCHAR(64) NOT NULL,
        content_id VARCHAR(64) NOT NULL,
        reason VARCHAR(64) NOT NULL,
        description TEXT,
        status VARCHAR(32) NOT NULL DEFAULT 'pendiente',
        created_at DATETIME NOT NULL
      );
    `);

    // Tabla de solicitudes de retiro
    await db.run(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id VARCHAR(64) PRIMARY KEY,
        tarotista_id VARCHAR(64) NOT NULL,
        tarotista_name VARCHAR(255) NOT NULL,
        amount_eur REAL NOT NULL,
        amount_coins INT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pendiente',
        requested_at DATETIME NOT NULL,
        vat_number VARCHAR(64) NOT NULL,
        bank_iban VARCHAR(64) NOT NULL
      );
    `);

    // Sembrar cuentas base con contraseñas seguras hasheadas (bcrypt) si no existen
    const existingAdmin = await db.get('SELECT id FROM users WHERE role = ?', ['admin']);
    if (!existingAdmin) {
      console.log('[Database] Creando cuenta de Administrador oficial con hash seguro...');
      const adminPasswordHash = await bcrypt.hash('AdminKabaly2026!', 10);
      const now = new Date().toISOString();

      await db.run(`
        INSERT INTO users (
          id, name, email, password_hash, role, avatar, coins_balance, is_age_verified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'usr_admin',
        'Administrador KABALY',
        'admin@kabaly.app',
        adminPasswordHash,
        'admin',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
        50000,
        1,
        now,
        now
      ]);

      // Sembrar tarotista inicial
      const tarotistaPass = await bcrypt.hash('LunaMistica2026!', 10);
      await db.run(`
        INSERT INTO users (
          id, name, email, password_hash, role, avatar, coins_balance, is_age_verified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'usr_tarotista_1',
        'Luna Mística',
        'lunamistica@kabaly.app',
        tarotistaPass,
        'tarotista',
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
        4850,
        1,
        now,
        now
      ]);

      await db.run(`
        INSERT INTO tarotista_profiles (
          id, user_id, professional_name, avatar, banner, specialties, bio, experience_years,
          price_per_min_coins, price_per_min_eur, languages, country, is_verified, kyc_status,
          stripe_connect_status, rating_average, total_reviews, total_readings, followers_count,
          video_count, availability_status, custom_commission_percentage, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'tar_1',
        'usr_tarotista_1',
        'Luna Mística',
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200',
        JSON.stringify(['Tarot Marsella', 'Rider-Waite', 'Amor y Pareja', 'Vidas Pasadas']),
        'Tarotista profesional con más de 12 años guiando caminos hacia la verdad del corazón y la luz.',
        12,
        20,
        2.00,
        JSON.stringify(['Español', 'Inglés']),
        'España',
        1,
        'aprobado',
        'conectado',
        4.9,
        142,
        630,
        2840,
        45,
        'online',
        20,
        now
      ]);

      // Sembrar publicaciones iniciales de demostración
      await db.run(`
        INSERT INTO videos (
          id, tarotista_id, tarotista_name, tarotista_avatar, is_verified, title,
          video_url, thumbnail_url, category, likes, comments_count, shares_count, sound_title,
          is_premium, price_coins, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'vid_1',
        'tar_1',
        'Luna Mística',
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
        1,
        'Tirada General: Mensaje Urgente de tus Guías para esta Luna Llena 🌕✨',
        'https://assets.mixkit.co/videos/preview/mixkit-mysterious-candle-burning-in-a-dark-room-41983-large.mp4',
        'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?auto=format&fit=crop&q=80&w=600',
        'Tarot',
        1420,
        89,
        245,
        'Frecuencia 528Hz - Sanación y Amor Incondicional',
        0,
        null,
        now
      ]);
    }

    // Registrar migración completada
    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ['001_phase1_auth_schema', new Date().toISOString()]);
    console.log('[Database] Migración 001_phase1_auth_schema completada.');
  }

  // Migración 002: Esquema FASE 3 (Publicaciones Reales, Formatos Media, Borrado Lógico, Idempotencia)
  if (!appliedSet.has('002_phase3_posts_feed')) {
    console.log('[Database] Aplicando migración: 002_phase3_posts_feed...');

    const safeAddColumn = async (table: string, colDef: string) => {
      try {
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      } catch (e: any) {
        // Columna ya existe
      }
    };

    await safeAddColumn('videos', 'media_type VARCHAR(16) NOT NULL DEFAULT "video"');
    await safeAddColumn('videos', 'description TEXT DEFAULT NULL');
    await safeAddColumn('videos', 'is_deleted INT NOT NULL DEFAULT 0');
    await safeAddColumn('videos', 'deleted_at DATETIME DEFAULT NULL');
    await safeAddColumn('videos', 'idempotency_key VARCHAR(128) DEFAULT NULL');

    // Eliminar publicaciones de demostración en funcionamiento normal
    const isTest = process.env.NODE_ENV === 'test' || process.env.TEST_RUN === 'true';
    if (!isTest) {
      await db.run(`DELETE FROM videos WHERE id = 'vid_1'`);
    }

    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ['002_phase3_posts_feed', new Date().toISOString()]);
    console.log('[Database] Migración 002_phase3_posts_feed completada.');
  }

  // Migración 003: Esquema FASE 4 (Likes persistentes, Comentarios con respuestas, Follows, Guardados, Stories de 24h)
  if (!appliedSet.has('003_phase4_social_stories')) {
    console.log('[Database] Aplicando migración: 003_phase4_social_stories...');

    // 1. Likes persistentes con restricción única por usuario y publicación
    await db.run(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id VARCHAR(64) PRIMARY KEY,
        video_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE(video_id, user_id)
      );
    `);

    // 2. Comentarios reales con soporte de 1 nivel de respuestas (parent_id)
    await db.run(`
      CREATE TABLE IF NOT EXISTS comments (
        id VARCHAR(64) PRIMARY KEY,
        video_id VARCHAR(64) NOT NULL,
        author_id VARCHAR(64) NOT NULL,
        author_name VARCHAR(255) NOT NULL,
        author_avatar TEXT,
        parent_id VARCHAR(64) DEFAULT NULL,
        content TEXT NOT NULL,
        is_deleted INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      );
    `);

    // 3. Relaciones de seguimiento persistentes (Follows)
    await db.run(`
      CREATE TABLE IF NOT EXISTS follows (
        id VARCHAR(64) PRIMARY KEY,
        follower_id VARCHAR(64) NOT NULL,
        following_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE(follower_id, following_id)
      );
    `);

    // 4. Publicaciones guardadas privadas (Saved Posts)
    await db.run(`
      CREATE TABLE IF NOT EXISTS saved_posts (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        video_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE(user_id, video_id)
      );
    `);

    // 5. Stories efímeras de 24 horas
    await db.run(`
      CREATE TABLE IF NOT EXISTS stories (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        user_avatar TEXT,
        media_url TEXT NOT NULL,
        media_type VARCHAR(16) NOT NULL DEFAULT 'image',
        caption TEXT DEFAULT NULL,
        created_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        is_deleted INT NOT NULL DEFAULT 0,
        deleted_at DATETIME DEFAULT NULL
      );
    `);

    // 6. Visualizaciones únicas de stories
    await db.run(`
      CREATE TABLE IF NOT EXISTS story_views (
        id VARCHAR(64) PRIMARY KEY,
        story_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        user_avatar TEXT,
        viewed_at DATETIME NOT NULL,
        UNIQUE(story_id, user_id)
      );
    `);

    // Índices de optimización
    try {
      await db.run('CREATE INDEX IF NOT EXISTS idx_post_likes_video ON post_likes(video_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_saved_posts_user ON saved_posts(user_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id)');
    } catch (e: any) {
      // Ignorar si el motor ya los indexa
    }

    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ['003_phase4_social_stories', new Date().toISOString()]);
    console.log('[Database] Migración 003_phase4_social_stories completada.');
  }

  // Migración 004: Esquema FASE 5 (Mensajería Privada, Adjuntos Seguros, Bloqueos y Reportes)
  if (!appliedSet.has('004_phase5_private_messaging')) {
    console.log('[Database] Aplicando migración: 004_phase5_private_messaging...');

    // 1. Conversaciones 1 a 1 (Única por pareja de usuarios con orden canónico)
    await db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(64) PRIMARY KEY,
        user_a_id VARCHAR(64) NOT NULL,
        user_b_id VARCHAR(64) NOT NULL,
        last_message_id VARCHAR(64) DEFAULT NULL,
        last_message_text TEXT DEFAULT NULL,
        last_message_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        UNIQUE(user_a_id, user_b_id)
      );
    `);

    // 2. Mensajes privados persistentes
    await db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(64) PRIMARY KEY,
        conversation_id VARCHAR(64) NOT NULL,
        sender_id VARCHAR(64) NOT NULL,
        recipient_id VARCHAR(64) NOT NULL,
        content TEXT NOT NULL,
        client_message_id VARCHAR(64) DEFAULT NULL,
        attachment_id VARCHAR(64) DEFAULT NULL,
        attachment_url TEXT DEFAULT NULL,
        attachment_type VARCHAR(16) DEFAULT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'sent',
        read_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE(conversation_id, client_message_id)
      );
    `);

    // 3. Adjuntos privados de chat
    await db.run(`
      CREATE TABLE IF NOT EXISTS chat_attachments (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        conversation_id VARCHAR(64) DEFAULT NULL,
        message_id VARCHAR(64) DEFAULT NULL,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(64) NOT NULL,
        size INT NOT NULL,
        is_claimed INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL
      );
    `);

    // 4. Bloqueos bidireccionales entre usuarios
    await db.run(`
      CREATE TABLE IF NOT EXISTS user_blocks (
        id VARCHAR(64) PRIMARY KEY,
        blocker_id VARCHAR(64) NOT NULL,
        blocked_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE(blocker_id, blocked_id)
      );
    `);

    // 5. Reportes privados de mensajes
    await db.run(`
      CREATE TABLE IF NOT EXISTS message_reports (
        id VARCHAR(64) PRIMARY KEY,
        reporter_id VARCHAR(64) NOT NULL,
        message_id VARCHAR(64) NOT NULL,
        conversation_id VARCHAR(64) NOT NULL,
        reported_user_id VARCHAR(64) NOT NULL,
        message_content TEXT NOT NULL,
        reason VARCHAR(64) NOT NULL,
        details TEXT DEFAULT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL
      );
    `);

    // Índices de optimización para mensajería
    try {
      await db.run('CREATE INDEX IF NOT EXISTS idx_conversations_user_a ON conversations(user_a_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_conversations_user_b ON conversations(user_b_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_conversations_last_msg_at ON conversations(last_message_at)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_messages_recipient_status ON messages(recipient_id, status)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_chat_attach_user ON chat_attachments(user_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_chat_attach_conv ON chat_attachments(conversation_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_message_reports_rep ON message_reports(reporter_id)');
    } catch (e: any) {
      // Ignorar si el motor ya los indexa
    }

    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ['004_phase5_private_messaging', new Date().toISOString()]);
    console.log('[Database] Migración 004_phase5_private_messaging completada.');
  }

  // Migración 005: Esquema FASE 6 (Monedero Persistente, Paquetes de Monedas, Pedidos y Eventos Stripe)
  if (!appliedSet.has('005_phase6_stripe_wallet')) {
    console.log('[Database] Aplicando migración: 005_phase6_stripe_wallet...');

    const safeAddColumn = async (table: string, colDef: string) => {
      try {
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      } catch (e: any) {
        // Columna ya existe
      }
    };

    // 1. Columnas contables exactas en ledger y separación de saldos en users
    await safeAddColumn('ledger', 'amount_cents INT NOT NULL DEFAULT 0');
    await safeAddColumn('ledger', 'balance_after INT NOT NULL DEFAULT 0');
    await safeAddColumn('users', 'spending_limit_daily_cents INT DEFAULT NULL');
    await safeAddColumn('users', 'spending_limit_weekly_cents INT DEFAULT NULL');
    await safeAddColumn('users', 'financial_restriction INT NOT NULL DEFAULT 0');
    await safeAddColumn('users', 'purchased_coins_balance INT NOT NULL DEFAULT 0');
    await safeAddColumn('users', 'earnings_coins_balance INT NOT NULL DEFAULT 0');

    // 2. Tabla canónica de paquetes de monedas del servidor
    await db.run(`
      CREATE TABLE IF NOT EXISTS coin_packages (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        coins INT NOT NULL,
        price_cents INT NOT NULL,
        currency VARCHAR(8) NOT NULL DEFAULT 'eur',
        badge VARCHAR(64),
        icon VARCHAR(64) NOT NULL,
        is_active INT NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL
      );
    `);

    // Sembrar paquetes canónicos oficiales
    const now = new Date().toISOString();
    const packagesToSeed = [
      { id: 'pack_iniciacion', name: 'Pack Iniciación', coins: 100, priceCents: 999, badge: 'Iniciación', icon: 'toll', sort: 1 },
      { id: 'pack_astral', name: 'Pack Astral', coins: 300, priceCents: 2499, badge: 'Popular', icon: 'auto_awesome', sort: 2 },
      { id: 'pack_mistico', name: 'Pack Místico', coins: 600, priceCents: 4499, badge: 'Ahorro 25%', icon: 'diamond', sort: 3 },
      { id: 'pack_cosmico', name: 'Pack Cósmico', coins: 1500, priceCents: 9999, badge: 'VIP', icon: 'crown', sort: 4 },
    ];

    for (const p of packagesToSeed) {
      await db.run(`
        INSERT OR IGNORE INTO coin_packages (id, name, coins, price_cents, currency, badge, icon, is_active, sort_order, created_at)
        VALUES (?, ?, ?, ?, 'eur', ?, ?, 1, ?, ?)
      `, [p.id, p.name, p.coins, p.priceCents, p.badge, p.icon, p.sort, now]);
    }

    // 3. Tabla de pedidos de compra de monedas (Stripe Checkout)
    await db.run(`
      CREATE TABLE IF NOT EXISTS coin_orders (
        id VARCHAR(64) PRIMARY KEY,
        order_number VARCHAR(64) NOT NULL UNIQUE,
        user_id VARCHAR(64) NOT NULL,
        package_id VARCHAR(64) NOT NULL,
        package_name VARCHAR(255) NOT NULL,
        coins INT NOT NULL,
        amount_cents INT NOT NULL,
        currency VARCHAR(8) NOT NULL DEFAULT 'eur',
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        stripe_session_id VARCHAR(255) UNIQUE,
        stripe_payment_intent_id VARCHAR(255),
        idempotency_key VARCHAR(128) UNIQUE,
        created_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        paid_at DATETIME,
        failed_at DATETIME,
        failure_reason TEXT,
        metadata TEXT
      );
    `);

    // 4. Tabla de eventos procesados de Stripe para garantizar idempotencia total en webhooks
    await db.run(`
      CREATE TABLE IF NOT EXISTS processed_stripe_events (
        id VARCHAR(128) PRIMARY KEY,
        event_type VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL,
        processed_at DATETIME NOT NULL,
        error_message TEXT,
        payload TEXT
      );
    `);

    // 5. Tabla de registro de reembolsos y disputas
    await db.run(`
      CREATE TABLE IF NOT EXISTS refund_disputes (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        stripe_refund_id VARCHAR(128) UNIQUE,
        stripe_dispute_id VARCHAR(128),
        amount_cents INT NOT NULL,
        coins_to_deduct INT NOT NULL,
        coins_deducted INT NOT NULL,
        unrecovered_coins INT NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'processed',
        notes TEXT,
        created_at DATETIME NOT NULL
      );
    `);

    // Índices de optimización para transacciones financieras y auditoría
    try {
      await db.run('CREATE INDEX IF NOT EXISTS idx_coin_orders_user ON coin_orders(user_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_coin_orders_status ON coin_orders(status)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_coin_orders_session ON coin_orders(stripe_session_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_coin_orders_expires ON coin_orders(expires_at)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger(type)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger(reference_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_refund_disputes_order ON refund_disputes(order_id)');
    } catch (e: any) {
      // Ignorar si ya existen
    }

    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ['005_phase6_stripe_wallet', new Date().toISOString()]);
    console.log('[Database] Migración 005_phase6_stripe_wallet completada.');
  }

  // Migración 006: Esquema FASE 8 (Consultas Privadas 1:1, Reserva/Liquidación, Sala y Disputas)
  if (!appliedSet.has('006_phase8_consultations')) {
    console.log('[Database] Aplicando migración: 006_phase8_consultations...');

    const safeAddColumn = async (table: string, colDef: string) => {
      try {
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      } catch (e: any) {
        // Columna ya existe
      }
    };

    // 1. Ampliación de columnas en consultations
    await safeAddColumn('consultations', 'tarotista_user_id VARCHAR(64)');
    await safeAddColumn('consultations', 'rate_per_minute_coins INT NOT NULL DEFAULT 0');
    await safeAddColumn('consultations', 'platform_commission_coins INT NOT NULL DEFAULT 0');
    await safeAddColumn('consultations', 'commission_percentage INT NOT NULL DEFAULT 20');
    await safeAddColumn('consultations', 'started_at DATETIME');
    await safeAddColumn('consultations', 'scheduled_end_at DATETIME');
    await safeAddColumn('consultations', 'accepted_at DATETIME');
    await safeAddColumn('consultations', 'ended_at DATETIME');
    await safeAddColumn('consultations', 'cancelled_at DATETIME');
    await safeAddColumn('consultations', 'cancelled_by VARCHAR(64)');
    await safeAddColumn('consultations', 'cancellation_reason TEXT');
    await safeAddColumn('consultations', 'is_settled INT NOT NULL DEFAULT 0');
    await safeAddColumn('consultations', 'is_refunded INT NOT NULL DEFAULT 0');
    await safeAddColumn('consultations', 'room_token VARCHAR(128)');
    await safeAddColumn('consultations', 'idempotency_key VARCHAR(128)');
    await safeAddColumn('consultations', 'notes TEXT');
    await safeAddColumn('consultations', 'expires_at DATETIME');

    // 2. Columna de saldo reservado en users
    await safeAddColumn('users', 'coins_reserved INT NOT NULL DEFAULT 0');

    // 3. Tabla de mensajes de sala privada
    await db.run(`
      CREATE TABLE IF NOT EXISTS consultation_messages (
        id VARCHAR(64) PRIMARY KEY,
        consultation_id VARCHAR(64) NOT NULL,
        sender_id VARCHAR(64) NOT NULL,
        sender_name VARCHAR(255) NOT NULL,
        sender_avatar TEXT,
        content TEXT NOT NULL,
        card_data TEXT,
        created_at DATETIME NOT NULL
      );
    `);

    // 4. Tabla de disputas de consultas
    await db.run(`
      CREATE TABLE IF NOT EXISTS consultation_disputes (
        id VARCHAR(64) PRIMARY KEY,
        consultation_id VARCHAR(64) NOT NULL,
        client_id VARCHAR(64) NOT NULL,
        tarotista_id VARCHAR(64) NOT NULL,
        raised_by_id VARCHAR(64) NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        refund_amount_coins INT NOT NULL DEFAULT 0,
        admin_notes TEXT,
        resolved_by VARCHAR(64),
        resolved_at DATETIME,
        created_at DATETIME NOT NULL
      );
    `);

    // 5. Tabla de directos / livestreams para verificar aislamiento y bloqueo de emisión pública
    await db.run(`
      CREATE TABLE IF NOT EXISTS live_streams (
        id VARCHAR(64) PRIMARY KEY,
        tarotista_id VARCHAR(64) NOT NULL,
        tarotista_name VARCHAR(255) NOT NULL,
        tarotista_avatar TEXT,
        is_verified INT NOT NULL DEFAULT 1,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(64) NOT NULL DEFAULT 'Tarot',
        viewer_count INT NOT NULL DEFAULT 0,
        is_live INT NOT NULL DEFAULT 1,
        started_at DATETIME NOT NULL,
        ended_at DATETIME
      );
    `);

    // Índices para búsquedas de sala, participantes y estado
    try {
      await db.run('CREATE INDEX IF NOT EXISTS idx_consultations_client ON consultations(client_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_consultations_tarotista ON consultations(tarotista_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_consultations_tarotista_user ON consultations(tarotista_user_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_consultations_idempotency ON consultations(idempotency_key)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_consultation_msgs_cons ON consultation_messages(consultation_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_consultation_disputes_cons ON consultation_disputes(consultation_id)');
      await db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_consultation_unique ON reviews(consultation_id)');
    } catch (e: any) {
      // Ignorar si ya existen
    }

    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ['006_phase8_consultations', new Date().toISOString()]);
    console.log('[Database] Migración 006_phase8_consultations completada.');
  }

  // Migración 007: Esquema FASE 9 (Catálogo de Regalos, Transacciones en Directos, Desbloqueo de Posts Exclusivos)
  if (!appliedSet.has('007_phase9_gifts_and_unlocks')) {
    console.log('[Database] Aplicando migración: 007_phase9_gifts_and_unlocks...');

    const safeAddColumn = async (table: string, colDef: string) => {
      try {
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      } catch (e: any) {
        // Columna ya existe
      }
    };

    // 1. Columnas adicionales en videos para exclusividad y retirada controlada
    await safeAddColumn('videos', 'is_exclusive INT NOT NULL DEFAULT 0');
    await safeAddColumn('videos', 'is_withdrawn INT NOT NULL DEFAULT 0');
    await safeAddColumn('videos', 'withdrawn_at DATETIME DEFAULT NULL');
    await safeAddColumn('videos', 'withdrawal_reason TEXT DEFAULT NULL');

    // 2. Catálogo oficial de regalos definido en el servidor
    await db.run(`
      CREATE TABLE IF NOT EXISTS stream_gifts (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(64) NOT NULL,
        cost_coins INT NOT NULL,
        description TEXT,
        is_active INT NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL
      );
    `);

    // Sembrar regalos oficiales
    const now = new Date().toISOString();
    const giftsToSeed = [
      { id: 'gift_vela', name: 'Vela Mística', icon: 'local_fire_department', costCoins: 10, description: 'Ilumina la lectura con energía sagrada', sortOrder: 1 },
      { id: 'gift_cristal', name: 'Cuarzo Rosa', icon: 'diamond', costCoins: 50, description: 'Atrae amor puro y armonía', sortOrder: 2 },
      { id: 'gift_bola', name: 'Bola de Cristal', icon: 'blur_on', costCoins: 150, description: 'Abre la visión del futuro celestial', sortOrder: 3 },
      { id: 'gift_corona', name: 'Corona Astral', icon: 'auto_awesome', costCoins: 500, description: 'Máximo tributo de agradecimiento', sortOrder: 4 },
    ];

    for (const g of giftsToSeed) {
      await db.run(`
        INSERT OR IGNORE INTO stream_gifts (id, name, icon, cost_coins, description, is_active, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `, [g.id, g.name, g.icon, g.costCoins, g.description, g.sortOrder, now]);
    }

    // 3. Tabla de transacciones de regalos durante emisiones en directo
    await db.run(`
      CREATE TABLE IF NOT EXISTS stream_gift_transactions (
        id VARCHAR(64) PRIMARY KEY,
        stream_id VARCHAR(64) NOT NULL,
        sender_id VARCHAR(64) NOT NULL,
        tarotista_id VARCHAR(64) NOT NULL,
        tarotista_user_id VARCHAR(64) NOT NULL,
        gift_id VARCHAR(64) NOT NULL,
        gift_name VARCHAR(255) NOT NULL,
        gift_icon VARCHAR(64) NOT NULL,
        coins_amount INT NOT NULL,
        platform_fee_coins INT NOT NULL,
        tarotista_earnings_coins INT NOT NULL,
        commission_percentage INT NOT NULL DEFAULT 20,
        idempotency_key VARCHAR(128),
        created_at DATETIME NOT NULL
      );
    `);

    // 4. Tabla de eventos recuperables de regalos en directos (para animaciones y logs)
    await db.run(`
      CREATE TABLE IF NOT EXISTS stream_gift_events (
        id VARCHAR(64) PRIMARY KEY,
        stream_id VARCHAR(64) NOT NULL,
        transaction_id VARCHAR(64) NOT NULL UNIQUE,
        sender_id VARCHAR(64) NOT NULL,
        sender_name VARCHAR(255) NOT NULL,
        sender_avatar TEXT,
        gift_id VARCHAR(64) NOT NULL,
        gift_name VARCHAR(255) NOT NULL,
        gift_icon VARCHAR(64) NOT NULL,
        coins INT NOT NULL,
        created_at DATETIME NOT NULL
      );
    `);

    // 5. Tabla de desbloqueos de publicaciones exclusivas (Compras de contenido)
    await db.run(`
      CREATE TABLE IF NOT EXISTS post_unlocks (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        post_id VARCHAR(64) NOT NULL,
        author_id VARCHAR(64) NOT NULL,
        coins_paid INT NOT NULL,
        platform_fee_coins INT NOT NULL,
        tarotista_earnings_coins INT NOT NULL,
        commission_percentage INT NOT NULL DEFAULT 20,
        idempotency_key VARCHAR(128),
        unlocked_at DATETIME NOT NULL,
        is_refunded INT NOT NULL DEFAULT 0,
        refunded_at DATETIME,
        refund_reason TEXT,
        UNIQUE(user_id, post_id)
      );
    `);

    // 6. Sembrar directos persistentes si la tabla live_streams está vacía
    const existingStreams = await db.get<any>('SELECT COUNT(*) as count FROM live_streams');
    if (!existingStreams || existingStreams.count === 0) {
      await db.run(`
        INSERT OR IGNORE INTO live_streams (id, tarotista_id, tarotista_name, tarotista_avatar, is_verified, title, category, viewer_count, is_live, started_at)
        VALUES 
          ('live_1', 'usr_tarotista_1', 'Luna Mística', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200', 1, 'Lectura Abierta de Tarot y Mensajes del Universo ✨ | En Vivo', 'Tarot', 1240, 1, ?),
          ('live_2', 'usr_tarotista_2', 'Astro Maestro', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200', 1, 'Análisis Astrológico Semanal & Consultas Rápidas 🪐', 'Astrología', 890, 1, ?)
      `, [now, now]);
    }

    // 7. Índices de rendimiento e integridad contable
    try {
      await db.run('CREATE INDEX IF NOT EXISTS idx_stream_gifts_active ON stream_gifts(is_active)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_gift_tx_stream ON stream_gift_transactions(stream_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_gift_tx_sender ON stream_gift_transactions(sender_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_gift_tx_tarotista ON stream_gift_transactions(tarotista_user_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_gift_events_stream ON stream_gift_events(stream_id, created_at)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_post_unlocks_user ON post_unlocks(user_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_post_unlocks_post ON post_unlocks(post_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_post_unlocks_author ON post_unlocks(author_id)');
    } catch (e: any) {
      // Ignorar si ya existen
    }

    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ['007_phase9_gifts_and_unlocks', new Date().toISOString()]);
    console.log('[Database] Migración 007_phase9_gifts_and_unlocks completada.');
  }

  // Migración 008: Red Social Esotérica Completa (Tríada Astral, Auras Destacadas, Notificaciones, Posts Fijados, Likes en Comentarios)
  if (!appliedSet.has('008_phase10_social_network_complete')) {
    console.log('[Database] Aplicando migración: 008_phase10_social_network_complete...');

    const safeAddColumn = async (table: string, colDef: string) => {
      try {
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      } catch (e: any) {
        // Columna ya existe
      }
    };

    // 1. Campos de identidad esotérica y privacidad en users
    await safeAddColumn('users', 'sun_sign VARCHAR(32) DEFAULT NULL');
    await safeAddColumn('users', 'moon_sign VARCHAR(32) DEFAULT NULL');
    await safeAddColumn('users', 'rising_sign VARCHAR(32) DEFAULT NULL');
    await safeAddColumn('users', 'ruling_arcana VARCHAR(64) DEFAULT NULL');
    await safeAddColumn('users', 'spiritual_gift VARCHAR(64) DEFAULT NULL');
    await safeAddColumn('users', 'is_private INT NOT NULL DEFAULT 0');

    // 2. Campos de fijado y carrusel en videos
    await safeAddColumn('videos', 'is_pinned INT NOT NULL DEFAULT 0');
    await safeAddColumn('videos', 'media_urls TEXT DEFAULT NULL');

    // 3. Campos de resonancia y fijado en comments
    await safeAddColumn('comments', 'likes_count INT NOT NULL DEFAULT 0');
    await safeAddColumn('comments', 'is_pinned INT NOT NULL DEFAULT 0');

    // 4. Tabla de notificaciones («Ecos del Cosmos»)
    await db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        actor_id VARCHAR(64) NOT NULL,
        actor_name VARCHAR(255) NOT NULL,
        actor_avatar TEXT,
        type VARCHAR(32) NOT NULL,
        reference_id VARCHAR(64),
        message TEXT NOT NULL,
        is_read INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL
      );
    `);

    // 5. Tabla de Auras Destacadas en el perfil (Stories fijadas permanentemente)
    await db.run(`
      CREATE TABLE IF NOT EXISTS profile_highlights (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        title VARCHAR(64) NOT NULL,
        cover_url TEXT NOT NULL,
        media_url TEXT NOT NULL,
        media_type VARCHAR(16) NOT NULL DEFAULT 'image',
        created_at DATETIME NOT NULL
      );
    `);

    // 6. Tabla de resonancias en comentarios
    await db.run(`
      CREATE TABLE IF NOT EXISTS comment_likes (
        id VARCHAR(64) PRIMARY KEY,
        comment_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE(comment_id, user_id)
      );
    `);

    try {
      await db.run('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_highlights_user ON profile_highlights(user_id)');
      await db.run('CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id)');
    } catch (e: any) {
      // Ignorar si ya existen
    }

    // Sembrar datos astrológicos por defecto para los perfiles semilla si existen
    try {
      await db.run(`
        UPDATE users SET sun_sign = 'Escorpio', moon_sign = 'Piscis', rising_sign = 'Acuario', ruling_arcana = 'XVIII • La Luna', spiritual_gift = 'Videncia Lunar'
        WHERE id = 'usr_tarotista_1' AND sun_sign IS NULL
      `);
      await db.run(`
        UPDATE users SET sun_sign = 'Leo', moon_sign = 'Sagitario', rising_sign = 'Aries', ruling_arcana = 'XIX • El Sol', spiritual_gift = 'Astrología Kármica'
        WHERE id = 'usr_tarotista_2' AND sun_sign IS NULL
      `);
    } catch (e: any) {
      // Ignorar
    }

    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ['008_phase10_social_network_complete', new Date().toISOString()]);
    console.log('[Database] Migración 008_phase10_social_network_complete completada.');
  }
}


