-- ============================================================================
-- Bot by mogent (bot.mogent.tech) - Clean Multi-Tenant SQLite WAL Database Schema
-- Currency: 100% Pure USD ($) Base Ledger with Dynamic Merchant BDT Conversion
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Global System Config (Super Admin God-Mode Settings)
CREATE TABLE IF NOT EXISTS global_system_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    wholesale_digitalcore_key TEXT DEFAULT '',
    wholesale_canboso_key TEXT DEFAULT '',
    platform_fee_fixed_usd NUMERIC DEFAULT 0.01,
    platform_fee_pct NUMERIC DEFAULT 0.0,
    owner_binance_uid TEXT DEFAULT '',
    owner_binance_api_key_enc TEXT DEFAULT '',
    owner_binance_api_secret_enc TEXT DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tenants Table (Merchants)
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_email TEXT NOT NULL,
    bot_token TEXT,
    bot_username TEXT,
    plan_id TEXT DEFAULT 'starter',
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED
    wallet_usd NUMERIC DEFAULT 0.0,
    usd_to_bdt_rate NUMERIC DEFAULT 125.0,
    global_markup_pct NUMERIC DEFAULT 20.0,
    global_markup_fixed_usd NUMERIC DEFAULT 0.50,
    auto_markup_enabled INTEGER DEFAULT 1,
    payment_numbers_json TEXT DEFAULT '{}', -- { bkash: "", nagad: "", rocket: "" }
    binance_config_json_enc TEXT DEFAULT '{}',  -- Encrypted { uid, apiKey, apiSecret }
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Admin Users (Platform Super Admin & Merchant Store Admins)
-- Note: tenant_id IS NULL for super_admin
CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'merchant_admin', -- super_admin, merchant_admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Products Table (100% USD-first)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    provider TEXT NOT NULL DEFAULT 'custom', -- custom, digitalcore, canboso
    provider_product_id TEXT,
    wholesale_price_usd NUMERIC DEFAULT 0.0,
    retail_price_usd NUMERIC NOT NULL,
    stock INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Custom Product Inventory (Digital Account / Key Serial Pool)
CREATE TABLE IF NOT EXISTS custom_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    item_data TEXT NOT NULL,
    status TEXT DEFAULT 'AVAILABLE', -- AVAILABLE, DELIVERED
    delivered_to_order_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Telegram Customers
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    telegram_id INTEGER NOT NULL,
    username TEXT,
    first_name TEXT,
    balance_usd NUMERIC DEFAULT 0.0,
    total_spent_usd NUMERIC DEFAULT 0.0,
    orders_count INTEGER DEFAULT 0,
    language TEXT DEFAULT 'bn', -- bn, en
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, telegram_id)
);

-- 7. Deposits Table
CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_telegram_id INTEGER NOT NULL,
    customer_username TEXT,
    method TEXT NOT NULL, -- bKash, Nagad, Rocket, Binance
    amount_bdt NUMERIC NOT NULL,
    amount_usd NUMERIC NOT NULL,
    trx_id TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    admin_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Index to ensure no duplicate pending/approved TrxID within same merchant
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_active_trx 
ON deposits (tenant_id, trx_id) 
WHERE status IN ('PENDING', 'APPROVED');

-- 8. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_number TEXT UNIQUE NOT NULL,
    customer_telegram_id INTEGER NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    total_price_usd NUMERIC NOT NULL,
    wholesale_cost_usd NUMERIC DEFAULT 0.0,
    profit_usd NUMERIC NOT NULL,
    delivered_data TEXT NOT NULL,
    provider_order_id TEXT,
    status TEXT NOT NULL, -- COMPLETED, FAILED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Crypto Global Verified Transactions (Replay-Attack Protection)
CREATE TABLE IF NOT EXISTS crypto_verified_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trx_id TEXT UNIQUE NOT NULL,
    payer_id TEXT,
    receiver_uid TEXT NOT NULL,
    amount_usd NUMERIC NOT NULL,
    purpose TEXT NOT NULL, -- 'retail_deposit' or 'wholesale_topup'
    tenant_id TEXT,
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial default global config if empty
INSERT OR IGNORE INTO global_system_config (id, platform_fee_fixed_usd, platform_fee_pct)
VALUES (1, 0.01, 0.0);
