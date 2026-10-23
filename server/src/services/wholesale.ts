import { db } from '../db/database';
import { WholesaleProductDTO } from '../../../shared/types';
import {
  cleanUpstreamText,
  cleanUpstreamDescription,
  extractCategoryFromProduct,
} from '../modules/wholesale/cleaner';
import { parseCanbosoStock } from '../modules/wholesale/providers/canboso.provider';
import { parseSsonDigitalStock } from '../modules/wholesale/providers/ssondigital.provider';
import { wholesaleRegistry } from '../modules/wholesale/providers/registry';
import { WholesaleProviderName } from '../modules/wholesale/providers/types';

// Re-export text cleaners and parsers so all callers retain full backward compatibility
export {
  cleanUpstreamText,
  cleanUpstreamDescription,
  extractCategoryFromProduct,
  parseCanbosoStock,
  parseSsonDigitalStock,
};

interface CachedCatalog {
  timestamp: number;
  products: WholesaleProductDTO[];
}

let catalogCache: CachedCatalog | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getGlobalWholesaleConfig() {
  const config = db.prepare('SELECT * FROM global_system_config WHERE id = 1').get() as any;
  return {
    digitalcoreKey: config?.wholesale_digitalcore_key || '',
    canbosoKey: config?.wholesale_canboso_key || '',
    vexorixKey: config?.wholesale_vexorix_key || '',
    prodsellerKey: config?.wholesale_prodseller_key || '',
    ssondigitalKey: config?.wholesale_ssondigital_key || '',
    platformFeeFixed: Number(config?.platform_fee_fixed_usd ?? 0.01),
    platformFeePct: Number(config?.platform_fee_pct ?? 0.0),
  };
}

export function invalidateWholesaleCache() {
  catalogCache = null;
}

export const PLAN_TIERS_RANK: Record<string, number> = {
  starter: 1,
  pro: 2,
  enterprise: 3,
};

// ========================================================
// Provider Balance Helpers (Delegated to Provider Modules)
// ========================================================

export async function getDigitalCoreBalance(): Promise<{ balance: number; currency: string } | null> {
  const { digitalcoreKey } = getGlobalWholesaleConfig();
  const provider = wholesaleRegistry.get('digitalcore');
  if (!provider || !digitalcoreKey) return null;
  return provider.getBalance(digitalcoreKey);
}

export async function getVexorixBalance(): Promise<{ balance: number; currency: string; username?: string } | null> {
  const { vexorixKey } = getGlobalWholesaleConfig();
  const provider = wholesaleRegistry.get('vexorix');
  if (!provider || !vexorixKey) return null;
  return provider.getBalance(vexorixKey);
}

export async function getProdSellerBalance(): Promise<{ balance: number; currency: string; username?: string } | null> {
  const { prodsellerKey } = getGlobalWholesaleConfig();
  const provider = wholesaleRegistry.get('prodseller');
  if (!provider || !prodsellerKey) return null;
  return provider.getBalance(prodsellerKey);
}

export async function getSsonDigitalBalance(): Promise<{ balance: number; currency: string; username?: string } | null> {
  const { ssondigitalKey } = getGlobalWholesaleConfig();
  const provider = wholesaleRegistry.get('ssondigital');
  if (!provider || !ssondigitalKey) return null;
  return provider.getBalance(ssondigitalKey);
}

export async function getCanbosoBalance(): Promise<{ balanceUsd: number; balanceVnd: number } | null> {
  const { canbosoKey } = getGlobalWholesaleConfig();
  const provider = wholesaleRegistry.get('canboso');
  if (!provider || !canbosoKey) return null;
  const res = await provider.getBalance(canbosoKey);
  if (!res) return null;
  return {
    balanceUsd: res.balance,
    balanceVnd: res.balanceVnd || 0,
  };
}

// ========================================================
// Live Catalog Fetching & Governance Rules Mapping
// ========================================================

