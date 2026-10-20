// ============================================================================
// Platform Name: Bot by mogent (bot.mogent.tech)
// Autonomous Telegram Commerce Cloud - Shared Contracts & Canonical Types
// Currency Standard: 100% Pure USD ($) with Dynamic Merchant BDT Conversion
// ============================================================================

export type TenantStatus = 'ACTIVE' | 'SUSPENDED';
export type UserRole = 'super_admin' | 'merchant_admin';
export type ProviderType = 'custom' | 'digitalcore' | 'canboso' | 'vexorix';
export type InventoryStatus = 'AVAILABLE' | 'DELIVERED';
export type DepositMethod = 'bKash' | 'Nagad' | 'Rocket' | 'Binance';
export type DepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type OrderStatus = 'COMPLETED' | 'FAILED';

export interface TenantPaymentNumbers {
  bkash?: string;
  nagad?: string;
  rocket?: string;
}

export interface TenantBinanceConfig {
  uid?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  bot_token?: string;
  bot_username?: string;
  plan_id: string;
  status: TenantStatus;
  wallet_usd: number;
  usd_to_bdt_rate: number; // e.g. 125.0
  global_markup_pct: number; // e.g. 20.0%
  global_markup_fixed_usd: number; // e.g. $0.50
  auto_markup_enabled: boolean;
  payment_numbers_json: TenantPaymentNumbers;
  binance_config_json: TenantBinanceConfig;
  about_text?: string;
  support_text?: string;
  welcome_text?: string;
  subscription_cycle?: 'MONTHLY' | 'YEARLY' | 'TRIAL';
  subscription_status?: 'TRIAL' | 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'SUSPENDED';
  subscription_started_at?: string;
  subscription_expires_at?: string;
  trial_ends_at?: string;
  created_at: string;
}

export interface AdminUser {
  id: number;
  tenant_id: string | null; // NULL for super_admin
  username: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
}

export interface ProductGroup {
  id: string;
  tenant_id: string;
  name: string;
  icon?: string;
  sort_order: number;
  product_count?: number;
  created_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  group_id?: string | null;
  group_name?: string | null;
  group_icon?: string | null;
  name: string;
  category: string;
  provider: ProviderType;
  provider_product_id?: string;
  wholesale_price_usd: number;
  retail_price_usd: number;
  markup_fixed_usd?: number;
  markup_pct?: number;
  pricing_mode?: 'fixed' | 'pct';
  stock: number;
  is_active: number; // 1 or 0
  description?: string;
  created_at: string;
}

export interface CustomInventoryItem {
  id: number;
  tenant_id: string;
  product_id: string;
  item_data: string;
  status: InventoryStatus;
  delivered_to_order_id?: string;
  created_at: string;
}

export interface Customer {
  id: number;
  tenant_id: string;
  telegram_id: number;
  username?: string;
  first_name?: string;
  balance_usd: number;
  total_spent_usd: number;
  orders_count: number;
  language: 'bn' | 'en';
  created_at: string;
}

export interface Deposit {
  id: number;
  tenant_id: string;
  customer_telegram_id: number;
  customer_username?: string;
  method: DepositMethod;
  amount_bdt: number;
  amount_usd: number;
  trx_id: string;
  status: DepositStatus;
  admin_note?: string;
  created_at: string;
  processed_at?: string;
}

export interface Order {
  id: number;
  tenant_id: string;
  order_number: string;
  customer_telegram_id: number;
  product_id: string;
  product_name: string;
  quantity: number;
  total_price_usd: number;
  wholesale_cost_usd: number;
  profit_usd: number;
  delivered_data: string;
  provider_order_id?: string;
  status: OrderStatus;
  created_at: string;
}

export interface GlobalSystemConfig {
  wholesale_digitalcore_key?: string;
  wholesale_canboso_key?: string;
  wholesale_vexorix_key?: string;
  platform_fee_fixed_usd: number; // default $0.01
  platform_fee_pct: number; // default 0.0%
  owner_binance_uid?: string;
  owner_binance_api_key?: string;
  owner_binance_api_secret?: string;
}

// API DTOs
export interface AuthResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
    role: UserRole;
    tenant_id: string | null;
  };
  tenant?: Tenant;
}

export interface PlatformWholesaleRule {
  provider_product_id: string;
  is_active: number; // 1 or 0
  min_plan_tier: 'starter' | 'pro' | 'enterprise';
  custom_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WholesaleProductDTO {
  id: string;
  name: string;
  provider: 'digitalcore' | 'canboso' | 'vexorix';
  base_price_usd: number;
  cost_with_platform_fee_usd: number; // Merchant sees this
  stock: number;
  category: string;
  icon?: string;
  description?: string;
  is_active_platform?: number; // 1 = available, 0 = globally disabled by owner
  min_plan_tier?: 'starter' | 'pro' | 'enterprise';
}

export interface BotRuntimeStatus {
  tenant_id: string;
  slug: string;
  bot_username: string | null;
  is_online: boolean;
  webhook_set: boolean;
  last_activity?: string;
  error?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price_monthly_usd: number;
  price_yearly_usd: number;
  max_products: number; // legacy fallback
  max_resale_products: number; // Wholesale / resale products limit (-1 for unlimited)
  max_custom_products: number; // Custom products limit (-1 for unlimited)
  allow_wholesale: number;
  allow_binance_pay: number;
  allow_custom_branding: number;
  features_json: string[];
  is_popular: number;
  is_active: number;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface Coupon {
  id: number;
  code: string;
  discount_type: 'PERCENTAGE' | 'FIXED_USD';
  discount_value: number;
  applicable_plan_id: string;
  applicable_cycle: 'ALL' | 'MONTHLY' | 'YEARLY';
  min_spend_usd: number;
  max_uses: number;
  used_count: number;
  expires_at?: string | null;
  is_active: number;
  created_at: string;
}

export interface SubscriptionHistory {
  id: number;
  tenant_id: string;
  plan_id: string;
  plan_name?: string;
  billing_cycle: 'MONTHLY' | 'YEARLY';
  original_price_usd: number;
  discount_amount_usd: number;
  final_amount_paid_usd: number;
  coupon_id?: number | null;
  payment_method: string;
  trx_id: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

