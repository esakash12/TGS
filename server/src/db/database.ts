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

    const hasMarkupFixed = tableInfo.some((col: any) => col.name === 'markup_fixed_usd');
    if (!hasMarkupFixed) {
      db.exec(`ALTER TABLE products ADD COLUMN markup_fixed_usd NUMERIC DEFAULT 0.0;`);
      console.log('✅ Migrated products table: added markup_fixed_usd column');
    }

    const hasMarkupPct = tableInfo.some((col: any) => col.name === 'markup_pct');
    if (!hasMarkupPct) {
      db.exec(`ALTER TABLE products ADD COLUMN markup_pct NUMERIC DEFAULT 0.0;`);
      console.log('✅ Migrated products table: added markup_pct column');
    }

    const hasPricingMode = tableInfo.some((col: any) => col.name === 'pricing_mode');
    if (!hasPricingMode) {
      db.exec(`ALTER TABLE products ADD COLUMN pricing_mode TEXT DEFAULT 'fixed';`);
      console.log('✅ Migrated products table: added pricing_mode column');
    }

    // Tenant customization columns
    try {
      const tenantTableInfo = db.prepare(`PRAGMA table_info(tenants)`).all() as any[];
      if (!tenantTableInfo.some((col: any) => col.name === 'about_text')) {
        db.exec(`ALTER TABLE tenants ADD COLUMN about_text TEXT;`);
        console.log('✅ Migrated tenants table: added about_text column');
      }
      if (!tenantTableInfo.some((col: any) => col.name === 'support_text')) {
        db.exec(`ALTER TABLE tenants ADD COLUMN support_text TEXT;`);
        console.log('✅ Migrated tenants table: added support_text column');
      }
      if (!tenantTableInfo.some((col: any) => col.name === 'welcome_text')) {
        db.exec(`ALTER TABLE tenants ADD COLUMN welcome_text TEXT;`);
        console.log('✅ Migrated tenants table: added welcome_text column');
      }
      if (!tenantTableInfo.some((col: any) => col.name === 'subscription_cycle')) {
        db.exec(`ALTER TABLE tenants ADD COLUMN subscription_cycle TEXT DEFAULT 'MONTHLY';`);
        console.log('✅ Migrated tenants table: added subscription_cycle column');
      }
      if (!tenantTableInfo.some((col: any) => col.name === 'subscription_status')) {
        db.exec(`ALTER TABLE tenants ADD COLUMN subscription_status TEXT DEFAULT 'EXPIRED';`);
        console.log('✅ Migrated tenants table: added subscription_status column');
      }
      if (!tenantTableInfo.some((col: any) => col.name === 'subscription_started_at')) {
        // SQLite ALTER TABLE does not allow non-constant DEFAULT CURRENT_TIMESTAMP
        db.exec(`ALTER TABLE tenants ADD COLUMN subscription_started_at TIMESTAMP;`);
        db.exec(`UPDATE tenants SET subscription_started_at = CURRENT_TIMESTAMP WHERE subscription_started_at IS NULL;`);
        console.log('✅ Migrated tenants table: added subscription_started_at column');
      }
      if (!tenantTableInfo.some((col: any) => col.name === 'subscription_expires_at')) {
        db.exec(`ALTER TABLE tenants ADD COLUMN subscription_expires_at TIMESTAMP;`);
        console.log('✅ Migrated tenants table: added subscription_expires_at column');
      }
      if (!tenantTableInfo.some((col: any) => col.name === 'trial_ends_at')) {
        db.exec(`ALTER TABLE tenants ADD COLUMN trial_ends_at TIMESTAMP;`);
        console.log('✅ Migrated tenants table: added trial_ends_at column');
      }
    } catch (err: any) {
      console.warn('Migration notice (tenants columns):', err.message);
    }

    // Subscription Plans separate limits (Wholesale/Resale vs Custom)
    try {
      const planTableInfo = db.prepare(`PRAGMA table_info(subscription_plans)`).all() as any[];
      if (!planTableInfo.some((col: any) => col.name === 'max_resale_products')) {
        db.exec(`ALTER TABLE subscription_plans ADD COLUMN max_resale_products INTEGER DEFAULT 5;`);
        console.log('✅ Migrated subscription_plans table: added max_resale_products column');
      }
      if (!planTableInfo.some((col: any) => col.name === 'max_custom_products')) {
        db.exec(`ALTER TABLE subscription_plans ADD COLUMN max_custom_products INTEGER DEFAULT 50;`);
        console.log('✅ Migrated subscription_plans table: added max_custom_products column');
      }

      // Sync default starter limits: 1 resale, 50 custom
      db.exec(`UPDATE subscription_plans SET max_resale_products = 1, max_custom_products = 50 WHERE id = 'starter';`);
      db.exec(`UPDATE subscription_plans SET max_resale_products = 25, max_custom_products = 250 WHERE id = 'pro';`);
      db.exec(`UPDATE subscription_plans SET max_resale_products = -1, max_custom_products = -1 WHERE id = 'enterprise';`);
    } catch (err: any) {
      console.warn('Migration notice (subscription_plans columns):', err.message);
    }
  } catch (err: any) {
    console.warn('Migration notice (columns):', err.message);
  }

  console.log('✅ SQLite WAL Database initialized successfully at:', DB_PATH);
}

