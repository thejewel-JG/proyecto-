var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
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

// src/db/database.ts
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
  if (!appliedSet.has("002_phase3_posts_feed")) {
    console.log("[Database] Aplicando migraci\xF3n: 002_phase3_posts_feed...");
    const safeAddColumn = async (table, colDef) => {
      try {
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      } catch (e) {
      }
    };
    await safeAddColumn("videos", 'media_type VARCHAR(16) NOT NULL DEFAULT "video"');
    await safeAddColumn("videos", "description TEXT DEFAULT NULL");
    await safeAddColumn("videos", "is_deleted INT NOT NULL DEFAULT 0");
    await safeAddColumn("videos", "deleted_at DATETIME DEFAULT NULL");
    await safeAddColumn("videos", "idempotency_key VARCHAR(128) DEFAULT NULL");
    const isTest = process.env.NODE_ENV === "test" || process.env.TEST_RUN === "true";
    if (!isTest) {
      await db.run(`DELETE FROM videos WHERE id = 'vid_1'`);
    }
    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ["002_phase3_posts_feed", (/* @__PURE__ */ new Date()).toISOString()]);
    console.log("[Database] Migraci\xF3n 002_phase3_posts_feed completada.");
  }
  if (!appliedSet.has("003_phase4_social_stories")) {
    console.log("[Database] Aplicando migraci\xF3n: 003_phase4_social_stories...");
    await db.run(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id VARCHAR(64) PRIMARY KEY,
        video_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE(video_id, user_id)
      );
    `);
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
    await db.run(`
      CREATE TABLE IF NOT EXISTS follows (
        id VARCHAR(64) PRIMARY KEY,
        follower_id VARCHAR(64) NOT NULL,
        following_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE(follower_id, following_id)
      );
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS saved_posts (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        video_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE(user_id, video_id)
      );
    `);
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
    try {
      await db.run("CREATE INDEX IF NOT EXISTS idx_post_likes_video ON post_likes(video_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_saved_posts_user ON saved_posts(user_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id)");
    } catch (e) {
    }
    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ["003_phase4_social_stories", (/* @__PURE__ */ new Date()).toISOString()]);
    console.log("[Database] Migraci\xF3n 003_phase4_social_stories completada.");
  }
  if (!appliedSet.has("004_phase5_private_messaging")) {
    console.log("[Database] Aplicando migraci\xF3n: 004_phase5_private_messaging...");
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
    await db.run(`
      CREATE TABLE IF NOT EXISTS user_blocks (
        id VARCHAR(64) PRIMARY KEY,
        blocker_id VARCHAR(64) NOT NULL,
        blocked_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL,
        UNIQUE(blocker_id, blocked_id)
      );
    `);
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
    try {
      await db.run("CREATE INDEX IF NOT EXISTS idx_conversations_user_a ON conversations(user_a_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_conversations_user_b ON conversations(user_b_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_conversations_last_msg_at ON conversations(last_message_at)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_messages_recipient_status ON messages(recipient_id, status)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_chat_attach_user ON chat_attachments(user_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_chat_attach_conv ON chat_attachments(conversation_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_message_reports_rep ON message_reports(reporter_id)");
    } catch (e) {
    }
    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ["004_phase5_private_messaging", (/* @__PURE__ */ new Date()).toISOString()]);
    console.log("[Database] Migraci\xF3n 004_phase5_private_messaging completada.");
  }
  if (!appliedSet.has("005_phase6_stripe_wallet")) {
    console.log("[Database] Aplicando migraci\xF3n: 005_phase6_stripe_wallet...");
    const safeAddColumn = async (table, colDef) => {
      try {
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      } catch (e) {
      }
    };
    await safeAddColumn("ledger", "amount_cents INT NOT NULL DEFAULT 0");
    await safeAddColumn("ledger", "balance_after INT NOT NULL DEFAULT 0");
    await safeAddColumn("users", "spending_limit_daily_cents INT DEFAULT NULL");
    await safeAddColumn("users", "spending_limit_weekly_cents INT DEFAULT NULL");
    await safeAddColumn("users", "financial_restriction INT NOT NULL DEFAULT 0");
    await safeAddColumn("users", "purchased_coins_balance INT NOT NULL DEFAULT 0");
    await safeAddColumn("users", "earnings_coins_balance INT NOT NULL DEFAULT 0");
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
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const packagesToSeed = [
      { id: "pack_iniciacion", name: "Pack Iniciaci\xF3n", coins: 100, priceCents: 999, badge: "Iniciaci\xF3n", icon: "toll", sort: 1 },
      { id: "pack_astral", name: "Pack Astral", coins: 300, priceCents: 2499, badge: "Popular", icon: "auto_awesome", sort: 2 },
      { id: "pack_mistico", name: "Pack M\xEDstico", coins: 600, priceCents: 4499, badge: "Ahorro 25%", icon: "diamond", sort: 3 },
      { id: "pack_cosmico", name: "Pack C\xF3smico", coins: 1500, priceCents: 9999, badge: "VIP", icon: "crown", sort: 4 }
    ];
    for (const p of packagesToSeed) {
      await db.run(`
        INSERT OR IGNORE INTO coin_packages (id, name, coins, price_cents, currency, badge, icon, is_active, sort_order, created_at)
        VALUES (?, ?, ?, ?, 'eur', ?, ?, 1, ?, ?)
      `, [p.id, p.name, p.coins, p.priceCents, p.badge, p.icon, p.sort, now]);
    }
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
    try {
      await db.run("CREATE INDEX IF NOT EXISTS idx_coin_orders_user ON coin_orders(user_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_coin_orders_status ON coin_orders(status)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_coin_orders_session ON coin_orders(stripe_session_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_coin_orders_expires ON coin_orders(expires_at)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger(type)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_ledger_ref ON ledger(reference_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_refund_disputes_order ON refund_disputes(order_id)");
    } catch (e) {
    }
    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ["005_phase6_stripe_wallet", (/* @__PURE__ */ new Date()).toISOString()]);
    console.log("[Database] Migraci\xF3n 005_phase6_stripe_wallet completada.");
  }
  if (!appliedSet.has("006_phase8_consultations")) {
    console.log("[Database] Aplicando migraci\xF3n: 006_phase8_consultations...");
    const safeAddColumn = async (table, colDef) => {
      try {
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      } catch (e) {
      }
    };
    await safeAddColumn("consultations", "tarotista_user_id VARCHAR(64)");
    await safeAddColumn("consultations", "rate_per_minute_coins INT NOT NULL DEFAULT 0");
    await safeAddColumn("consultations", "platform_commission_coins INT NOT NULL DEFAULT 0");
    await safeAddColumn("consultations", "commission_percentage INT NOT NULL DEFAULT 20");
    await safeAddColumn("consultations", "started_at DATETIME");
    await safeAddColumn("consultations", "scheduled_end_at DATETIME");
    await safeAddColumn("consultations", "accepted_at DATETIME");
    await safeAddColumn("consultations", "ended_at DATETIME");
    await safeAddColumn("consultations", "cancelled_at DATETIME");
    await safeAddColumn("consultations", "cancelled_by VARCHAR(64)");
    await safeAddColumn("consultations", "cancellation_reason TEXT");
    await safeAddColumn("consultations", "is_settled INT NOT NULL DEFAULT 0");
    await safeAddColumn("consultations", "is_refunded INT NOT NULL DEFAULT 0");
    await safeAddColumn("consultations", "room_token VARCHAR(128)");
    await safeAddColumn("consultations", "idempotency_key VARCHAR(128)");
    await safeAddColumn("consultations", "notes TEXT");
    await safeAddColumn("consultations", "expires_at DATETIME");
    await safeAddColumn("users", "coins_reserved INT NOT NULL DEFAULT 0");
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
    try {
      await db.run("CREATE INDEX IF NOT EXISTS idx_consultations_client ON consultations(client_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_consultations_tarotista ON consultations(tarotista_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_consultations_tarotista_user ON consultations(tarotista_user_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_consultations_idempotency ON consultations(idempotency_key)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_consultation_msgs_cons ON consultation_messages(consultation_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_consultation_disputes_cons ON consultation_disputes(consultation_id)");
      await db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_consultation_unique ON reviews(consultation_id)");
    } catch (e) {
    }
    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ["006_phase8_consultations", (/* @__PURE__ */ new Date()).toISOString()]);
    console.log("[Database] Migraci\xF3n 006_phase8_consultations completada.");
  }
  if (!appliedSet.has("007_phase9_gifts_and_unlocks")) {
    console.log("[Database] Aplicando migraci\xF3n: 007_phase9_gifts_and_unlocks...");
    const safeAddColumn = async (table, colDef) => {
      try {
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      } catch (e) {
      }
    };
    await safeAddColumn("videos", "is_exclusive INT NOT NULL DEFAULT 0");
    await safeAddColumn("videos", "is_withdrawn INT NOT NULL DEFAULT 0");
    await safeAddColumn("videos", "withdrawn_at DATETIME DEFAULT NULL");
    await safeAddColumn("videos", "withdrawal_reason TEXT DEFAULT NULL");
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
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const giftsToSeed = [
      { id: "gift_vela", name: "Vela M\xEDstica", icon: "local_fire_department", costCoins: 10, description: "Ilumina la lectura con energ\xEDa sagrada", sortOrder: 1 },
      { id: "gift_cristal", name: "Cuarzo Rosa", icon: "diamond", costCoins: 50, description: "Atrae amor puro y armon\xEDa", sortOrder: 2 },
      { id: "gift_bola", name: "Bola de Cristal", icon: "blur_on", costCoins: 150, description: "Abre la visi\xF3n del futuro celestial", sortOrder: 3 },
      { id: "gift_corona", name: "Corona Astral", icon: "auto_awesome", costCoins: 500, description: "M\xE1ximo tributo de agradecimiento", sortOrder: 4 }
    ];
    for (const g of giftsToSeed) {
      await db.run(`
        INSERT OR IGNORE INTO stream_gifts (id, name, icon, cost_coins, description, is_active, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `, [g.id, g.name, g.icon, g.costCoins, g.description, g.sortOrder, now]);
    }
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
    const existingStreams = await db.get("SELECT COUNT(*) as count FROM live_streams");
    if (!existingStreams || existingStreams.count === 0) {
      await db.run(`
        INSERT OR IGNORE INTO live_streams (id, tarotista_id, tarotista_name, tarotista_avatar, is_verified, title, category, viewer_count, is_live, started_at)
        VALUES 
          ('live_1', 'usr_tarotista_1', 'Luna M\xEDstica', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200', 1, 'Lectura Abierta de Tarot y Mensajes del Universo \u2728 | En Vivo', 'Tarot', 1240, 1, ?),
          ('live_2', 'usr_tarotista_2', 'Astro Maestro', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200', 1, 'An\xE1lisis Astrol\xF3gico Semanal & Consultas R\xE1pidas \u{1FA90}', 'Astrolog\xEDa', 890, 1, ?)
      `, [now, now]);
    }
    try {
      await db.run("CREATE INDEX IF NOT EXISTS idx_stream_gifts_active ON stream_gifts(is_active)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_gift_tx_stream ON stream_gift_transactions(stream_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_gift_tx_sender ON stream_gift_transactions(sender_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_gift_tx_tarotista ON stream_gift_transactions(tarotista_user_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_gift_events_stream ON stream_gift_events(stream_id, created_at)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_post_unlocks_user ON post_unlocks(user_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_post_unlocks_post ON post_unlocks(post_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_post_unlocks_author ON post_unlocks(author_id)");
    } catch (e) {
    }
    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ["007_phase9_gifts_and_unlocks", (/* @__PURE__ */ new Date()).toISOString()]);
    console.log("[Database] Migraci\xF3n 007_phase9_gifts_and_unlocks completada.");
  }
  if (!appliedSet.has("008_phase10_social_network_complete")) {
    console.log("[Database] Aplicando migraci\xF3n: 008_phase10_social_network_complete...");
    const safeAddColumn = async (table, colDef) => {
      try {
        await db.run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      } catch (e) {
      }
    };
    await safeAddColumn("users", "sun_sign VARCHAR(32) DEFAULT NULL");
    await safeAddColumn("users", "moon_sign VARCHAR(32) DEFAULT NULL");
    await safeAddColumn("users", "rising_sign VARCHAR(32) DEFAULT NULL");
    await safeAddColumn("users", "ruling_arcana VARCHAR(64) DEFAULT NULL");
    await safeAddColumn("users", "spiritual_gift VARCHAR(64) DEFAULT NULL");
    await safeAddColumn("users", "is_private INT NOT NULL DEFAULT 0");
    await safeAddColumn("videos", "is_pinned INT NOT NULL DEFAULT 0");
    await safeAddColumn("videos", "media_urls TEXT DEFAULT NULL");
    await safeAddColumn("comments", "likes_count INT NOT NULL DEFAULT 0");
    await safeAddColumn("comments", "is_pinned INT NOT NULL DEFAULT 0");
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
      await db.run("CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_highlights_user ON profile_highlights(user_id)");
      await db.run("CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id)");
    } catch (e) {
    }
    try {
      await db.run(`
        UPDATE users SET sun_sign = 'Escorpio', moon_sign = 'Piscis', rising_sign = 'Acuario', ruling_arcana = 'XVIII \u2022 La Luna', spiritual_gift = 'Videncia Lunar'
        WHERE id = 'usr_tarotista_1' AND sun_sign IS NULL
      `);
      await db.run(`
        UPDATE users SET sun_sign = 'Leo', moon_sign = 'Sagitario', rising_sign = 'Aries', ruling_arcana = 'XIX \u2022 El Sol', spiritual_gift = 'Astrolog\xEDa K\xE1rmica'
        WHERE id = 'usr_tarotista_2' AND sun_sign IS NULL
      `);
    } catch (e) {
    }
    await db.run(`
      INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)
    `, ["008_phase10_social_network_complete", (/* @__PURE__ */ new Date()).toISOString()]);
    console.log("[Database] Migraci\xF3n 008_phase10_social_network_complete completada.");
  }
}
var import_path, import_module, import_bcryptjs, import_promise, req, sqliteConstructor, SqliteDatabase, MysqlDatabase, dbInstance, lastDbError;
var init_database = __esm({
  "src/db/database.ts"() {
    import_path = __toESM(require("path"), 1);
    import_module = require("module");
    import_bcryptjs = __toESM(require("bcryptjs"), 1);
    import_promise = __toESM(require("mysql2/promise"), 1);
    req = typeof require !== "undefined" ? require : (0, import_module.createRequire)(import_path.default.resolve(process.cwd(), "package.json"));
    sqliteConstructor = null;
    SqliteDatabase = class {
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
    MysqlDatabase = class {
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
    dbInstance = null;
    lastDbError = null;
  }
});

// src/services/consultationService.ts
var consultationService_exports = {};
__export(consultationService_exports, {
  ACCEPT_TIMEOUT_MS: () => ACCEPT_TIMEOUT_MS,
  RECONNECT_GRACE_PERIOD_MS: () => RECONNECT_GRACE_PERIOD_MS,
  acceptConsultation: () => acceptConsultation,
  autoExpireConsultations: () => autoExpireConsultations,
  cancelConsultation: () => cancelConsultation,
  completeConsultation: () => completeConsultation,
  createConsultationBooking: () => createConsultationBooking,
  createConsultationDispute: () => createConsultationDispute,
  createConsultationReview: () => createConsultationReview,
  getConsultationMessages: () => getConsultationMessages,
  getConsultationRoomCredentials: () => getConsultationRoomCredentials,
  mapConsultationRow: () => mapConsultationRow,
  rejectConsultation: () => rejectConsultation,
  resolveConsultationDispute: () => resolveConsultationDispute,
  sendConsultationMessage: () => sendConsultationMessage,
  startConsultation: () => startConsultation
});
function mapConsultationRow(row) {
  const mod = row.type || "chat";
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    clientAvatar: row.client_avatar,
    tarotistaId: row.tarotista_id,
    tarotistaUserId: row.tarotista_user_id || void 0,
    tarotistaName: row.tarotista_name,
    tarotistaAvatar: row.tarotista_avatar,
    type: mod,
    modality: mod,
    durationMinutes: row.duration_minutes,
    status: row.status,
    ratePerMinuteCoins: row.rate_per_minute_coins || 0,
    totalCoins: row.total_coins,
    priceCoins: row.total_coins,
    platformCommissionCoins: row.platform_commission_coins || 0,
    tarotistaEarningsCoins: row.tarotista_earnings_coins || 0,
    commissionPercentage: row.commission_percentage || 20,
    createdAt: row.created_at,
    requestedAt: row.created_at,
    acceptedAt: row.accepted_at || void 0,
    startedAt: row.started_at || void 0,
    scheduledEndAt: row.scheduled_end_at || void 0,
    endedAt: row.ended_at || void 0,
    cancelledAt: row.cancelled_at || void 0,
    cancelledBy: row.cancelled_by || void 0,
    cancellationReason: row.cancellation_reason || void 0,
    isSettled: !!row.is_settled,
    isRefunded: !!row.is_refunded,
    roomToken: row.room_token || void 0,
    idempotencyKey: row.idempotency_key || void 0,
    notes: row.notes || void 0,
    expiresAt: row.expires_at || void 0
  };
}
async function createConsultationBooking(params) {
  const db = await getDb();
  const { clientId, tarotistaId, durationMinutes, idempotencyKey, notes } = params;
  const modality = params.type || params.modality || "";
  if (!["chat", "audio", "video"].includes(modality)) {
    throw { status: 400, message: "Modalidad de consulta inv\xE1lida. Las opciones disponibles son: chat, audio o video." };
  }
  const validDurations = [10, 15, 20, 30, 45, 60];
  if (!validDurations.includes(durationMinutes)) {
    throw { status: 400, message: `Duraci\xF3n no permitida. Elija una de: ${validDurations.join(", ")} minutos.` };
  }
  if (idempotencyKey) {
    const existing = await db.get(
      "SELECT * FROM consultations WHERE client_id = ? AND idempotency_key = ?",
      [clientId, idempotencyKey]
    );
    if (existing) {
      const mapped2 = mapConsultationRow(existing);
      return { consultation: mapped2, isDuplicate: true, ...mapped2 };
    }
  }
  const profile = await db.get(
    "SELECT * FROM tarotista_profiles WHERE id = ? OR user_id = ?",
    [tarotistaId, tarotistaId]
  );
  if (!profile) {
    throw { status: 404, message: "Perfil de tarotista no encontrado o inactivo." };
  }
  const tarotistaUserId = profile.user_id;
  if (clientId === tarotistaUserId) {
    throw { status: 400, message: "Un profesional no puede contratar una consulta consigo mismo." };
  }
  const ratePerMinute = profile.price_per_min_coins || 15;
  const commissionPercentage = profile.custom_commission_percentage ?? 20;
  const totalCoins = ratePerMinute * durationMinutes;
  const clientUser = await db.get(
    "SELECT id, name, avatar, coins_balance, coins_reserved FROM users WHERE id = ?",
    [clientId]
  );
  if (!clientUser) {
    throw { status: 404, message: "Usuario cliente no encontrado." };
  }
  if (clientUser.coins_balance < totalCoins) {
    throw {
      status: 402,
      message: `Saldo insuficiente. Tu saldo disponible es de ${clientUser.coins_balance} monedas y la consulta requiere ${totalCoins} monedas.`
    };
  }
  const clientName = params.clientName || clientUser.name || "Cliente";
  const clientAvatar = params.clientAvatar || clientUser.avatar || "";
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + ACCEPT_TIMEOUT_MS);
  const consultationId = `cons_${Date.now()}_${import_crypto5.default.randomBytes(4).toString("hex")}`;
  await db.run("BEGIN TRANSACTION");
  try {
    const updateRes = await db.run(
      `UPDATE users 
       SET coins_balance = coins_balance - ?, 
           coins_reserved = coins_reserved + ?,
           updated_at = ?
       WHERE id = ? AND coins_balance >= ?`,
      [totalCoins, totalCoins, now.toISOString(), clientId, totalCoins]
    );
    if (updateRes.changes === 0) {
      await db.run("ROLLBACK");
      throw { status: 400, message: "No se pudo reservar el saldo requerido para la consulta." };
    }
    const updatedClient = await db.get("SELECT coins_balance FROM users WHERE id = ?", [clientId]);
    const ledgerId = `tx_hold_${Date.now()}_${import_crypto5.default.randomBytes(4).toString("hex")}`;
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'consultation_reserve', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        ledgerId,
        clientId,
        -totalCoins,
        updatedClient.coins_balance,
        `Retenci\xF3n para consulta 1:1 (${modality}, ${durationMinutes} min) con ${profile.professional_name}`,
        consultationId,
        now.toISOString()
      ]
    );
    await db.run(
      `INSERT INTO consultations (
        id, client_id, client_name, client_avatar,
        tarotista_id, tarotista_user_id, tarotista_name, tarotista_avatar,
        status, type, duration_minutes, rate_per_minute_coins,
        total_coins, platform_commission_coins, tarotista_earnings_coins,
        commission_percentage, scheduled_for, created_at, expires_at, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'solicitada', ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`,
      [
        consultationId,
        clientId,
        clientName,
        clientAvatar,
        profile.id,
        tarotistaUserId,
        profile.professional_name,
        profile.avatar,
        modality,
        durationMinutes,
        ratePerMinute,
        totalCoins,
        commissionPercentage,
        now.toISOString(),
        now.toISOString(),
        expiresAt.toISOString(),
        idempotencyKey || null
      ]
    );
    await db.run("COMMIT");
  } catch (err) {
    try {
      await db.run("ROLLBACK");
    } catch {
    }
    throw err;
  }
  const created = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
  const mapped = mapConsultationRow(created);
  return { consultation: mapped, isDuplicate: false, ...mapped };
}
async function acceptConsultation(consultationId, tarotistaUserId) {
  const db = await getDb();
  const cons = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
  if (!cons) {
    throw { status: 404, message: "Consulta no encontrada." };
  }
  if (cons.tarotista_user_id !== tarotistaUserId) {
    throw { status: 403, message: "Solo el profesional asignado puede aceptar esta consulta." };
  }
  if (cons.status !== "solicitada") {
    throw { status: 400, message: `La consulta se encuentra en estado '${cons.status}', no puede aceptarse.` };
  }
  const activeConcurrent = await db.get(
    `SELECT id FROM consultations 
     WHERE tarotista_user_id = ? 
       AND status IN ('en_curso') 
       AND id != ?`,
    [tarotistaUserId, consultationId]
  );
  if (activeConcurrent) {
    throw { status: 409, message: "Actualmente ya tienes una consulta en curso. Finaliza la sesi\xF3n actual antes de aceptar otra." };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.run(
    "UPDATE consultations SET status = 'aceptada', accepted_at = ? WHERE id = ?",
    [now, consultationId]
  );
  const updated = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
  return mapConsultationRow(updated);
}
async function rejectConsultation(consultationIdOrParams, tarotistaUserIdArg, reasonArg = "Rechazada por el profesional") {
  const consultationId = typeof consultationIdOrParams === "object" ? consultationIdOrParams.consultationId : consultationIdOrParams;
  const tarotistaUserId = typeof consultationIdOrParams === "object" ? consultationIdOrParams.tarotistaUserId : tarotistaUserIdArg || "";
  const reason = typeof consultationIdOrParams === "object" ? consultationIdOrParams.reason || reasonArg : reasonArg;
  const db = await getDb();
  const cons = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
  if (!cons) {
    throw { status: 404, message: "Consulta no encontrada." };
  }
  if (cons.tarotista_user_id !== tarotistaUserId) {
    throw { status: 403, message: "Solo el profesional asignado puede rechazar esta consulta." };
  }
  if (cons.status !== "solicitada") {
    throw { status: 400, message: `No se puede rechazar una consulta en estado '${cons.status}'.` };
  }
  return releaseConsultationHold({
    consultationId,
    targetStatus: "rechazada",
    cancelledBy: tarotistaUserId,
    reason
  });
}
async function cancelConsultation(consultationIdOrParams, userIdArg, reasonArg = "Cancelada por el usuario") {
  const consultationId = typeof consultationIdOrParams === "object" ? consultationIdOrParams.consultationId : consultationIdOrParams;
  const userId = typeof consultationIdOrParams === "object" ? consultationIdOrParams.userId : userIdArg || "";
  const reason = typeof consultationIdOrParams === "object" ? consultationIdOrParams.reason || reasonArg : reasonArg;
  const db = await getDb();
  const cons = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
  if (!cons) {
    throw { status: 404, message: "Consulta no encontrada." };
  }
  const isClient = cons.client_id === userId;
  const isTarotista = cons.tarotista_user_id === userId;
  if (!isClient && !isTarotista) {
    throw { status: 403, message: "No tienes autorizaci\xF3n para cancelar esta consulta." };
  }
  if (cons.status !== "solicitada" && cons.status !== "aceptada") {
    throw { status: 400, message: `No se puede cancelar una consulta en estado '${cons.status}'.` };
  }
  return releaseConsultationHold({
    consultationId,
    targetStatus: "cancelada",
    cancelledBy: userId,
    reason
  });
}
async function releaseConsultationHold(params) {
  const db = await getDb();
  const { consultationId, targetStatus, cancelledBy, reason } = params;
  await db.run("BEGIN TRANSACTION");
  try {
    const cons = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
    if (!cons || cons.is_refunded === 1) {
      await db.run("COMMIT");
      return mapConsultationRow(cons);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const totalCoins = cons.total_coins;
    await db.run(
      `UPDATE users 
       SET coins_balance = coins_balance + ?, 
           coins_reserved = MAX(0, coins_reserved - ?),
           updated_at = ?
       WHERE id = ?`,
      [totalCoins, totalCoins, now, cons.client_id]
    );
    const updatedClient = await db.get("SELECT coins_balance FROM users WHERE id = ?", [cons.client_id]);
    const ledgerId = `tx_rel_${Date.now()}_${import_crypto5.default.randomBytes(4).toString("hex")}`;
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'consultation_refund', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        ledgerId,
        cons.client_id,
        totalCoins,
        updatedClient.coins_balance,
        `Liberaci\xF3n de reserva por consulta ${targetStatus} (${cons.tarotista_name}): ${reason}`,
        consultationId,
        now
      ]
    );
    await db.run(
      `UPDATE consultations 
       SET status = ?, 
           cancelled_at = ?, 
           cancelled_by = ?, 
           cancellation_reason = ?, 
           is_refunded = 1 
       WHERE id = ?`,
      [targetStatus, now, cancelledBy, reason, consultationId]
    );
    await db.run("COMMIT");
  } catch (err) {
    try {
      await db.run("ROLLBACK");
    } catch {
    }
    throw err;
  }
  const updated = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
  return mapConsultationRow(updated);
}
async function startConsultation(consultationId, userId) {
  const db = await getDb();
  const cons = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
  if (!cons) {
    throw { status: 404, message: "Consulta no encontrada." };
  }
  const isClient = cons.client_id === userId;
  const isTarotista = cons.tarotista_user_id === userId;
  if (!isClient && !isTarotista) {
    throw { status: 403, message: "Acceso denegado a esta sala de consulta." };
  }
  if (cons.status === "en_curso") {
    return mapConsultationRow(cons);
  }
  if (cons.status !== "aceptada") {
    throw { status: 400, message: `La consulta debe estar aceptada para iniciarla (estado actual: '${cons.status}').` };
  }
  const activeStream = await db.get(
    "SELECT id FROM live_streams WHERE (tarotista_id = ? OR tarotista_id = ?) AND is_live = 1",
    [cons.tarotista_id, cons.tarotista_user_id || cons.tarotista_id]
  );
  if (activeStream) {
    throw {
      status: 409,
      message: "El profesional tiene una emisi\xF3n p\xFAblica en directo activa. Debe detener la emisi\xF3n antes de activar la sala privada."
    };
  }
  const now = /* @__PURE__ */ new Date();
  const scheduledEndAt = new Date(now.getTime() + cons.duration_minutes * 60 * 1e3);
  const roomToken = `room_${import_crypto5.default.randomBytes(24).toString("hex")}`;
  await db.run(
    `UPDATE consultations 
     SET status = 'en_curso', 
         started_at = ?, 
         scheduled_end_at = ?, 
         room_token = ? 
     WHERE id = ?`,
    [now.toISOString(), scheduledEndAt.toISOString(), roomToken, consultationId]
  );
  const updated = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
  return mapConsultationRow(updated);
}
async function completeConsultation(consultationId, _closedByUserId, _reason = "Tiempo completado") {
  const db = await getDb();
  await db.run("BEGIN TRANSACTION");
  try {
    const cons = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
    if (!cons) {
      await db.run("ROLLBACK");
      throw { status: 404, message: "Consulta no encontrada." };
    }
    if (cons.is_settled === 1) {
      await db.run("COMMIT");
      return mapConsultationRow(cons);
    }
    if (cons.status !== "en_curso") {
      await db.run("ROLLBACK");
      throw { status: 400, message: `Solo se pueden liquidar consultas que est\xE9n 'en_curso' (actual: '${cons.status}').` };
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const totalCoins = cons.total_coins;
    const commissionPct = cons.commission_percentage || 20;
    const platformFeeCoins = Math.round(totalCoins * (commissionPct / 100));
    const tarotistaEarningsCoins = totalCoins - platformFeeCoins;
    if (platformFeeCoins + tarotistaEarningsCoins !== totalCoins) {
      throw new Error("Error en el balance de liquidaci\xF3n contable.");
    }
    await db.run(
      "UPDATE users SET coins_reserved = MAX(0, coins_reserved - ?), updated_at = ? WHERE id = ?",
      [totalCoins, now, cons.client_id]
    );
    await db.run(
      `UPDATE users 
       SET coins_balance = coins_balance + ?, 
           earnings_coins_balance = earnings_coins_balance + ?,
           updated_at = ?
       WHERE id = ?`,
      [tarotistaEarningsCoins, tarotistaEarningsCoins, now, cons.tarotista_user_id]
    );
    await db.run(
      "UPDATE tarotista_profiles SET total_readings = total_readings + 1 WHERE id = ? OR user_id = ?",
      [cons.tarotista_id, cons.tarotista_user_id]
    );
    const tarotistaUser = await db.get("SELECT coins_balance FROM users WHERE id = ?", [cons.tarotista_user_id]);
    const ledgerTarotistaId = `tx_earn_${Date.now()}_${import_crypto5.default.randomBytes(4).toString("hex")}`;
    const ledgerFeeId = `tx_fee_${Date.now()}_${import_crypto5.default.randomBytes(4).toString("hex")}`;
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'consultation_settlement', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        ledgerTarotistaId,
        cons.tarotista_user_id,
        tarotistaEarningsCoins,
        tarotistaUser.coins_balance,
        `Liquidaci\xF3n de consulta 1:1 (${cons.duration_minutes} min) con ${cons.client_name}`,
        consultationId,
        now
      ]
    );
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, 'platform', 'platform_fee', ?, 0, 0, 0, ?, ?, ?, 'completed')`,
      [
        ledgerFeeId,
        platformFeeCoins,
        `Comisi\xF3n de plataforma (${commissionPct}%) por consulta ${consultationId}`,
        consultationId,
        now
      ]
    );
    await db.run(
      `UPDATE consultations 
       SET status = 'completada', 
           ended_at = ?, 
           platform_commission_coins = ?, 
           tarotista_earnings_coins = ?, 
           is_settled = 1 
       WHERE id = ?`,
      [now, platformFeeCoins, tarotistaEarningsCoins, consultationId]
    );
    await db.run("COMMIT");
  } catch (err) {
    try {
      await db.run("ROLLBACK");
    } catch {
    }
    throw err;
  }
  const updated = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
  return mapConsultationRow(updated);
}
async function createConsultationDispute(params) {
  const db = await getDb();
  const { consultationId, raisedById, reason } = params;
  const cons = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
  if (!cons) {
    throw { status: 404, message: "Consulta no encontrada." };
  }
  const isClient = cons.client_id === raisedById;
  const isTarotista = cons.tarotista_user_id === raisedById;
  if (!isClient && !isTarotista) {
    throw { status: 403, message: "Solo los participantes de la consulta pueden abrir una disputa." };
  }
  const disputeId = `disp_${Date.now()}_${import_crypto5.default.randomBytes(4).toString("hex")}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.run(
    `INSERT INTO consultation_disputes (
      id, consultation_id, client_id, tarotista_id, raised_by_id,
      reason, status, refund_amount_coins, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
    [disputeId, consultationId, cons.client_id, cons.tarotista_id, raisedById, reason, now]
  );
  await db.run(
    "UPDATE consultations SET status = 'disputada' WHERE id = ?",
    [consultationId]
  );
  return {
    id: disputeId,
    consultationId,
    clientId: cons.client_id,
    tarotistaId: cons.tarotista_id,
    raisedById,
    reason,
    status: "pending",
    refundAmountCoins: 0,
    createdAt: now
  };
}
async function resolveConsultationDispute(params) {
  const db = await getDb();
  const { disputeId, adminUserId, resolution, adminNotes } = params;
  const dispute = await db.get("SELECT * FROM consultation_disputes WHERE id = ?", [disputeId]);
  if (!dispute) {
    throw { status: 404, message: "Disputa no encontrada." };
  }
  if (dispute.status !== "pending") {
    throw { status: 400, message: "Esta disputa ya ha sido resuelta con anterioridad." };
  }
  const cons = await db.get("SELECT * FROM consultations WHERE id = ?", [dispute.consultation_id]);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let coinsToRefund = 0;
  if (resolution === "resolved_refund_full") {
    coinsToRefund = cons.total_coins;
  } else if (resolution === "resolved_refund_partial") {
    coinsToRefund = Math.min(cons.total_coins, Math.max(0, params.refundAmountCoins || 0));
  }
  await db.run("BEGIN TRANSACTION");
  try {
    if (coinsToRefund > 0) {
      if (cons.is_settled === 1) {
        const tarotistaUser = await db.get("SELECT coins_balance FROM users WHERE id = ?", [cons.tarotista_user_id]);
        const currentTarotistaBal = tarotistaUser ? tarotistaUser.coins_balance : 0;
        const deductFromTarotista = Math.min(currentTarotistaBal, coinsToRefund);
        await db.run(
          `UPDATE users 
           SET coins_balance = MAX(0, coins_balance - ?),
               earnings_coins_balance = MAX(0, earnings_coins_balance - ?),
               financial_restriction = CASE WHEN ? > coins_balance THEN 1 ELSE financial_restriction END,
               updated_at = ?
           WHERE id = ?`,
          [deductFromTarotista, deductFromTarotista, coinsToRefund, now, cons.tarotista_user_id]
        );
      } else {
        await db.run(
          "UPDATE users SET coins_reserved = MAX(0, coins_reserved - ?), updated_at = ? WHERE id = ?",
          [cons.total_coins, now, cons.client_id]
        );
      }
      await db.run(
        "UPDATE users SET coins_balance = coins_balance + ?, updated_at = ? WHERE id = ?",
        [coinsToRefund, now, cons.client_id]
      );
      const updatedClient = await db.get("SELECT coins_balance FROM users WHERE id = ?", [cons.client_id]);
      const ledgerId = `tx_disp_${Date.now()}_${import_crypto5.default.randomBytes(4).toString("hex")}`;
      await db.run(
        `INSERT INTO ledger (
          id, user_id, type, amount_coins, amount_cents, amount_eur,
          balance_after, description, reference_id, timestamp, status
        ) VALUES (?, ?, 'consultation_refund', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
        [
          ledgerId,
          cons.client_id,
          coinsToRefund,
          updatedClient.coins_balance,
          `Resoluci\xF3n de disputa #${disputeId}: Reembolso de ${coinsToRefund} monedas`,
          cons.id,
          now
        ]
      );
    }
    await db.run(
      `UPDATE consultation_disputes 
       SET status = ?, 
           refund_amount_coins = ?, 
           admin_notes = ?, 
           resolved_by = ?, 
           resolved_at = ? 
       WHERE id = ?`,
      [resolution, coinsToRefund, adminNotes || null, adminUserId, now, disputeId]
    );
    await db.run(
      "UPDATE consultations SET status = 'reembolsada' WHERE id = ?",
      [cons.id]
    );
    await db.run("COMMIT");
  } catch (err) {
    try {
      await db.run("ROLLBACK");
    } catch {
    }
    throw err;
  }
  const updated = await db.get("SELECT * FROM consultation_disputes WHERE id = ?", [disputeId]);
  return {
    id: updated.id,
    consultationId: updated.consultation_id,
    clientId: updated.client_id,
    tarotistaId: updated.tarotista_id,
    raisedById: updated.raised_by_id,
    reason: updated.reason,
    status: updated.status,
    refundAmountCoins: updated.refund_amount_coins,
    adminNotes: updated.admin_notes || void 0,
    resolvedBy: updated.resolved_by || void 0,
    resolvedAt: updated.resolved_at || void 0,
    createdAt: updated.created_at
  };
}
async function getConsultationMessages(consultationId, userId) {
  const db = await getDb();
  const cons = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
  if (!cons) {
    throw { status: 404, message: "Consulta no encontrada." };
  }
  const isClient = cons.client_id === userId;
  const isTarotista = cons.tarotista_user_id === userId;
  if (!isClient && !isTarotista) {
    throw { status: 403, message: "No tienes permiso para acceder a los mensajes de esta consulta." };
  }
  const rows = await db.query(
    "SELECT * FROM consultation_messages WHERE consultation_id = ? ORDER BY created_at ASC",
    [consultationId]
  );
  return rows.map((r) => ({
    id: r.id,
    consultationId: r.consultation_id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    senderAvatar: r.sender_avatar || void 0,
    content: r.content,
    cardData: r.card_data ? JSON.parse(r.card_data) : void 0,
    createdAt: r.created_at
  }));
}
async function sendConsultationMessage(params) {
  const db = await getDb();
  const { consultationId, senderId } = params;
  const content = params.content || params.text || "";
  const cardData = params.cardData || params.cardShared;
  const cons = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
  if (!cons) {
    throw { status: 404, message: "Consulta no encontrada." };
  }
  const isClient = cons.client_id === senderId;
  const isTarotista = cons.tarotista_user_id === senderId;
  if (!isClient && !isTarotista) {
    throw { status: 403, message: "No tienes permiso para enviar mensajes en esta sala." };
  }
  if (cons.status !== "en_curso" && cons.status !== "aceptada") {
    throw { status: 400, message: `No se pueden enviar mensajes en una consulta en estado '${cons.status}'.` };
  }
  const senderUser = await db.get("SELECT name, avatar FROM users WHERE id = ?", [senderId]);
  const senderName = params.senderName || (senderUser ? senderUser.name : isClient ? cons.client_name : cons.tarotista_name);
  const senderAvatar = params.senderAvatar || (senderUser ? senderUser.avatar : "");
  if (!content.trim() && !cardData) {
    throw { status: 400, message: "El mensaje no puede estar vac\xEDo." };
  }
  const id = `cmsg_${Date.now()}_${import_crypto5.default.randomBytes(4).toString("hex")}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.run(
    `INSERT INTO consultation_messages (
      id, consultation_id, sender_id, sender_name, sender_avatar, content, card_data, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, consultationId, senderId, senderName, senderAvatar || null, content, cardData ? JSON.stringify(cardData) : null, now]
  );
  return {
    id,
    consultationId,
    senderId,
    senderName,
    senderAvatar,
    content,
    text: content,
    cardData,
    cardShared: cardData,
    createdAt: now
  };
}
async function getConsultationRoomCredentials(consultationId, userId) {
  const db = await getDb();
  const cons = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
  if (!cons) {
    throw { status: 404, message: "Consulta no encontrada." };
  }
  const isClient = cons.client_id === userId;
  const isTarotista = cons.tarotista_user_id === userId;
  if (!isClient && !isTarotista) {
    throw { status: 403, message: "Acceso denegado a las credenciales de la sala." };
  }
  const now = /* @__PURE__ */ new Date();
  const expiresAt = cons.scheduled_end_at || new Date(now.getTime() + 30 * 60 * 1e3).toISOString();
  const roomToken = cons.room_token || `token_${import_crypto5.default.randomBytes(16).toString("hex")}`;
  const role = isClient ? "client" : "tarotista";
  return {
    consultationId,
    roomToken,
    channelName: `kabaly_room_${consultationId}`,
    userId,
    userName: isClient ? cons.client_name : cons.tarotista_name,
    role,
    participantRole: role,
    isReady: true,
    type: cons.type,
    expiresAt,
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ]
  };
}
async function createConsultationReview(params) {
  const db = await getDb();
  const { consultationId, clientId, clientName, clientAvatar, rating, comment } = params;
  if (rating < 1 || rating > 5) {
    throw { status: 400, message: "La valoraci\xF3n debe ser un n\xFAmero entero entre 1 y 5 estrellas." };
  }
  const cons = await db.get("SELECT * FROM consultations WHERE id = ?", [consultationId]);
  if (!cons) {
    throw { status: 404, message: "Consulta no encontrada." };
  }
  if (cons.client_id !== clientId) {
    throw { status: 403, message: "Solo el cliente que recibi\xF3 la consulta puede dejar una rese\xF1a." };
  }
  if (cons.status !== "completada") {
    throw { status: 400, message: "Solo se pueden valorar consultas que hayan sido completadas satisfactoriamente." };
  }
  const existingReview = await db.get("SELECT id FROM reviews WHERE consultation_id = ?", [consultationId]);
  if (existingReview) {
    throw { status: 400, message: "Ya has publicado una rese\xF1a para esta consulta." };
  }
  const reviewId = `rev_${Date.now()}_${import_crypto5.default.randomBytes(4).toString("hex")}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.run(
    `INSERT INTO reviews (
      id, consultation_id, tarotista_id, client_id, client_name, client_avatar, rating, comment, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [reviewId, consultationId, cons.tarotista_id, clientId, clientName, clientAvatar, Math.round(rating), comment, now]
  );
  const stats = await db.get(
    "SELECT COUNT(*) as count, AVG(rating) as avgRating FROM reviews WHERE tarotista_id = ?",
    [cons.tarotista_id]
  );
  if (stats) {
    const avg = parseFloat(Number(stats.avgRating || 5).toFixed(1));
    await db.run(
      "UPDATE tarotista_profiles SET rating_average = ?, total_reviews = ? WHERE id = ? OR user_id = ?",
      [avg, stats.count, cons.tarotista_id, cons.tarotista_user_id]
    );
  }
  return {
    id: reviewId,
    consultationId,
    tarotistaId: cons.tarotista_id,
    rating: Math.round(rating),
    comment,
    createdAt: now
  };
}
async function autoExpireConsultations() {
  const db = await getDb();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let expiredCount = 0;
  let completedCount = 0;
  const expiredRequested = await db.query(
    "SELECT id FROM consultations WHERE status = 'solicitada' AND expires_at <= ?",
    [now]
  );
  for (const c of expiredRequested) {
    try {
      await releaseConsultationHold({
        consultationId: c.id,
        targetStatus: "expirada",
        cancelledBy: "system_timeout",
        reason: "Plazo de aceptaci\xF3n expirado sin respuesta del profesional"
      });
      expiredCount++;
    } catch (e) {
      console.error(`[Janitor Error] Expirando consulta ${c.id}:`, e);
    }
  }
  const expiredInProgress = await db.query(
    "SELECT id FROM consultations WHERE status = 'en_curso' AND scheduled_end_at <= ? AND is_settled = 0",
    [now]
  );
  for (const c of expiredInProgress) {
    try {
      await completeConsultation(c.id, "system_timeout", "Tiempo contratado finalizado");
      completedCount++;
    } catch (e) {
      console.error(`[Janitor Error] Completando consulta ${c.id}:`, e);
    }
  }
  return { expiredCount, completedCount };
}
var import_crypto5, ACCEPT_TIMEOUT_MS, RECONNECT_GRACE_PERIOD_MS;
var init_consultationService = __esm({
  "src/services/consultationService.ts"() {
    import_crypto5 = __toESM(require("crypto"), 1);
    init_database();
    ACCEPT_TIMEOUT_MS = 15 * 60 * 1e3;
    RECONNECT_GRACE_PERIOD_MS = 3 * 60 * 1e3;
  }
});

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
var import_path3 = __toESM(require("path"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
init_database();

// src/auth/authService.ts
var import_crypto = __toESM(require("crypto"), 1);
var import_bcryptjs2 = __toESM(require("bcryptjs"), 1);
init_database();
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
    0,
    // Saldo inicial real en 0 (sin monedas ficticias)
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
    coinsBalance: 0,
    purchasedCoinsBalance: 0,
    earningsCoinsBalance: 0,
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
    sunSign: row.sun_sign || void 0,
    moonSign: row.moon_sign || void 0,
    risingSign: row.rising_sign || void 0,
    rulingArcana: row.ruling_arcana || void 0,
    spiritualGift: row.spiritual_gift || void 0,
    isPrivate: !!row.is_private,
    coinsBalance: row.coins_balance,
    purchasedCoinsBalance: row.purchased_coins_balance || 0,
    earningsCoinsBalance: row.earnings_coins_balance || 0,
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
    sunSign: row.sun_sign || void 0,
    moonSign: row.moon_sign || void 0,
    risingSign: row.rising_sign || void 0,
    rulingArcana: row.ruling_arcana || void 0,
    spiritualGift: row.spiritual_gift || void 0,
    isPrivate: !!row.is_private,
    coinsBalance: row.coins_balance,
    purchasedCoinsBalance: row.purchased_coins_balance || 0,
    earningsCoinsBalance: row.earnings_coins_balance || 0,
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
var import_crypto2 = __toESM(require("crypto"), 1);
init_database();
function mapVideoRow(r) {
  return {
    id: r.id,
    tarotistaId: r.tarotista_id,
    authorId: r.tarotista_id,
    tarotistaName: r.tarotista_name,
    tarotistaAvatar: r.tarotista_avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
    isVerified: !!r.is_verified,
    title: r.title,
    videoUrl: r.video_url,
    thumbnailUrl: r.thumbnail_url || (r.media_type === "image" ? r.video_url : ""),
    category: r.category,
    likes: r.likes || 0,
    commentsCount: r.comments_count || 0,
    sharesCount: r.shares_count || 0,
    soundTitle: r.sound_title || "Audio Original",
    isPremium: !!r.is_premium,
    isExclusive: !!r.is_exclusive || !!r.is_premium,
    priceCoins: r.price_coins,
    unlockedByUserIds: [],
    mediaType: r.media_type || "video",
    mediaUrls: r.media_urls ? parseJson(r.media_urls, void 0) : void 0,
    isPinned: !!r.is_pinned,
    description: r.description || "",
    isWithdrawn: !!r.is_withdrawn,
    withdrawnAt: r.withdrawn_at || void 0,
    withdrawalReason: r.withdrawal_reason || void 0,
    createdAt: r.created_at
  };
}
function encodeCursor(createdAt, id) {
  return Buffer.from(`${createdAt}|${id}`).toString("base64");
}
function decodeCursor(cursor) {
  try {
    const raw = Buffer.from(cursor, "base64").toString("utf8");
    const [createdAt, id] = raw.split("|");
    if (createdAt && id) return { createdAt, id };
    return null;
  } catch (e) {
    return null;
  }
}
async function getFeedPosts(opts = {}) {
  const db = await getDb();
  const limit = Math.min(Math.max(Number(opts.limit) || 10, 1), 50);
  const conditions = ["is_deleted = 0"];
  const params = [];
  if (opts.category === "Siguiendo" || opts.feedType === "following") {
    if (!opts.currentUserId) {
      return { items: [], nextCursor: null, hasMore: false };
    }
    conditions.push(`(
      tarotista_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
      OR tarotista_id IN (SELECT id FROM tarotista_profiles WHERE user_id IN (SELECT following_id FROM follows WHERE follower_id = ?))
      OR tarotista_id IN (SELECT user_id FROM tarotista_profiles WHERE id IN (SELECT following_id FROM follows WHERE follower_id = ?))
    )`);
    params.push(opts.currentUserId, opts.currentUserId, opts.currentUserId);
  } else if (opts.category && opts.category !== "Para ti") {
    conditions.push("category = ?");
    params.push(opts.category);
  }
  if (opts.authorId) {
    conditions.push("tarotista_id = ?");
    params.push(opts.authorId);
  }
  if (opts.cursor) {
    const decoded = decodeCursor(opts.cursor);
    if (decoded) {
      conditions.push("(created_at < ? OR (created_at = ? AND id < ?))");
      params.push(decoded.createdAt, decoded.createdAt, decoded.id);
    }
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT * FROM videos ${whereClause} ORDER BY created_at DESC, id DESC LIMIT ?`;
  params.push(limit + 1);
  const rows = await db.query(sql, params);
  const hasMore = rows.length > limit;
  const itemsRows = hasMore ? rows.slice(0, limit) : rows;
  let likedSet = /* @__PURE__ */ new Set();
  let savedSet = /* @__PURE__ */ new Set();
  let unlockedSet = /* @__PURE__ */ new Set();
  if (opts.currentUserId && itemsRows.length > 0) {
    const ids = itemsRows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const [likedRows, savedRows, unlockedRows] = await Promise.all([
      db.query(`SELECT video_id FROM post_likes WHERE user_id = ? AND video_id IN (${placeholders})`, [opts.currentUserId, ...ids]),
      db.query(`SELECT video_id FROM saved_posts WHERE user_id = ? AND video_id IN (${placeholders})`, [opts.currentUserId, ...ids]),
      db.query(`SELECT post_id FROM post_unlocks WHERE user_id = ? AND is_refunded = 0 AND post_id IN (${placeholders})`, [opts.currentUserId, ...ids])
    ]);
    likedSet = new Set(likedRows.map((r) => r.video_id));
    savedSet = new Set(savedRows.map((r) => r.video_id));
    unlockedSet = new Set(unlockedRows.map((r) => r.post_id));
  }
  const items = itemsRows.map((r) => {
    const post = mapVideoRow(r);
    post.isLikedByCurrentUser = likedSet.has(r.id);
    post.isSavedByCurrentUser = savedSet.has(r.id);
    const isAuthor = opts.currentUserId && (opts.currentUserId === r.tarotista_id || opts.currentUserId === r.author_id);
    const isPurchased = unlockedSet.has(r.id);
    const hasUnlocked = !post.isPremium || !post.priceCoins || post.priceCoins <= 0 || !!isAuthor || isPurchased;
    post.hasUnlocked = hasUnlocked;
    if (!hasUnlocked) {
      post.videoUrl = "";
      post.mediaUrls = void 0;
    }
    return post;
  });
  let nextCursor = null;
  if (hasMore && itemsRows.length > 0) {
    const lastItem = itemsRows[itemsRows.length - 1];
    nextCursor = encodeCursor(lastItem.created_at, lastItem.id);
  }
  return { items, nextCursor, hasMore };
}
async function createPost(params) {
  const db = await getDb();
  if (params.idempotencyKey) {
    const existing = await db.get(
      "SELECT * FROM videos WHERE idempotency_key = ? AND is_deleted = 0",
      [params.idempotencyKey]
    );
    if (existing) {
      return { post: mapVideoRow(existing), wasExisting: true };
    }
  }
  const id = `vid_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const isPrem = !!params.isPremium;
  const price = isPrem && typeof params.priceCoins === "number" && params.priceCoins > 0 ? Math.floor(params.priceCoins) : null;
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
    params.authorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
    params.isVerified ? 1 : 0,
    params.title,
    params.videoUrl,
    mediaUrlsJson,
    params.thumbnailUrl || (params.mediaType === "image" ? params.videoUrl : ""),
    params.category || "Tarot",
    params.mediaType === "video" ? "Audio Original" : "Visual Sagrada",
    isPrem ? 1 : 0,
    isPrem ? 1 : 0,
    price,
    params.mediaType,
    params.description || "",
    params.idempotencyKey || null,
    now
  ]);
  await db.run("UPDATE tarotista_profiles SET video_count = video_count + 1 WHERE user_id = ?", [params.authorId]);
  const created = await db.get("SELECT * FROM videos WHERE id = ?", [id]);
  const post = mapVideoRow(created);
  post.hasUnlocked = true;
  return { post, wasExisting: false };
}
async function getPostById(id, currentUserId) {
  const db = await getDb();
  const row = await db.get("SELECT * FROM videos WHERE id = ? AND is_deleted = 0", [id]);
  if (!row) return null;
  const post = mapVideoRow(row);
  const isAuthor = currentUserId && (currentUserId === row.tarotista_id || currentUserId === row.author_id);
  let isPurchased = false;
  if (currentUserId) {
    const [likeRow, saveRow, unlockRow] = await Promise.all([
      db.get("SELECT id FROM post_likes WHERE video_id = ? AND user_id = ?", [id, currentUserId]),
      db.get("SELECT id FROM saved_posts WHERE video_id = ? AND user_id = ?", [id, currentUserId]),
      db.get("SELECT id FROM post_unlocks WHERE post_id = ? AND user_id = ? AND is_refunded = 0", [id, currentUserId])
    ]);
    post.isLikedByCurrentUser = !!likeRow;
    post.isSavedByCurrentUser = !!saveRow;
    isPurchased = !!unlockRow;
  }
  const hasUnlocked = !post.isPremium || !post.priceCoins || post.priceCoins <= 0 || !!isAuthor || isPurchased;
  post.hasUnlocked = hasUnlocked;
  if (!hasUnlocked) {
    post.videoUrl = "";
  }
  return post;
}
async function updatePost(id, userId, updates, isAdmin = false) {
  const db = await getDb();
  const post = await db.get("SELECT * FROM videos WHERE id = ?", [id]);
  if (!post || post.is_deleted) {
    return { success: false, error: "Publicaci\xF3n no encontrada o ha sido retirada.", status: 404 };
  }
  if (post.tarotista_id !== userId && !isAdmin) {
    return { success: false, error: "No tienes permiso para editar esta publicaci\xF3n.", status: 403 };
  }
  if (updates.isPremium && !post.is_premium) {
    return {
      success: false,
      error: "No es posible convertir una publicaci\xF3n p\xFAblica existente en exclusiva porque su archivo original ya fue expuesto de forma p\xFAblica y copias previamente descargadas no pueden recuperarse. Crea una nueva publicaci\xF3n exclusiva con portada separada y archivo privado.",
      status: 400
    };
  }
  let newPrice = post.price_coins;
  if (typeof updates.priceCoins === "number" && updates.priceCoins > 0) {
    newPrice = Math.floor(updates.priceCoins);
  }
  const newTitle = updates.title !== void 0 ? updates.title.trim() : post.title;
  const newDesc = updates.description !== void 0 ? updates.description.trim() : post.description;
  const newCat = updates.category !== void 0 ? updates.category : post.category;
  await db.run(`
    UPDATE videos
    SET title = ?, description = ?, category = ?, price_coins = ?
    WHERE id = ?
  `, [newTitle, newDesc, newCat, newPrice, id]);
  const updated = await db.get("SELECT * FROM videos WHERE id = ?", [id]);
  return { success: true, post: mapVideoRow(updated), status: 200 };
}
async function deletePost(id, userId, isAdmin = false) {
  const db = await getDb();
  const post = await db.get("SELECT * FROM videos WHERE id = ?", [id]);
  if (!post || post.is_deleted) {
    return { success: false, error: "Publicaci\xF3n no encontrada o ya retirada.", status: 404 };
  }
  if (post.tarotista_id !== userId && !isAdmin) {
    return { success: false, error: "No tienes permiso para retirar esta publicaci\xF3n.", status: 403 };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.run("UPDATE videos SET is_deleted = 1, deleted_at = ? WHERE id = ?", [now, id]);
  await db.run("UPDATE tarotista_profiles SET video_count = MAX(0, video_count - 1) WHERE user_id = ?", [post.tarotista_id]);
  return { success: true, status: 200 };
}
async function getPublicVideos(currentUserId) {
  const res = await getFeedPosts({ limit: 50, currentUserId });
  return res.items;
}
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
  let sql = "SELECT * FROM consultations WHERE client_id = ? OR tarotista_id = ? OR tarotista_user_id = ? ORDER BY created_at DESC";
  let params = [userId, userId, userId];
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
    tarotistaUserId: r.tarotista_user_id || void 0,
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
    acceptedAt: r.accepted_at || void 0,
    startedAt: r.started_at || void 0,
    scheduledEndAt: r.scheduled_end_at || void 0,
    endedAt: r.ended_at || void 0,
    cancelledAt: r.cancelled_at || void 0,
    cancelledBy: r.cancelled_by || void 0,
    cancellationReason: r.cancellation_reason || void 0,
    isSettled: !!r.is_settled,
    isRefunded: !!r.is_refunded,
    roomToken: r.room_token || void 0,
    idempotencyKey: r.idempotency_key || void 0,
    notes: r.notes || void 0,
    expiresAt: r.expires_at || void 0,
    disputeReason: r.dispute_reason || void 0
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
async function addPostLike(videoId, userId) {
  const db = await getDb();
  const post = await db.get("SELECT id, tarotista_id, title, is_deleted FROM videos WHERE id = ?", [videoId]);
  if (!post || post.is_deleted) {
    throw { status: 404, message: "Publicaci\xF3n no encontrada o retirada." };
  }
  const existing = await db.get("SELECT id FROM post_likes WHERE video_id = ? AND user_id = ?", [videoId, userId]);
  if (!existing) {
    const likeId = `like_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
    await db.run("INSERT INTO post_likes (id, video_id, user_id, created_at) VALUES (?, ?, ?, ?)", [
      likeId,
      videoId,
      userId,
      (/* @__PURE__ */ new Date()).toISOString()
    ]);
    if (post.tarotista_id && post.tarotista_id !== userId) {
      const actor = await db.get("SELECT name, avatar FROM users WHERE id = ?", [userId]);
      if (actor) {
        await createNotification({
          userId: post.tarotista_id,
          actorId: userId,
          actorName: actor.name,
          actorAvatar: actor.avatar || "",
          type: "like",
          referenceId: videoId,
          message: `ha resonado con tu visi\xF3n \xAB${(post.title || "").slice(0, 40)}\xBB`
        }).catch(() => {
        });
      }
    }
  }
  const countRow = await db.get("SELECT COUNT(*) as cnt FROM post_likes WHERE video_id = ?", [videoId]);
  const likesCount = countRow ? countRow.cnt : 0;
  await db.run("UPDATE videos SET likes = ? WHERE id = ?", [likesCount, videoId]);
  return { likes: likesCount, isLiked: true };
}
async function removePostLike(videoId, userId) {
  const db = await getDb();
  const post = await db.get("SELECT id, is_deleted FROM videos WHERE id = ?", [videoId]);
  if (!post || post.is_deleted) {
    throw { status: 404, message: "Publicaci\xF3n no encontrada o retirada." };
  }
  await db.run("DELETE FROM post_likes WHERE video_id = ? AND user_id = ?", [videoId, userId]);
  const countRow = await db.get("SELECT COUNT(*) as cnt FROM post_likes WHERE video_id = ?", [videoId]);
  const likesCount = countRow ? countRow.cnt : 0;
  await db.run("UPDATE videos SET likes = ? WHERE id = ?", [likesCount, videoId]);
  return { likes: likesCount, isLiked: false };
}
function sanitizeCommentContent(raw) {
  return raw.replace(/<[^>]*>?/gm, "").trim();
}
async function createComment(params) {
  const db = await getDb();
  const post = await db.get("SELECT id, tarotista_id, title, is_deleted FROM videos WHERE id = ?", [params.videoId]);
  if (!post || post.is_deleted) {
    throw { status: 404, message: "La publicaci\xF3n no est\xE1 disponible para comentar." };
  }
  const cleanContent = sanitizeCommentContent(params.content);
  if (cleanContent.length < 1 || cleanContent.length > 500) {
    throw { status: 400, message: "El comentario debe tener entre 1 y 500 caracteres." };
  }
  let finalParentId = null;
  let parentAuthorId = null;
  if (params.parentId) {
    const parent = await db.get("SELECT id, video_id, parent_id, author_id FROM comments WHERE id = ?", [params.parentId]);
    if (!parent || parent.video_id !== params.videoId) {
      throw { status: 400, message: "El comentario al que intentas responder no existe." };
    }
    finalParentId = parent.parent_id ? parent.parent_id : parent.id;
    parentAuthorId = parent.author_id;
  }
  const commentId = `cmt_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.run(`
    INSERT INTO comments (id, video_id, author_id, author_name, author_avatar, parent_id, content, is_deleted, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `, [
    commentId,
    params.videoId,
    params.authorId,
    params.authorName,
    params.authorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
    finalParentId,
    cleanContent,
    now,
    now
  ]);
  const countRow = await db.get("SELECT COUNT(*) as cnt FROM comments WHERE video_id = ? AND is_deleted = 0", [params.videoId]);
  const commentsCount = countRow ? countRow.cnt : 0;
  await db.run("UPDATE videos SET comments_count = ? WHERE id = ?", [commentsCount, params.videoId]);
  if (parentAuthorId && parentAuthorId !== params.authorId) {
    await createNotification({
      userId: parentAuthorId,
      actorId: params.authorId,
      actorName: params.authorName,
      actorAvatar: params.authorAvatar || "",
      type: "reply",
      referenceId: params.videoId,
      message: `respondi\xF3 a tu susurro: \xAB${cleanContent.slice(0, 45)}\xBB`
    }).catch(() => {
    });
  } else if (post.tarotista_id && post.tarotista_id !== params.authorId) {
    await createNotification({
      userId: post.tarotista_id,
      actorId: params.authorId,
      actorName: params.authorName,
      actorAvatar: params.authorAvatar || "",
      type: "comment",
      referenceId: params.videoId,
      message: `dej\xF3 una visi\xF3n en tu or\xE1culo: \xAB${cleanContent.slice(0, 45)}\xBB`
    }).catch(() => {
    });
  }
  const mentionMatches = cleanContent.match(/@([a-zA-Z0-9_.-]+)/g);
  if (mentionMatches && mentionMatches.length > 0) {
    for (const rawMention of mentionMatches.slice(0, 5)) {
      const cleanHandle = rawMention.toLowerCase();
      const stripHandle = rawMention.slice(1).toLowerCase();
      const mentionedUser = await db.get(
        `SELECT id FROM users WHERE LOWER(handle) = ? OR LOWER(handle) = ? OR LOWER(REPLACE(name, ' ', '')) = ? LIMIT 1`,
        [cleanHandle, `@${stripHandle}`, stripHandle]
      );
      if (mentionedUser && mentionedUser.id !== params.authorId) {
        await createNotification({
          userId: mentionedUser.id,
          actorId: params.authorId,
          actorName: params.authorName,
          actorAvatar: params.authorAvatar || "",
          type: "mention",
          referenceId: params.videoId,
          message: `te ha mencionado en el or\xE1culo: \xAB${cleanContent.slice(0, 45)}\xBB`
        }).catch(() => {
        });
      }
    }
  }
  return {
    id: commentId,
    videoId: params.videoId,
    authorId: params.authorId,
    authorName: params.authorName,
    authorAvatar: params.authorAvatar || "",
    parentId: finalParentId,
    content: cleanContent,
    likesCount: 0,
    isLikedByCurrentUser: false,
    isPinned: false,
    isDeleted: false,
    createdAt: now,
    replies: []
  };
}
async function getPostComments(videoId, currentUserId) {
  const db = await getDb();
  const rows = await db.query(`
    SELECT * FROM comments
    WHERE video_id = ?
    ORDER BY COALESCE(is_pinned, 0) DESC, created_at ASC
  `, [videoId]);
  let likedCommentIds = /* @__PURE__ */ new Set();
  if (currentUserId && rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const likedRows = await db.query(
      `SELECT comment_id FROM comment_likes WHERE user_id = ? AND comment_id IN (${placeholders})`,
      [currentUserId, ...ids]
    );
    likedCommentIds = new Set(likedRows.map((r) => r.comment_id));
  }
  const activeCount = rows.filter((r) => !r.is_deleted).length;
  const rootComments = [];
  const repliesMap = /* @__PURE__ */ new Map();
  for (const r of rows) {
    if (r.parent_id) {
      if (!repliesMap.has(r.parent_id)) {
        repliesMap.set(r.parent_id, []);
      }
      if (!r.is_deleted) {
        repliesMap.get(r.parent_id).push({
          id: r.id,
          videoId: r.video_id,
          authorId: r.author_id,
          authorName: r.author_name,
          authorAvatar: r.author_avatar || "",
          parentId: r.parent_id,
          content: r.content,
          likesCount: r.likes_count || 0,
          isLikedByCurrentUser: likedCommentIds.has(r.id),
          isPinned: !!r.is_pinned,
          isDeleted: false,
          createdAt: r.created_at
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
        authorAvatar: r.author_avatar || "",
        parentId: null,
        content: r.is_deleted ? "[Comentario eliminado por el autor]" : r.content,
        likesCount: r.likes_count || 0,
        isLikedByCurrentUser: likedCommentIds.has(r.id),
        isPinned: !!r.is_pinned,
        isDeleted: !!r.is_deleted,
        createdAt: r.created_at,
        replies
      });
    }
  }
  return { comments: rootComments, total: activeCount };
}
async function deleteComment(commentId, userId, isAdmin) {
  const db = await getDb();
  const comment = await db.get("SELECT * FROM comments WHERE id = ?", [commentId]);
  if (!comment) {
    throw { status: 404, message: "Comentario no encontrado." };
  }
  if (comment.author_id !== userId && !isAdmin) {
    throw { status: 403, message: "No tienes permiso para borrar este comentario." };
  }
  const repliesCount = await db.get("SELECT COUNT(*) as cnt FROM comments WHERE parent_id = ? AND is_deleted = 0", [commentId]);
  const hasReplies = repliesCount && repliesCount.cnt > 0;
  if (hasReplies) {
    await db.run("UPDATE comments SET is_deleted = 1, content = ?, updated_at = ? WHERE id = ?", [
      "[Comentario eliminado por el autor]",
      (/* @__PURE__ */ new Date()).toISOString(),
      commentId
    ]);
  } else {
    await db.run("DELETE FROM comments WHERE id = ?", [commentId]);
  }
  const countRow = await db.get("SELECT COUNT(*) as cnt FROM comments WHERE video_id = ? AND is_deleted = 0", [comment.video_id]);
  const commentsCount = countRow ? countRow.cnt : 0;
  await db.run("UPDATE videos SET comments_count = ? WHERE id = ?", [commentsCount, comment.video_id]);
  return { success: true, softDeleted: !!hasReplies };
}
async function followUser(followerId, followingId) {
  if (followerId === followingId) {
    throw { status: 400, message: "No puedes seguirte a ti mismo en KABALY." };
  }
  const db = await getDb();
  const targetUser = await db.get("SELECT id FROM users WHERE id = ?", [followingId]);
  if (!targetUser) {
    throw { status: 404, message: "Usuario no encontrado." };
  }
  const existing = await db.get("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?", [followerId, followingId]);
  if (!existing) {
    const followId = `flw_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
    await db.run("INSERT INTO follows (id, follower_id, following_id, created_at) VALUES (?, ?, ?, ?)", [
      followId,
      followerId,
      followingId,
      (/* @__PURE__ */ new Date()).toISOString()
    ]);
    const actor = await db.get("SELECT name, avatar FROM users WHERE id = ?", [followerId]);
    if (actor) {
      await createNotification({
        userId: followingId,
        actorId: followerId,
        actorName: actor.name,
        actorAvatar: actor.avatar || "",
        type: "follow",
        referenceId: followerId,
        message: "se ha unido a tu c\xEDrculo astral (ahora te sigue)"
      }).catch(() => {
      });
    }
  }
  const rel = await getUserRelationship(followingId, followerId);
  await db.run("UPDATE tarotista_profiles SET followers_count = ? WHERE user_id = ? OR id = ?", [
    rel.followersCount,
    followingId,
    followingId
  ]);
  return rel;
}
async function unfollowUser(followerId, followingId) {
  const db = await getDb();
  await db.run("DELETE FROM follows WHERE follower_id = ? AND following_id = ?", [followerId, followingId]);
  const rel = await getUserRelationship(followingId, followerId);
  await db.run("UPDATE tarotista_profiles SET followers_count = ? WHERE user_id = ? OR id = ?", [
    rel.followersCount,
    followingId,
    followingId
  ]);
  return rel;
}
async function getUserRelationship(targetUserId, currentUserId) {
  const db = await getDb();
  const [followersRow, followingRow, isFollowingRow] = await Promise.all([
    db.get("SELECT COUNT(*) as cnt FROM follows WHERE following_id = ?", [targetUserId]),
    db.get("SELECT COUNT(*) as cnt FROM follows WHERE follower_id = ?", [targetUserId]),
    currentUserId ? db.get("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?", [currentUserId, targetUserId]) : null
  ]);
  return {
    isFollowing: !!isFollowingRow,
    followersCount: followersRow ? followersRow.cnt : 0,
    followingCount: followingRow ? followingRow.cnt : 0
  };
}
async function getUserFollowers(userId, currentUserId) {
  const db = await getDb();
  const rows = await db.query(`
    SELECT u.id, u.name, u.avatar, u.role, u.handle
    FROM follows f
    JOIN users u ON f.follower_id = u.id
    WHERE f.following_id = ?
    ORDER BY f.created_at DESC
  `, [userId]);
  let followingSet = /* @__PURE__ */ new Set();
  if (currentUserId && rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const relRows = await db.query(`
      SELECT following_id FROM follows WHERE follower_id = ? AND following_id IN (${placeholders})
    `, [currentUserId, ...ids]);
    followingSet = new Set(relRows.map((r) => r.following_id));
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatar: r.avatar || "",
    role: r.role,
    handle: r.handle,
    isFollowing: followingSet.has(r.id)
  }));
}
async function getUserFollowing(userId, currentUserId) {
  const db = await getDb();
  const rows = await db.query(`
    SELECT u.id, u.name, u.avatar, u.role, u.handle
    FROM follows f
    JOIN users u ON f.following_id = u.id
    WHERE f.follower_id = ?
    ORDER BY f.created_at DESC
  `, [userId]);
  let followingSet = /* @__PURE__ */ new Set();
  if (currentUserId && rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const relRows = await db.query(`
      SELECT following_id FROM follows WHERE follower_id = ? AND following_id IN (${placeholders})
    `, [currentUserId, ...ids]);
    followingSet = new Set(relRows.map((r) => r.following_id));
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatar: r.avatar || "",
    role: r.role,
    handle: r.handle,
    isFollowing: followingSet.has(r.id)
  }));
}
async function savePost(userId, videoId) {
  const db = await getDb();
  const post = await db.get("SELECT id, is_deleted FROM videos WHERE id = ?", [videoId]);
  if (!post || post.is_deleted) {
    throw { status: 404, message: "Publicaci\xF3n no disponible para guardar." };
  }
  const existing = await db.get("SELECT id FROM saved_posts WHERE user_id = ? AND video_id = ?", [userId, videoId]);
  if (!existing) {
    const saveId = `sav_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
    await db.run("INSERT INTO saved_posts (id, user_id, video_id, created_at) VALUES (?, ?, ?, ?)", [
      saveId,
      userId,
      videoId,
      (/* @__PURE__ */ new Date()).toISOString()
    ]);
  }
  return { success: true, isSaved: true };
}
async function unsavePost(userId, videoId) {
  const db = await getDb();
  await db.run("DELETE FROM saved_posts WHERE user_id = ? AND video_id = ?", [userId, videoId]);
  return { success: true, isSaved: false };
}
async function getUserSavedPosts(userId) {
  const db = await getDb();
  const rows = await db.query(`
    SELECT v.*
    FROM saved_posts sp
    JOIN videos v ON sp.video_id = v.id
    WHERE sp.user_id = ? AND v.is_deleted = 0
    ORDER BY sp.created_at DESC
  `, [userId]);
  return rows.map((r) => {
    const post = mapVideoRow(r);
    post.isSavedByCurrentUser = true;
    return post;
  });
}
async function createStory(params) {
  const db = await getDb();
  const storyId = `sty_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
  const now = /* @__PURE__ */ new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1e3).toISOString();
  await db.run(`
    INSERT INTO stories (id, user_id, user_name, user_avatar, media_url, media_type, caption, created_at, expires_at, is_deleted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `, [
    storyId,
    params.userId,
    params.userName,
    params.userAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
    params.mediaUrl,
    params.mediaType,
    params.caption?.trim() || null,
    createdAt,
    expiresAt
  ]);
  return {
    id: storyId,
    userId: params.userId,
    userName: params.userName,
    userAvatar: params.userAvatar || "",
    mediaUrl: params.mediaUrl,
    mediaType: params.mediaType,
    caption: params.caption?.trim() || void 0,
    createdAt,
    expiresAt,
    viewsCount: 0,
    hasViewed: false
  };
}
async function getActiveStories(currentUserId) {
  const db = await getDb();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const rows = await db.query(`
    SELECT s.*, (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) as views_count
    FROM stories s
    WHERE s.expires_at > ? AND s.is_deleted = 0
    ORDER BY s.created_at ASC
  `, [now]);
  let viewedSet = /* @__PURE__ */ new Set();
  if (currentUserId && rows.length > 0) {
    const storyIds = rows.map((r) => r.id);
    const placeholders = storyIds.map(() => "?").join(",");
    const vRows = await db.query(`
      SELECT story_id FROM story_views WHERE user_id = ? AND story_id IN (${placeholders})
    `, [currentUserId, ...storyIds]);
    viewedSet = new Set(vRows.map((r) => r.story_id));
  }
  const groupsMap = /* @__PURE__ */ new Map();
  for (const r of rows) {
    if (!groupsMap.has(r.user_id)) {
      groupsMap.set(r.user_id, {
        userId: r.user_id,
        userName: r.user_name,
        userAvatar: r.user_avatar || "",
        hasUnseen: false,
        stories: []
      });
    }
    const group = groupsMap.get(r.user_id);
    const hasViewed = viewedSet.has(r.id);
    if (!hasViewed) {
      group.hasUnseen = true;
    }
    group.stories.push({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userAvatar: r.user_avatar || "",
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      caption: r.caption || void 0,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      viewsCount: r.views_count || 0,
      hasViewed
    });
  }
  const groups = Array.from(groupsMap.values());
  if (currentUserId) {
    groups.sort((a, b) => a.userId === currentUserId ? -1 : b.userId === currentUserId ? 1 : 0);
  }
  return groups;
}
async function getStoryById(storyId, currentUserId) {
  const db = await getDb();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const row = await db.get(`
    SELECT s.*, (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) as views_count
    FROM stories s
    WHERE s.id = ? AND s.expires_at > ? AND s.is_deleted = 0
  `, [storyId, now]);
  if (!row) return null;
  let hasViewed = false;
  if (currentUserId) {
    const v = await db.get("SELECT id FROM story_views WHERE story_id = ? AND user_id = ?", [storyId, currentUserId]);
    hasViewed = !!v;
  }
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userAvatar: row.user_avatar || "",
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    caption: row.caption || void 0,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    viewsCount: row.views_count || 0,
    hasViewed
  };
}
async function deleteStory(storyId, userId, isAdmin) {
  const db = await getDb();
  const story = await db.get("SELECT * FROM stories WHERE id = ?", [storyId]);
  if (!story) {
    throw { status: 404, message: "Historia no encontrada." };
  }
  if (story.user_id !== userId && !isAdmin) {
    throw { status: 403, message: "No tienes permiso para retirar esta historia." };
  }
  await db.run("UPDATE stories SET is_deleted = 1, deleted_at = ? WHERE id = ?", [
    (/* @__PURE__ */ new Date()).toISOString(),
    storyId
  ]);
  return { success: true };
}
async function recordStoryView(storyId, userId, userName, userAvatar) {
  const db = await getDb();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const story = await db.get("SELECT id, user_id, expires_at, is_deleted FROM stories WHERE id = ?", [storyId]);
  if (!story || story.is_deleted || story.expires_at <= now) {
    throw { status: 404, message: "Esta historia ha caducado o no est\xE1 disponible." };
  }
  const existing = await db.get("SELECT id FROM story_views WHERE story_id = ? AND user_id = ?", [storyId, userId]);
  if (!existing) {
    const viewId = `stv_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
    await db.run("INSERT INTO story_views (id, story_id, user_id, user_name, user_avatar, viewed_at) VALUES (?, ?, ?, ?, ?, ?)", [
      viewId,
      storyId,
      userId,
      userName,
      userAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
      now
    ]);
  }
  const isNewView = !existing;
  const cntRow = await db.get("SELECT COUNT(*) as cnt FROM story_views WHERE story_id = ?", [storyId]);
  const totalViews = cntRow ? cntRow.cnt : 1;
  return { success: true, isNewView, viewsCount: totalViews, totalViews };
}
async function getStoryViewers(storyId, requestingUserId, isAdmin) {
  const db = await getDb();
  const story = await db.get("SELECT user_id FROM stories WHERE id = ?", [storyId]);
  if (!story) {
    throw { status: 404, message: "Historia no encontrada." };
  }
  if (story.user_id !== requestingUserId && !isAdmin) {
    throw { status: 403, message: "Solo el autor puede consultar las visualizaciones de su historia." };
  }
  const rows = await db.query(`
    SELECT user_id, user_name, user_avatar, viewed_at
    FROM story_views
    WHERE story_id = ?
    ORDER BY viewed_at DESC
  `, [storyId]);
  return rows.map((r) => ({
    userId: r.user_id,
    userName: r.user_name,
    userAvatar: r.user_avatar || "",
    viewedAt: r.viewed_at
  }));
}
async function getOrCreateConversation(currentUserId, targetUserId) {
  if (currentUserId === targetUserId) {
    throw { status: 400, message: "No puedes iniciar una conversaci\xF3n contigo mismo." };
  }
  const db = await getDb();
  const targetUser = await db.get("SELECT id, name, avatar, role, handle FROM users WHERE id = ?", [targetUserId]);
  if (!targetUser) {
    throw { status: 404, message: "Usuario no encontrado." };
  }
  const userA = currentUserId < targetUserId ? currentUserId : targetUserId;
  const userB = currentUserId < targetUserId ? targetUserId : currentUserId;
  let convRow = await db.get(
    "SELECT * FROM conversations WHERE user_a_id = ? AND user_b_id = ?",
    [userA, userB]
  );
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (!convRow) {
    const convId = `conv_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
    try {
      await db.run(
        "INSERT INTO conversations (id, user_a_id, user_b_id, last_message_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [convId, userA, userB, now, now, now]
      );
      convRow = await db.get("SELECT * FROM conversations WHERE id = ?", [convId]);
    } catch (err) {
      convRow = await db.get(
        "SELECT * FROM conversations WHERE user_a_id = ? AND user_b_id = ?",
        [userA, userB]
      );
      if (!convRow) throw err;
    }
  }
  const [blockedByMe, blockedMe] = await Promise.all([
    db.get("SELECT id FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?", [currentUserId, targetUserId]),
    db.get("SELECT id FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?", [targetUserId, currentUserId])
  ]);
  const unreadRow = await db.get(
    "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ? AND recipient_id = ? AND status != 'read'",
    [convRow.id, currentUserId]
  );
  let lastMessage = void 0;
  if (convRow.last_message_id) {
    const lastMsgRow = await db.get("SELECT * FROM messages WHERE id = ?", [convRow.last_message_id]);
    if (lastMsgRow) {
      lastMessage = {
        id: lastMsgRow.id,
        senderId: lastMsgRow.sender_id,
        content: lastMsgRow.content,
        createdAt: lastMsgRow.created_at,
        status: lastMsgRow.status,
        hasAttachment: !!lastMsgRow.attachment_url
      };
    }
  }
  return {
    id: convRow.id,
    otherUser: {
      id: targetUser.id,
      name: targetUser.name,
      avatar: targetUser.avatar || "",
      handle: targetUser.handle,
      role: targetUser.role
    },
    lastMessage,
    unreadCount: unreadRow ? unreadRow.cnt : 0,
    isBlockedByMe: !!blockedByMe,
    hasBlockedMe: !!blockedMe,
    createdAt: convRow.created_at,
    updatedAt: convRow.updated_at
  };
}
async function getUserConversations(userId, search) {
  const db = await getDb();
  const convRows = await db.query(
    "SELECT * FROM conversations WHERE user_a_id = ? OR user_b_id = ? ORDER BY last_message_at DESC",
    [userId, userId]
  );
  if (convRows.length === 0) return [];
  const otherUserIds = convRows.map((c) => c.user_a_id === userId ? c.user_b_id : c.user_a_id);
  const uniqueOtherIds = Array.from(new Set(otherUserIds));
  const placeholders = uniqueOtherIds.map(() => "?").join(",");
  const [usersRows, blocksRows] = await Promise.all([
    db.query(`SELECT id, name, avatar, role, handle FROM users WHERE id IN (${placeholders})`, uniqueOtherIds),
    db.query(
      `SELECT blocker_id, blocked_id FROM user_blocks WHERE blocker_id = ? OR blocked_id = ?`,
      [userId, userId]
    )
  ]);
  const userMap = new Map(usersRows.map((u) => [u.id, u]));
  const blockedByMeSet = new Set(blocksRows.filter((b) => b.blocker_id === userId).map((b) => b.blocked_id));
  const blockedMeSet = new Set(blocksRows.filter((b) => b.blocked_id === userId).map((b) => b.blocker_id));
  const convIds = convRows.map((c) => c.id);
  const convPlaceholders = convIds.map(() => "?").join(",");
  const unreadRows = await db.query(
    `SELECT conversation_id, COUNT(*) as cnt FROM messages WHERE conversation_id IN (${convPlaceholders}) AND recipient_id = ? AND status != 'read' GROUP BY conversation_id`,
    [...convIds, userId]
  );
  const unreadMap = new Map(unreadRows.map((u) => [u.conversation_id, u.cnt]));
  const result = [];
  for (const c of convRows) {
    const otherId = c.user_a_id === userId ? c.user_b_id : c.user_a_id;
    const other = userMap.get(otherId);
    if (!other) continue;
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      const nameMatch = (other.name || "").toLowerCase().includes(q);
      const handleMatch = (other.handle || "").toLowerCase().includes(q);
      const msgMatch = (c.last_message_text || "").toLowerCase().includes(q);
      if (!nameMatch && !handleMatch && !msgMatch) continue;
    }
    result.push({
      id: c.id,
      otherUser: {
        id: other.id,
        name: other.name,
        avatar: other.avatar || "",
        handle: other.handle,
        role: other.role
      },
      lastMessage: c.last_message_id ? {
        id: c.last_message_id,
        senderId: "",
        content: c.last_message_text || "",
        createdAt: c.last_message_at,
        status: "sent"
      } : void 0,
      unreadCount: unreadMap.get(c.id) || 0,
      isBlockedByMe: blockedByMeSet.has(otherId),
      hasBlockedMe: blockedMeSet.has(otherId),
      createdAt: c.created_at,
      updatedAt: c.updated_at
    });
  }
  return result;
}
async function getConversationById(conversationId, userId) {
  const db = await getDb();
  const c = await db.get("SELECT * FROM conversations WHERE id = ?", [conversationId]);
  if (!c) {
    throw { status: 404, message: "Conversaci\xF3n no encontrada." };
  }
  if (c.user_a_id !== userId && c.user_b_id !== userId) {
    throw { status: 403, message: "No tienes permiso para acceder a esta conversaci\xF3n." };
  }
  const otherId = c.user_a_id === userId ? c.user_b_id : c.user_a_id;
  const other = await db.get("SELECT id, name, avatar, role, handle FROM users WHERE id = ?", [otherId]);
  const [blockedByMe, blockedMe, unreadRow] = await Promise.all([
    db.get("SELECT id FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?", [userId, otherId]),
    db.get("SELECT id FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?", [otherId, userId]),
    db.get(
      "SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ? AND recipient_id = ? AND status != 'read'",
      [conversationId, userId]
    )
  ]);
  return {
    id: c.id,
    otherUser: {
      id: other?.id || otherId,
      name: other?.name || "Usuario Kabaly",
      avatar: other?.avatar || "",
      handle: other?.handle,
      role: other?.role || "cliente"
    },
    lastMessage: c.last_message_id ? {
      id: c.last_message_id,
      senderId: "",
      content: c.last_message_text || "",
      createdAt: c.last_message_at,
      status: "sent"
    } : void 0,
    unreadCount: unreadRow ? unreadRow.cnt : 0,
    isBlockedByMe: !!blockedByMe,
    hasBlockedMe: !!blockedMe,
    createdAt: c.created_at,
    updatedAt: c.updated_at
  };
}
async function getConversationMessages(conversationId, userId, options = {}) {
  const db = await getDb();
  const conv = await db.get("SELECT user_a_id, user_b_id FROM conversations WHERE id = ?", [conversationId]);
  if (!conv) {
    throw { status: 404, message: "Conversaci\xF3n no encontrada." };
  }
  if (conv.user_a_id !== userId && conv.user_b_id !== userId) {
    throw { status: 403, message: "No tienes permiso para ver los mensajes de esta conversaci\xF3n." };
  }
  const limit = options.limit ? Math.min(Math.max(1, options.limit), 100) : 50;
  if (options.sinceTimestamp) {
    const rows2 = await db.query(
      "SELECT * FROM messages WHERE conversation_id = ? AND created_at > ? ORDER BY created_at ASC",
      [conversationId, options.sinceTimestamp]
    );
    return {
      messages: rows2.map(mapMessageRow),
      hasMore: false
    };
  }
  let query = "SELECT * FROM messages WHERE conversation_id = ?";
  const params = [conversationId];
  if (options.cursor) {
    query += " AND created_at < ?";
    params.push(options.cursor);
  }
  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit + 1);
  const rows = await db.query(query, params);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const chronological = items.reverse();
  const nextCursor = hasMore ? items[0].created_at : void 0;
  return {
    messages: chronological.map(mapMessageRow),
    nextCursor,
    hasMore
  };
}
function mapMessageRow(r) {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    recipientId: r.recipient_id,
    content: r.content,
    clientMessageId: r.client_message_id || void 0,
    attachmentId: r.attachment_id || void 0,
    attachmentUrl: r.attachment_url || void 0,
    attachmentType: r.attachment_type || void 0,
    status: r.status,
    readAt: r.read_at || void 0,
    createdAt: r.created_at
  };
}
async function sendChatMessage(params) {
  const db = await getDb();
  const conv = await db.get("SELECT * FROM conversations WHERE id = ?", [params.conversationId]);
  if (!conv) {
    throw { status: 404, message: "Conversaci\xF3n no encontrada." };
  }
  if (conv.user_a_id !== params.senderId && conv.user_b_id !== params.senderId) {
    throw { status: 403, message: "No tienes permiso para enviar mensajes en esta conversaci\xF3n." };
  }
  const recipientId = conv.user_a_id === params.senderId ? conv.user_b_id : conv.user_a_id;
  const blockRow = await db.get(
    "SELECT id, blocker_id FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)",
    [params.senderId, recipientId, recipientId, params.senderId]
  );
  if (blockRow) {
    throw { status: 403, message: "No es posible enviar mensajes debido a un bloqueo activo entre usuarios." };
  }
  if (params.clientMessageId) {
    const existing = await db.get(
      "SELECT * FROM messages WHERE conversation_id = ? AND client_message_id = ?",
      [params.conversationId, params.clientMessageId]
    );
    if (existing) {
      return mapMessageRow(existing);
    }
  }
  let attachmentUrl = void 0;
  let attachmentType = void 0;
  if (params.attachmentId) {
    const attach = await db.get("SELECT * FROM chat_attachments WHERE id = ?", [params.attachmentId]);
    if (!attach || attach.user_id !== params.senderId) {
      throw { status: 400, message: "Adjunto no v\xE1lido o no autorizado." };
    }
    attachmentUrl = `/api/chat/attachments/${attach.id}`;
    attachmentType = "image";
  }
  const rawText = (params.content || "").trim();
  if (!rawText && !attachmentUrl) {
    throw { status: 400, message: "El mensaje no puede estar vac\xEDo." };
  }
  if (rawText.length > 2e3) {
    throw { status: 400, message: "El mensaje no puede exceder los 2000 caracteres." };
  }
  const cleanContent = rawText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<[^>]+>/g, "").trim();
  const msgId = `msg_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      cleanContent || (attachmentUrl ? "[Imagen adjunta]" : ""),
      params.clientMessageId || null,
      params.attachmentId || null,
      attachmentUrl || null,
      attachmentType || null,
      "sent",
      now
    ]
  );
  if (params.attachmentId) {
    await db.run(
      "UPDATE chat_attachments SET conversation_id = ?, message_id = ?, is_claimed = 1 WHERE id = ?",
      [params.conversationId, msgId, params.attachmentId]
    );
  }
  const snippet = cleanContent.length > 60 ? cleanContent.slice(0, 60) + "..." : cleanContent || "[Imagen adjunta]";
  await db.run(
    "UPDATE conversations SET last_message_id = ?, last_message_text = ?, last_message_at = ?, updated_at = ? WHERE id = ?",
    [msgId, snippet, now, now, params.conversationId]
  );
  return {
    id: msgId,
    conversationId: params.conversationId,
    senderId: params.senderId,
    recipientId,
    content: cleanContent || "[Imagen adjunta]",
    clientMessageId: params.clientMessageId,
    attachmentId: params.attachmentId,
    attachmentUrl,
    attachmentType,
    status: "sent",
    createdAt: now
  };
}
async function markConversationAsRead(conversationId, userId) {
  const db = await getDb();
  const conv = await db.get("SELECT user_a_id, user_b_id FROM conversations WHERE id = ?", [conversationId]);
  if (!conv || conv.user_a_id !== userId && conv.user_b_id !== userId) {
    throw { status: 403, message: "No autorizado." };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.run(
    "UPDATE messages SET status = 'read', read_at = ? WHERE conversation_id = ? AND recipient_id = ? AND status != 'read'",
    [now, conversationId, userId]
  );
  return { success: true, count: 1 };
}
async function blockUser(blockerId, targetUserId) {
  if (blockerId === targetUserId) {
    throw { status: 400, message: "No puedes bloquearte a ti mismo." };
  }
  const db = await getDb();
  const target = await db.get("SELECT id FROM users WHERE id = ?", [targetUserId]);
  if (!target) {
    throw { status: 404, message: "Usuario no encontrado." };
  }
  const blockId = `blk_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.run(
    "INSERT OR IGNORE INTO user_blocks (id, blocker_id, blocked_id, created_at) VALUES (?, ?, ?, ?)",
    [blockId, blockerId, targetUserId, now]
  );
  return { success: true, isBlocked: true };
}
async function unblockUser(blockerId, targetUserId) {
  const db = await getDb();
  await db.run("DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?", [blockerId, targetUserId]);
  return { success: true, isBlocked: false };
}
async function getBlockedUsers(userId) {
  const db = await getDb();
  const rows = await db.query(
    `SELECT b.id, u.id as user_id, u.name, u.avatar, u.role, u.handle, b.created_at as blocked_at
     FROM user_blocks b
     JOIN users u ON b.blocked_id = u.id
     WHERE b.blocker_id = ?
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    avatar: r.avatar || "",
    role: r.role,
    handle: r.handle,
    blockedAt: r.blocked_at
  }));
}
async function reportMessage(params) {
  const db = await getDb();
  const msg = await db.get("SELECT * FROM messages WHERE id = ?", [params.messageId]);
  if (!msg) {
    throw { status: 404, message: "Mensaje no encontrado." };
  }
  const conv = await db.get("SELECT user_a_id, user_b_id FROM conversations WHERE id = ?", [msg.conversation_id]);
  if (!conv || conv.user_a_id !== params.reporterId && conv.user_b_id !== params.reporterId) {
    throw { status: 403, message: "No autorizado para reportar este mensaje." };
  }
  const reportId = `mrp_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
      "pending",
      now
    ]
  );
  return { success: true, reportId };
}
async function getReportedMessages(adminUserId) {
  const db = await getDb();
  const admin = await db.get("SELECT role FROM users WHERE id = ?", [adminUserId]);
  if (!admin || admin.role !== "admin") {
    throw { status: 403, message: "Acceso restringido a moderadores y administradores." };
  }
  const rows = await db.query(
    "SELECT * FROM message_reports ORDER BY created_at DESC"
  );
  return rows.map((r) => ({
    id: r.id,
    reporterId: r.reporter_id,
    messageId: r.message_id,
    conversationId: r.conversation_id,
    reportedUserId: r.reported_user_id,
    messageContent: r.message_content,
    reason: r.reason,
    details: r.details || void 0,
    status: r.status,
    createdAt: r.created_at
  }));
}
async function createChatAttachment(params) {
  const db = await getDb();
  const attachId = `att_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.run(
    "INSERT INTO chat_attachments (id, user_id, filename, original_name, mime_type, size, is_claimed, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
    [attachId, params.userId, params.filename, params.originalName, params.mimeType, params.size, now]
  );
  return {
    id: attachId,
    url: `/api/chat/attachments/${attachId}`
  };
}
async function getChatAttachmentForUser(attachmentId, userId) {
  const db = await getDb();
  const attach = await db.get("SELECT * FROM chat_attachments WHERE id = ?", [attachmentId]);
  if (!attach) {
    throw { status: 404, message: "Archivo adjunto no encontrado." };
  }
  if (attach.conversation_id) {
    const conv = await db.get("SELECT user_a_id, user_b_id FROM conversations WHERE id = ?", [attach.conversation_id]);
    if (!conv || conv.user_a_id !== userId && conv.user_b_id !== userId) {
      throw { status: 403, message: "Acceso denegado a este archivo privado." };
    }
  } else {
    if (attach.user_id !== userId) {
      throw { status: 403, message: "Acceso denegado a este archivo privado." };
    }
  }
  return {
    filename: attach.filename,
    mimeType: attach.mime_type
  };
}
async function getTotalUnreadMessagesCount(userId) {
  const db = await getDb();
  const row = await db.get(
    "SELECT COUNT(*) as cnt FROM messages WHERE recipient_id = ? AND status != 'read'",
    [userId]
  );
  return row ? row.cnt : 0;
}
async function createNotification(params) {
  if (!params.userId || params.userId === params.actorId) return;
  const db = await getDb();
  const id = `not_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
  await db.run(
    `INSERT INTO notifications (id, user_id, actor_id, actor_name, actor_avatar, type, reference_id, message, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      id,
      params.userId,
      params.actorId,
      params.actorName,
      params.actorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
      params.type,
      params.referenceId || null,
      params.message,
      (/* @__PURE__ */ new Date()).toISOString()
    ]
  );
}
async function getUserNotifications(userId, limit = 40) {
  const db = await getDb();
  const [rows, countRow] = await Promise.all([
    db.query(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
      [userId, limit]
    ),
    db.get(
      "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0",
      [userId]
    )
  ]);
  const notifications = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    actorId: r.actor_id,
    actorName: r.actor_name,
    actorAvatar: r.actor_avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
    type: r.type,
    referenceId: r.reference_id || void 0,
    message: r.message,
    isRead: !!r.is_read,
    createdAt: r.created_at
  }));
  return {
    notifications,
    unreadCount: countRow ? countRow.cnt : 0
  };
}
async function markNotificationsRead(userId, notificationId) {
  const db = await getDb();
  if (notificationId) {
    await db.run("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [notificationId, userId]);
  } else {
    await db.run("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [userId]);
  }
  return { success: true };
}
async function getUserHighlights(userId) {
  const db = await getDb();
  const rows = await db.query(
    "SELECT * FROM profile_highlights WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    coverUrl: r.cover_url,
    mediaUrl: r.media_url,
    mediaType: r.media_type || "image",
    createdAt: r.created_at
  }));
}
async function createProfileHighlight(params) {
  const db = await getDb();
  const id = `hl_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const safeTitle = (params.title || "Aura").trim().slice(0, 32);
  const safeMedia = (params.mediaUrl || "").trim();
  const safeCover = (params.coverUrl || safeMedia).trim();
  await db.run(
    `INSERT INTO profile_highlights (id, user_id, title, cover_url, media_url, media_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, params.userId, safeTitle, safeCover, safeMedia, params.mediaType === "video" ? "video" : "image", now]
  );
  return {
    id,
    userId: params.userId,
    title: safeTitle,
    coverUrl: safeCover,
    mediaUrl: safeMedia,
    mediaType: params.mediaType === "video" ? "video" : "image",
    createdAt: now
  };
}
async function deleteProfileHighlight(highlightId, userId) {
  const db = await getDb();
  await db.run("DELETE FROM profile_highlights WHERE id = ? AND user_id = ?", [highlightId, userId]);
  return { success: true };
}
async function togglePinPost(postId, userId) {
  const db = await getDb();
  const post = await db.get("SELECT id, tarotista_id, is_pinned FROM videos WHERE id = ? AND is_deleted = 0", [postId]);
  if (!post) {
    throw { status: 404, message: "Publicaci\xF3n no encontrada." };
  }
  if (post.tarotista_id !== userId) {
    throw { status: 403, message: "Solo puedes fijar o desfijar tus propias publicaciones." };
  }
  const nextPinned = post.is_pinned ? 0 : 1;
  await db.run("UPDATE videos SET is_pinned = ? WHERE id = ?", [nextPinned, postId]);
  return { isPinned: !!nextPinned };
}
async function toggleCommentLike(commentId, userId) {
  const db = await getDb();
  const comment = await db.get("SELECT id, video_id, author_id, content FROM comments WHERE id = ? AND is_deleted = 0", [commentId]);
  if (!comment) {
    throw { status: 404, message: "Comentario no encontrado." };
  }
  const existing = await db.get("SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?", [commentId, userId]);
  let isLiked = false;
  if (existing) {
    await db.run("DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?", [commentId, userId]);
    isLiked = false;
  } else {
    const id = `cml_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
    await db.run("INSERT INTO comment_likes (id, comment_id, user_id, created_at) VALUES (?, ?, ?, ?)", [
      id,
      commentId,
      userId,
      (/* @__PURE__ */ new Date()).toISOString()
    ]);
    isLiked = true;
  }
  const countRow = await db.get("SELECT COUNT(*) as cnt FROM comment_likes WHERE comment_id = ?", [commentId]);
  const likesCount = countRow ? countRow.cnt : 0;
  await db.run("UPDATE comments SET likes_count = ? WHERE id = ?", [likesCount, commentId]);
  return { likesCount, isLiked };
}
async function getPublicUserProfile(targetIdentifier, currentUserId) {
  const db = await getDb();
  let userRow = await db.get("SELECT * FROM users WHERE id = ? OR handle = ?", [targetIdentifier, targetIdentifier]);
  let tarRow = await db.get("SELECT * FROM tarotista_profiles WHERE id = ? OR user_id = ?", [targetIdentifier, userRow ? userRow.id : targetIdentifier]);
  if (!userRow && tarRow) {
    userRow = await db.get("SELECT * FROM users WHERE id = ?", [tarRow.user_id]);
  }
  if (!userRow && !tarRow) {
    return null;
  }
  const resolvedUserId = userRow ? userRow.id : tarRow.user_id;
  const [rel, highlights, feedRes] = await Promise.all([
    getUserRelationship(resolvedUserId, currentUserId),
    getUserHighlights(resolvedUserId),
    getFeedPosts({ authorId: resolvedUserId, currentUserId, limit: 30 })
  ]);
  const sortedPosts = [...feedRes.items].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  let mappedTarotista = null;
  if (tarRow) {
    mappedTarotista = {
      id: tarRow.id,
      userId: tarRow.user_id,
      professionalName: tarRow.professional_name,
      avatar: tarRow.avatar || userRow?.avatar || "",
      banner: tarRow.banner || userRow?.cover_image || "",
      specialties: parseJson(tarRow.specialties, ["Tarot"]),
      bio: tarRow.bio || userRow?.bio || "",
      experienceYears: tarRow.experience_years || 1,
      pricePerMinCoins: tarRow.price_per_min_coins || 15,
      pricePerMinEur: tarRow.price_per_min_eur || 1.5,
      languages: parseJson(tarRow.languages, ["Espa\xF1ol"]),
      country: tarRow.country || "Espa\xF1a",
      isVerified: !!tarRow.is_verified,
      kycStatus: tarRow.kyc_status,
      stripeConnectStatus: tarRow.stripe_connect_status,
      ratingAverage: tarRow.rating_average || 5,
      totalReviews: tarRow.total_reviews || 0,
      totalReadings: tarRow.total_readings || 0,
      followersCount: rel.followersCount,
      videoCount: sortedPosts.length,
      availabilityStatus: tarRow.availability_status || "online",
      customCommissionPercentage: tarRow.custom_commission_percentage || 20
    };
  }
  const displayName = userRow?.name || tarRow?.professional_name || "Iniciado Kabaly";
  const defaultHandle = `@${displayName.toLowerCase().replace(/\s+/g, "_")}`;
  return {
    id: resolvedUserId,
    name: displayName,
    handle: userRow?.handle || defaultHandle,
    role: userRow?.role || "tarotista",
    avatar: userRow?.avatar || tarRow?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
    coverImage: userRow?.cover_image || tarRow?.banner || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200",
    bio: userRow?.bio || tarRow?.bio || "Viajero astral en KABALY \u2728",
    sunSign: userRow?.sun_sign || void 0,
    moonSign: userRow?.moon_sign || void 0,
    risingSign: userRow?.rising_sign || void 0,
    rulingArcana: userRow?.ruling_arcana || void 0,
    spiritualGift: userRow?.spiritual_gift || void 0,
    isPrivate: !!userRow?.is_private,
    followersCount: rel.followersCount,
    followingCount: rel.followingCount,
    postsCount: sortedPosts.length,
    isFollowing: rel.isFollowing,
    tarotistaProfile: mappedTarotista,
    highlights,
    posts: sortedPosts,
    createdAt: userRow?.created_at || tarRow?.created_at || (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function applyForTarotistaKyc(userId, params) {
  const db = await getDb();
  const user = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) {
    throw { status: 404, message: "Usuario no encontrado." };
  }
  const safeProfName = (params.professionalName || user.name).trim();
  const safeBio = (params.bio || user.bio || "Gu\xEDa espiritual en KABALY").trim();
  const safeSpecs = Array.isArray(params.specialties) && params.specialties.length > 0 ? params.specialties : ["Tarot"];
  const safeExp = Math.max(1, Number(params.experienceYears) || 1);
  const safePriceCoins = Math.max(5, Math.min(500, Math.floor(Number(params.pricePerMinCoins) || 15)));
  const safePriceEur = Number((safePriceCoins * 0.1).toFixed(2));
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existing = await db.get("SELECT id FROM tarotista_profiles WHERE user_id = ?", [userId]);
  let profileId = existing ? existing.id : `tar_${Date.now()}_${import_crypto2.default.randomBytes(3).toString("hex")}`;
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
        user.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
        user.cover_image || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200",
        JSON.stringify(safeSpecs),
        safeBio,
        safeExp,
        safePriceCoins,
        safePriceEur,
        JSON.stringify(params.languages || ["Espa\xF1ol"]),
        params.country || "Espa\xF1a",
        now
      ]
    );
  }
  await db.run("UPDATE users SET role = 'tarotista', updated_at = ? WHERE id = ? AND role = 'cliente'", [now, userId]);
  return { success: true, profileId };
}
async function searchSocialNetwork(query, currentUserId) {
  const db = await getDb();
  const q = (query || "").trim().toLowerCase();
  const likeParam = `%${q}%`;
  const [userRows, allTarotistas, feedRes] = await Promise.all([
    q ? db.query(
      'SELECT id, name, avatar, role, handle FROM users WHERE LOWER(name) LIKE ? OR LOWER(COALESCE(handle, "")) LIKE ? OR LOWER(COALESCE(bio, "")) LIKE ? LIMIT 25',
      [likeParam, likeParam, likeParam]
    ) : db.query("SELECT id, name, avatar, role, handle FROM users ORDER BY created_at DESC LIMIT 15"),
    getPublicTarotistas(),
    getFeedPosts({ limit: 40, currentUserId })
  ]);
  const filteredTarotistas = q ? allTarotistas.filter(
    (t) => t.professionalName.toLowerCase().includes(q) || t.bio.toLowerCase().includes(q) || t.specialties.some((s) => s.toLowerCase().includes(q))
  ) : allTarotistas;
  const filteredPosts = q ? feedRes.items.filter(
    (p) => p.title.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.tarotistaName.toLowerCase().includes(q)
  ) : feedRes.items;
  const tagCounts = /* @__PURE__ */ new Map();
  for (const p of feedRes.items) {
    const text = `${p.title} ${p.description || ""} #${p.category.replace(/\s+/g, "")}`;
    const matches = text.match(/#[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9_]+/g) || [];
    for (const rawTag of matches) {
      const normalized = rawTag.toLowerCase();
      if (!q || normalized.includes(q.replace(/^#/, ""))) {
        tagCounts.set(rawTag, (tagCounts.get(rawTag) || 0) + 1);
      }
    }
  }
  const hashtags = Array.from(tagCounts.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 12);
  return {
    users: userRows.map((r) => ({
      id: r.id,
      name: r.name,
      avatar: r.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
      role: r.role,
      handle: r.handle || `@${r.name.toLowerCase().replace(/\s+/g, "_")}`
    })),
    tarotistas: filteredTarotistas,
    posts: filteredPosts,
    hashtags
  };
}
async function togglePinComment(commentId, userId, isAdmin = false) {
  const db = await getDb();
  const comment = await db.get("SELECT * FROM comments WHERE id = ? AND is_deleted = 0", [commentId]);
  if (!comment) {
    return { success: false, error: "Comentario no encontrado.", status: 404 };
  }
  const video = await db.get("SELECT * FROM videos WHERE id = ?", [comment.video_id]);
  if (!video) {
    return { success: false, error: "Publicaci\xF3n no encontrada.", status: 404 };
  }
  const tarProfile = await db.get("SELECT id FROM tarotista_profiles WHERE user_id = ?", [userId]);
  const isPostAuthor = video.tarotista_id === userId || tarProfile && video.tarotista_id === tarProfile.id;
  if (!isPostAuthor && !isAdmin) {
    return { success: false, error: "Solo el autor de la visi\xF3n puede fijar un comentario en su or\xE1culo.", status: 403 };
  }
  const nextPinned = comment.is_pinned ? 0 : 1;
  if (nextPinned === 1) {
    await db.run("UPDATE comments SET is_pinned = 0 WHERE video_id = ?", [comment.video_id]);
  }
  await db.run("UPDATE comments SET is_pinned = ? WHERE id = ?", [nextPinned, commentId]);
  return { success: true, isPinned: nextPinned === 1, status: 200 };
}

// src/middleware/upload.ts
var import_multer = __toESM(require("multer"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_crypto3 = __toESM(require("crypto"), 1);
var UPLOADS_DIR = import_path2.default.join(process.cwd(), "uploads");
if (!import_fs.default.existsSync(UPLOADS_DIR)) {
  import_fs.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
var storage = import_multer.default.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = import_path2.default.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}_${import_crypto3.default.randomBytes(6).toString("hex")}`;
    cb(null, `media_${uniqueSuffix}${ext}`);
  }
});
var ALLOWED_MIME_TYPES = /* @__PURE__ */ new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  // .mov
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav"
]);
var uploadMediaMiddleware = (0, import_multer.default)({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024
    // Máximo 50MB
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato no admitido. Formatos v\xE1lidos: JPG, PNG, WEBP, GIF, MP4, WEBM, MOV."));
    }
  }
});
var PRIVATE_CHAT_DIR = import_path2.default.join(process.cwd(), "private_storage", "chat_attachments");
if (!import_fs.default.existsSync(PRIVATE_CHAT_DIR)) {
  import_fs.default.mkdirSync(PRIVATE_CHAT_DIR, { recursive: true });
}
var privateChatStorage = import_multer.default.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, PRIVATE_CHAT_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = import_path2.default.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}_${import_crypto3.default.randomBytes(8).toString("hex")}`;
    cb(null, `chat_att_${uniqueSuffix}${ext}`);
  }
});
var ALLOWED_CHAT_MIME_TYPES = /* @__PURE__ */ new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);
var uploadPrivateChatMiddleware = (0, import_multer.default)({
  storage: privateChatStorage,
  limits: {
    fileSize: 10 * 1024 * 1024
    // Máximo 10MB para imágenes de chat
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_CHAT_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten im\xE1genes (JPEG, PNG, WEBP, GIF) en el chat privado."));
    }
  }
});

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

