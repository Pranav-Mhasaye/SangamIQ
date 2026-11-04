import { runner } from 'node-pg-migrate';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgrespassword@localhost:5432/sangamiq';

async function runMigrations() {
  console.log('🔄 Running SangamIQ database migrations...');
  console.log(`📡 Database URL: ${DATABASE_URL}`);

  try {
    await runner({
      databaseUrl: DATABASE_URL,
      dir: path.resolve(__dirname, '../migrations'),
      direction: 'up',
      migrationsTable: 'pgmigrations',
      verbose: true,
      singleTransaction: true,
    });
    console.log('✅ Migrations applied successfully!');
  } catch (err) {
    console.error(`\n❌ Migration failed: ${err.message}`);
    console.error('👉 Make sure PostgreSQL + PostGIS is running:');
    console.error('   docker compose up -d\n');
    process.exit(1);
  }
}

runMigrations();