export async function fetchLiveWholesaleCatalog(forceRefresh = false): Promise<WholesaleProductDTO[]> {
  const now = Date.now();
  if (!forceRefresh && catalogCache && now - catalogCache.timestamp < CACHE_TTL_MS) {
    return catalogCache.products;
  }

  const {
    digitalcoreKey,
    canbosoKey,
    vexorixKey,
    prodsellerKey,
    ssondigitalKey,
    platformFeeFixed,
    platformFeePct,
  } = getGlobalWholesaleConfig();

  const applyPlatformFee = (basePrice: number) => {
    const markup = basePrice * (platformFeePct / 100) + platformFeeFixed;
    return Number((basePrice + markup).toFixed(2));
  };

  const keyMap: Record<WholesaleProviderName, string> = {
    digitalcore: digitalcoreKey,
    canboso: canbosoKey,
    vexorix: vexorixKey,
    prodseller: prodsellerKey,
    ssondigital: ssondigitalKey,
  };

  // Fetch catalogs from all registered providers concurrently
  const providers = wholesaleRegistry.getAll();
  const catalogPromises = providers.map(async (provider) => {
    const key = keyMap[provider.name];
    if (!key) return [];
    try {
      return await provider.fetchCatalog(key, applyPlatformFee);
    } catch (err: any) {
      console.warn(`[${provider.displayName}] Failed to fetch catalog:`, err.message);
      return [];
    }
  });

  const results = await Promise.all(catalogPromises);
  const allProducts: WholesaleProductDTO[] = results.flat();

  // Augment with God-Mode Platform Wholesale Governance Rules
  const rules = db.prepare('SELECT * FROM platform_wholesale_rules').all() as any[];
  const rulesMap = new Map<string, any>();
  for (const r of rules) {
    rulesMap.set(r.provider_product_id, r);
  }

  for (const p of allProducts) {
    const rule = rulesMap.get(p.id);
    p.is_active_platform = rule ? rule.is_active : 1;
    p.min_plan_tier = rule ? rule.min_plan_tier : 'starter';
    if (rule?.custom_name) {
      p.name = rule.custom_name;
    }
    if (rule?.custom_price_usd !== undefined && rule?.custom_price_usd !== null && Number(rule.custom_price_usd) > 0) {
      p.cost_with_platform_fee_usd = Number(Number(rule.custom_price_usd).toFixed(2));
      p.custom_price_usd = p.cost_with_platform_fee_usd;
    }
  }

  catalogCache = {
    timestamp: now,
    products: allProducts,
  };

  return allProducts;
}

export function getCachedWholesaleCatalog(): WholesaleProductDTO[] | null {
  return catalogCache ? catalogCache.products : null;
}

export function getCachedProductLiveStock(providerProductId?: string | null): number | null {
  if (!providerProductId || !catalogCache) return null;
  const match = catalogCache.products.find(p => p.id === providerProductId);
  return match !== undefined && match.stock !== undefined ? Number(match.stock) : null;
}

export async function fetchLiveWholesaleCatalogForMerchant(
  merchantPlanId = 'starter',
  searchQuery?: string,
  forceRefresh = false
): Promise<WholesaleProductDTO[]> {
  let fullCatalog = await fetchLiveWholesaleCatalog(forceRefresh);
  if (fullCatalog.length === 0 && !forceRefresh) {
    fullCatalog = await fetchLiveWholesaleCatalog(true);
  }

  let filtered = fullCatalog.filter((item) => {
    // 1. If Site Owner deleted or disabled this product globally, it must NEVER show for merchants
    if (item.is_active_platform === 0) return false;
    return true;
  });

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.provider.toLowerCase().includes(q)
    );
  }

  return filtered;
}

export function isWholesaleProductGloballyActive(providerProductId: string): boolean {
  if (!providerProductId) return true;
  const rule = db.prepare('SELECT is_active FROM platform_wholesale_rules WHERE provider_product_id = ?').get(providerProductId) as any;
  if (!rule) return true; // Default active if no override
  return rule.is_active === 1;
}

// ========================================================
// Upstream Order Execution (Delegated to Provider Modules)
// ========================================================

