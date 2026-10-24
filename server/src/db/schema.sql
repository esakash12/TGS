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
    wholesale_vexorix_key TEXT DEFAULT '',
    wholesale_prodseller_key TEXT DEFAULT '',
    wholesale_ssondigital_key TEXT DEFAULT '',
    platform_fee_fixed_usd NUMERIC DEFAULT 0.01,
    platform_fee_pct NUMERIC DEFAULT 0.0,
    owner_binance_uid TEXT DEFAULT '',
    owner_binance_api_key_enc TEXT DEFAULT '',
    owner_binance_api_secret_enc TEXT DEFAULT '',
    godmode_telegram_id INTEGER,
    godmode_bot_token TEXT DEFAULT '',
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
    about_text TEXT,
    support_text TEXT,
    welcome_text TEXT,
    categories_enabled INTEGER DEFAULT 1, -- 1 = Categories active (folders), 0 = Flat product list (no categories)
    admin_telegram_id INTEGER, -- Merchant's personal Telegram ID for instant deposit approval & notifications
    zinipay_api_key_enc TEXT DEFAULT '', -- Encrypted ZiniPay API key
    zinipay_enabled INTEGER DEFAULT 0, -- 1 = Enabled, 0 = Disabled
    log_channel_id TEXT DEFAULT '',
    log_purchases_enabled INTEGER DEFAULT 1,
    log_deposits_enabled INTEGER DEFAULT 1,
    auto_broadcast_price_drop INTEGER DEFAULT 0,
    subscription_cycle TEXT DEFAULT 'MONTHLY', -- MONTHLY, YEARLY, TRIAL
    subscription_status TEXT DEFAULT 'TRIAL', -- TRIAL, ACTIVE, GRACE, EXPIRED, SUSPENDED
    subscription_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subscription_expires_at TIMESTAMP,
    trial_ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.1 Tenant Wholesale Wallets Per Provider (Mogent V1, V2, etc.)
CREATE TABLE IF NOT EXISTS tenant_api_wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- digitalcore (Mogent V1), vexorix (Mogent V2), canboso
    wallet_usd NUMERIC DEFAULT 0.0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, provider)
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

-- 3.1. Merchant Custom Product Groups / Folders
CREATE TABLE IF NOT EXISTS product_groups (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📁',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Products Table (100% USD-first)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES product_groups(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    provider TEXT NOT NULL DEFAULT 'custom', -- custom, digitalcore, canboso
    provider_product_id TEXT,
    wholesale_price_usd NUMERIC DEFAULT 0.0,
    retail_price_usd NUMERIC NOT NULL,
    markup_fixed_usd NUMERIC DEFAULT 0.0,
    markup_pct NUMERIC DEFAULT 0.0,
    pricing_mode TEXT DEFAULT 'fixed', -- fixed, pct
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
    order_id TEXT,
    transaction_id TEXT,
    payer_id TEXT,
    receiver_uid TEXT NOT NULL,
    amount_usd NUMERIC NOT NULL,
    purpose TEXT NOT NULL, -- 'retail_deposit', 'wholesale_topup', 'subscription_payment'
    tenant_id TEXT,
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_order_id ON crypto_verified_transactions(order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_transaction_id ON crypto_verified_transactions(transaction_id) WHERE transaction_id IS NOT NULL;

-- 10. Platform Wholesale Catalog Rules (God-Mode Availability & Plan Tier Gating)
CREATE TABLE IF NOT EXISTS platform_wholesale_rules (
    provider_product_id TEXT PRIMARY KEY,
    is_active INTEGER DEFAULT 1,
    min_plan_tier TEXT DEFAULT 'starter', -- starter, pro, enterprise
    custom_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Subscription Plans (God-Mode Managed)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_monthly_usd NUMERIC NOT NULL,
    price_yearly_usd NUMERIC NOT NULL,
    max_products INTEGER DEFAULT 50,           -- -1 for unlimited (legacy fallback)
    max_resale_products INTEGER DEFAULT 5,     -- Wholesale/resale item limit (-1 for unlimited)
    max_custom_products INTEGER DEFAULT 50,    -- Custom digital item limit (-1 for unlimited)
    allow_wholesale INTEGER DEFAULT 1,
    allow_binance_pay INTEGER DEFAULT 1,
    allow_custom_branding INTEGER DEFAULT 0,
    features_json TEXT DEFAULT '[]',
    is_popular INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Discount Coupons
CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL,               -- 'PERCENTAGE' or 'FIXED_USD'
    discount_value NUMERIC NOT NULL,
    applicable_plan_id TEXT DEFAULT 'ALL',
    applicable_cycle TEXT DEFAULT 'ALL',       -- 'ALL', 'MONTHLY', 'YEARLY'
    min_spend_usd NUMERIC DEFAULT 0.0,
    max_uses INTEGER DEFAULT -1,               -- -1 for unlimited
    used_count INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Subscription Payment Ledger
CREATE TABLE IF NOT EXISTS subscription_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
    billing_cycle TEXT NOT NULL,               -- 'MONTHLY' or 'YEARLY'
    original_price_usd NUMERIC NOT NULL,
    discount_amount_usd NUMERIC DEFAULT 0.0,
    final_amount_paid_usd NUMERIC NOT NULL,
    coupon_id INTEGER REFERENCES coupons(id),
    payment_method TEXT NOT NULL DEFAULT 'BINANCE_PAY',
    trx_id TEXT NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial default global config if empty
INSERT OR IGNORE INTO global_system_config (id, platform_fee_fixed_usd, platform_fee_pct)
VALUES (1, 0.01, 0.0);




-- 15. Broadcast History
CREATE TABLE IF NOT EXISTS broadcast_history (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    broadcast_type TEXT NOT NULL,
    product_id TEXT,
    title TEXT,
    message TEXT NOT NULL,
    target_recipients_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_broadcast_tenant ON broadcast_history(tenant_id, created_at DESC);
