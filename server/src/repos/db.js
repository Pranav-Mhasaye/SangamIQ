import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

let pool = null;
let memoryMode = process.env.USE_MEMORY_DB === 'true' || !process.env.DATABASE_URL;

if (!memoryMode) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 15,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2500,
    });

    pool.on('error', (err) => {
      console.warn('⚠️  PostgreSQL background client error:', err.message);
    });
  } catch (err) {
    console.warn('⚠️  Could not create PostgreSQL pool, using in-memory store:', err.message);
    memoryMode = true;
  }
}

export function isMemory() {
  return memoryMode;
}

export function setMemoryMode(val) {
  memoryMode = val;
}

export async function query(text, params) {
  if (memoryMode || !pool) {
    throw new Error('Database is in memory mode');
  }
  return pool.query(text, params);
}

export async function initDb() {
  if (memoryMode) {
    console.log('📦  SangamIQ running with IN-MEMORY store (USE_MEMORY_DB=true or no DATABASE_URL)');
    return;
  }

  try {
    const client = await pool.connect();
    const res = await client.query('SELECT postgis_full_version();');
    client.release();
    console.log('🐘  Connected to PostgreSQL + PostGIS:');
    console.log(`    ${res.rows[0].postgis_full_version.split('\n')[0]}`);
  } catch (err) {
    console.warn(`⚠️  PostgreSQL connection failed (${err.message}).`);
    console.warn('📦  Falling back to IN-MEMORY store for seamless operation.');
    memoryMode = true;
  }
}

export { pool };
