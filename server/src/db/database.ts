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
  // 1. Pre-migration: If tables exist from earlier versions, ensure missing columns are added before running schema SQL
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    const tableNames = new Set(tables.map((t: any) => t.name));

    if (tableNames.has('subscription_plans')) {
      const planCols = (db.prepare("PRAGMA table_info(subscription_plans)").all() as any[]).map((c: any) => c.name);
      if (!planCols.includes('max_resale_products')) {
        db.exec("ALTER TABLE subscription_plans ADD COLUMN max_resale_products INTEGER DEFAULT 5;");
        console.log('✅ Pre-migrated subscription_plans: added max_resale_products column');
      }
      if (!planCols.includes('max_custom_products')) {
        db.exec("ALTER TABLE subscription_plans ADD COLUMN max_custom_products INTEGER DEFAULT 50;");
        console.log('✅ Pre-migrated subscription_plans: added max_custom_products column');
      }
    }

    if (tableNames.has('tenants')) {
      const tenantCols = (db.prepare("PRAGMA table_info(tenants)").all() as any[]).map((c: any) => c.name);
      if (!tenantCols.includes('about_text')) db.exec("ALTER TABLE tenants ADD COLUMN about_text TEXT;");
      if (!tenantCols.includes('support_text')) db.exec("ALTER TABLE tenants ADD COLUMN support_text TEXT;");
      if (!tenantCols.includes('welcome_text')) db.exec("ALTER TABLE tenants ADD COLUMN welcome_text TEXT;");
      if (!tenantCols.includes('categories_enabled')) db.exec("ALTER TABLE tenants ADD COLUMN categories_enabled INTEGER DEFAULT 1;");
      if (!tenantCols.includes('subscription_cycle')) db.exec("ALTER TABLE tenants ADD COLUMN subscription_cycle TEXT DEFAULT 'MONTHLY';");
      if (!tenantCols.includes('subscription_status')) db.exec("ALTER TABLE tenants ADD COLUMN subscription_status TEXT DEFAULT 'EXPIRED';");
      if (!tenantCols.includes('subscription_started_at')) {
        db.exec("ALTER TABLE tenants ADD COLUMN subscription_started_at TIMESTAMP;");
        db.exec("UPDATE tenants SET subscription_started_at = CURRENT_TIMESTAMP WHERE subscription_started_at IS NULL;");
        console.log('✅ Pre-migrated tenants: added subscription_started_at column');
      }
      if (!tenantCols.includes('subscription_expires_at')) db.exec("ALTER TABLE tenants ADD COLUMN subscription_expires_at TIMESTAMP;");
      if (!tenantCols.includes('trial_ends_at')) db.exec("ALTER TABLE tenants ADD COLUMN trial_ends_at TIMESTAMP;");
    }

    if (tableNames.has('products')) {
      const prodCols = (db.prepare("PRAGMA table_info(products)").all() as any[]).map((c: any) => c.name);
      if (!prodCols.includes('group_id')) db.exec("ALTER TABLE products ADD COLUMN group_id TEXT REFERENCES product_groups(id) ON DELETE SET NULL;");
      if (!prodCols.includes('markup_fixed_usd')) db.exec("ALTER TABLE products ADD COLUMN markup_fixed_usd NUMERIC DEFAULT 0.0;");
      if (!prodCols.includes('markup_pct')) db.exec("ALTER TABLE products ADD COLUMN markup_pct NUMERIC DEFAULT 0.0;");
      if (!prodCols.includes('pricing_mode')) db.exec("ALTER TABLE products ADD COLUMN pricing_mode TEXT DEFAULT 'fixed';");
    }
  } catch (err: any) {
    console.warn('Pre-migration check notice:', err.message);
  }

  // 2. Initialize database schema (CREATE TABLE IF NOT EXISTS...)
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // 3. Post-migration: Seed and sync default subscription plans
  try {
    const insertPlanStmt = db.prepare(`
      INSERT OR IGNORE INTO subscription_plans (
        id, name, description, price_monthly_usd, price_yearly_usd, max_products, max_resale_products, max_custom_products,
        allow_wholesale, allow_binance_pay, allow_custom_branding, features_json, is_popular, is_active, sort_order
      ) VALUES (
        @id, @name, @description, @price_monthly_usd, @price_yearly_usd, @max_products, @max_resale_products, @max_custom_products,
        @allow_wholesale, @allow_binance_pay, @allow_custom_branding, @features_json, @is_popular, @is_active, @sort_order
      )
    `);

    const defaultPlans = [
      {
        id: 'starter',
        name: 'Starter Cloud',
        description: 'Perfect for newly launched digital stores',
        price_monthly_usd: 8.00,
        price_yearly_usd: 80.00,
        max_products: 50,
        max_resale_products: 1,
        max_custom_products: 50,
        allow_wholesale: 1,
        allow_binance_pay: 1,
        allow_custom_branding: 0,
        features_json: '["1 Active Telegram Bot", "1 Wholesale Resale Product", "Up to 50 Custom Products", "bKash / Nagad Auto-Convert", "Instant Binance Pay SAPI", "Community Support"]',
        is_popular: 0,
        is_active: 1,
        sort_order: 1
      },
      {
        id: 'pro',
        name: 'Pro Merchant',
        description: 'Most popular choice for growing businesses',
        price_monthly_usd: 20.00,
        price_yearly_usd: 200.00,
        max_products: 250,
        max_resale_products: 25,
        max_custom_products: 250,
        allow_wholesale: 1,
        allow_binance_pay: 1,
        allow_custom_branding: 0,
        features_json: '["3 Active Telegram Bots", "25 Wholesale Resale Products", "Up to 250 Custom Products", "Instant Binance Pay Auto-Deposit", "Wholesale Reseller Access", "Auto Margin Engine", "Priority Telegram Support"]',
        is_popular: 1,
        is_active: 1,
        sort_order: 2
      },
      {
        id: 'enterprise',
        name: 'Enterprise VIP',
        description: 'Unlimited power for high-volume automated sellers',
        price_monthly_usd: 48.00,
        price_yearly_usd: 480.00,
        max_products: -1,
        max_resale_products: -1,
        max_custom_products: -1,
        allow_wholesale: 1,
        allow_binance_pay: 1,
        allow_custom_branding: 1,
        features_json: '["Unlimited Telegram Bots", "Unlimited Wholesale Products", "Unlimited Custom Products", "Zero Platform Wholesale Fees", "Custom Domain & Branding", "Dedicated Account Manager", "Custom API Integrations"]',
        is_popular: 0,
        is_active: 1,
        sort_order: 3
      }
    ];

    for (const p of defaultPlans) {
      insertPlanStmt.run(p);
    }

    // Sync default plan limits
    db.exec(`UPDATE subscription_plans SET max_resale_products = 1, max_custom_products = 50 WHERE id = 'starter';`);
    db.exec(`UPDATE subscription_plans SET max_resale_products = 25, max_custom_products = 250 WHERE id = 'pro';`);
    db.exec(`UPDATE subscription_plans SET max_resale_products = -1, max_custom_products = -1 WHERE id = 'enterprise';`);
  } catch (err: any) {
    console.warn('Subscription plans sync notice:', err.message);
  }

  console.log('✅ SQLite WAL Database initialized successfully at:', DB_PATH);
}