export async function purchaseUpstreamProduct(params: {
  provider: 'digitalcore' | 'canboso' | 'vexorix' | 'prodseller' | 'ssondigital';
  providerProductId: string;
  quantity: number;
}): Promise<{ success: boolean; deliveredItems: string[]; orderId: string; error?: string }> {
  const { provider: providerName, providerProductId, quantity } = params;
  const config = getGlobalWholesaleConfig();

  const keyMap: Record<WholesaleProviderName, string> = {
    digitalcore: config.digitalcoreKey,
    canboso: config.canbosoKey,
    vexorix: config.vexorixKey,
    prodseller: config.prodsellerKey,
    ssondigital: config.ssondigitalKey,
  };

  const provider = wholesaleRegistry.get(providerName);
  if (!provider) {
    return { success: false, deliveredItems: [], orderId: '', error: `Unknown provider "${providerName}"` };
  }

  const key = keyMap[providerName];
  if (!key) {
    return { success: false, deliveredItems: [], orderId: '', error: `${provider.displayName} API Key is not configured in God-Mode` };
  }

  return provider.purchase(key, providerProductId, quantity);
}

// ========================================================
// Price & Stock Synchronization Across Tenants
// ========================================================

export async function syncLivePricesForTenant(tenantId: string): Promise<{ updatedCount: number; totalWholesale: number }> {
  const catalog = await fetchLiveWholesaleCatalog(true);
  const catalogMap = new Map<string, WholesaleProductDTO>();
  for (const item of catalog) {
    catalogMap.set(item.id, item);
  }

  const wholesaleProducts = db.prepare(`
    SELECT * FROM products WHERE tenant_id = ? AND provider != 'custom'
  `).all(tenantId) as any[];

  let updatedCount = 0;

  const updateTx = db.transaction(() => {
    for (const p of wholesaleProducts) {
      if (!p.provider_product_id) continue;
      const upstreamItem = catalogMap.get(p.provider_product_id);
      if (!upstreamItem) continue;

      const currentUpstreamCost = upstreamItem.cost_with_platform_fee_usd;
      let newRetailPrice = p.retail_price_usd;
      let fixedMargin: number | null = null;

      if (p.pricing_mode === 'pct' && p.markup_pct) {
        newRetailPrice = Number((currentUpstreamCost * (1 + p.markup_pct / 100)).toFixed(2));
      } else {
        // Fixed USD margin rule
        fixedMargin = p.markup_fixed_usd !== undefined && p.markup_fixed_usd !== null
          ? Number(p.markup_fixed_usd)
          : Math.max(0, Number((p.retail_price_usd - p.wholesale_price_usd).toFixed(2)));
        newRetailPrice = Number((currentUpstreamCost + fixedMargin).toFixed(2));
      }

      const upstreamStock = upstreamItem.stock !== undefined && upstreamItem.stock !== null ? Number(upstreamItem.stock) : 0;
      const upstreamDesc = upstreamItem.description || '';

      db.prepare(`
        UPDATE products
        SET wholesale_price_usd = ?,
            retail_price_usd = ?,
            markup_fixed_usd = COALESCE(markup_fixed_usd, ?),
            stock = ?,
            description = COALESCE(NULLIF(?, ''), description)
        WHERE id = ? AND tenant_id = ?
      `).run(currentUpstreamCost, newRetailPrice, fixedMargin, upstreamStock, upstreamDesc, p.id, tenantId);
      updatedCount++;
    }
  });

  updateTx();
  return { updatedCount, totalWholesale: wholesaleProducts.length };
}

export async function syncLivePricesForAllTenants(): Promise<number> {
  const tenants = db.prepare(`
    SELECT id FROM tenants 
    WHERE status = 'ACTIVE' 
      AND subscription_status = 'ACTIVE'
  `).all() as any[];

  let totalUpdated = 0;
  for (const t of tenants) {
    try {
      const res = await syncLivePricesForTenant(t.id);
      totalUpdated += res.updatedCount;
    } catch (err: any) {
      console.warn(`[Auto-Sync] Warning syncing tenant ${t.id}:`, err.message);
    }
  }
  return totalUpdated;
}
