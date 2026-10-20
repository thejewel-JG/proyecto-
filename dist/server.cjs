var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  createServerApp: () => createServerApp,
  startServer: () => startServer
});
module.exports = __toCommonJS(server_exports);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_express = __toESM(require("express"), 1);
var import_cookie_parser = __toESM(require("cookie-parser"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");

// src/db/database.ts
var import_path = __toESM(require("path"), 1);
var import_module = require("module");
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_promise = __toESM(require("mysql2/promise"), 1);
var import_meta = {};
var req = (0, import_module.createRequire)(import_meta.url);
var sqliteConstructor = null;
function getSqliteConstructor() {
  if (!sqliteConstructor) {
    try {
      sqliteConstructor = req("better-sqlite3");
    } catch (e) {
      console.warn("[Database SQLite Loader]:", e.message);
      throw new Error("[Database Error] better-sqlite3 no est\xE1 instalado o compilado. En producci\xF3n configure DB_CLIENT=mysql para usar MySQL.");
    }
  }
  return sqliteConstructor;
}
var SqliteDatabase = class {
  constructor(filePath) {
    const Sqlite = getSqliteConstructor();
    this.db = new Sqlite(filePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }
  async query(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }
  async get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params);
    return row || null;
  }
  async run(sql, params = []) {
    const stmt = this.db.prepare(sql);
    const info = stmt.run(...params);
    return { lastInsertId: Number(info.lastInsertRowid), changes: info.changes };
  }
  async close() {
    this.db.close();
  }
};
var MysqlDatabase = class {
  constructor(pool) {
    this.pool = pool;
  }
  async query(sql, params = []) {
    const [rows] = await this.pool.query(sql, params);
    return rows;
  }
  async get(sql, params = []) {
    const [rows] = await this.pool.query(sql, params);
    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0];
    }
    return null;
  }
  async run(sql, params = []) {
    const [result] = await this.pool.query(sql, params);
    return {
      lastInsertId: result.insertId,
      changes: result.affectedRows
    };
  }
  async close() {
    await this.pool.end();
  }
};
var dbInstance = null;
var lastDbError = null;
function getDbError() {
  return lastDbError;
}
async function getDb() {
  if (dbInstance) return dbInstance;
  throw new Error(lastDbError || "La base de datos no est\xE1 inicializada. Verifique la conexi\xF3n relacional.");
}
async function initDatabase(customPath) {
  const isProd = process.env.NODE_ENV === "production";
  const hasMysqlConfig = !!(process.env.DB_PASSWORD && process.env.DB_PASSWORD !== "TU_PASSWORD_AQUI");
  const dbClient = process.env.DB_CLIENT || (isProd || hasMysqlConfig ? "mysql" : "sqlite");
  if (dbClient === "mysql") {
    const host = process.env.DB_HOST || "127.0.0.1";
    const user = process.env.DB_USER || "u141101294_kabaly";
    const password = process.env.DB_PASSWORD || "Wattpad_3317";
    const database = process.env.DB_NAME || "u141101294_kabaly";
    const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306;
    try {
      console.log(`[Database] Conectando a MySQL (${database}@${host}:${port})...`);
      const pool = import_promise.default.createPool({
        host,
        user,
        password,
        database,
        port,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 5e3
      });
      const conn = await pool.getConnection();
      conn.release();
      console.log(`[Database] Conectado exitosamente a MySQL (${database}@${host})`);
      dbInstance = new MysqlDatabase(pool);
      lastDbError = null;
    } catch (err) {
      const errMsg = `[Database Error] No se pudo conectar a la base de datos MySQL (${host}:${port}): ${err.message}.`;
      console.error(errMsg);
      lastDbError = errMsg;
      throw new Error(errMsg);
    }
  } else {
    const sqlitePath = customPath || process.env.SQLITE_PATH || import_path.default.join(process.cwd(), "kabaly.db");
    console.log(`[Database] Inicializando base de datos relacional SQLite en: ${sqlitePath}`);
    dbInstance = new SqliteDatabase(sqlitePath);
    lastDbError = null;
  }
  await runMigrations(dbInstance);
  return dbInstance;
}
async function runMigrations(db) {
  console.log("[Database] Ejecutando migraciones de esquemas...");
  await db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(64) PRIMARY KEY,
      applied_at DATETIME NOT NULL
    );
  `);
  const applied = await db.query("SELECT id FROM schema_migrations");
  const appliedSet = new Set(applied.map((m) => m.id));
  if (!appliedSet.has("001_phase1_auth_schema")) {
    console.log("[Database] Aplicando migraci\xF3n: 001_phase1_auth_schema...");
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
    await db.run(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        identifier VARCHAR(255) PRIMARY KEY,
        attempts INT NOT NULL DEFAULT 1,
        last_attempt DATETIME NOT NULL,
        locked_until DATETIME DEFAULT NULL
      );
    `);
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
        country VARCHAR(64) NOT NULL DEFAULT 'Espa\xF1a',
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
    const existingAdmin = await db.get("SELECT id FROM users WHERE role = ?", ["admin"]);
    if (!existingAdmin) {
      console.log("[Database] Creando cuenta de Administrador oficial con hash seguro...");
      const adminPasswordHash = await import_bcryptjs.default.hash("AdminKabaly2026!", 10);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await db.run(`
        INSERT INTO users (
          id, name, email, password_hash, role, avatar, coins_balance, is_age_verified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        "usr_admin",
        "Administrador KABALY",
        "admin@kabaly.app",
        adminPasswordHash,
        "admin",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200",
        5e4,
        1,
        now,
        now
      ]);
      const tarotistaPass = await import_bcryptjs.default.hash("LunaMistica2026!", 10);
      await db.run(`
        INSERT INTO users (
          id, name, email, password_hash, role, avatar, coins_balance, is_age_verified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        "usr_tarotista_1",
        "Luna M\xEDstica",
        "lunamistica@kabaly.app",
        tarotistaPass,
        "tarotista",
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200",
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
        "tar_1",
        "usr_tarotista_1",
        "Luna M\xEDstica",
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200",
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200",
        JSON.stringify(["Tarot Marsella", "Rider-Waite", "Amor y Pareja", "Vidas Pasadas"]),
        "Tarotista profesional con m\xE1s de 12 a\xF1os guiando caminos hacia la verdad del coraz\xF3n y la luz.",
        12,
        20,
        2,
        JSON.stringify(["Espa\xF1ol", "Ingl\xE9s"]),
        "Espa\xF1a",
        1,
        "aprobado",
        "conectado",
        4.9,
        142,
        630,
        2840,
        45,
        "online",
        20,
        now
      ]);
      await db.run(`
        INSERT INTO videos (
          id, tarotista_id, tarotista_name, tarotista_avatar, is_verified, title,
          video_url, thumbnail_url, category, likes, comments_count, shares_count, sound_title,
          is_premium, price_coins, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        "vid_1",
        "tar_1",
        "Luna M\xEDstica",
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200",
        1,
        "Tirada General: Mensaje Urgente de tus Gu\xEDas para esta Luna Llena \u{1F315}\u2728",
        "https://assets.mixkit.co/videos/preview/mixkit-mysterious-candle-burning-in-a-dark-room-41983-large.mp4",
        "https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?auto=format&fit=crop&q=80&w=600",
        "Tarot",
        1420,
        89,
        245,
        "Frecuencia 528Hz - Sanaci\xF3n y Amor Incondicional",
        0,
        null,
        now
      ]);
    }
    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ["001_phase1_auth_schema", (/* @__PURE__ */ new Date()).toISOString()]);
    console.log("[Database] Migraci\xF3n 001_phase1_auth_schema completada.");
  }
}

// src/auth/authService.ts
var import_crypto = __toESM(require("crypto"), 1);
var import_bcryptjs2 = __toESM(require("bcryptjs"), 1);
var SESSION_COOKIE_NAME = "kabaly_session";
var SESSION_DURATION_DAYS = 7;
async function registerUser(params) {
  const db = await getDb();
  const name = (params.name || "").trim();
  const email = (params.email || "").trim().toLowerCase();
  const password = params.password || "";
  if (!name || name.length < 2) {
    throw { status: 400, message: "El nombre debe contener al menos 2 caracteres." };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    throw { status: 400, message: "Debe proporcionar un correo electr\xF3nico v\xE1lido." };
  }
  if (!password || password.length < 8) {
    throw { status: 400, message: "La contrase\xF1a debe tener al menos 8 caracteres." };
  }
  if (!params.isAgeVerified) {
    throw { status: 400, message: "Debe confirmar que es mayor de 18 a\xF1os para utilizar KABALY." };
  }
  let safeRole = "cliente";
  if (params.role === "tarotista") {
    safeRole = "tarotista";
  }
  const existing = await db.get("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) {
    throw { status: 400, message: "El correo electr\xF3nico ya se encuentra registrado." };
  }
  const passwordHash = await import_bcryptjs2.default.hash(password, 10);
  const userId = `usr_${Date.now()}_${import_crypto.default.randomBytes(4).toString("hex")}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const defaultAvatar = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200";
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
    100,
    // Saldo de bienvenida de 100 monedas
    1,
    now,
    now
  ]);
  if (safeRole === "tarotista") {
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
      JSON.stringify(["Tarot", "Astrolog\xEDa"]),
      "Gu\xEDa espiritual profesional verificado en KABALY.",
      1,
      15,
      1.5,
      JSON.stringify(["Espa\xF1ol"]),
      "Espa\xF1a",
      0,
      "pendiente",
      "pendiente",
      5,
      0,
      0,
      0,
      0,
      "offline",
      20,
      now
    ]);
  }
  const sessionToken = await createSession(userId, params.userAgent, params.ip);
  const user = {
    id: userId,
    name,
    email,
    role: safeRole,
    avatar: defaultAvatar,
    coinsBalance: 100,
    isAgeVerified: true,
    spentToday: 0,
    spentThisWeek: 0,
    createdAt: now
  };
  return { user, sessionToken };
}
async function loginUser(params) {
  const db = await getDb();
  const email = (params.email || "").trim().toLowerCase();
  const password = params.password || "";
  const ip = params.ip || "127.0.0.1";
  const rateLimitIdentifier = `${ip}_${email}`;
  const now = /* @__PURE__ */ new Date();
  const rateRecord = await db.get(
    "SELECT attempts, last_attempt, locked_until FROM login_attempts WHERE identifier = ?",
    [rateLimitIdentifier]
  );
  if (rateRecord && rateRecord.locked_until) {
    const lockedUntilDate = new Date(rateRecord.locked_until);
    if (lockedUntilDate > now) {
      const minutesRemaining = Math.ceil((lockedUntilDate.getTime() - now.getTime()) / 6e4);
      throw {
        status: 429,
        message: `Demasiados intentos fallidos. Por seguridad, intente de nuevo en ${minutesRemaining} minuto(s).`
      };
    }
  }
  const row = await db.get(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );
  let isPasswordValid = false;
  if (row) {
    isPasswordValid = await import_bcryptjs2.default.compare(password, row.password_hash);
  }
  if (!row || !isPasswordValid) {
    const nextAttempts = rateRecord ? rateRecord.attempts + 1 : 1;
    let lockedUntil = null;
    if (nextAttempts >= 5) {
      lockedUntil = new Date(now.getTime() + 15 * 60 * 1e3).toISOString();
    }
    await db.run(`
      INSERT INTO login_attempts (identifier, attempts, last_attempt, locked_until)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(identifier) DO UPDATE SET
        attempts = ?,
        last_attempt = ?,
        locked_until = ?
    `, [
      rateLimitIdentifier,
      nextAttempts,
      now.toISOString(),
      lockedUntil,
      nextAttempts,
      now.toISOString(),
      lockedUntil
    ]);
    throw { status: 401, message: "Credenciales incorrectas. Verifique su correo y contrase\xF1a." };
  }
  await db.run("DELETE FROM login_attempts WHERE identifier = ?", [rateLimitIdentifier]);
  const sessionToken = await createSession(row.id, params.userAgent, params.ip);
  const user = {
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
    createdAt: row.created_at
  };
  return { user, sessionToken };
}
async function createSession(userId, userAgent, ip) {
  const db = await getDb();
  const sessionToken = import_crypto.default.randomBytes(32).toString("hex");
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1e3);
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
async function getSessionUser(sessionToken) {
  if (!sessionToken || typeof sessionToken !== "string") return null;
  const db = await getDb();
  const session = await db.get(
    "SELECT user_id, expires_at FROM sessions WHERE id = ?",
    [sessionToken]
  );
  if (!session) return null;
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(session.expires_at);
  if (expiresAt <= now) {
    await db.run("DELETE FROM sessions WHERE id = ?", [sessionToken]);
    return null;
  }
  const row = await db.get(
    "SELECT * FROM users WHERE id = ?",
    [session.user_id]
  );
  if (!row) {
    await db.run("DELETE FROM sessions WHERE id = ?", [sessionToken]);
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
    createdAt: row.created_at
  };
}
async function logoutUser(sessionToken) {
  if (!sessionToken) return;
  const db = await getDb();
  await db.run("DELETE FROM sessions WHERE id = ?", [sessionToken]);
}