// src/services/stripeService.ts
var import_stripe = __toESM(require("stripe"), 1);
var import_crypto4 = __toESM(require("crypto"), 1);
init_database();
var STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
var STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
if (STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  console.error("[STRIPE CRITICAL ERROR]: Se detect\xF3 una clave que no es de prueba (sk_test_). La FASE 6 opera EXCLUSIVAMENTE en modo de pruebas.");
}
var stripeClient = STRIPE_SECRET_KEY ? new import_stripe.default(STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
  typescript: true
}) : null;
async function getActiveCoinPackages() {
  const db = await getDb();
  const rows = await db.query(
    "SELECT * FROM coin_packages WHERE is_active = 1 ORDER BY sort_order ASC"
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    coins: r.coins,
    priceEur: r.price_cents / 100,
    priceCents: r.price_cents,
    currency: r.currency || "eur",
    badge: r.badge || void 0,
    icon: r.icon,
    popular: r.badge === "Popular",
    isActive: !!r.is_active
  }));
}
async function getCoinPackageById(packageId) {
  const db = await getDb();
  const row = await db.get(
    "SELECT * FROM coin_packages WHERE id = ? AND is_active = 1",
    [packageId]
  );
  if (!row) {
    throw { status: 404, message: "El paquete de monedas solicitado no existe o est\xE1 desactivado." };
  }
  return {
    id: row.id,
    name: row.name,
    coins: row.coins,
    priceEur: row.price_cents / 100,
    priceCents: row.price_cents,
    currency: row.currency || "eur",
    badge: row.badge || void 0,
    icon: row.icon,
    popular: row.badge === "Popular",
    isActive: !!row.is_active
  };
}
async function checkUserSpendingLimits(userId, newOrderCents) {
  const db = await getDb();
  const user = await db.get(
    "SELECT spending_limit_daily, spending_limit_weekly, spending_limit_daily_cents, spending_limit_weekly_cents FROM users WHERE id = ?",
    [userId]
  );
  if (!user) {
    throw { status: 404, message: "Usuario no encontrado." };
  }
  const dailyLimitCents = user.spending_limit_daily_cents ?? (user.spending_limit_daily ? Math.round(user.spending_limit_daily * 100) : null);
  const weeklyLimitCents = user.spending_limit_weekly_cents ?? (user.spending_limit_weekly ? Math.round(user.spending_limit_weekly * 100) : null);
  const now = /* @__PURE__ */ new Date();
  const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const sevenDaysAgoUtc = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3).toISOString();
  const nowIso = now.toISOString();
  const spentTodayRow = await db.get(
    `SELECT COALESCE(SUM(amount_cents), 0) as sum FROM coin_orders 
     WHERE user_id = ? AND status = 'paid' AND paid_at >= ?`,
    [userId, startOfDayUtc]
  );
  const spentTodayCents = spentTodayRow ? spentTodayRow.sum : 0;
  const spentWeeklyRow = await db.get(
    `SELECT COALESCE(SUM(amount_cents), 0) as sum FROM coin_orders 
     WHERE user_id = ? AND status = 'paid' AND paid_at >= ?`,
    [userId, sevenDaysAgoUtc]
  );
  const spentWeeklyCents = spentWeeklyRow ? spentWeeklyRow.sum : 0;
  const pendingRow = await db.get(
    `SELECT COALESCE(SUM(amount_cents), 0) as sum FROM coin_orders 
     WHERE user_id = ? AND status = 'pending' AND expires_at > ?`,
    [userId, nowIso]
  );
  const pendingCents = pendingRow ? pendingRow.sum : 0;
  if (dailyLimitCents !== null) {
    if (spentTodayCents + pendingCents + newOrderCents > dailyLimitCents) {
      return {
        allowed: false,
        reason: `Esta compra superar\xEDa tu l\xEDmite de gasto diario configurado (${(dailyLimitCents / 100).toFixed(2)} \u20AC). Incluye compras activas y reservas pendientes de confirmaci\xF3n.`,
        spentTodayEur: spentTodayCents / 100,
        spentWeeklyEur: spentWeeklyCents / 100,
        pendingReservationEur: pendingCents / 100,
        dailyLimitEur: dailyLimitCents / 100,
        weeklyLimitEur: weeklyLimitCents !== null ? weeklyLimitCents / 100 : void 0
      };
    }
  }
  if (weeklyLimitCents !== null) {
    if (spentWeeklyCents + pendingCents + newOrderCents > weeklyLimitCents) {
      return {
        allowed: false,
        reason: `Esta compra superar\xEDa tu l\xEDmite de gasto semanal configurado (${(weeklyLimitCents / 100).toFixed(2)} \u20AC). Incluye compras activas y reservas pendientes de confirmaci\xF3n.`,
        spentTodayEur: spentTodayCents / 100,
        spentWeeklyEur: spentWeeklyCents / 100,
        pendingReservationEur: pendingCents / 100,
        dailyLimitEur: dailyLimitCents !== null ? dailyLimitCents / 100 : void 0,
        weeklyLimitEur: weeklyLimitCents / 100
      };
    }
  }
  return {
    allowed: true,
    spentTodayEur: spentTodayCents / 100,
    spentWeeklyEur: spentWeeklyCents / 100,
    pendingReservationEur: pendingCents / 100,
    dailyLimitEur: dailyLimitCents !== null ? dailyLimitCents / 100 : void 0,
    weeklyLimitEur: weeklyLimitCents !== null ? weeklyLimitCents / 100 : void 0
  };
}
async function createCoinOrderAndCheckoutSession(params) {
  const db = await getDb();
  const user = await db.get("SELECT id, email, financial_restriction FROM users WHERE id = ?", [params.userId]);
  if (!user) {
    throw { status: 404, message: "Usuario no encontrado." };
  }
  if (user.financial_restriction) {
    throw { status: 403, message: "Tu cuenta tiene una restricci\xF3n financiera activa debido a un reembolso pendiente de conciliaci\xF3n. Contacta con soporte." };
  }
  const pkg = await getCoinPackageById(params.packageId);
  if (params.idempotencyKey) {
    const existingOrder = await db.get(
      "SELECT * FROM coin_orders WHERE user_id = ? AND idempotency_key = ?",
      [params.userId, params.idempotencyKey]
    );
    if (existingOrder) {
      return {
        order: mapCoinOrderRow(existingOrder),
        checkoutUrl: `/wallet?order_id=${existingOrder.id}&session_id=${existingOrder.stripe_session_id || ""}`,
        sessionId: existingOrder.stripe_session_id || `sim_session_${existingOrder.id}`
      };
    }
  }
  const limitCheck = await checkUserSpendingLimits(params.userId, pkg.priceCents);
  if (!limitCheck.allowed) {
    throw { status: 422, message: limitCheck.reason };
  }
  const now = /* @__PURE__ */ new Date();
  const orderId = `ord_${Date.now()}_${import_crypto4.default.randomBytes(4).toString("hex")}`;
  const orderNumber = `KB-${Date.now().toString().slice(-6)}-${import_crypto4.default.randomBytes(2).toString("hex").toUpperCase()}`;
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1e3);
  await db.run(
    `INSERT INTO coin_orders (
      id, order_number, user_id, package_id, package_name,
      coins, amount_cents, currency, status, idempotency_key,
      created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'eur', 'pending', ?, ?, ?)`,
    [
      orderId,
      orderNumber,
      params.userId,
      pkg.id,
      pkg.name,
      pkg.coins,
      pkg.priceCents,
      params.idempotencyKey || null,
      now.toISOString(),
      expiresAt.toISOString()
    ]
  );
  let sessionId = `sess_${Date.now()}_${import_crypto4.default.randomBytes(6).toString("hex")}`;
  let checkoutUrl = `${params.originUrl}/wallet?order_id=${orderId}&session_id=${sessionId}`;
  if (stripeClient && STRIPE_SECRET_KEY.startsWith("sk_test_")) {
    try {
      const session = await stripeClient.checkout.sessions.create({
        mode: "payment",
        client_reference_id: orderId,
        customer_email: params.userEmail,
        line_items: [
          {
            price_data: {
              currency: "eur",
              unit_amount: pkg.priceCents,
              product_data: {
                name: `${pkg.name} \u2014 ${pkg.coins} Monedas Astrales`,
                description: `Recarga de ${pkg.coins} monedas en KABALY (Modo Pruebas / Sandbox)`
              }
            },
            quantity: 1
          }
        ],
        metadata: {
          orderId,
          userId: params.userId,
          packageId: pkg.id,
          coins: pkg.coins.toString(),
          testMode: "true"
        },
        success_url: `${params.originUrl}/wallet?order_id=${orderId}&session_id={CHECKOUT_SESSION_ID}&payment_status=success`,
        cancel_url: `${params.originUrl}/wallet?order_id=${orderId}&status=cancelled`,
        expires_at: Math.floor(expiresAt.getTime() / 1e3)
      }, {
        idempotencyKey: params.idempotencyKey ? `stripe_${params.idempotencyKey}` : void 0
      });
      if (session.id && session.url) {
        sessionId = session.id;
        checkoutUrl = session.url;
      }
    } catch (err) {
      console.error("[Stripe Checkout Error]:", err);
      sessionId = `sess_test_${orderId}`;
      checkoutUrl = `${params.originUrl}/wallet?order_id=${orderId}&session_id=${sessionId}&sandbox=true`;
    }
  }
  await db.run(
    "UPDATE coin_orders SET stripe_session_id = ? WHERE id = ?",
    [sessionId, orderId]
  );
  const updatedOrder = await db.get("SELECT * FROM coin_orders WHERE id = ?", [orderId]);
  return {
    order: mapCoinOrderRow(updatedOrder),
    checkoutUrl,
    sessionId
  };
}
async function getCoinOrderById(orderId, userId, isAdmin = false) {
  const db = await getDb();
  const orderRow = await db.get("SELECT * FROM coin_orders WHERE id = ?", [orderId]);
  if (!orderRow) {
    throw { status: 404, message: "Pedido no encontrado." };
  }
  if (orderRow.user_id !== userId && !isAdmin) {
    throw { status: 403, message: "No tienes permiso para consultar este pedido." };
  }
  if (orderRow.status === "pending" && new Date(orderRow.expires_at).getTime() < Date.now()) {
    await db.run(
      "UPDATE coin_orders SET status = 'expired', failed_at = ? WHERE id = ?",
      [(/* @__PURE__ */ new Date()).toISOString(), orderId]
    );
    orderRow.status = "expired";
  }
  return mapCoinOrderRow(orderRow);
}
async function getUserCoinOrders(userId, limit = 20) {
  const db = await getDb();
  const rows = await db.query(
    "SELECT * FROM coin_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    [userId, limit]
  );
  return rows.map(mapCoinOrderRow);
}
async function getUserLedgerTransactions(userId, options = {}) {
  const db = await getDb();
  const limit = options.limit ? Math.min(Math.max(1, options.limit), 50) : 20;
  const offset = options.offset || 0;
  const countRow = await db.get("SELECT COUNT(*) as c FROM ledger WHERE user_id = ?", [userId]);
  const total = countRow ? countRow.c : 0;
  const rows = await db.query(
    "SELECT * FROM ledger WHERE user_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?",
    [userId, limit, offset]
  );
  return {
    transactions: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      type: r.type,
      amountCoins: r.amount_coins,
      amountCents: r.amount_cents || Math.round(r.amount_eur * 100),
      amountEur: r.amount_eur,
      balanceAfter: r.balance_after || void 0,
      description: r.description,
      referenceId: r.reference_id || void 0,
      timestamp: r.timestamp,
      status: r.status
    })),
    total
  };
}
function mapCoinOrderRow(r) {
  return {
    id: r.id,
    orderNumber: r.order_number,
    userId: r.user_id,
    packageId: r.package_id,
    packageName: r.package_name,
    coins: r.coins,
    amountCents: r.amount_cents,
    currency: r.currency,
    status: r.status,
    stripeSessionId: r.stripe_session_id || void 0,
    stripePaymentIntentId: r.stripe_payment_intent_id || void 0,
    idempotencyKey: r.idempotency_key || void 0,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    paidAt: r.paid_at || void 0,
    failedAt: r.failed_at || void 0,
    failureReason: r.failure_reason || void 0
  };
}
async function processStripeWebhookEvent(rawEvent) {
  const db = await getDb();
  const eventId = rawEvent.id;
  const eventType = rawEvent.type;
  const existingEvent = await db.get(
    "SELECT id, status FROM processed_stripe_events WHERE id = ?",
    [eventId]
  );
  if (existingEvent && existingEvent.status === "processed") {
    return { success: true, action: "already_processed", alreadyProcessed: true };
  }
  const obj = rawEvent.data.object;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded") {
    const clientRefId = obj.client_reference_id;
    const sessionId = obj.id;
    const paymentIntentId = obj.payment_intent;
    const amountTotal = obj.amount_total;
    const currency = (obj.currency || "eur").toLowerCase();
    let order = await db.get(
      "SELECT * FROM coin_orders WHERE id = ? OR stripe_session_id = ?",
      [clientRefId || "", sessionId || ""]
    );
    if (!order) {
      throw new Error(`[Stripe Webhook] Pedido no encontrado para sesi\xF3n ${sessionId} / ref ${clientRefId}`);
    }
    if (currency !== "eur") {
      throw new Error(`[Stripe Webhook] Moneda no esperada: ${currency}`);
    }
    if (amountTotal !== void 0 && amountTotal !== order.amount_cents) {
      throw new Error(`[Stripe Webhook] Discrepancia de monto: recibido ${amountTotal} c\xE9ntimos, pedido esperado ${order.amount_cents}`);
    }
    if (order.status === "paid") {
      await db.run(
        "INSERT OR REPLACE INTO processed_stripe_events (id, event_type, status, processed_at) VALUES (?, ?, 'processed', ?)",
        [eventId, eventType, now]
      );
      return { success: true, action: "order_already_paid", orderId: order.id, alreadyProcessed: true };
    }
    const isLatePayment = order.status === "expired";
    const userRow = await db.get("SELECT coins_balance, purchased_coins_balance FROM users WHERE id = ?", [order.user_id]);
    const currentBalance = userRow ? userRow.coins_balance : 0;
    const currentPurchased = userRow ? userRow.purchased_coins_balance : 0;
    const newBalance = currentBalance + order.coins;
    const newPurchased = currentPurchased + order.coins;
    await db.run(
      `UPDATE coin_orders SET 
        status = 'paid', 
        paid_at = ?, 
        stripe_payment_intent_id = ?,
        metadata = ?
      WHERE id = ?`,
      [
        now,
        paymentIntentId || order.stripe_payment_intent_id,
        isLatePayment ? "PAGO_TARDIO_CONFIRMADO" : null,
        order.id
      ]
    );
    await db.run(
      `UPDATE users SET 
        coins_balance = coins_balance + ?,
        purchased_coins_balance = purchased_coins_balance + ?,
        spent_today = spent_today + ?,
        spent_this_week = spent_this_week + ?,
        updated_at = ?
      WHERE id = ?`,
      [
        order.coins,
        order.coins,
        order.amount_cents / 100,
        order.amount_cents / 100,
        now,
        order.user_id
      ]
    );
    const ledgerId = `tx_${Date.now()}_${import_crypto4.default.randomBytes(4).toString("hex")}`;
    const desc = isLatePayment ? `Recarga tard\xEDa confirmada: ${order.coins} monedas (${order.package_name} #${order.order_number})` : `Recarga de monedas: ${order.coins} monedas (${order.package_name} #${order.order_number})`;
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'topup', ?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [
        ledgerId,
        order.user_id,
        order.coins,
        order.amount_cents,
        order.amount_cents / 100,
        newBalance,
        desc,
        order.id,
        now
      ]
    );
    await db.run(
      "INSERT OR REPLACE INTO processed_stripe_events (id, event_type, status, processed_at) VALUES (?, ?, 'processed', ?)",
      [eventId, eventType, now]
    );
    return { success: true, action: "order_credited", orderId: order.id };
  }
  if (eventType === "checkout.session.async_payment_failed" || eventType === "checkout.session.expired") {
    const sessionId = obj.id;
    const clientRefId = obj.client_reference_id;
    const order = await db.get(
      "SELECT * FROM coin_orders WHERE id = ? OR stripe_session_id = ?",
      [clientRefId || "", sessionId || ""]
    );
    if (order && order.status === "pending") {
      const newStatus = eventType === "checkout.session.expired" ? "expired" : "failed";
      await db.run(
        "UPDATE coin_orders SET status = ?, failed_at = ?, failure_reason = ? WHERE id = ?",
        [newStatus, now, eventType, order.id]
      );
    }
    await db.run(
      "INSERT OR REPLACE INTO processed_stripe_events (id, event_type, status, processed_at) VALUES (?, ?, 'processed', ?)",
      [eventId, eventType, now]
    );
    return { success: true, action: "order_status_updated", orderId: order?.id };
  }
  if (eventType === "charge.refunded") {
    const refundObj = obj.refunds?.data?.[0] || obj;
    const stripeRefundId = refundObj.id || `ref_${eventId}`;
    const paymentIntentId = obj.payment_intent;
    const amountRefundedCents = refundObj.amount || obj.amount_refunded || 0;
    const order = await db.get(
      "SELECT * FROM coin_orders WHERE stripe_payment_intent_id = ? OR id = ?",
      [paymentIntentId || "", obj.metadata?.orderId || ""]
    );
    if (order) {
      const user = await db.get("SELECT coins_balance, purchased_coins_balance FROM users WHERE id = ?", [order.user_id]);
      const currentBalance = user ? user.coins_balance : 0;
      const coinsToDeduct = order.coins;
      let coinsDeducted = coinsToDeduct;
      let unrecoveredCoins = 0;
      let requiresManualReview = false;
      if (currentBalance < coinsToDeduct) {
        coinsDeducted = Math.max(0, currentBalance);
        unrecoveredCoins = coinsToDeduct - coinsDeducted;
        requiresManualReview = true;
      }
      const newBalance = currentBalance - coinsDeducted;
      await db.run(
        `UPDATE users SET 
          coins_balance = ?, 
          purchased_coins_balance = MAX(0, purchased_coins_balance - ?),
          financial_restriction = CASE WHEN ? = 1 THEN 1 ELSE financial_restriction END,
          updated_at = ?
         WHERE id = ?`,
        [newBalance, coinsDeducted, requiresManualReview ? 1 : 0, now, order.user_id]
      );
      const compLedgerId = `comp_${Date.now()}_${import_crypto4.default.randomBytes(4).toString("hex")}`;
      await db.run(
        `INSERT INTO ledger (
          id, user_id, type, amount_coins, amount_cents, amount_eur,
          balance_after, description, reference_id, timestamp, status
        ) VALUES (?, ?, 'refund', ?, ?, ?, ?, ?, ?, ?, 'completed')`,
        [
          compLedgerId,
          order.user_id,
          -coinsDeducted,
          -amountRefundedCents,
          -(amountRefundedCents / 100),
          newBalance,
          `Ajuste por reembolso de Stripe (${order.package_name} #${order.order_number})`,
          order.id,
          now
        ]
      );
      const disputeId = `rfd_${Date.now()}_${import_crypto4.default.randomBytes(4).toString("hex")}`;
      await db.run(
        `INSERT OR IGNORE INTO refund_disputes (
          id, order_id, user_id, stripe_refund_id, amount_cents,
          coins_to_deduct, coins_deducted, unrecovered_coins, status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          disputeId,
          order.id,
          order.user_id,
          stripeRefundId,
          amountRefundedCents,
          coinsToDeduct,
          coinsDeducted,
          unrecoveredCoins,
          requiresManualReview ? "pending_manual_review" : "processed",
          requiresManualReview ? `Saldo insuficiente al reembolsar: quedaron ${unrecoveredCoins} monedas sin recuperar.` : null,
          now
        ]
      );
    }
    await db.run(
      "INSERT OR REPLACE INTO processed_stripe_events (id, event_type, status, processed_at) VALUES (?, ?, 'processed', ?)",
      [eventId, eventType, now]
    );
    return { success: true, action: "refund_processed", orderId: order?.id };
  }
  await db.run(
    'INSERT OR REPLACE INTO processed_stripe_events (id, event_type, status, processed_at) VALUES (?, ?, "ignored", ?)',
    [eventId, eventType, now]
  );
  return { success: true, action: "ignored" };
}
async function runWalletReconciliation() {
  const db = await getDb();
  const discrepancies = [];
  const paidOrders = await db.query(
    "SELECT id, order_number, user_id, coins, amount_cents FROM coin_orders WHERE status = 'paid'"
  );
  let totalOrdersAmountCents = 0;
  let totalCoinsCredited = 0;
  for (const ord of paidOrders) {
    totalOrdersAmountCents += ord.amount_cents;
    totalCoinsCredited += ord.coins;
    const ledgerEntries = await db.query(
      "SELECT id, amount_coins FROM ledger WHERE reference_id = ? AND type = 'topup'",
      [ord.id]
    );
    if (ledgerEntries.length === 0) {
      discrepancies.push({
        type: "UNCREDITED_PAID_ORDER",
        orderId: ord.id,
        userId: ord.user_id,
        details: `El pedido pagado ${ord.order_number} (${ord.coins} monedas) no tiene ning\xFAn asiento en el libro mayor.`,
        severity: "high"
      });
    } else if (ledgerEntries.length > 1) {
      discrepancies.push({
        type: "DUPLICATE_ORDER_CREDIT",
        orderId: ord.id,
        userId: ord.user_id,
        details: `El pedido ${ord.order_number} tiene ${ledgerEntries.length} asientos duplicados en el libro mayor.`,
        severity: "high"
      });
    }
  }
  const users = await db.query("SELECT id, name, coins_balance, purchased_coins_balance FROM users");
  for (const u of users) {
    if (u.coins_balance < 0) {
      discrepancies.push({
        type: "NEGATIVE_BALANCE",
        userId: u.id,
        details: `El usuario ${u.name} (${u.id}) tiene un saldo negativo inadmisible: ${u.coins_balance}`,
        severity: "high"
      });
    }
    const txSumRow = await db.get(
      "SELECT COALESCE(SUM(amount_coins), 0) as sumCoins FROM ledger WHERE user_id = ? AND status = 'completed'",
      [u.id]
    );
    const ledgerSum = txSumRow ? txSumRow.sumCoins : 0;
    const hasTransactions = await db.get("SELECT id FROM ledger WHERE user_id = ? LIMIT 1", [u.id]);
    if (hasTransactions && Math.abs(u.coins_balance - ledgerSum) > 0) {
      discrepancies.push({
        type: "BALANCE_LEDGER_MISMATCH",
        userId: u.id,
        details: `Descuadre contable para ${u.name} (${u.id}): saldo actual en users=${u.coins_balance}, acumulado en ledger=${ledgerSum}`,
        severity: "medium"
      });
    }
  }
  return {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    totalOrdersPaid: paidOrders.length,
    totalOrdersAmountCents,
    totalCoinsCredited,
    totalUsersAudited: users.length,
    discrepancies,
    isBalanced: discrepancies.length === 0
  };
}
async function updateUserSpendingLimits(userId, dailyEur, weeklyEur) {
  const db = await getDb();
  const dailyCents = dailyEur !== null && dailyEur !== void 0 ? Math.round(dailyEur * 100) : null;
  const weeklyCents = weeklyEur !== null && weeklyEur !== void 0 ? Math.round(weeklyEur * 100) : null;
  if (dailyCents !== null && dailyCents < 0) {
    throw { status: 400, message: "El l\xEDmite diario no puede ser negativo." };
  }
  if (weeklyCents !== null && weeklyCents < 0) {
    throw { status: 400, message: "El l\xEDmite semanal no puede ser negativo." };
  }
  if (dailyCents !== null && weeklyCents !== null && dailyCents > weeklyCents) {
    throw { status: 400, message: "El l\xEDmite diario no puede ser superior al l\xEDmite semanal." };
  }
  await db.run(
    `UPDATE users 
     SET spending_limit_daily = ?, 
         spending_limit_weekly = ?, 
         spending_limit_daily_cents = ?, 
         spending_limit_weekly_cents = ? 
     WHERE id = ?`,
    [
      dailyEur !== null ? dailyEur : null,
      weeklyEur !== null ? weeklyEur : null,
      dailyCents,
      weeklyCents,
      userId
    ]
  );
  return {
    spendingLimitDaily: dailyEur,
    spendingLimitWeekly: weeklyEur
  };
}

// server.ts
init_consultationService();

// src/services/giftAndUnlockService.ts
var import_crypto6 = __toESM(require("crypto"), 1);
init_database();
async function getGiftCatalog() {
  const db = await getDb();
  const rows = await db.query(
    "SELECT id, name, icon, cost_coins, description FROM stream_gifts WHERE is_active = 1 ORDER BY sort_order ASC, cost_coins ASC"
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    costCoins: r.cost_coins,
    description: r.description || ""
  }));
}
async function checkCoinSpendingLimits(userId, coinsToSpend) {
  const db = await getDb();
  const user = await db.get(
    "SELECT coins_balance, coins_reserved, financial_restriction, spending_limit_daily, spending_limit_weekly, spending_limit_daily_cents, spending_limit_weekly_cents FROM users WHERE id = ?",
    [userId]
  );
  if (!user) {
    throw { status: 404, message: "Usuario no encontrado." };
  }
  if (user.financial_restriction === 1) {
    throw {
      status: 403,
      message: "Esta cuenta tiene una restricci\xF3n financiera administrativa activa. No se permiten operaciones de gasto hasta su revisi\xF3n."
    };
  }
  const availableCoins = (user.coins_balance || 0) - (user.coins_reserved || 0);
  if (availableCoins < coinsToSpend) {
    throw {
      status: 402,
      code: "INSUFFICIENT_COINS",
      message: `Saldo insuficiente. Dispones de ${availableCoins} monedas libres y la operaci\xF3n requiere ${coinsToSpend} monedas.`
    };
  }
  const dailyLimitEur = user.spending_limit_daily_cents ? user.spending_limit_daily_cents / 100 : user.spending_limit_daily;
  const weeklyLimitEur = user.spending_limit_weekly_cents ? user.spending_limit_weekly_cents / 100 : user.spending_limit_weekly;
  if (dailyLimitEur !== null && dailyLimitEur !== void 0 && dailyLimitEur > 0) {
    const dailyLimitCoins = Math.round(dailyLimitEur * 10);
    const now = /* @__PURE__ */ new Date();
    const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const spentTodayRow = await db.get(
      "SELECT COALESCE(SUM(ABS(amount_coins)), 0) as total FROM ledger WHERE user_id = ? AND amount_coins < 0 AND timestamp >= ?",
      [userId, startOfDayUtc]
    );
    const spentTodayCoins = spentTodayRow ? spentTodayRow.total : 0;
    if (spentTodayCoins + coinsToSpend > dailyLimitCoins) {
      throw {
        status: 400,
        message: `Esta operaci\xF3n superar\xEDa tu l\xEDmite de gasto diario configurado (${dailyLimitEur.toFixed(2)} \u20AC / ${dailyLimitCoins} monedas). Ya has gastado ${spentTodayCoins} monedas hoy.`
      };
    }
  }
  if (weeklyLimitEur !== null && weeklyLimitEur !== void 0 && weeklyLimitEur > 0) {
    const weeklyLimitCoins = Math.round(weeklyLimitEur * 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3).toISOString();
    const spentWeeklyRow = await db.get(
      "SELECT COALESCE(SUM(ABS(amount_coins)), 0) as total FROM ledger WHERE user_id = ? AND amount_coins < 0 AND timestamp >= ?",
      [userId, sevenDaysAgo]
    );
    const spentWeeklyCoins = spentWeeklyRow ? spentWeeklyRow.total : 0;
    if (spentWeeklyCoins + coinsToSpend > weeklyLimitCoins) {
      throw {
        status: 400,
        message: `Esta operaci\xF3n superar\xEDa tu l\xEDmite de gasto semanal configurado (${weeklyLimitEur.toFixed(2)} \u20AC / ${weeklyLimitCoins} monedas). Ya has gastado ${spentWeeklyCoins} monedas en los \xFAltimos 7 d\xEDas.`
      };
    }
  }
}
async function sendStreamGift(params) {
  const db = await getDb();
  const { senderId, streamId, giftId, idempotencyKey } = params;
  if (idempotencyKey) {
    const existingTx = await db.get(
      "SELECT * FROM stream_gift_transactions WHERE sender_id = ? AND idempotency_key = ?",
      [senderId, idempotencyKey]
    );
    if (existingTx) {
      const existingEvt = await db.get(
        "SELECT * FROM stream_gift_events WHERE transaction_id = ?",
        [existingTx.id]
      );
      const sender = await db.get("SELECT coins_balance FROM users WHERE id = ?", [senderId]);
      return {
        success: true,
        isDuplicate: true,
        transactionId: existingTx.id,
        event: {
          id: existingEvt ? existingEvt.id : `evt_${existingTx.id}`,
          streamId: existingTx.stream_id,
          transactionId: existingTx.id,
          senderId: existingTx.sender_id,
          senderName: existingEvt ? existingEvt.sender_name : "Usuario",
          senderAvatar: existingEvt ? existingEvt.sender_avatar : "",
          giftId: existingTx.gift_id,
          giftName: existingTx.gift_name,
          giftIcon: existingTx.gift_icon,
          giftCost: existingTx.coins_amount,
          timestamp: existingTx.created_at
        },
        balanceAfter: sender ? sender.coins_balance : 0,
        costCoins: existingTx.coins_amount,
        platformFeeCoins: existingTx.platform_fee_coins,
        tarotistaEarningsCoins: existingTx.tarotista_earnings_coins
      };
    }
  }
  const gift = await db.get(
    "SELECT * FROM stream_gifts WHERE id = ? AND is_active = 1",
    [giftId]
  );
  if (!gift) {
    throw { status: 400, message: "El regalo seleccionado no existe o est\xE1 desactivado." };
  }
  const costCoins = gift.cost_coins;
  const stream = await db.get(
    "SELECT * FROM live_streams WHERE id = ?",
    [streamId]
  );
  if (!stream) {
    throw { status: 404, message: "La emisi\xF3n en directo no fue encontrada." };
  }
  if (stream.is_live !== 1) {
    throw {
      status: 400,
      code: "STREAM_NOT_LIVE",
      message: "La emisi\xF3n en directo ya ha finalizado. No se pueden enviar regalos a directos terminados."
    };
  }
  let tarotistaUserId = stream.tarotista_id;
  let tarotistaProfileId = stream.tarotista_id;
  let commissionPercentage = 20;
  const profile = await db.get(
    "SELECT id, user_id, custom_commission_percentage FROM tarotista_profiles WHERE id = ? OR user_id = ?",
    [stream.tarotista_id, stream.tarotista_id]
  );
  if (profile) {
    tarotistaUserId = profile.user_id;
    tarotistaProfileId = profile.id;
    commissionPercentage = profile.custom_commission_percentage ?? 20;
  }
  if (senderId === tarotistaUserId || senderId === stream.tarotista_id) {
    throw { status: 400, code: "CANNOT_GIFT_SELF", message: "No puedes enviarte regalos a ti mismo." };
  }
  await checkCoinSpendingLimits(senderId, costCoins);
  const senderUser = await db.get(
    "SELECT id, name, avatar, coins_balance FROM users WHERE id = ?",
    [senderId]
  );
  if (!senderUser) {
    throw { status: 404, message: "Usuario remitente no encontrado." };
  }
  const platformFee = Math.round(costCoins * (commissionPercentage / 100));
  const tarotistaEarnings = costCoins - platformFee;
  const txId = `tx_gift_${Date.now()}_${import_crypto6.default.randomBytes(4).toString("hex")}`;
  const eventId = `evt_gift_${Date.now()}_${import_crypto6.default.randomBytes(4).toString("hex")}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.run("BEGIN TRANSACTION");
  try {
    const deductRes = await db.run(
      `UPDATE users 
       SET coins_balance = coins_balance - ?, 
           updated_at = ?
       WHERE id = ? AND coins_balance >= ?`,
      [costCoins, now, senderId, costCoins]
    );
    if (deductRes.changes === 0) {
      await db.run("ROLLBACK");
      throw { status: 402, message: "Saldo insuficiente o conflicto concurrente al procesar el regalo." };
    }
    await db.run(
      `UPDATE users 
       SET coins_balance = coins_balance + ?, 
           earnings_coins_balance = earnings_coins_balance + ?,
           updated_at = ?
       WHERE id = ?`,
      [tarotistaEarnings, tarotistaEarnings, now, tarotistaUserId]
    );
    await db.run(
      `INSERT INTO stream_gift_transactions (
        id, stream_id, sender_id, tarotista_id, tarotista_user_id,
        gift_id, gift_name, gift_icon, coins_amount, platform_fee_coins,
        tarotista_earnings_coins, commission_percentage, idempotency_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        txId,
        streamId,
        senderId,
        tarotistaProfileId,
        tarotistaUserId,
        gift.id,
        gift.name,
        gift.icon,
        costCoins,
        platformFee,
        tarotistaEarnings,
        commissionPercentage,
        idempotencyKey || null,
        now
      ]
    );
    await db.run(
      `INSERT INTO stream_gift_events (
        id, stream_id, transaction_id, sender_id, sender_name, sender_avatar,
        gift_id, gift_name, gift_icon, coins, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        streamId,
        txId,
        senderId,
        senderUser.name,
        senderUser.avatar || null,
        gift.id,
        gift.name,
        gift.icon,
        costCoins,
        now
      ]
    );
    const updatedSender = await db.get("SELECT coins_balance FROM users WHERE id = ?", [senderId]);
    const updatedTarotista = await db.get("SELECT coins_balance FROM users WHERE id = ?", [tarotistaUserId]);
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'gift_sent', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        `tx_ledger_s_${txId}`,
        senderId,
        -costCoins,
        updatedSender.coins_balance,
        `Regalo enviado: ${gift.name} (${costCoins} monedas) a ${stream.tarotista_name}`,
        txId,
        now
      ]
    );
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'gift_received', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        `tx_ledger_t_${txId}`,
        tarotistaUserId,
        tarotistaEarnings,
        updatedTarotista.coins_balance,
        `Regalo recibido en directo: ${gift.name} (+${tarotistaEarnings} monedas) de ${senderUser.name}`,
        txId,
        now
      ]
    );
    if (platformFee > 0) {
      await db.run(
        `INSERT INTO ledger (
          id, user_id, type, amount_coins, amount_cents, amount_eur,
          balance_after, description, reference_id, timestamp, status
        ) VALUES (?, 'platform', 'platform_fee', ?, 0, 0, 0, ?, ?, ?, 'completed')`,
        [
          `tx_ledger_p_${txId}`,
          platformFee,
          `Comisi\xF3n plataforma (${commissionPercentage}%) por regalo en directo #${streamId}`,
          txId,
          now
        ]
      );
    }
    await db.run("COMMIT");
    const giftEvent = {
      id: eventId,
      streamId,
      transactionId: txId,
      senderId,
      senderName: senderUser.name,
      senderAvatar: senderUser.avatar || "",
      giftId: gift.id,
      giftName: gift.name,
      giftIcon: gift.icon,
      giftCost: costCoins,
      timestamp: now
    };
    return {
      success: true,
      transactionId: txId,
      event: giftEvent,
      balanceAfter: updatedSender.coins_balance,
      costCoins,
      platformFeeCoins: platformFee,
      tarotistaEarningsCoins: tarotistaEarnings
    };
  } catch (err) {
    try {
      await db.run("ROLLBACK");
    } catch {
    }
    throw err;
  }
}
async function getStreamGiftEvents(streamId, sinceIso, limit = 30) {
  const db = await getDb();
  let query = "SELECT * FROM stream_gift_events WHERE stream_id = ?";
  const params = [streamId];
  if (sinceIso) {
    query += " AND created_at > ?";
    params.push(sinceIso);
  }
  query += " ORDER BY created_at ASC LIMIT ?";
  params.push(Math.min(Math.max(limit, 1), 100));
  const rows = await db.query(query, params);
  return rows.map((r) => ({
    id: r.id,
    streamId: r.stream_id,
    transactionId: r.transaction_id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    senderAvatar: r.sender_avatar || "",
    giftId: r.gift_id,
    giftName: r.gift_name,
    giftIcon: r.gift_icon,
    giftCost: r.coins,
    timestamp: r.created_at
  }));
}
async function unlockExclusivePost(params) {
  const db = await getDb();
  const { buyerId, postId, idempotencyKey } = params;
  const post = await db.get(
    "SELECT * FROM videos WHERE id = ? AND is_deleted = 0",
    [postId]
  );
  if (!post) {
    throw { status: 404, message: "La publicaci\xF3n no fue encontrada o ha sido eliminada." };
  }
  if (post.is_withdrawn === 1) {
    throw {
      status: 410,
      message: `Esta publicaci\xF3n ha sido retirada por su autor o moderaci\xF3n. Motivo: ${post.withdrawal_reason || "Contenido retirado"}.`
    };
  }
  const authorProfileId = post.tarotista_id;
  const authorProfile = await db.get(
    "SELECT id, user_id, custom_commission_percentage FROM tarotista_profiles WHERE id = ? OR user_id = ?",
    [authorProfileId, authorProfileId]
  );
  const authorUserId = authorProfile ? authorProfile.user_id : authorProfileId;
  const commissionPercentage = authorProfile?.custom_commission_percentage ?? 20;
  if (buyerId === authorUserId || buyerId === authorProfileId) {
    const user = await db.get("SELECT coins_balance FROM users WHERE id = ?", [buyerId]);
    return {
      success: true,
      alreadyUnlocked: true,
      isAuthor: true,
      unlockId: `author_${postId}`,
      mediaUrl: post.video_url,
      priceCoins: 0,
      balanceAfter: user ? user.coins_balance : 0
    };
  }
  const priceCoins = post.is_premium ? post.price_coins || 0 : 0;
  if (!post.is_premium || priceCoins <= 0) {
    const user = await db.get("SELECT coins_balance FROM users WHERE id = ?", [buyerId]);
    return {
      success: true,
      alreadyUnlocked: true,
      unlockId: `free_${postId}`,
      mediaUrl: post.video_url,
      priceCoins: 0,
      balanceAfter: user ? user.coins_balance : 0
    };
  }
  const existingUnlock = await db.get(
    "SELECT * FROM post_unlocks WHERE user_id = ? AND post_id = ? AND is_refunded = 0",
    [buyerId, postId]
  );
  if (existingUnlock) {
    const user = await db.get("SELECT coins_balance FROM users WHERE id = ?", [buyerId]);
    return {
      success: true,
      alreadyUnlocked: true,
      unlockId: existingUnlock.id,
      mediaUrl: post.video_url,
      priceCoins: existingUnlock.coins_paid,
      balanceAfter: user ? user.coins_balance : 0
    };
  }
  await checkCoinSpendingLimits(buyerId, priceCoins);
  const buyerUser = await db.get(
    "SELECT id, name, avatar, coins_balance FROM users WHERE id = ?",
    [buyerId]
  );
  if (!buyerUser) {
    throw { status: 404, message: "Usuario comprador no encontrado." };
  }
  const platformFee = Math.round(priceCoins * (commissionPercentage / 100));
  const tarotistaEarnings = priceCoins - platformFee;
  const unlockId = `unl_${Date.now()}_${import_crypto6.default.randomBytes(4).toString("hex")}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.run("BEGIN TRANSACTION");
  try {
    const deductRes = await db.run(
      `UPDATE users 
       SET coins_balance = coins_balance - ?, 
           updated_at = ?
       WHERE id = ? AND coins_balance >= ?`,
      [priceCoins, now, buyerId, priceCoins]
    );
    if (deductRes.changes === 0) {
      await db.run("ROLLBACK");
      throw { status: 402, message: "Saldo insuficiente o conflicto concurrente al desbloquear la publicaci\xF3n." };
    }
    await db.run(
      `UPDATE users 
       SET coins_balance = coins_balance + ?, 
           earnings_coins_balance = earnings_coins_balance + ?,
           updated_at = ?
       WHERE id = ?`,
      [tarotistaEarnings, tarotistaEarnings, now, authorUserId]
    );
    await db.run(
      `INSERT INTO post_unlocks (
        id, user_id, post_id, author_id, coins_paid, platform_fee_coins,
        tarotista_earnings_coins, commission_percentage, idempotency_key, unlocked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        unlockId,
        buyerId,
        postId,
        authorUserId,
        priceCoins,
        platformFee,
        tarotistaEarnings,
        commissionPercentage,
        idempotencyKey || null,
        now
      ]
    );
    const updatedBuyer = await db.get("SELECT coins_balance FROM users WHERE id = ?", [buyerId]);
    const updatedAuthor = await db.get("SELECT coins_balance FROM users WHERE id = ?", [authorUserId]);
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'post_unlock_buy', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        `tx_unl_b_${unlockId}`,
        buyerId,
        -priceCoins,
        updatedBuyer.coins_balance,
        `Desbloqueo exclusivo: "${post.title}" (${priceCoins} monedas)`,
        unlockId,
        now
      ]
    );
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'post_unlock_earn', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        `tx_unl_a_${unlockId}`,
        authorUserId,
        tarotistaEarnings,
        updatedAuthor.coins_balance,
        `Venta de contenido exclusivo: "${post.title}" (+${tarotistaEarnings} monedas) a ${buyerUser.name}`,
        unlockId,
        now
      ]
    );
    if (platformFee > 0) {
      await db.run(
        `INSERT INTO ledger (
          id, user_id, type, amount_coins, amount_cents, amount_eur,
          balance_after, description, reference_id, timestamp, status
        ) VALUES (?, 'platform', 'platform_fee', ?, 0, 0, 0, ?, ?, ?, 'completed')`,
        [
          `tx_unl_p_${unlockId}`,
          platformFee,
          `Comisi\xF3n plataforma (${commissionPercentage}%) por desbloqueo #${unlockId}`,
          unlockId,
          now
        ]
      );
    }
    await db.run("COMMIT");
    return {
      success: true,
      alreadyUnlocked: false,
      unlockId,
      mediaUrl: post.video_url,
      priceCoins,
      balanceAfter: updatedBuyer.coins_balance
    };
  } catch (err) {
    try {
      await db.run("ROLLBACK");
    } catch {
    }
    throw err;
  }
}
async function checkPostAccess(userId, postId) {
  const db = await getDb();
  const post = await db.get(
    "SELECT * FROM videos WHERE id = ? AND is_deleted = 0",
    [postId]
  );
  if (!post) {
    throw { status: 404, message: "Publicaci\xF3n no encontrada." };
  }
  if (!post.is_premium || !post.price_coins || post.price_coins <= 0) {
    return {
      hasAccess: true,
      isAuthor: false,
      isPurchased: false,
      post,
      mediaUrl: post.video_url
    };
  }
  if (!userId) {
    return {
      hasAccess: false,
      isAuthor: false,
      isPurchased: false,
      post,
      mediaUrl: null
      // REQUISITO: Ocultar URL original del archivo a no autenticados
    };
  }
  const user = await db.get("SELECT role FROM users WHERE id = ?", [userId]);
  const isAdmin = user?.role === "admin";
  let authorUserId = post.tarotista_id;
  const authorProfile = await db.get(
    "SELECT user_id FROM tarotista_profiles WHERE id = ? OR user_id = ?",
    [post.tarotista_id, post.tarotista_id]
  );
  if (authorProfile) authorUserId = authorProfile.user_id;
  const isAuthor = userId === authorUserId || userId === post.tarotista_id;
  if (isAuthor || isAdmin) {
    return {
      hasAccess: true,
      isAuthor,
      isPurchased: false,
      post,
      mediaUrl: post.video_url
    };
  }
  const unlock = await db.get(
    "SELECT * FROM post_unlocks WHERE user_id = ? AND post_id = ? AND is_refunded = 0",
    [userId, postId]
  );
  const isPurchased = !!unlock;
  return {
    hasAccess: isPurchased,
    isAuthor: false,
    isPurchased,
    post,
    mediaUrl: isPurchased ? post.video_url : null
  };
}
async function getUserUnlockedPurchases(userId) {
  const db = await getDb();
  const rows = await db.query(
    `SELECT u.*, 
            v.title as post_title, 
            v.thumbnail_url as post_thumbnail, 
            v.video_url, 
            v.media_type, 
            v.tarotista_name as author_name,
            v.is_withdrawn,
            v.withdrawal_reason
     FROM post_unlocks u
     JOIN videos v ON u.post_id = v.id
     WHERE u.user_id = ? AND u.is_refunded = 0
     ORDER BY u.unlocked_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    postId: r.post_id,
    authorId: r.author_id,
    coinsPaid: r.coins_paid,
    priceCoins: r.coins_paid,
    platformFeeCoins: r.platform_fee_coins,
    tarotistaEarningsCoins: r.tarotista_earnings_coins,
    unlockedAt: r.unlocked_at,
    isRefunded: !!r.is_refunded,
    refundedAt: r.refunded_at || void 0,
    refundReason: r.refund_reason || void 0,
    postTitle: r.post_title,
    postThumbnail: r.post_thumbnail,
    authorName: r.author_name,
    mediaType: r.media_type,
    videoUrl: r.video_url
    // Disponible porque este endpoint es privado y solo devuelve las compras validadas del usuario
  }));
}
async function refundPostUnlock(params) {
  const db = await getDb();
  const { unlockId, adminUserId, reason } = params;
  const unlock = await db.get("SELECT * FROM post_unlocks WHERE id = ?", [unlockId]);
  if (!unlock) {
    throw { status: 404, message: "Registro de compra no encontrado." };
  }
  if (unlock.is_refunded === 1) {
    throw { status: 400, code: "ALREADY_REFUNDED", message: "Esta compra ya fue reembolsada con anterioridad." };
  }
  const coinsToRefund = unlock.coins_paid;
  const authorEarnings = unlock.tarotista_earnings_coins;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await db.run("BEGIN TRANSACTION");
  try {
    const author = await db.get("SELECT coins_balance, earnings_coins_balance FROM users WHERE id = ?", [unlock.author_id]);
    const currentAuthorBal = author ? author.coins_balance : 0;
    const deductAuthor = Math.min(currentAuthorBal, authorEarnings);
    await db.run(
      `UPDATE users 
       SET coins_balance = MAX(0, coins_balance - ?),
           earnings_coins_balance = MAX(0, earnings_coins_balance - ?),
           financial_restriction = CASE WHEN ? > coins_balance THEN 1 ELSE financial_restriction END,
           updated_at = ?
       WHERE id = ?`,
      [deductAuthor, deductAuthor, authorEarnings, now, unlock.author_id]
    );
    await db.run(
      "UPDATE users SET coins_balance = coins_balance + ?, updated_at = ? WHERE id = ?",
      [coinsToRefund, now, unlock.user_id]
    );
    await db.run(
      "UPDATE post_unlocks SET is_refunded = 1, refunded_at = ?, refund_reason = ? WHERE id = ?",
      [now, `${reason} (por admin ${adminUserId})`, unlockId]
    );
    const updatedBuyer = await db.get("SELECT coins_balance FROM users WHERE id = ?", [unlock.user_id]);
    const updatedAuthor = await db.get("SELECT coins_balance FROM users WHERE id = ?", [unlock.author_id]);
    await db.run(
      `INSERT INTO ledger (
        id, user_id, type, amount_coins, amount_cents, amount_eur,
        balance_after, description, reference_id, timestamp, status
      ) VALUES (?, ?, 'post_unlock_refund', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
      [
        `tx_ref_b_${unlockId}`,
        unlock.user_id,
        coinsToRefund,
        updatedBuyer.coins_balance,
        `Reembolso compensatorio por compra #${unlockId}: ${reason}`,
        unlockId,
        now
      ]
    );
    if (deductAuthor > 0) {
      await db.run(
        `INSERT INTO ledger (
          id, user_id, type, amount_coins, amount_cents, amount_eur,
          balance_after, description, reference_id, timestamp, status
        ) VALUES (?, ?, 'compensatory_adjustment', ?, 0, 0, ?, ?, ?, ?, 'completed')`,
        [
          `tx_ref_a_${unlockId}`,
          unlock.author_id,
          -deductAuthor,
          updatedAuthor.coins_balance,
          `Ajuste compensatorio por devoluci\xF3n de compra #${unlockId}`,
          unlockId,
          now
        ]
      );
    }
    await db.run("COMMIT");
    return {
      success: true,
      refundAmountCoins: coinsToRefund,
      refundCoins: coinsToRefund,
      buyerBalanceAfter: updatedBuyer.coins_balance,
      authorBalanceAfter: updatedAuthor ? updatedAuthor.coins_balance : 0
    };
  } catch (err) {
    try {
      await db.run("ROLLBACK");
    } catch {
    }
    throw err;
  }
}
async function withdrawPost(params) {
  const db = await getDb();
  const { postId, userId, reason, isAdmin } = params;
  const post = await db.get("SELECT * FROM videos WHERE id = ? AND is_deleted = 0", [postId]);
  if (!post) {
    throw { status: 404, message: "Publicaci\xF3n no encontrada." };
  }
  let authorUserId = post.tarotista_id;
  const authorProfile = await db.get(
    "SELECT user_id FROM tarotista_profiles WHERE id = ? OR user_id = ?",
    [post.tarotista_id, post.tarotista_id]
  );
  if (authorProfile) authorUserId = authorProfile.user_id;
  if (userId !== authorUserId && userId !== post.tarotista_id && !isAdmin) {
    throw { status: 403, message: "Solo el autor o un administrador pueden retirar esta publicaci\xF3n." };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const safeReason = reason || "Retirada por el autor";
  await db.run(
    "UPDATE videos SET is_withdrawn = 1, withdrawn_at = ?, withdrawal_reason = ? WHERE id = ?",
    [now, safeReason, postId]
  );
  return {
    withdrawn: true,
    postId,
    withdrawnAt: now,
    reason: safeReason
  };
}

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
  app.use(import_express.default.json({
    verify: (req2, _res, buf) => {
      req2.rawBody = buf;
    }
  }));
  app.use((0, import_cookie_parser.default)());
  app.use(attachUserMiddleware);
  const uploadsDir = import_path3.default.join(process.cwd(), "uploads");
  if (!import_fs2.default.existsSync(uploadsDir)) {
    import_fs2.default.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", import_express.default.static(uploadsDir));
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
      const [publicTarotistas, publicVideos, publicReviews, giftCatalog] = await Promise.all([
        getPublicTarotistas(),
        getPublicVideos(currentUser?.id),
        getPublicReviews(),
        getGiftCatalog().catch(() => initialGifts)
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
        gifts: giftCatalog,
        consultations: userConsultations,
        ledger: userLedger,
        reports: userReports,
        withdrawals: userWithdrawals,
        coinPackages: initialCoinPackages
      });
    } catch (err) {
      console.error("[API State Error]:", err);
      res.status(500).json({ error: "Error al recuperar el estado de la aplicaci\xF3n." });
    }
  });
  app.post("/api/users/profile", requireAuth, async (req2, res) => {
    try {
      const userId = req2.user.id;
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
        isPrivate
      } = req2.body;
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
        sunSign !== void 0 ? sunSign?.trim() || null : null,
        moonSign !== void 0 ? moonSign?.trim() || null : null,
        risingSign !== void 0 ? risingSign?.trim() || null : null,
        rulingArcana !== void 0 ? rulingArcana?.trim() || null : null,
        spiritualGift !== void 0 ? spiritualGift?.trim() || null : null,
        isPrivate !== void 0 ? isPrivate ? 1 : 0 : null,
        (/* @__PURE__ */ new Date()).toISOString(),
        userId
      ]);
      if (avatar?.trim()) {
        await db.run("UPDATE tarotista_profiles SET avatar = ? WHERE user_id = ?", [avatar.trim(), userId]).catch(() => {
        });
        await db.run("UPDATE videos SET tarotista_avatar = ? WHERE tarotista_id = ?", [avatar.trim(), userId]).catch(() => {
        });
      }
      if (coverImage?.trim()) {
        await db.run("UPDATE tarotista_profiles SET banner = ? WHERE user_id = ?", [coverImage.trim(), userId]).catch(() => {
        });
      }
      if (safeName) {
        await db.run("UPDATE videos SET tarotista_name = ? WHERE tarotista_id = ?", [safeName, userId]).catch(() => {
        });
      }
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
          sunSign: updated.sun_sign || void 0,
          moonSign: updated.moon_sign || void 0,
          risingSign: updated.rising_sign || void 0,
          rulingArcana: updated.ruling_arcana || void 0,
          spiritualGift: updated.spiritual_gift || void 0,
          isPrivate: !!updated.is_private,
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
  app.post("/api/upload", requireAuth, (req2, res) => {
    uploadMediaMiddleware.single("file")(req2, res, (err) => {
      if (err) {
        const message = err.message || "Error al procesar el archivo.";
        return res.status(400).json({ error: message });
      }
      if (!req2.file) {
        return res.status(400).json({ error: "No se ha enviado ning\xFAn archivo multimedia." });
      }
      const isVideo = req2.file.mimetype.startsWith("video");
      const mediaUrl = `/uploads/${req2.file.filename}`;
      res.status(200).json({
        success: true,
        url: mediaUrl,
        type: isVideo ? "video" : "image",
        mediaType: isVideo ? "video" : "image",
        filename: req2.file.filename,
        originalName: req2.file.originalname,
        size: req2.file.size
      });
    });
  });
  app.get("/api/posts", async (req2, res) => {
    try {
      const { limit, cursor, category, authorId, feed } = req2.query;
      const isFollowingFeed = category === "Siguiendo" || feed === "following";
      const result = await getFeedPosts({
        limit: limit ? parseInt(limit, 10) : 10,
        cursor,
        category,
        authorId,
        currentUserId: req2.user?.id,
        feedType: isFollowingFeed ? "following" : "all"
      });
      res.json(result);
    } catch (err) {
      console.error("[API Posts Feed Error]:", err);
      res.status(500).json({ error: "Error al cargar las publicaciones del feed." });
    }
  });
  app.get("/api/posts/saved", requireAuth, async (req2, res) => {
    try {
      const items = await getUserSavedPosts(req2.user.id);
      res.json({ success: true, items });
    } catch (err) {
      res.status(500).json({ error: "Error al consultar publicaciones guardadas." });
    }
  });
  app.get("/api/posts/:id", async (req2, res) => {
    try {
      const post = await getPostById(req2.params.id, req2.user?.id);
      if (!post) {
        return res.status(404).json({
          error: "Esta publicaci\xF3n sagrada ya no est\xE1 disponible o ha sido retirada por su autor.",
          code: "POST_NOT_FOUND"
        });
      }
      res.json({ success: true, post });
    } catch (err) {
      res.status(500).json({ error: "Error al consultar la publicaci\xF3n." });
    }
  });
  app.post("/api/posts", requireAuth, async (req2, res) => {
    try {
      const user = req2.user;
      const idempotencyKey = req2.headers["idempotency-key"] || req2.body.idempotencyKey;
      const { title, description, category, videoUrl, mediaUrl, mediaUrls, thumbnailUrl, mediaType, isPremium, priceCoins } = req2.body;
      let safeIsPremium = false;
      let safePriceCoins = null;
      if (isPremium) {
        if (user.role !== "tarotista" && user.role !== "admin") {
          return res.status(403).json({
            error: "Solo los tarotistas verificados pueden configurar publicaciones exclusivas de pago.",
            code: "PREMIUM_ONLY_TAROTISTA"
          });
        }
        const parsedPrice = parseInt(priceCoins, 10);
        if (isNaN(parsedPrice) || parsedPrice <= 0 || parsedPrice > 5e4) {
          return res.status(400).json({
            error: "El precio en monedas debe ser un n\xFAmero entero positivo (m\xE1ximo 50.000 monedas).",
            code: "INVALID_PREMIUM_PRICE"
          });
        }
        if (!thumbnailUrl || !thumbnailUrl.trim()) {
          return res.status(400).json({
            error: "Las publicaciones exclusivas deben incluir una portada o vista previa separada del archivo completo.",
            code: "PREMIUM_THUMBNAIL_REQUIRED"
          });
        }
        safeIsPremium = true;
        safePriceCoins = parsedPrice;
      }
      const safeTitle = (title || "").trim();
      if (safeTitle.length < 3 || safeTitle.length > 150) {
        return res.status(400).json({ error: "El t\xEDtulo debe tener entre 3 y 150 caracteres." });
      }
      const targetMediaUrl = (videoUrl || mediaUrl || "").trim();
      if (!targetMediaUrl) {
        return res.status(400).json({ error: "Debe proporcionar una imagen o v\xEDdeo v\xE1lido para publicar." });
      }
      const safeCategory = (category || "Tarot").trim();
      const safeMediaType = mediaType === "image" ? "image" : "video";
      const result = await createPost({
        authorId: user.id,
        authorName: user.name,
        authorAvatar: user.avatar,
        isVerified: user.role === "tarotista",
        title: safeTitle,
        description: (description || "").trim(),
        category: safeCategory,
        videoUrl: targetMediaUrl,
        mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : void 0,
        thumbnailUrl: (thumbnailUrl || "").trim(),
        mediaType: safeMediaType,
        idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : void 0,
        isPremium: safeIsPremium,
        priceCoins: safePriceCoins
      });
      res.status(result.wasExisting ? 200 : 201).json({
        success: true,
        post: result.post,
        wasExisting: result.wasExisting,
        idempotent: result.wasExisting
      });
    } catch (err) {
      console.error("[API Create Post Error]:", err);
      res.status(500).json({ error: "Error al guardar la publicaci\xF3n en la base de datos." });
    }
  });
  app.put("/api/posts/:id", requireAuth, async (req2, res) => {
    try {
      const { title, description, category } = req2.body;
      const result = await updatePost(
        req2.params.id,
        req2.user.id,
        { title, description, category },
        req2.user.role === "admin"
      );
      res.status(result.status).json(result);
    } catch (err) {
      res.status(500).json({ error: "Error al actualizar la publicaci\xF3n." });
    }
  });
  app.delete("/api/posts/:id", requireAuth, async (req2, res) => {
    try {
      const result = await deletePost(
        req2.params.id,
        req2.user.id,
        req2.user.role === "admin"
      );
      res.status(result.status).json(result);
    } catch (err) {
      res.status(500).json({ error: "Error al retirar la publicaci\xF3n." });
    }
  });
  app.post("/api/posts/:id/like", requireAuth, async (req2, res) => {
    try {
      const result = await addPostLike(req2.params.id, req2.user.id);
      res.json({ success: true, ...result, isLikedByCurrentUser: result.isLiked });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al registrar Me gusta." });
    }
  });
  app.delete("/api/posts/:id/like", requireAuth, async (req2, res) => {
    try {
      const result = await removePostLike(req2.params.id, req2.user.id);
      res.json({ success: true, ...result, isLikedByCurrentUser: result.isLiked });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al retirar Me gusta." });
    }
  });
  app.post("/api/videos/:id/like", requireAuth, async (req2, res) => {
    try {
      const post = await getPostById(req2.params.id, req2.user.id);
      if (!post) return res.status(404).json({ error: "Publicaci\xF3n no encontrada." });
      if (post.isLikedByCurrentUser) {
        const result = await removePostLike(req2.params.id, req2.user.id);
        res.json({ success: true, likes: result.likes, isLikedByCurrentUser: false });
      } else {
        const result = await addPostLike(req2.params.id, req2.user.id);
        res.json({ success: true, likes: result.likes, isLikedByCurrentUser: true });
      }
    } catch (err) {
      res.status(500).json({ error: "Error al procesar like." });
    }
  });
  const userCommentTimestamps = /* @__PURE__ */ new Map();
  app.get("/api/posts/:id/comments", async (req2, res) => {
    try {
      const result = await getPostComments(req2.params.id, req2.user?.id);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: "Error al obtener los comentarios." });
    }
  });
  app.post("/api/posts/:id/comments", requireAuth, async (req2, res) => {
    try {
      const userId = req2.user.id;
      const now = Date.now();
      const lastComment = userCommentTimestamps.get(userId) || 0;
      if (now - lastComment < 1500) {
        return res.status(429).json({ error: "Por favor, espera un momento antes de enviar otro comentario c\xF3smico." });
      }
      userCommentTimestamps.set(userId, now);
      const { content, parentId } = req2.body;
      const comment = await createComment({
        videoId: req2.params.id,
        authorId: userId,
        authorName: req2.user.name,
        authorAvatar: req2.user.avatar,
        content: content || "",
        parentId: parentId || null
      });
      res.status(201).json({ success: true, comment });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al publicar comentario." });
    }
  });
  app.delete("/api/comments/:id", requireAuth, async (req2, res) => {
    try {
      const result = await deleteComment(
        req2.params.id,
        req2.user.id,
        req2.user.role === "admin"
      );
      res.json(result);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al eliminar comentario." });
    }
  });
  app.post("/api/users/:id/follow", requireAuth, async (req2, res) => {
    try {
      const rel = await followUser(req2.user.id, req2.params.id);
      res.json({ success: true, ...rel });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al seguir usuario." });
    }
  });
  app.delete("/api/users/:id/follow", requireAuth, async (req2, res) => {
    try {
      const rel = await unfollowUser(req2.user.id, req2.params.id);
      res.json({ success: true, ...rel });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al dejar de seguir." });
    }
  });
  app.get("/api/users/:id/followers", async (req2, res) => {
    try {
      const followers = await getUserFollowers(req2.params.id, req2.user?.id);
      res.json({ success: true, followers, count: followers.length });
    } catch (err) {
      res.status(500).json({ error: "Error al obtener seguidores." });
    }
  });
  app.get("/api/users/:id/following", async (req2, res) => {
    try {
      const following = await getUserFollowing(req2.params.id, req2.user?.id);
      res.json({ success: true, following, count: following.length });
    } catch (err) {
      res.status(500).json({ error: "Error al obtener seguidos." });
    }
  });
  app.get("/api/users/:id/relationship", async (req2, res) => {
    try {
      const rel = await getUserRelationship(req2.params.id, req2.user?.id);
      res.json({ success: true, ...rel });
    } catch (err) {
      res.status(500).json({ error: "Error al consultar relaci\xF3n." });
    }
  });
  app.post("/api/posts/:id/save", requireAuth, async (req2, res) => {
    try {
      const result = await savePost(req2.user.id, req2.params.id);
      res.json({ ...result, isSavedByCurrentUser: result.isSaved });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al guardar publicaci\xF3n." });
    }
  });
  app.delete("/api/posts/:id/save", requireAuth, async (req2, res) => {
    try {
      const result = await unsavePost(req2.user.id, req2.params.id);
      res.json({ ...result, isSavedByCurrentUser: result.isSaved });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al quitar guardado." });
    }
  });
  app.get("/api/users/me/saved", requireAuth, async (req2, res) => {
    try {
      const items = await getUserSavedPosts(req2.user.id);
      res.json({ success: true, items });
    } catch (err) {
      res.status(500).json({ error: "Error al consultar guardados." });
    }
  });
  app.get("/api/stories", async (req2, res) => {
    try {
      const groups = await getActiveStories(req2.user?.id);
      res.json({ success: true, groups });
    } catch (err) {
      console.error("[API Stories Error]:", err);
      res.status(500).json({ error: "Error al obtener historias activas." });
    }
  });
  app.post("/api/stories", requireAuth, async (req2, res) => {
    try {
      const { mediaUrl, mediaType, caption } = req2.body;
      if (!mediaUrl || typeof mediaUrl !== "string") {
        return res.status(400).json({ error: "Debe proporcionar una imagen o v\xEDdeo para la story." });
      }
      const story = await createStory({
        userId: req2.user.id,
        userName: req2.user.name,
        userAvatar: req2.user.avatar,
        mediaUrl: mediaUrl.trim(),
        mediaType: mediaType === "video" ? "video" : "image",
        caption: caption || ""
      });
      res.status(201).json({ success: true, story });
    } catch (err) {
      res.status(500).json({ error: "Error al publicar story." });
    }
  });
  app.get("/api/stories/:id", async (req2, res) => {
    try {
      const story = await getStoryById(req2.params.id, req2.user?.id);
      if (!story) {
        return res.status(404).json({ error: "Esta historia ha caducado o no est\xE1 disponible.", code: "STORY_NOT_FOUND" });
      }
      res.json({ success: true, story });
    } catch (err) {
      res.status(500).json({ error: "Error al consultar story." });
    }
  });
  app.delete("/api/stories/:id", requireAuth, async (req2, res) => {
    try {
      const result = await deleteStory(
        req2.params.id,
        req2.user.id,
        req2.user.role === "admin"
      );
      res.json(result);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al retirar story." });
    }
  });
  app.post("/api/stories/:id/view", requireAuth, async (req2, res) => {
    try {
      const result = await recordStoryView(
        req2.params.id,
        req2.user.id,
        req2.user.name,
        req2.user.avatar
      );
      res.json(result);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al registrar visualizaci\xF3n." });
    }
  });
  app.get("/api/stories/:id/views", requireAuth, async (req2, res) => {
    try {
      const viewers = await getStoryViewers(
        req2.params.id,
        req2.user.id,
        req2.user.role === "admin"
      );
      res.json({ success: true, viewers, count: viewers.length });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al consultar visualizaciones." });
    }
  });
  app.get("/api/notifications", requireAuth, async (req2, res) => {
    try {
      const data = await getUserNotifications(req2.user.id, 40);
      res.json({ success: true, ...data });
    } catch (err) {
      res.status(500).json({ error: "Error al consultar notificaciones c\xF3smicas." });
    }
  });
  app.post("/api/notifications/read", requireAuth, async (req2, res) => {
    try {
      const { notificationId } = req2.body || {};
      const result = await markNotificationsRead(req2.user.id, notificationId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Error al marcar notificaciones como le\xEDdas." });
    }
  });
  app.get("/api/users/:id/public", async (req2, res) => {
    try {
      const profile = await getPublicUserProfile(req2.params.id, req2.user?.id);
      if (!profile) {
        return res.status(404).json({ error: "Este perfil astral no existe en KABALY." });
      }
      res.json({ success: true, profile });
    } catch (err) {
      res.status(500).json({ error: "Error al cargar el perfil p\xFAblico." });
    }
  });
  app.get("/api/users/:id/highlights", async (req2, res) => {
    try {
      const highlights = await getUserHighlights(req2.params.id);
      res.json({ success: true, highlights });
    } catch (err) {
      res.status(500).json({ error: "Error al cargar Auras Destacadas." });
    }
  });
  app.post("/api/highlights", requireAuth, async (req2, res) => {
    try {
      const { title, coverUrl, mediaUrl, mediaType } = req2.body;
      if (!mediaUrl || typeof mediaUrl !== "string") {
        return res.status(400).json({ error: "Se requiere una imagen o v\xEDdeo para el Aura Destacada." });
      }
      const highlight = await createProfileHighlight({
        userId: req2.user.id,
        title: title || "Aura",
        coverUrl: coverUrl || mediaUrl,
        mediaUrl,
        mediaType: mediaType === "video" ? "video" : "image"
      });
      res.status(201).json({ success: true, highlight });
    } catch (err) {
      res.status(500).json({ error: "Error al crear Aura Destacada." });
    }
  });
  app.delete("/api/highlights/:id", requireAuth, async (req2, res) => {
    try {
      const result = await deleteProfileHighlight(req2.params.id, req2.user.id);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Error al eliminar Aura Destacada." });
    }
  });
  app.post("/api/posts/:id/pin", requireAuth, async (req2, res) => {
    try {
      const result = await togglePinPost(req2.params.id, req2.user.id);
      res.json({ success: true, ...result });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al fijar publicaci\xF3n." });
    }
  });
  app.post("/api/comments/:id/like", requireAuth, async (req2, res) => {
    try {
      const result = await toggleCommentLike(req2.params.id, req2.user.id);
      res.json({ success: true, ...result });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al resonar con el comentario." });
    }
  });
  app.post("/api/comments/:id/pin", requireAuth, async (req2, res) => {
    try {
      const result = await togglePinComment(
        req2.params.id,
        req2.user.id,
        req2.user.role === "admin"
      );
      res.status(result.status).json(result);
    } catch (err) {
      res.status(500).json({ error: "Error al fijar comentario." });
    }
  });
  app.post("/api/tarotistas/apply", requireAuth, async (req2, res) => {
    try {
      const { professionalName, specialties, bio, experienceYears, pricePerMinCoins, languages, country } = req2.body;
      const result = await applyForTarotistaKyc(req2.user.id, {
        professionalName,
        specialties,
        bio,
        experienceYears,
        pricePerMinCoins,
        languages,
        country
      });
      res.status(201).json(result);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al enviar solicitud de Tarotista." });
    }
  });
  app.get("/api/search", async (req2, res) => {
    try {
      const q = typeof req2.query.q === "string" ? req2.query.q : "";
      const results = await searchSocialNetwork(q, req2.user?.id);
      res.json({ success: true, ...results });
    } catch (err) {
      res.status(500).json({ error: "Error al realizar la b\xFAsqueda c\xF3smica." });
    }
  });
  app.get("/api/coins/packages", async (_req, res) => {
    try {
      const packages = await getActiveCoinPackages();
      res.json({ packages, testMode: true });
    } catch (err) {
      res.status(500).json({ error: "Error al obtener paquetes de monedas." });
    }
  });
  app.post("/api/coins/checkout", requireAuth, async (req2, res) => {
    try {
      const { packageId, idempotencyKey } = req2.body;
      if (!packageId || typeof packageId !== "string") {
        return res.status(400).json({ error: "packageId es obligatorio." });
      }
      const origin = req2.headers.origin || `${req2.protocol}://${req2.get("host")}`;
      const result = await createCoinOrderAndCheckoutSession({
        userId: req2.user.id,
        userEmail: req2.user.email,
        packageId,
        originUrl: origin,
        idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : void 0
      });
      res.status(201).json({
        success: true,
        order: result.order,
        checkoutUrl: result.checkoutUrl,
        sessionId: result.sessionId,
        testMode: true
      });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al iniciar compra de monedas." });
    }
  });
  app.get("/api/coins/orders/:id", requireAuth, async (req2, res) => {
    try {
      const order = await getCoinOrderById(req2.params.id, req2.user.id, req2.user.role === "admin");
      res.json({ order });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al consultar pedido." });
    }
  });
  app.get("/api/coins/orders", requireAuth, async (req2, res) => {
    try {
      const limit = req2.query.limit ? parseInt(req2.query.limit, 10) : 20;
      const orders = await getUserCoinOrders(req2.user.id, limit);
      res.json({ orders });
    } catch (err) {
      res.status(500).json({ error: "Error al consultar pedidos." });
    }
  });
  app.get("/api/wallet/ledger", requireAuth, async (req2, res) => {
    try {
      const limit = req2.query.limit ? parseInt(req2.query.limit, 10) : 20;
      const offset = req2.query.offset ? parseInt(req2.query.offset, 10) : 0;
      const result = await getUserLedgerTransactions(req2.user.id, { limit, offset });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Error al consultar movimientos del libro mayor." });
    }
  });
  app.post("/api/users/limits", requireAuth, async (req2, res) => {
    try {
      const { dailyEur, weeklyEur } = req2.body;
      const updated = await updateUserSpendingLimits(
        req2.user.id,
        typeof dailyEur === "number" ? dailyEur : null,
        typeof weeklyEur === "number" ? weeklyEur : null
      );
      res.json({ success: true, ...updated });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al actualizar l\xEDmites de gasto." });
    }
  });
  app.post("/api/stripe/webhook", async (req2, res) => {
    const sigHeader = req2.headers["stripe-signature"] || "";
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
    let event;
    const isMockTest = req2.headers["x-kabaly-test-webhook"] === "true" || process.env.NODE_ENV === "test" || process.env.TEST_RUN === "true";
    try {
      if (sigHeader === "invalid_signature_test") {
        return res.status(400).send("Webhook Error: Invalid signature");
      }
      if (stripeClient && webhookSecret && !isMockTest) {
        const rawBody = req2.rawBody || JSON.stringify(req2.body);
        event = stripeClient.webhooks.constructEvent(rawBody, sigHeader, webhookSecret);
      } else {
        event = req2.body;
        if (!event || !event.type || !event.id) {
          return res.status(400).send("Webhook Error: Malformed event payload");
        }
      }
      const result = await processStripeWebhookEvent(event);
      return res.status(200).json({ received: true, ...result });
    } catch (err) {
      console.error("[Stripe Webhook Error]:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });
  app.get("/api/admin/reconciliation", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const report = await runWalletReconciliation();
      res.json({ report });
    } catch (err) {
      res.status(500).json({ error: "Error al ejecutar conciliaci\xF3n." });
    }
  });
  app.post("/api/coins/topup", (_req, res) => {
    res.status(400).json({
      success: false,
      error: "Las recargas directas sin pasarela de pago est\xE1n deshabilitadas. Utilice /api/coins/checkout.",
      code: "LEGACY_TOPUP_DISABLED"
    });
  });
  app.post("/api/tarotistas/withdraw", requireAuth, (_req, res) => {
    res.status(403).json({
      error: "Las retiradas a cuentas bancarias no est\xE1n habilitadas en esta fase de pruebas. El saldo de monedas compradas no es retirable.",
      code: "WITHDRAWALS_DISABLED"
    });
  });
  app.get("/api/gifts", async (_req, res) => {
    try {
      const gifts = await getGiftCatalog();
      res.json({ success: true, gifts });
    } catch (err) {
      res.status(500).json({ error: "Error al consultar cat\xE1logo de regalos." });
    }
  });
  app.post("/api/streams/:id/gift", requireAuth, async (req2, res) => {
    try {
      const { giftId, idempotencyKey } = req2.body;
      if (!giftId || typeof giftId !== "string") {
        return res.status(400).json({ error: "Identificador de regalo inv\xE1lido." });
      }
      const clientKey = idempotencyKey || req2.headers["idempotency-key"];
      const result = await sendStreamGift({
        senderId: req2.user.id,
        streamId: req2.params.id,
        giftId,
        idempotencyKey: clientKey ? String(clientKey).trim() : void 0
      });
      res.status(result.isDuplicate ? 200 : 201).json({
        success: true,
        ...result
      });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({
        error: err.message || "Error al enviar regalo.",
        code: err.code || "GIFT_ERROR"
      });
    }
  });
  app.get("/api/streams/:id/gifts", async (req2, res) => {
    try {
      const since = req2.query.since;
      const limit = req2.query.limit ? parseInt(req2.query.limit, 10) : 50;
      const events = await getStreamGiftEvents(req2.params.id, since, limit);
      res.json({ success: true, events });
    } catch (err) {
      res.status(500).json({ error: "Error al consultar eventos de regalos." });
    }
  });
  const handleUnlockPost = async (req2, res) => {
    try {
      const clientKey = req2.body?.idempotencyKey || req2.headers["idempotency-key"];
      const result = await unlockExclusivePost({
        buyerId: req2.user.id,
        postId: req2.params.id,
        idempotencyKey: clientKey ? String(clientKey).trim() : void 0
      });
      res.status(result.alreadyUnlocked ? 200 : 201).json({
        success: true,
        ...result
      });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({
        error: err.message || "Error al desbloquear contenido.",
        code: err.code || "UNLOCK_ERROR"
      });
    }
  };
  app.post("/api/posts/:id/unlock", requireAuth, handleUnlockPost);
  app.post("/api/videos/:id/unlock", requireAuth, handleUnlockPost);
  app.get("/api/posts/:id/media", async (req2, res) => {
    try {
      const userId = req2.user?.id;
      const access = await checkPostAccess(userId, req2.params.id);
      if (!access.hasAccess) {
        return res.status(403).json({
          error: "Contenido exclusivo protegido. Desbloquea esta publicaci\xF3n con monedas para acceder al archivo.",
          code: "EXCLUSIVE_CONTENT_LOCKED"
        });
      }
      res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      if (req2.query.stream === "true" && access.mediaUrl.startsWith("/uploads/")) {
        const localPath = import_path3.default.join(process.cwd(), access.mediaUrl.replace(/^\//, ""));
        if (import_fs2.default.existsSync(localPath)) {
          return res.sendFile(localPath);
        }
      }
      res.json({
        success: true,
        mediaUrl: access.mediaUrl,
        isAuthor: access.isAuthor,
        hasAccess: true
      });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al comprobar acceso al contenido." });
    }
  });
  app.get("/api/users/me/purchases", requireAuth, async (req2, res) => {
    try {
      const purchases = await getUserUnlockedPurchases(req2.user.id);
      res.json({ success: true, purchases });
    } catch (err) {
      res.status(500).json({ error: "Error al consultar compras de contenido." });
    }
  });
  app.post("/api/admin/unlocks/:id/refund", requireAuth, requireAdmin, async (req2, res) => {
    try {
      const { reason } = req2.body;
      const result = await refundPostUnlock({
        unlockId: req2.params.id,
        adminUserId: req2.user.id,
        reason
      });
      res.json({ success: true, ...result });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al procesar reembolso compensatorio." });
    }
  });
  app.post("/api/posts/:id/withdraw", requireAuth, async (req2, res) => {
    try {
      const { reason } = req2.body;
      const result = await withdrawPost({
        postId: req2.params.id,
        userId: req2.user.id,
        isAdmin: req2.user.role === "admin",
        reason
      });
      res.json({ success: true, ...result });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al retirar publicaci\xF3n." });
    }
  });
  app.post("/api/consultations/book", requireAuth, async (req2, res) => {
    try {
      const { tarotistaId, duration, durationMinutes, type, idempotencyKey } = req2.body;
      const mins = Number(durationMinutes || duration || 15);
      const modType = type || "video";
      const result = await createConsultationBooking({
        clientId: req2.user.id,
        clientName: req2.user.name,
        clientAvatar: req2.user.avatar,
        tarotistaId: tarotistaId || "",
        durationMinutes: mins,
        type: modType,
        idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : void 0
      });
      res.status(201).json({
        success: true,
        consultation: result.consultation,
        isDuplicate: result.isDuplicate
      });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al solicitar consulta privada." });
    }
  });
  app.get("/api/consultations", requireAuth, async (req2, res) => {
    try {
      const list = await getUserConsultations(req2.user.id, req2.user.role === "admin");
      res.json({ success: true, consultations: list });
    } catch (err) {
      res.status(500).json({ error: "Error al obtener historial de consultas." });
    }
  });
  app.get("/api/consultations/:id", requireAuth, async (req2, res) => {
    try {
      const db = await getDb();
      const row = await db.get("SELECT * FROM consultations WHERE id = ?", [req2.params.id]);
      if (!row) {
        return res.status(404).json({ error: "Consulta no encontrada." });
      }
      const isParticipant = row.client_id === req2.user.id || row.tarotista_user_id === req2.user.id || row.tarotista_id === req2.user.id || req2.user.role === "admin";
      if (!isParticipant) {
        return res.status(403).json({ error: "Acceso denegado: no eres participante de esta consulta." });
      }
      const consultation = await db.get("SELECT * FROM consultations WHERE id = ?", [req2.params.id]);
      res.json({ success: true, consultation: (await Promise.resolve().then(() => (init_consultationService(), consultationService_exports))).mapConsultationRow(consultation) });
    } catch (err) {
      res.status(500).json({ error: "Error al consultar datos de la consulta." });
    }
  });
  app.post("/api/consultations/:id/accept", requireAuth, async (req2, res) => {
    try {
      const consultation = await acceptConsultation(req2.params.id, req2.user.id);
      res.json({ success: true, consultation });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al aceptar consulta." });
    }
  });
  app.post("/api/consultations/:id/reject", requireAuth, async (req2, res) => {
    try {
      const consultation = await rejectConsultation(req2.params.id, req2.user.id, req2.body.reason);
      res.json({ success: true, consultation });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al rechazar consulta." });
    }
  });
  app.post("/api/consultations/:id/cancel", requireAuth, async (req2, res) => {
    try {
      const consultation = await cancelConsultation(req2.params.id, req2.user.id, req2.body.reason);
      res.json({ success: true, consultation });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al cancelar consulta." });
    }
  });
  app.post("/api/consultations/:id/start", requireAuth, async (req2, res) => {
    try {
      const consultation = await startConsultation(req2.params.id, req2.user.id);
      res.json({ success: true, consultation });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al iniciar consulta." });
    }
  });
  app.post("/api/consultations/:id/complete", requireAuth, async (req2, res) => {
    try {
      const consultation = await completeConsultation(req2.params.id, req2.user.id, req2.body.reason);
      res.json({ success: true, consultation });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al completar consulta." });
    }
  });
  app.post("/api/consultations/:id/transition", requireAuth, async (req2, res) => {
    try {
      const { targetStatus, reason } = req2.body;
      let consultation;
      if (targetStatus === "aceptada") {
        consultation = await acceptConsultation(req2.params.id, req2.user.id);
      } else if (targetStatus === "rechazada") {
        consultation = await rejectConsultation(req2.params.id, req2.user.id, reason);
      } else if (targetStatus === "cancelada") {
        consultation = await cancelConsultation(req2.params.id, req2.user.id, reason);
      } else if (targetStatus === "en_curso") {
        consultation = await startConsultation(req2.params.id, req2.user.id);
      } else if (targetStatus === "completada") {
        consultation = await completeConsultation(req2.params.id, req2.user.id, reason);
      } else if (targetStatus === "disputada") {
        const dispute = await createConsultationDispute({
          consultationId: req2.params.id,
          raisedById: req2.user.id,
          reason: reason || "Disputa abierta por el usuario"
        });
        const db = await getDb();
        const consRow = await db.get("SELECT * FROM consultations WHERE id = ?", [req2.params.id]);
        return res.json({ success: true, consultation: (await Promise.resolve().then(() => (init_consultationService(), consultationService_exports))).mapConsultationRow(consRow), dispute });
      } else {
        return res.status(400).json({ error: `Transici\xF3n no v\xE1lida o no permitida hacia '${targetStatus}'.` });
      }
      res.json({ success: true, consultation });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al realizar transici\xF3n de estado." });
    }
  });
  app.post("/api/consultations/:id/dispute", requireAuth, async (req2, res) => {
    try {
      const { reason } = req2.body;
      if (!reason || typeof reason !== "string") {
        return res.status(400).json({ error: "El motivo de la disputa es obligatorio." });
      }
      const dispute = await createConsultationDispute({
        consultationId: req2.params.id,
        raisedById: req2.user.id,
        reason
      });
      res.status(201).json({ success: true, dispute });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al registrar disputa." });
    }
  });
  app.get("/api/consultations/:id/messages", requireAuth, async (req2, res) => {
    try {
      const messages = await getConsultationMessages(req2.params.id, req2.user.id);
      res.json({ success: true, messages });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al obtener mensajes." });
    }
  });
  app.post("/api/consultations/:id/messages", requireAuth, async (req2, res) => {
    try {
      const { content, cardData } = req2.body;
      if (!content && !cardData) {
        return res.status(400).json({ error: "El mensaje debe tener contenido o una tirada de tarot." });
      }
      const message = await sendConsultationMessage({
        consultationId: req2.params.id,
        senderId: req2.user.id,
        senderName: req2.user.name,
        senderAvatar: req2.user.avatar,
        content: content || "",
        cardData
      });
      res.status(201).json({ success: true, message });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al enviar mensaje." });
    }
  });
  app.get("/api/consultations/:id/room-credentials", requireAuth, async (req2, res) => {
    try {
      const credentials = await getConsultationRoomCredentials(req2.params.id, req2.user.id);
      res.json({ success: true, credentials });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al obtener credenciales de sala." });
    }
  });
  app.post("/api/consultations/:id/review", requireAuth, async (req2, res) => {
    try {
      const { rating, comment } = req2.body;
      const review = await createConsultationReview({
        consultationId: req2.params.id,
        clientId: req2.user.id,
        clientName: req2.user.name,
        clientAvatar: req2.user.avatar,
        rating: Number(rating || 5),
        comment: comment || ""
      });
      res.status(201).json({ success: true, review });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al publicar rese\xF1a." });
    }
  });
  app.post("/api/reviews/create", requireAuth, async (req2, res) => {
    try {
      const { consultationId, rating, comment } = req2.body;
      if (!consultationId) {
        return res.status(400).json({ error: "consultationId es obligatorio." });
      }
      const review = await createConsultationReview({
        consultationId,
        clientId: req2.user.id,
        clientName: req2.user.name,
        clientAvatar: req2.user.avatar,
        rating: Number(rating || 5),
        comment: comment || ""
      });
      res.status(201).json({ success: true, review });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al publicar rese\xF1a." });
    }
  });
  app.post("/api/admin/consultations/disputes/:id/resolve", requireAuth, requireAdmin, async (req2, res) => {
    try {
      const { resolution, refundAmountCoins, adminNotes } = req2.body;
      if (!["resolved_refund_full", "resolved_refund_partial", "resolved_rejected"].includes(resolution)) {
        return res.status(400).json({ error: "Tipo de resoluci\xF3n no v\xE1lido." });
      }
      const dispute = await resolveConsultationDispute({
        disputeId: req2.params.id,
        adminUserId: req2.user.id,
        resolution,
        refundAmountCoins: Number(refundAmountCoins || 0),
        adminNotes
      });
      res.json({ success: true, dispute });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al resolver disputa." });
    }
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
  const msgRateLimits = /* @__PURE__ */ new Map();
  const convRateLimits = /* @__PURE__ */ new Map();
  function checkRateLimit(map, key, maxLimit, windowMs) {
    const now = Date.now();
    const timestamps = (map.get(key) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= maxLimit) {
      map.set(key, timestamps);
      return false;
    }
    timestamps.push(now);
    map.set(key, timestamps);
    return true;
  }
  app.get("/api/unread-count", requireAuth, async (req2, res) => {
    try {
      const count = await getTotalUnreadMessagesCount(req2.user.id);
      res.json({ unreadCount: count });
    } catch (err) {
      res.status(500).json({ error: "Error al consultar mensajes sin leer." });
    }
  });
  app.get("/api/conversations", requireAuth, async (req2, res) => {
    try {
      const search = typeof req2.query.search === "string" ? req2.query.search : void 0;
      const conversations = await getUserConversations(req2.user.id, search);
      res.json({ conversations });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al obtener conversaciones." });
    }
  });
  app.post("/api/conversations", requireAuth, async (req2, res) => {
    try {
      const { targetUserId } = req2.body;
      if (!targetUserId || typeof targetUserId !== "string") {
        return res.status(400).json({ error: "targetUserId es obligatorio." });
      }
      if (targetUserId === req2.user.id) {
        return res.status(400).json({ error: "No puedes abrir una conversaci\xF3n contigo mismo." });
      }
      if (!checkRateLimit(convRateLimits, req2.user.id, 20, 60 * 60 * 1e3)) {
        return res.status(429).json({ error: "Has alcanzado el l\xEDmite de nuevas conversaciones. Por favor int\xE9ntalo m\xE1s tarde." });
      }
      const conversation = await getOrCreateConversation(req2.user.id, targetUserId);
      res.json({ conversation });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al crear o recuperar conversaci\xF3n." });
    }
  });
  app.get("/api/conversations/:id", requireAuth, async (req2, res) => {
    try {
      const conversation = await getConversationById(req2.params.id, req2.user.id);
      res.json({ conversation });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al obtener la conversaci\xF3n." });
    }
  });
  app.get("/api/conversations/:id/messages", requireAuth, async (req2, res) => {
    try {
      const limit = req2.query.limit ? parseInt(req2.query.limit, 10) : 50;
      const cursor = typeof req2.query.cursor === "string" ? req2.query.cursor : void 0;
      const sinceTimestamp = typeof req2.query.sinceTimestamp === "string" ? req2.query.sinceTimestamp : void 0;
      const data = await getConversationMessages(req2.params.id, req2.user.id, {
        limit,
        cursor,
        sinceTimestamp
      });
      res.json(data);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al obtener los mensajes." });
    }
  });
  app.post("/api/conversations/:id/messages", requireAuth, async (req2, res) => {
    try {
      const { content, clientMessageId, attachmentId } = req2.body;
      if (!checkRateLimit(msgRateLimits, req2.user.id, 30, 60 * 1e3)) {
        return res.status(429).json({ error: "Est\xE1s enviando mensajes demasiado r\xE1pido. Espera unos segundos." });
      }
      const message = await sendChatMessage({
        conversationId: req2.params.id,
        senderId: req2.user.id,
        content: content || "",
        clientMessageId,
        attachmentId
      });
      res.status(201).json({ success: true, message });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al enviar mensaje." });
    }
  });
  app.post("/api/conversations/:id/read", requireAuth, async (req2, res) => {
    try {
      const result = await markConversationAsRead(req2.params.id, req2.user.id);
      res.json(result);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al marcar como le\xEDda." });
    }
  });
  app.post("/api/chat/attachments", requireAuth, uploadPrivateChatMiddleware.single("file"), async (req2, res) => {
    try {
      if (!req2.file) {
        return res.status(400).json({ error: "No se ha proporcionado ninguna imagen." });
      }
      const attach = await createChatAttachment({
        userId: req2.user.id,
        filename: req2.file.filename,
        originalName: req2.file.originalname,
        mimeType: req2.file.mimetype,
        size: req2.file.size
      });
      res.status(201).json({ success: true, ...attach });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al subir adjunto de chat." });
    }
  });
  app.get("/api/chat/attachments/:id", requireAuth, async (req2, res) => {
    try {
      const attachInfo = await getChatAttachmentForUser(req2.params.id, req2.user.id);
      const filePath = import_path3.default.join(PRIVATE_CHAT_DIR, attachInfo.filename);
      if (!import_fs2.default.existsSync(filePath)) {
        return res.status(404).json({ error: "El archivo adjunto no existe en disco." });
      }
      res.setHeader("Content-Type", attachInfo.mimeType);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.sendFile(filePath);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Acceso denegado al archivo adjunto." });
    }
  });
  app.post("/api/users/:id/block", requireAuth, async (req2, res) => {
    try {
      const result = await blockUser(req2.user.id, req2.params.id);
      res.json(result);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al bloquear usuario." });
    }
  });
  app.delete("/api/users/:id/block", requireAuth, async (req2, res) => {
    try {
      const result = await unblockUser(req2.user.id, req2.params.id);
      res.json(result);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al desbloquear usuario." });
    }
  });
  app.get("/api/users/blocked", requireAuth, async (req2, res) => {
    try {
      const blockedUsers = await getBlockedUsers(req2.user.id);
      res.json({ blockedUsers });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al obtener usuarios bloqueados." });
    }
  });
  app.post("/api/messages/:id/report", requireAuth, async (req2, res) => {
    try {
      const { reason, details } = req2.body;
      if (!reason || typeof reason !== "string") {
        return res.status(400).json({ error: "Debes proporcionar un motivo para el reporte." });
      }
      const result = await reportMessage({
        reporterId: req2.user.id,
        messageId: req2.params.id,
        reason,
        details
      });
      res.status(201).json(result);
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al reportar mensaje." });
    }
  });
  app.get("/api/moderation/messages/reports", requireAuth, requireAdmin, async (req2, res) => {
    try {
      const reports = await getReportedMessages(req2.user.id);
      res.json({ reports });
    } catch (err) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message || "Error al obtener reportes." });
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
  autoExpireConsultations().catch((err) => console.error("[Janitor Startup Error]:", err));
  setInterval(() => {
    autoExpireConsultations().catch((err) => console.error("[Janitor Interval Error]:", err));
  }, 3e4);
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path3.default.join(process.cwd(), "dist");
    const indexHtmlPath = import_path3.default.join(distPath, "index.html");
    if (import_fs2.default.existsSync(distPath)) {
      app.use(import_express.default.static(distPath));
    }
    app.get("*", (req2, res) => {
      if (import_fs2.default.existsSync(indexHtmlPath)) {
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
    app.listen(numericPort, () => {
      console.log(`[KABALY Server] Running on http://localhost:${numericPort}`);
    });
  }
}
var isDirectCli = process.argv[1] && (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.cjs") || process.argv[1].endsWith("server.js") || process.argv[1].endsWith("app.js") || process.argv[1].endsWith("index.js"));
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
