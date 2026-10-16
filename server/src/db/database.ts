import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../../data/mogent.sqlite');

// Ensure data folder exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db: Database.Database = new Database(DB_PATH);

// Optimize SQLite for high-concurrency production on $7 Lightsail VPS
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('temp_store = MEMORY');
db.pragma('cache_size = -32000'); // 32MB cache limit to stay well within memory budget

export function initDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // Safe runtime migrations for existing production databases
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(products)`).all() as any[];
    const hasGroupId = tableInfo.some((col: any) => col.name === 'group_id');
    if (!hasGroupId) {
      db.exec(`ALTER TABLE products ADD COLUMN group_id TEXT REFERENCES product_groups(id) ON DELETE SET NULL;`);
      console.log('✅ Migrated products table: added group_id column');
    }
  } catch (err: any) {
    console.warn('Migration notice (group_id):', err.message);
  }

  console.log('✅ SQLite WAL Database initialized successfully at:', DB_PATH);
}

