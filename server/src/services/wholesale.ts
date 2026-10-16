import axios from 'axios';
import { db } from '../db/database';
import {
  UPSTREAM_DIGITALCORE_BASE_URL,
  UPSTREAM_CANBOSO_BASE_URL,
} from '../../../shared/constants';
import { WholesaleProductDTO } from '../../../shared/types';

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
    platformFeeFixed: Number(config?.platform_fee_fixed_usd ?? 0.01),
    platformFeePct: Number(config?.platform_fee_pct ?? 0.0),
  };
}

export async function getDigitalCoreBalance(): Promise<{ balance: number; currency: string } | null> {
  const { digitalcoreKey } = getGlobalWholesaleConfig();
  if (!digitalcoreKey) return null;
  try {
    const res = await axios.get(`${UPSTREAM_DIGITALCORE_BASE_URL}/api/user/me`, {
      headers: { 'Api-Key': digitalcoreKey },
      timeout: 8000,
    });
    return {
      balance: Number(res.data.balance || 0),
      currency: res.data.currency || 'USD',
    };
  } catch (err: any) {
    console.error('DigitalCore balance check failed:', err.message);
    return null;
  }
}

export async function getCanbosoBalance(): Promise<{ balanceUsd: number; balanceVnd: number } | null> {
  const { canbosoKey } = getGlobalWholesaleConfig();
  if (!canbosoKey) return null;
  try {
    const res = await axios.get(`${UPSTREAM_CANBOSO_BASE_URL}/api/v2/telegram-buyer/balance`, {
      params: { key: canbosoKey },
      timeout: 8000,
    });
    return {
      balanceUsd: Number(res.data.balanceUsd || 0),
      balanceVnd: Number(res.data.balance || 0),
    };
  } catch (err: any) {
    console.error('Canboso balance check failed:', err.message);
    return null;
  }
}

export function invalidateWholesaleCache() {
  catalogCache = null;
}

export const PLAN_TIERS_RANK: Record<string, number> = {
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export async function fetchLiveWholesaleCatalog(forceRefresh = false): Promise<WholesaleProductDTO[]> {
  const now = Date.now();
  if (!forceRefresh && catalogCache && now - catalogCache.timestamp < CACHE_TTL_MS) {
    return catalogCache.products;
  }

  const { digitalcoreKey, canbosoKey, platformFeeFixed, platformFeePct } = getGlobalWholesaleConfig();
  const allProducts: WholesaleProductDTO[] = [];

  // Helper to calculate price with platform fee (e.g. +$0.01)
  const applyPlatformFee = (basePrice: number) => {
    const markup = basePrice * (platformFeePct / 100) + platformFeeFixed;
    return Number((basePrice + markup).toFixed(2));
  };

  // 1. Fetch from DigitalCore
  if (digitalcoreKey) {
    try {
      const res = await axios.get(`${UPSTREAM_DIGITALCORE_BASE_URL}/api/user/products`, {
        headers: { 'Api-Key': digitalcoreKey },
        timeout: 10000,
      });
      if (Array.isArray(res.data)) {
        for (const item of res.data) {
          const basePrice = Number(item.price || 0);
          allProducts.push({
            id: `dc_${item.id}`,
            name: item.name,
            provider: 'digitalcore',
            base_price_usd: basePrice,
            cost_with_platform_fee_usd: applyPlatformFee(basePrice),
            stock: Number(item.stock || 0),
            category: item.category || 'Digital Services',
          });
        }
      }
    } catch (err: any) {
      console.warn('DigitalCore catalog fetch warning:', err.message);
    }
  }

  // 2. Fetch from Canboso
  if (canbosoKey) {
    try {
      const res = await axios.get(`${UPSTREAM_CANBOSO_BASE_URL}/api/v2/telegram-buyer/products`, {
        params: { key: canbosoKey },
        timeout: 10000,
      });
      if (res.data?.success && Array.isArray(res.data.products)) {
        for (const item of res.data.products) {
          const basePrice = Number(item.price?.amount || 0);
          allProducts.push({
            id: `cb_${item.productId}`,
            name: item.name,
            provider: 'canboso',
            base_price_usd: basePrice,
            cost_with_platform_fee_usd: applyPlatformFee(basePrice),
            stock: Number(item.availability?.available ?? 999),
            category: 'VPN & Streaming',
          });
        }
      }
    } catch (err: any) {
      console.warn('Canboso catalog fetch warning:', err.message);
    }
  }

  // 3. Augment with God-Mode Platform Wholesale Governance Rules
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
  }

  catalogCache = {
    timestamp: now,
    products: allProducts,
  };

  return allProducts;
}

