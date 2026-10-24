-- ============================================================================
-- Bot by mogent (bot.mogent.tech) - PostgreSQL Production Schema
-- Engine: PostgreSQL 14+ with Row-Level Locking (FOR UPDATE) & Concurrency
-- ============================================================================

-- 1. Global System Config (Super Admin God-Mode Settings)
CREATE TABLE IF NOT EXISTS global_system_config (
    id INT PRIMARY KEY CHECK (id = 1),
    wholesale_digitalcore_key TEXT DEFAULT '',
    wholesale_canboso_key TEXT DEFAULT '',
    wholesale_vexorix_key TEXT DEFAULT '',
    wholesale_prodseller_key TEXT DEFAULT '',
    wholesale_ssondigital_key TEXT DEFAULT '',
    wholesale_blinkey_key TEXT DEFAULT '',
    platform_fee_fixed_usd NUMERIC(14, 4) DEFAULT 0.01,
    platform_fee_pct NUMERIC(14, 4) DEFAULT 0.0,
    owner_binance_uid TEXT DEFAULT '',
    owner_binance_api_key_enc TEXT DEFAULT '',
    owner_binance_api_secret_enc TEXT DEFAULT '',
    godmode_telegram_id BIGINT,
    godmode_bot_token TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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
    wallet_usd NUMERIC(14, 4) DEFAULT 0.0,
    usd_to_bdt_rate NUMERIC(14, 4) DEFAULT 125.0,
    global_markup_pct NUMERIC(14, 4) DEFAULT 20.0,
    global_markup_fixed_usd NUMERIC(14, 4) DEFAULT 0.50,
    auto_markup_enabled INT DEFAULT 1,
    payment_numbers_json TEXT DEFAULT '{}',
    binance_config_json_enc TEXT DEFAULT '{}',
    about_text TEXT,
    support_text TEXT,
    welcome_text TEXT,
    categories_enabled INT DEFAULT 1,
    admin_telegram_id BIGINT,
    zinipay_api_key_enc TEXT DEFAULT '',
    zinipay_enabled INT DEFAULT 0,
    subscription_cycle TEXT DEFAULT 'MONTHLY',
    subscription_status TEXT DEFAULT 'TRIAL',
    subscription_started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    subscription_expires_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    log_channel_id TEXT DEFAULT '',
    log_purchases_enabled INT DEFAULT 1,
    log_deposits_enabled INT DEFAULT 1,
    auto_broadcast_price_drop INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- 2.1 Tenant Wholesale Wallets Per Provider (Mogent V1, V2, etc.)
CREATE TABLE IF NOT EXISTS tenant_api_wallets (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    wallet_usd NUMERIC(14, 4) DEFAULT 0.0,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_tenant_wallets ON tenant_api_wallets(tenant_id, provider);

-- 3. Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'merchant_admin',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3.1. Merchant Custom Product Groups / Folders
CREATE TABLE IF NOT EXISTS product_groups (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📁',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_groups_tenant ON product_groups(tenant_id);

-- 4. Products Table (100% USD-first)
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES product_groups(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    provider TEXT NOT NULL DEFAULT 'custom',
    provider_product_id TEXT,
    wholesale_price_usd NUMERIC(14, 4) DEFAULT 0.0,
    retail_price_usd NUMERIC(14, 4) NOT NULL,
    markup_fixed_usd NUMERIC(14, 4) DEFAULT 0.0,
    markup_pct NUMERIC(14, 4) DEFAULT 0.0,
    pricing_mode TEXT DEFAULT 'fixed',
    stock INT DEFAULT 0,
    is_active INT DEFAULT 1,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_provider ON products(provider, provider_product_id);

-- 5. Custom Product Inventory (Digital Account / Key Serial Pool)
CREATE TABLE IF NOT EXISTS custom_inventory (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    item_data TEXT NOT NULL,
    status TEXT DEFAULT 'AVAILABLE',
    delivered_to_order_id TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_inv_lookup ON custom_inventory(product_id, status);

-- 6. Telegram Customers
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    username TEXT,
    first_name TEXT,
    balance_usd NUMERIC(14, 4) DEFAULT 0.0,
    total_spent_usd NUMERIC(14, 4) DEFAULT 0.0,
    orders_count INT DEFAULT 0,
    language TEXT DEFAULT 'bn',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id, telegram_id);

-- 7. Deposits Table
CREATE TABLE IF NOT EXISTS deposits (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_telegram_id BIGINT NOT NULL,
    customer_username TEXT,
    method TEXT NOT NULL,
    amount_bdt NUMERIC(14, 4) NOT NULL,
    amount_usd NUMERIC(14, 4) NOT NULL,
    trx_id TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_active_trx 
ON deposits (tenant_id, trx_id) 
WHERE status IN ('PENDING', 'APPROVED');

-- 8. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_number TEXT UNIQUE NOT NULL,
    customer_telegram_id BIGINT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INT DEFAULT 1,
    total_price_usd NUMERIC(14, 4) NOT NULL,
    wholesale_cost_usd NUMERIC(14, 4) DEFAULT 0.0,
    profit_usd NUMERIC(14, 4) NOT NULL,
    delivered_data TEXT NOT NULL,
    provider_order_id TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(tenant_id, customer_telegram_id);

-- 9. Crypto Global Verified Transactions
CREATE TABLE IF NOT EXISTS crypto_verified_transactions (
    id SERIAL PRIMARY KEY,
    trx_id TEXT UNIQUE NOT NULL,
    order_id TEXT,
    transaction_id TEXT,
    payer_id TEXT,
    receiver_uid TEXT NOT NULL,
    amount_usd NUMERIC(14, 4) NOT NULL,
    purpose TEXT NOT NULL,
    tenant_id TEXT,
    verified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_order_id ON crypto_verified_transactions(order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_transaction_id ON crypto_verified_transactions(transaction_id) WHERE transaction_id IS NOT NULL;

-- 10. Platform Wholesale Catalog Rules
CREATE TABLE IF NOT EXISTS platform_wholesale_rules (
    provider_product_id TEXT PRIMARY KEY,
    is_active INT DEFAULT 1,
    min_plan_tier TEXT DEFAULT 'starter',
    custom_name TEXT,
    custom_price_usd NUMERIC(14, 4),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_monthly_usd NUMERIC(14, 4) NOT NULL,
    price_yearly_usd NUMERIC(14, 4) NOT NULL,
    max_products INT DEFAULT 50,
    max_resale_products INT DEFAULT 5,
    max_custom_products INT DEFAULT 50,
    allow_wholesale INT DEFAULT 1,
    allow_binance_pay INT DEFAULT 1,
    allow_custom_branding INT DEFAULT 0,
    features_json TEXT DEFAULT '[]',
    is_popular INT DEFAULT 0,
    is_active INT DEFAULT 1,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. Discount Coupons
CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL,
    discount_value NUMERIC(14, 4) NOT NULL,
    applicable_plan_id TEXT DEFAULT 'ALL',
    applicable_cycle TEXT DEFAULT 'ALL',
    min_spend_usd NUMERIC(14, 4) DEFAULT 0.0,
    max_uses INT DEFAULT -1,
    used_count INT DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. Subscription Payment Ledger
CREATE TABLE IF NOT EXISTS subscription_history (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
    billing_cycle TEXT NOT NULL,
    original_price_usd NUMERIC(14, 4) NOT NULL,
    discount_amount_usd NUMERIC(14, 4) DEFAULT 0.0,
    final_amount_paid_usd NUMERIC(14, 4) NOT NULL,
    coupon_id INT REFERENCES coupons(id),
    payment_method TEXT NOT NULL DEFAULT 'BINANCE_PAY',
    trx_id TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial default global config if empty
INSERT INTO global_system_config (id, platform_fee_fixed_usd, platform_fee_pct)
VALUES (1, 0.01, 0.0)
ON CONFLICT (id) DO NOTHING;

-- 15. Broadcast History
CREATE TABLE IF NOT EXISTS broadcast_history (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    broadcast_type VARCHAR(50) NOT NULL,
    product_id TEXT,
    title VARCHAR(255),
    message TEXT NOT NULL,
    target_recipients_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_tenant ON broadcast_history(tenant_id, created_at DESC);
