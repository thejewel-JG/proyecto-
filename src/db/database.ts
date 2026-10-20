import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';

export interface IDatabase {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  get<T = any>(sql: string, params?: any[]): Promise<T | null>;
  run(sql: string, params?: any[]): Promise<{ lastInsertId?: number | string; changes?: number }>;
  close(): Promise<void>;
}

class SqliteDatabase implements IDatabase {
  private db: Database.Database;

  constructor(filePath: string) {
    this.db = new Database(filePath);
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

export async function getDb(): Promise<IDatabase> {
  if (dbInstance) return dbInstance;
  throw new Error('La base de datos no está inicializada. Llame a initDatabase() primero.');
}

export async function initDatabase(customPath?: string): Promise<IDatabase> {
  const dbClient = process.env.DB_CLIENT || (process.env.DB_PASSWORD && process.env.DB_PASSWORD !== 'TU_PASSWORD_AQUI' && process.env.DB_HOST && process.env.DB_HOST !== '127.0.0.1' ? 'mysql' : 'sqlite');

  if (dbClient === 'mysql') {
    const host = process.env.DB_HOST || '127.0.0.1';
    const user = process.env.DB_USER || 'u141101294_kabaly';
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME || 'u141101294_kabaly';
    const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306;

    if (!password || password === 'TU_PASSWORD_AQUI') {
      const errMsg = '[Database Error] Se ha configurado el cliente MySQL pero falta la variable DB_PASSWORD en .env.';
      console.error(errMsg);
      throw new Error(errMsg);
    }

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
    } catch (err: any) {
      const errMsg = `[Database Error] No se pudo conectar a la base de datos MySQL (${host}:${port}): ${err.message}.`;
      console.error(errMsg);
      // REQUISITO: "Si falta conexión a la base de datos, muestra un error claro; no sustituyas silenciosamente los datos por una simulación."
      throw new Error(errMsg);
    }
  } else {
    // SQLite Relacional
    const sqlitePath = customPath || process.env.SQLITE_PATH || path.join(process.cwd(), 'kabaly.db');
    console.log(`[Database] Inicializando base de datos relacional SQLite en: ${sqlitePath}`);
    dbInstance = new SqliteDatabase(sqlitePath);
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
}