// src/auth/authMiddleware.ts
async function attachUserMiddleware(req2, res, next) {
  try {
    const cookieToken = req2.cookies?.[SESSION_COOKIE_NAME];
    const authHeader = req2.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
    const token = cookieToken || bearerToken;
    if (token) {
      const user = await getSessionUser(token);
      req2.user = user;
      req2.sessionToken = token;
    } else {
      req2.user = null;
    }
  } catch (err) {
    req2.user = null;
  }
  next();
}
function requireAuth(req2, res, next) {
  if (!req2.user) {
    return res.status(401).json({
      error: "Autenticaci\xF3n requerida. Por favor, inicie sesi\xF3n.",
      code: "UNAUTHORIZED"
    });
  }
  next();
}
function requireAdmin(req2, res, next) {
  if (!req2.user) {
    return res.status(401).json({
      error: "Autenticaci\xF3n requerida.",
      code: "UNAUTHORIZED"
    });
  }
  if (req2.user.role !== "admin") {
    return res.status(403).json({
      error: "Acceso denegado: se requieren permisos de administrador.",
      code: "FORBIDDEN"
    });
  }
  next();
}
function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60 * 1e3,
    path: "/"
  });
}
function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
}

// src/db/repo.ts
async function getPublicTarotistas() {
  const db = await getDb();
  const rows = await db.query(`
    SELECT id, user_id, professional_name, avatar, banner, specialties, bio, experience_years,
           price_per_min_coins, price_per_min_eur, languages, country, is_verified, kyc_status,
           stripe_connect_status, rating_average, total_reviews, total_readings, followers_count,
           video_count, availability_status, custom_commission_percentage, created_at
    FROM tarotista_profiles
    ORDER BY is_verified DESC, rating_average DESC
  `);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    professionalName: r.professional_name,
    avatar: r.avatar,
    banner: r.banner,
    specialties: parseJson(r.specialties, ["Tarot"]),
    bio: r.bio || "",
    experienceYears: r.experience_years,
    pricePerMinCoins: r.price_per_min_coins,
    pricePerMinEur: r.price_per_min_eur,
    languages: parseJson(r.languages, ["Espa\xF1ol"]),
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
    customCommissionPercentage: r.custom_commission_percentage
    // docIdentityUrl SE OMITE intencionalmente para no filtrar documentos privados
  }));
}
async function getPublicVideos() {
  const db = await getDb();
  const rows = await db.query(`
    SELECT * FROM videos ORDER BY created_at DESC
  `);
  return rows.map((r) => ({
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
    unlockedByUserIds: []
  }));
}
async function getPublicReviews() {
  const db = await getDb();
  const rows = await db.query(`
    SELECT * FROM reviews ORDER BY created_at DESC LIMIT 50
  `);
  return rows.map((r) => ({
    id: r.id,
    consultationId: r.consultation_id,
    tarotistaId: r.tarotista_id,
    clientId: r.client_id,
    clientName: r.client_name,
    clientAvatar: r.client_avatar,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
    isVerifiedPurchase: !!r.is_verified_purchase
  }));
}
async function getUserConsultations(userId, isAdmin = false) {
  const db = await getDb();
  let sql = "SELECT * FROM consultations WHERE client_id = ? OR tarotista_id = ? ORDER BY created_at DESC";
  let params = [userId, userId];
  if (isAdmin) {
    sql = "SELECT * FROM consultations ORDER BY created_at DESC LIMIT 100";
    params = [];
  }
  const rows = await db.query(sql, params);
  return rows.map((r) => ({
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
    createdAt: r.created_at
  }));
}
async function getUserLedger(userId, isAdmin = false) {
  const db = await getDb();
  let sql = "SELECT * FROM ledger WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50";
  let params = [userId];
  if (isAdmin) {
    sql = "SELECT * FROM ledger ORDER BY timestamp DESC LIMIT 200";
    params = [];
  }
  const rows = await db.query(sql, params);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    amountCoins: r.amount_coins,
    amountEur: r.amount_eur,
    description: r.description,
    referenceId: r.reference_id,
    timestamp: r.timestamp,
    status: r.status
  }));
}
async function getReports(userId, isAdmin = false) {
  if (!isAdmin) return [];
  const db = await getDb();
  const rows = await db.query("SELECT * FROM reports ORDER BY created_at DESC");
  return rows.map((r) => ({
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
    createdAt: r.created_at
  }));
}
async function getWithdrawals(userId, isAdmin = false, isTarotista = false) {
  const db = await getDb();
  let sql = "";
  let params = [];
  if (isAdmin) {
    sql = "SELECT * FROM withdrawals ORDER BY requested_at DESC";
  } else if (isTarotista) {
    sql = "SELECT * FROM withdrawals WHERE tarotista_id = ? ORDER BY requested_at DESC";
    params = [userId];
  } else {
    return [];
  }
  const rows = await db.query(sql, params);
  return rows.map((r) => ({
    id: r.id,
    tarotistaId: r.tarotista_id,
    tarotistaName: r.tarotista_name,
    amountEur: r.amount_eur,
    amountCoins: r.amount_coins,
    status: r.status,
    requestedAt: r.requested_at,
    vatNumber: r.vat_number,
    bankIban: r.bank_iban
  }));
}
function parseJson(str, fallback) {
  if (Array.isArray(str)) return str;
  if (typeof str !== "string") return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// src/data/initialData.ts
var initialCoinPackages = [
  {
    id: "pack_intro",
    name: "Pack Intro",
    coins: 50,
    priceEur: 4.99,
    icon: "toll"
  },
  {
    id: "pack_master",
    name: "Pack Maestro",
    coins: 200,
    priceEur: 19.99,
    badge: "M\xC1S POPULAR",
    popular: true,
    icon: "workspace_premium"
  },
  {
    id: "pack_astral",
    name: "Pack Astral",
    coins: 500,
    priceEur: 45.99,
    badge: "MEJOR VALOR",
    icon: "auto_awesome"
  },
  {
    id: "pack_galactico",
    name: "Pack Gal\xE1ctico",
    coins: 1e3,
    priceEur: 84.99,
    badge: "DESCUENTO 30%",
    icon: "brightness_high"
  }
];
var initialGifts = [
  {
    id: "gift_vela",
    name: "Vela M\xEDstica",
    icon: "local_fire_department",
    costCoins: 10,
    description: "Ilumina la lectura con energ\xEDa sagrada"
  },
  {
    id: "gift_cristal",
    name: "Cuarzo Rosa",
    icon: "diamond",
    costCoins: 50,
    description: "Atrae amor puro y armon\xEDa"
  },
  {
    id: "gift_bola",
    name: "Bola de Cristal",
    icon: "blur_on",
    costCoins: 150,
    description: "Abre la visi\xF3n del futuro celestial"
  },
  {
    id: "gift_corona",
    name: "Corona Astral",
    icon: "auto_awesome",
    costCoins: 500,
    description: "M\xE1ximo tributo de agradecimiento"
  }
];
var initialLiveStreams = [
  {
    id: "live_1",
    tarotistaId: "tar_1",
    tarotistaName: "Luna M\xEDstica",
    tarotistaAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200",
    title: "Lectura Abierta de Tarot y Mensajes del Universo \u2728 | En Vivo",
    category: "Tarot",
    viewersCount: 1240,
    isLive: true,
    inPrivateConsultation: false,
    streamVideoUrl: "https://assets.mixkit.co/videos/preview/mixkit-hands-shuffling-a-deck-of-tarot-cards-43403-large.mp4",
    queueUsers: [
      {
        id: "usr_cliente_1",
        name: "Elena Pastor",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
        joinedAt: "2026-07-26T03:10:00Z",
        durationMinutes: 10,
        consultationType: "videollamada"
      },
      {
        id: "usr_q_2",
        name: "Carlos Ruiz",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200",
        joinedAt: "2026-07-26T03:15:00Z",
        durationMinutes: 15,
        consultationType: "audio"
      }
    ]
  },
  {
    id: "live_2",
    tarotistaId: "tar_2",
    tarotistaName: "Astro Maestro",
    tarotistaAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
    title: "An\xE1lisis Astrol\xF3gico Semanal & Consultas R\xE1pidas \u{1FA90}",
    category: "Astrolog\xEDa",
    viewersCount: 890,
    isLive: true,
    inPrivateConsultation: false,
    streamVideoUrl: "https://assets.mixkit.co/videos/preview/mixkit-starry-sky-at-night-4286-large.mp4",
    queueUsers: []
  }
];

// server.ts
if (process.env.NODE_ENV !== "test" && !process.env.TEST_RUN) {
  import_dotenv.default.config();
}
var ai = new import_genai.GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "MOCK_KEY",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
async function createServerApp() {
  try {
    await initDatabase();
  } catch (err) {
    console.error("[Database Warning]:", err.message);
  }
  const app = (0, import_express.default)();
  app.use(import_express.default.json());
  app.use((0, import_cookie_parser.default)());
  app.use(attachUserMiddleware);
  app.get("/api/health", (req2, res) => {
    const dbErr = getDbError();
    res.status(dbErr ? 503 : 200).json({
      status: dbErr ? "database_error" : "ok",
      error: dbErr,
      time: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.use("/api", (req2, res, next) => {
    const dbErr = getDbError();
    if (dbErr && req2.path !== "/health") {
      return res.status(503).json({
        error: "Error de conexi\xF3n con la base de datos relacional.",
        details: dbErr
      });
    }
    next();
  });
  app.post("/api/auth/register", async (req2, res) => {
    try {
      const { name, email, password, role, isAgeVerified } = req2.body;
      const { user, sessionToken } = await registerUser({
        name,
        email,
        password,
        role,
        isAgeVerified: !!isAgeVerified,
        userAgent: req2.headers["user-agent"],
        ip: req2.ip
      });
      setSessionCookie(res, sessionToken);
      res.status(201).json({ success: true, user });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error interno al registrar usuario." });
    }
  });
  app.post("/api/auth/login", async (req2, res) => {
    try {
      const { email, password } = req2.body;
      const { user, sessionToken } = await loginUser({
        email,
        password,
        userAgent: req2.headers["user-agent"],
        ip: req2.ip
      });
      setSessionCookie(res, sessionToken);
      res.json({ success: true, user });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al iniciar sesi\xF3n." });
    }
  });
  app.post("/api/auth/logout", async (req2, res) => {
    try {
      await logoutUser(req2.sessionToken);
      clearSessionCookie(res);
      res.json({ success: true, message: "Sesi\xF3n finalizada correctamente." });
    } catch (err) {
      clearSessionCookie(res);
      res.json({ success: true });
    }
  });
  app.get("/api/auth/me", (req2, res) => {
    res.json({ success: true, user: req2.user || null });
  });
  app.get("/api/state", async (req2, res) => {
    try {
      const currentUser = req2.user || null;
      const isAdmin = currentUser?.role === "admin";
      const isTarotista = currentUser?.role === "tarotista";
      const [publicTarotistas, publicVideos, publicReviews] = await Promise.all([
        getPublicTarotistas(),
        getPublicVideos(),
        getPublicReviews()
      ]);
      let userConsultations = [];
      let userLedger = [];
      let userReports = [];
      let userWithdrawals = [];
      if (currentUser) {
        [userConsultations, userLedger, userReports, userWithdrawals] = await Promise.all([
          getUserConsultations(currentUser.id, isAdmin),
          getUserLedger(currentUser.id, isAdmin),
          getReports(currentUser.id, isAdmin),
          getWithdrawals(currentUser.id, isAdmin, isTarotista)
        ]);
      }
      res.json({
        currentUser,
        tarotistaProfiles: publicTarotistas,
        videos: publicVideos,
        liveStreams: initialLiveStreams,
        reviews: publicReviews,
        consultations: userConsultations,
        ledger: userLedger,
        reports: userReports,
        withdrawals: userWithdrawals,
        coinPackages: initialCoinPackages,
        gifts: initialGifts
      });
    } catch (err) {
      console.error("[API State Error]:", err);
      res.status(500).json({ error: "Error al recuperar el estado de la aplicaci\xF3n." });
    }
  });
  app.post("/api/users/profile", requireAuth, async (req2, res) => {
    try {
      const userId = req2.user.id;
      const { name, handle, bio, avatar, coverImage } = req2.body;
      const db = await getDb();
      const safeName = (name || "").trim();
      if (name !== void 0 && safeName.length < 2) {
        return res.status(400).json({ error: "El nombre debe tener al menos 2 caracteres." });
      }
      await db.run(`
        UPDATE users
        SET name = COALESCE(?, name),
            handle = COALESCE(?, handle),
            bio = COALESCE(?, bio),
            avatar = COALESCE(?, avatar),
            cover_image = COALESCE(?, cover_image),
            updated_at = ?
        WHERE id = ?
      `, [
        safeName || null,
        handle?.trim() || null,
        bio?.trim() || null,
        avatar?.trim() || null,
        coverImage?.trim() || null,
        (/* @__PURE__ */ new Date()).toISOString(),
        userId
      ]);
      const updated = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
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
          coinsBalance: updated.coins_balance,
          isAgeVerified: !!updated.is_age_verified,
          spendingLimitDaily: updated.spending_limit_daily,
          spendingLimitWeekly: updated.spending_limit_weekly,
          spentToday: updated.spent_today,
          spentThisWeek: updated.spent_this_week,
          createdAt: updated.created_at
        }
      });
    } catch (err) {
      res.status(500).json({ error: "Error al actualizar el perfil." });
    }
  });
  app.post("/api/coins/topup", (req2, res) => {
    res.status(503).json({
      success: false,
      error: "La pasarela de pago seguro a\xFAn no est\xE1 disponible. No se ha modificado su saldo ni procesado ninguna transacci\xF3n.",
      code: "PAYMENT_GATEWAY_UNAVAILABLE"
    });
  });
  app.post("/api/admin/approve-tarotista", requireAdmin, async (req2, res) => {
    try {
      const { profileId, approve } = req2.body;
      const db = await getDb();
      const profile = await db.get("SELECT * FROM tarotista_profiles WHERE id = ?", [profileId]);
      if (!profile) return res.status(404).json({ error: "Perfil no encontrado." });
      const newKyc = approve ? "aprobado" : "rechazado";
      const isVerified = approve ? 1 : 0;
      const stripeStatus = approve ? "conectado" : "pendiente";
      await db.run(`
        UPDATE tarotista_profiles
        SET kyc_status = ?, is_verified = ?, stripe_connect_status = ?
        WHERE id = ?
      `, [newKyc, isVerified, stripeStatus, profileId]);
      res.json({ success: true, profileId, status: newKyc });
    } catch (err) {
      res.status(500).json({ error: "Error al moderar perfil." });
    }
  });
  app.post("/api/admin/resolve-dispute", requireAdmin, async (req2, res) => {
    try {
      const { consultationId, refundClient } = req2.body;
      const db = await getDb();
      const consultation = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
      if (!consultation) return res.status(404).json({ error: "Consulta no encontrada." });
      const newStatus = refundClient ? "reembolsada" : "completada";
      await db.run("UPDATE consultations SET status = ? WHERE id = ?", [newStatus, consultationId]);
      if (refundClient) {
        await db.run("UPDATE users SET coins_balance = coins_balance + ? WHERE id = ?", [consultation.total_coins, consultation.client_id]);
      } else {
        await db.run("UPDATE users SET coins_balance = coins_balance + ? WHERE id = ?", [consultation.tarotista_earnings_coins, consultation.tarotista_id]);
      }
      res.json({ success: true, consultationId, status: newStatus });
    } catch (err) {
      res.status(500).json({ error: "Error al resolver disputa." });
    }
  });
  app.post("/api/tarotistas/withdraw", requireAuth, async (req2, res) => {
    if (req2.user.role !== "tarotista") {
      return res.status(403).json({ error: "Solo los tarotistas verificados pueden solicitar retiros." });
    }
    const { amountEur, vatNumber, bankIban } = req2.body;
    const db = await getDb();
    const eur = Number(amountEur) || 50;
    const coins = eur * 10;
    if (eur < 50) {
      return res.status(400).json({ error: "El umbral m\xEDnimo de retiro es de 50.00 \u20AC (500 monedas)." });
    }
    const userRow = await db.get("SELECT coins_balance FROM users WHERE id = ?", [req2.user.id]);
    if (!userRow || userRow.coins_balance < coins) {
      return res.status(400).json({ error: "Saldo de monedas insuficiente para solicitar este retiro." });
    }
    await db.run("UPDATE users SET coins_balance = coins_balance - ? WHERE id = ?", [coins, req2.user.id]);
    const reqId = `wdr_${Date.now()}`;
    await db.run(`
      INSERT INTO withdrawals (id, tarotista_id, tarotista_name, amount_eur, amount_coins, status, requested_at, vat_number, bank_iban)
      VALUES (?, ?, ?, ?, ?, 'pendiente', ?, ?, ?)
    `, [reqId, req2.user.id, req2.user.name, eur, coins, (/* @__PURE__ */ new Date()).toISOString(), vatNumber || "", bankIban || ""]);
    res.json({ success: true, id: reqId, amountEur: eur });
  });
  app.post("/api/reports/create", requireAuth, async (req2, res) => {
    try {
      const { reportedUserId, reportedUserName, contentType, contentId, reason, description } = req2.body;
      const db = await getDb();
      const reportId = `rep_${Date.now()}`;
      await db.run(`
        INSERT INTO reports (id, reporter_id, reporter_name, reported_user_id, reported_user_name, content_type, content_id, reason, description, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)
      `, [
        reportId,
        req2.user.id,
        req2.user.name,
        reportedUserId || "unknown",
        reportedUserName || "Usuario reportado",
        contentType || "chat",
        contentId || "general",
        reason || "acoso",
        description || "",
        (/* @__PURE__ */ new Date()).toISOString()
      ]);
      res.json({ success: true, reportId });
    } catch (err) {
      res.status(500).json({ error: "Error al enviar reporte." });
    }
  });
  app.post("/api/ai/chat", async (req2, res) => {
    const { prompt } = req2.body;
    const lower = (prompt || "").toLowerCase();
    if (lower.includes("suicidio") || lower.includes("matarme") || lower.includes("morir") || lower.includes("autolesion")) {
      return res.json({
        response: "Siento mucho que est\xE9s pasando por un momento de gran dolor. En KABALY nos preocupamos profundamente por tu bienestar. Te pedimos con urgencia que busques apoyo profesional y humano inmediato. Puedes comunicarte gratis y confidencialmente con el Tel\xE9fono de la Esperanza llamando al 717 003 717 o al 024 (L\xEDnea de atenci\xF3n a la conducta suicida en Espa\xF1a). Tu vida tiene un valor incalculable y no est\xE1s solo/a. \u2764\uFE0F",
        isCrisis: true
      });
    }
    try {
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MOCK_KEY") {
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            systemInstruction: `Eres "Kabaly AI", la gu\xEDa m\xEDstica y asistente de sabidur\xEDa espiritual de KABALY.
Tu personalidad es serena, po\xE9tica, elegante y reconfortante.
Ofreces interpretaciones sobre el Tarot, significado de las cartas, orientaci\xF3n astrol\xF3gica y hor\xF3scopos.
REGLAS OBLIGATORIAS:
1. NUNCA prometes o garantizas resultados futuros en amor, salud o dinero.
2. NUNCA das asesoramiento m\xE9dico, psicol\xF3gico, legal ni financiero.
3. Si el usuario pregunta por predicciones tr\xE1gicas o enfermedades, recuerda que el Tarot es una herramienta de autoconocimiento y reflexi\xF3n personal.
4. Responde con un tono elevado pero accesible, con sutiles referencias cosmicas. M\xE1ximo 150 palabras.
5. Recomienda amablemente reservar una consulta 1:1 con un tarotista profesional verificado en la plataforma si el usuario desea una lectura personalizada profunda.`
          }
        });
        return res.json({
          response: response.text,
          cardDrawn: {
            name: "La Estrella (XVII)",
            meaning: "Esperanza, fe, renovaci\xF3n e inspiraci\xF3n estelar.",
            imageUrl: "https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?auto=format&fit=crop&q=80&w=300"
          }
        });
      }
    } catch (e) {
    }
    const fallbackResponses = [
      `El universo te recuerda que las sombras del presente son solo la antesala de una luz m\xE1s radiante. Las alineaciones planetarias actuales favorecen la introspecci\xF3n y la sanaci\xF3n personal.`,
      `En el arcano de tu camino, la claridad surge cuando conf\xEDas en tu propia intuici\xF3n. Cada decisi\xF3n guiada por la serenidad expande tu energ\xEDa astral.`,
      `Los astros indican que est\xE1s en un ciclo de renovaci\xF3n profunda. Perm\xEDtete soltar lo que ya no vibra con tu prop\xF3sito sagrado.`
    ];
    res.json({
      response: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
      cardDrawn: {
        name: "La Estrella (XVII)",
        meaning: "Esperanza, fe, renovaci\xF3n e inspiraci\xF3n celestial.",
        imageUrl: "https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?auto=format&fit=crop&q=80&w=300"
      }
    });
  });
  return app;
}
async function startServer() {
  const app = await createServerApp();
  const PORT = process.env.PORT || 3001;
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    const indexHtmlPath = import_path2.default.join(distPath, "index.html");
    if (import_fs.default.existsSync(distPath)) {
      app.use(import_express.default.static(distPath));
    }
    app.get("*", (req2, res) => {
      if (import_fs.default.existsSync(indexHtmlPath)) {
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
              <p>El servidor backend est\xE1 activo y funcionando.</p>
              <p><small>${(/* @__PURE__ */ new Date()).toISOString()}</small></p>
            </div>
          </body>
          </html>
        `);
      }
    });
  }
  if (typeof PORT === "string" && isNaN(Number(PORT))) {
    app.listen(PORT, () => {
      console.log(`[KABALY Server] Listening on UNIX socket ${PORT}`);
    });
  } else {
    const numericPort = Number(PORT);
    app.listen(numericPort, "0.0.0.0", () => {
      console.log(`[KABALY Server] Running on http://localhost:${numericPort}`);
    });
  }
}
var isDirectCli = process.argv[1] && (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.cjs"));
if (isDirectCli && process.env.NODE_ENV !== "test" && !process.env.TEST_RUN) {
  startServer().catch((err) => {
    console.error("[FATAL SERVER ERROR]:", err);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createServerApp,
  startServer
});
//# sourceMappingURL=server.cjs.map
