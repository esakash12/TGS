// ============================================================================
// Platform Name: Bot by mogent (bot.mogent.tech)
// Autonomous Telegram Commerce Cloud - Constants & System Config
// ============================================================================

export const APP_NAME = 'Bot by mogent';
export const APP_DOMAIN = 'bot.mogent.tech';
export const GODMODE_SECRET_TOKEN = 'hkjhl-sadmin-godmode-2026';
export const GODMODE_SECRET_PATH = '/secure/hkjhl/sadmin';

export const DEFAULT_USD_TO_BDT_RATE = 125.0;
export const DEFAULT_PLATFORM_FEE_FIXED_USD = 0.01;
export const DEFAULT_PLATFORM_FEE_PCT = 0.0;

export const UPSTREAM_DIGITALCORE_BASE_URL = 'https://digitalcore.top';
export const UPSTREAM_CANBOSO_BASE_URL = 'https://canboso.com';
export const UPSTREAM_VEXORIX_BASE_URL = 'https://207-148-64-141.sslip.io';

export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price_bdt: 999,
    price_usd: 8.0,
    max_products: 50,
    features: ['1 Active Telegram Bot', 'Up to 50 Products', 'bKash / Nagad Manual Approval', 'Community Support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    popular: true,
    price_bdt: 2499,
    price_usd: 20.0,
    max_products: 250,
    features: ['3 Active Telegram Bots', 'Unlimited Products', 'Instant Binance Pay Auto-Deposit', 'Wholesale Reseller Access', 'Priority Telegram Support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price_bdt: 5999,
    price_usd: 48.0,
    max_products: 1000,
    features: ['Unlimited Telegram Bots', 'Custom Domain (CNAME)', 'Zero Platform Wholesale Fees', 'Dedicated Account Manager', 'Custom API Integrations'],
  },
];
