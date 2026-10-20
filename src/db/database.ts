import mysql from 'mysql2/promise';
import { 
  initialUsers, 
  initialTarotistaProfiles, 
  initialVideos, 
  initialLiveStreams, 
  initialConsultations, 
  initialReviews, 
  initialLedger, 
  initialReports, 
  initialWithdrawals 
} from '../data/initialData';
import {
  User,
  TarotistaProfile,
  Video,
  LiveStream,
  Consultation,
  LedgerTransaction,
  Review,
  Report,
  WithdrawalRequest
} from '../types';

export interface AppDatabaseState {
  users: User[];
  tarotistaProfiles: TarotistaProfile[];
  videos: Video[];
  liveStreams: LiveStream[];
  consultations: Consultation[];
  reviews: Review[];
  ledger: LedgerTransaction[];
  reports: Report[];
  withdrawals: WithdrawalRequest[];
}

let pool: mysql.Pool | null = null;
let isConnected = false;

export async function initDatabase(): Promise<AppDatabaseState> {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'u141101294_kabaly';
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME || 'u141101294_kabaly';
  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306;

  // Si no hay password configurada o se está en local sin mysql
  if (!password || password === 'TU_PASSWORD_AQUI') {
    console.log('[Database] Sin contraseña de MySQL configurada. Usando almacén en memoria.');
    return getFallbackState();
  }

  try {
    pool = mysql.createPool({
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

    // Probar conexión
    const connection = await pool.getConnection();
    console.log(`[Database] Conectado exitosamente a MySQL (${database}@${host})`);

    // Crear tabla de persistencia si no existe
    await connection.query(`
      CREATE TABLE IF NOT EXISTS astralis_store (
        store_key VARCHAR(64) PRIMARY KEY,
        store_value LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    connection.release();
    isConnected = true;

    // Cargar datos existentes o inicializar
    const state = await loadStateFromDb();
    return state;
  } catch (error: any) {
    console.warn(`[Database] Aviso al conectar con MySQL: ${error?.message || error}. Se usará almacenamiento en memoria.`);
    isConnected = false;
    return getFallbackState();
  }
}

async function loadStateFromDb(): Promise<AppDatabaseState> {
  if (!pool || !isConnected) return getFallbackState();

  try {
    const [rows]: any = await pool.query('SELECT store_key, store_value FROM astralis_store');
    const dbMap = new Map<string, any>();
    
    for (const row of rows) {
      try {
        dbMap.set(row.store_key, JSON.parse(row.store_value));
      } catch (e) {
        console.error(`[Database] Error parseando JSON para ${row.store_key}:`, e);
      }
    }

    // Si la tabla está vacía, inicializar con initialData
    if (dbMap.size === 0) {
      console.log('[Database] Base de datos vacía. Sembrando datos iniciales...');
      const defaultState = getFallbackState();
      for (const [key, val] of Object.entries(defaultState)) {
        await saveToDb(key, val);
      }
      return defaultState;
    }

    return {
      users: dbMap.get('users') || [...initialUsers],
      tarotistaProfiles: dbMap.get('tarotistaProfiles') || [...initialTarotistaProfiles],
      videos: dbMap.get('videos') || [...initialVideos],
      liveStreams: dbMap.get('liveStreams') || [...initialLiveStreams],
      consultations: dbMap.get('consultations') || [...initialConsultations],
      reviews: dbMap.get('reviews') || [...initialReviews],
      ledger: dbMap.get('ledger') || [...initialLedger],
      reports: dbMap.get('reports') || [...initialReports],
      withdrawals: dbMap.get('withdrawals') || [...initialWithdrawals],
    };
  } catch (error) {
    console.error('[Database] Error al cargar estado desde la base de datos:', error);
    return getFallbackState();
  }
}

export async function saveToDb(key: string, data: any): Promise<void> {
  if (!pool || !isConnected) return;

  try {
    const jsonStr = JSON.stringify(data);
    await pool.query(
      `INSERT INTO astralis_store (store_key, store_value) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE store_value = VALUES(store_value)`,
      [key, jsonStr]
    );
  } catch (err) {
    console.error(`[Database] Error guardando ${key} en MySQL:`, err);
  }
}

function getFallbackState(): AppDatabaseState {
  return {
    users: [...initialUsers],
    tarotistaProfiles: [...initialTarotistaProfiles],
    videos: [...initialVideos],
    liveStreams: [...initialLiveStreams],
    consultations: [...initialConsultations],
    reviews: [...initialReviews],
    ledger: [...initialLedger],
    reports: [...initialReports],
    withdrawals: [...initialWithdrawals],
  };
}