export async function fetchLiveWholesaleCatalogForMerchant(merchantPlanId = 'starter', searchQuery?: string): Promise<WholesaleProductDTO[]> {
  const fullCatalog = await fetchLiveWholesaleCatalog();
  const merchantRank = PLAN_TIERS_RANK[merchantPlanId.toLowerCase()] || 1;

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

export async function purchaseUpstreamProduct(params: {
  provider: 'digitalcore' | 'canboso';
  providerProductId: string;
  quantity: number;
}): Promise<{ success: boolean; deliveredItems: string[]; orderId: string; error?: string }> {
  const { provider, providerProductId, quantity } = params;
  const { digitalcoreKey, canbosoKey } = getGlobalWholesaleConfig();

  if (provider === 'digitalcore') {
    if (!digitalcoreKey) {
      return { success: false, deliveredItems: [], orderId: '', error: 'DigitalCore API Key is not configured' };
    }
    const rawId = providerProductId.replace(/^dc_/, '');
    try {
      const res = await axios.post(
        `${UPSTREAM_DIGITALCORE_BASE_URL}/api/user/buy`,
        { id: rawId, count: quantity },
        { headers: { 'Api-Key': digitalcoreKey }, timeout: 15000 }
      );
      if (res.data?.success && Array.isArray(res.data.items)) {
        return {
          success: true,
          deliveredItems: res.data.items,
          orderId: String(res.data.order_id || 'DC-' + Date.now()),
        };
      }
      return {
        success: false,
        deliveredItems: [],
        orderId: '',
        error: res.data?.msg || 'Purchase failed at DigitalCore',
      };
    } catch (err: any) {
      return {
        success: false,
        deliveredItems: [],
        orderId: '',
        error: err.response?.data?.msg || err.message,
      };
    }
  }

  if (provider === 'canboso') {
    if (!canbosoKey) {
      return { success: false, deliveredItems: [], orderId: '', error: 'Canboso API Key is not configured' };
    }
    const rawId = providerProductId.replace(/^cb_/, '');
    try {
      const res = await axios.post(
        `${UPSTREAM_CANBOSO_BASE_URL}/api/v2/telegram-buyer/order`,
        { key: canbosoKey, product_id: rawId, quantity },
        { timeout: 15000 }
      );
      if (res.data?.success && Array.isArray(res.data.deliveredAccounts)) {
        return {
          success: true,
          deliveredItems: res.data.deliveredAccounts,
          orderId: String(res.data.orderId || 'CB-' + Date.now()),
        };
      }
      return {
        success: false,
        deliveredItems: [],
        orderId: '',
        error: res.data?.msg || 'Purchase failed at Canboso',
      };
    } catch (err: any) {
      return {
        success: false,
        deliveredItems: [],
        orderId: '',
        error: err.response?.data?.msg || err.message,
      };
    }
  }

  return { success: false, deliveredItems: [], orderId: '', error: 'Unknown provider' };
}

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

      if (Number(p.wholesale_price_usd) !== currentUpstreamCost || Number(p.retail_price_usd) !== newRetailPrice) {
        db.prepare(`
          UPDATE products
          SET wholesale_price_usd = ?,
              retail_price_usd = ?,
              markup_fixed_usd = COALESCE(markup_fixed_usd, ?)
          WHERE id = ? AND tenant_id = ?
        `).run(currentUpstreamCost, newRetailPrice, fixedMargin, p.id, tenantId);
        updatedCount++;
      }
    }
  });

  updateTx();
  return { updatedCount, totalWholesale: wholesaleProducts.length };
}

