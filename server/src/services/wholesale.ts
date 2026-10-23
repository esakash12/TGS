import axios from 'axios';
import { db } from '../db/database';
import {
  UPSTREAM_DIGITALCORE_BASE_URL,
  UPSTREAM_CANBOSO_BASE_URL,
  UPSTREAM_VEXORIX_BASE_URL,
  UPSTREAM_PRODSELLER_BASE_URL,
  UPSTREAM_SSON_BASE_URL,
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
    vexorixKey: config?.wholesale_vexorix_key || '',
    prodsellerKey: config?.wholesale_prodseller_key || '',
    ssondigitalKey: config?.wholesale_ssondigital_key || '',
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


export async function getVexorixBalance(): Promise<{ balance: number; currency: string; username?: string } | null> {
  const { vexorixKey } = getGlobalWholesaleConfig();
  if (!vexorixKey) return null;
  try {
    const res = await axios.get(`${UPSTREAM_VEXORIX_BASE_URL}/api/reseller/me`, {
      headers: { 'X-Reseller-Key': vexorixKey },
      timeout: 8000,
    });
    const d = res.data || {};
    const bal =
      d.wallet?.balance !== undefined
        ? Number(d.wallet.balance)
        : d.balance !== undefined
        ? Number(d.balance)
        : 0;
    const curr = d.wallet?.currency || d.currency || 'USDT';
    const user = d.username || d.account?.username || d.email || '';
    return {
      balance: bal,
      currency: curr,
      username: user,
    };
  } catch (err: any) {
    console.error('Vexorix balance check failed:', err.response?.data || err.message);
    return null;
  }
}
export async function getProdSellerBalance(): Promise<{ balance: number; currency: string; username?: string } | null> {
  const { prodsellerKey } = getGlobalWholesaleConfig();
  if (!prodsellerKey) return null;
  try {
    const res = await axios.get(`${UPSTREAM_PRODSELLER_BASE_URL}/v1/balance`, {
      headers: { 'X-API-Key': prodsellerKey },
      timeout: 8000,
    });
    const d = res.data || {};
    return {
      balance: Number(d.balance || 0),
      currency: 'USD',
      username: d.username || (d.telegramId ? String(d.telegramId) : ''),
    };
  } catch (err: any) {
    console.error('ProdSeller balance check failed:', err.response?.data || err.message);
    return null;
  }
}

export async function getSsonDigitalBalance(): Promise<{ balance: number; currency: string; username?: string } | null> {
  const { ssondigitalKey } = getGlobalWholesaleConfig();
  if (!ssondigitalKey) return null;
  const cleanKey = ssondigitalKey.trim().replace(/^Bearer\s+/i, '');
  try {
    const res = await axios.get(`${UPSTREAM_SSON_BASE_URL}?action=balance`, {
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'X-API-Key': cleanKey,
      },
      params: {
        action: 'balance',
        api_key: cleanKey,
      },
      timeout: 8000,
    });
    const d = res.data || {};
    const bal =
      d.balance !== undefined
        ? Number(d.balance)
        : d.data?.balance !== undefined
        ? Number(d.data.balance)
        : d.wallet?.balance !== undefined
        ? Number(d.wallet.balance)
        : d.wallet_balance !== undefined
        ? Number(d.wallet_balance)
        : 0;
    const curr = d.currency || d.data?.currency || 'USD';
    const user = d.username || d.email || d.data?.username || d.account?.username || 'Active';
    return {
      balance: isNaN(bal) ? 0 : bal,
      currency: curr,
      username: user,
    };
  } catch (err: any) {
    console.error('SsonDigital balance check failed:', err.response?.status, err.response?.data || err.message);
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

export function cleanUpstreamText(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';

  return raw
    .replace(/\{pe:\d+\}/gi, '')
    .replace(/\{emoji:\d+\}/gi, '')
    .replace(/\[pe:\d+\]/gi, '')
    .replace(/\[emoji:\d+\]/gi, '')
    .replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/gi, '$1')
    .replace(/<tg-emoji[^>]*\/>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#039;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function cleanUpstreamDescription(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';

  let text = raw
    .replace(/\{pe:\d+\}/gi, '')
    .replace(/\{emoji:\d+\}/gi, '')
    .replace(/\[pe:\d+\]/gi, '')
    .replace(/\[emoji:\d+\]/gi, '')
    .replace(/<tg-emoji[^>]*>(.*?)<\/tg-emoji>/gi, '$1')
    .replace(/<tg-emoji[^>]*\/>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#039;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  const lines = text.split('\n').map(l => l.trim());
  return lines.join('\n').trim();
}

export function extractCategoryFromProduct(name: string, idOrSlug?: string, emoji?: string): { category: string; icon: string } {
  const cleanName = cleanUpstreamText(name);
  const combined = `${cleanName} ${idOrSlug || ''} ${emoji || ''}`.toLowerCase();

  if (/gemini/i.test(combined)) return { category: 'Gemini', icon: '🇬' };
  if (/chatgpt|openai|gpt/i.test(combined)) return { category: 'ChatGPT', icon: '🤖' };
  if (/claude|anthropic/i.test(combined)) return { category: 'Claude', icon: '☀️' };
  if (/notion/i.test(combined)) return { category: 'Notion Business', icon: '🗃' };
  if (/github/i.test(combined)) return { category: 'GitHub', icon: '🐙' };
  if (/capcut/i.test(combined)) return { category: 'CapCut', icon: '🎬' };
  if (/grok|x\.ai/i.test(combined)) return { category: 'Grok', icon: '𝕏' };
  if (/canva/i.test(combined)) return { category: 'Canva', icon: '🎨' };
  if (/loveable/i.test(combined)) return { category: 'Loveable Pro', icon: '🚀' };
  if (/telegram|tg\s*prem/i.test(combined)) return { category: 'Telegram Premium', icon: '✈️' };
  if (/vpn|nord|express|surfshark/i.test(combined)) return { category: 'VPN', icon: '🛡️' };
  if (/youtube/i.test(combined)) return { category: 'YouTube', icon: '▶️' };
  if (/email|gmail|mail|hotmail|outlook/i.test(combined)) return { category: 'Email', icon: '✉️' };
  if (/elevenlabs|voice/i.test(combined)) return { category: 'ElevenLabs', icon: '🗣️' };
  if (/elite\s*methods|vip/i.test(combined)) return { category: 'VIP & Methods', icon: '👑' };
  if (/figma/i.test(combined)) return { category: 'Figma', icon: '🖋️' };
  if (/duolingo/i.test(combined)) return { category: 'Doulingo', icon: '🦉' };
  if (/leonardo/i.test(combined)) return { category: 'Leonardo AI', icon: '🎨' };
  if (/muse/i.test(combined)) return { category: 'Muse AI', icon: '♾️' };
  if (/netflix|spotify|disney|prime|hulu|crunchyroll|streaming/i.test(combined)) return { category: 'Streaming & OTT', icon: '🍿' };
  if (/api\s*key|api\s*gateway|tokens/i.test(combined)) return { category: 'API Keys', icon: '🔑' };
  if (/cursor|v0|replit|developer/i.test(combined)) return { category: 'Developer Tools', icon: '💻' };

  return { category: 'General Digital', icon: '📦' };
}

export const PLAN_TIERS_RANK: Record<string, number> = {
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function parseCanbosoStock(item: any): number {
  if (!item) return 0;

  // Explicit out of stock indicators
  if (
    item.inStock === false ||
    item.in_stock === false ||
    item.isAvailable === false ||
    item.is_available === false ||
    item.available === false ||
    item.availability?.isAvailable === false ||
    item.availability?.is_available === false ||
    item.availability?.available === false ||
    item.availability?.inStock === false ||
    item.availability?.in_stock === false
  ) {
    return 0;
  }

  // Check numeric availability fields across item and availability
  const candidates = [
    item.availability?.stock,
    item.availability?.quantity,
    item.availability?.count,
    item.availability?.available,
    item.availability?.inventory,
    item.stock,
    item.quantity,
    item.count,
    item.inventory,
  ];

  for (const val of candidates) {
    if (val !== undefined && val !== null && typeof val !== 'boolean') {
      const num = Number(val);
      if (!isNaN(num) && num >= 0) {
        return num;
      }
    }
  }

  // If boolean true is present without numeric count, mark as 1 (available) instead of 999
  if (
    item.availability?.available === true ||
    item.availability?.inStock === true ||
    item.availability?.isAvailable === true ||
    item.inStock === true ||
    item.isAvailable === true
  ) {
    return 1;
  }

  // Safe default: 0 (out of stock/unavailable), never 999
  return 0;
}

export function parseSsonDigitalStock(item: any): number {
  if (!item) return 0;

  // Explicit out of stock indicators
  if (
    item.in_stock === false ||
    item.inStock === false ||
    item.is_available === false ||
    item.available === false ||
    item.status === 'out_of_stock' ||
    item.status === 'inactive'
  ) {
    return 0;
  }

  const candidates = [
    item.stock,
    item.quantity,
    item.inventory,
    item.available_quantity,
    item.available_stock,
    item.available,
    item.count,
  ];

  for (const val of candidates) {
    if (val !== undefined && val !== null && typeof val !== 'boolean') {
      const num = Number(val);
      if (!isNaN(num) && num >= 0) {
        return num;
      }
    }
  }

  // If boolean true is present without numeric count, mark as 1 (available) instead of 999
  if (
    item.in_stock === true ||
    item.inStock === true ||
    item.available === true ||
    item.status === 'in_stock' ||
    item.status === 'active'
  ) {
    return 1;
  }

  return 0;
}

export async function fetchLiveWholesaleCatalog(forceRefresh = false): Promise<WholesaleProductDTO[]> {
  const now = Date.now();
  if (!forceRefresh && catalogCache && now - catalogCache.timestamp < CACHE_TTL_MS) {
    return catalogCache.products;
  }

  const { digitalcoreKey, canbosoKey, vexorixKey, prodsellerKey, ssondigitalKey, platformFeeFixed, platformFeePct } = getGlobalWholesaleConfig();
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
          const cleanName = cleanUpstreamText(item.name);
          const catInfo = extractCategoryFromProduct(cleanName, item.id);
          allProducts.push({
            id: `dc_${item.id}`,
            name: cleanName,
            provider: 'digitalcore',
            base_price_usd: basePrice,
            cost_with_platform_fee_usd: applyPlatformFee(basePrice),
            stock: Number(item.stock || 0),
            category: cleanUpstreamText(item.category) || catInfo.category,
            icon: catInfo.icon,
            description: cleanUpstreamDescription(item.description),
          });
        }
      }
    } catch (err: any) {
      console.warn('DigitalCore catalog fetch warning:', err.message);
    }
  }

  // 2. Fetch from Canboso (Mogent V3)
  if (canbosoKey) {
    try {
      const res = await axios.get(`${UPSTREAM_CANBOSO_BASE_URL}/api/v2/telegram-buyer/products`, {
        params: { key: canbosoKey },
        timeout: 10000,
      });
      if (res.data?.success && Array.isArray(res.data.products)) {
        for (const item of res.data.products) {
          const basePrice = Number(item.price?.amount || 0);
          const cleanName = cleanUpstreamText(item.name);
          const catInfo = extractCategoryFromProduct(cleanName, String(item.productId), item.emoji);
          const stock = parseCanbosoStock(item);
          allProducts.push({
            id: `cb_${item.productId}`,
            name: cleanName,
            provider: 'canboso',
            base_price_usd: basePrice,
            cost_with_platform_fee_usd: applyPlatformFee(basePrice),
            stock,
            category: cleanUpstreamText(item.category) || catInfo.category,
            icon: catInfo.icon,
            description: cleanUpstreamDescription(item.description),
          });
        }
      }
    } catch (err: any) {
      console.warn('Canboso catalog fetch warning:', err.message);
    }
  }

  // 3. Fetch from Vexorix (Mogent V2)
  if (vexorixKey) {
    try {
      const res = await axios.get(`${UPSTREAM_VEXORIX_BASE_URL}/api/reseller/products`, {
        headers: { 'X-Reseller-Key': vexorixKey },
        timeout: 10000,
      });
      const prods = Array.isArray(res.data?.products)
        ? res.data.products
        : Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];
      for (const item of prods) {
        const basePrice = Number(item.price ?? item.cost ?? 0);
        const cleanName = cleanUpstreamText(item.name);
        const catInfo = extractCategoryFromProduct(cleanName, item.id);
        allProducts.push({
          id: `vx_${item.id}`,
          name: cleanName || 'Unnamed Wholesale Item',
          provider: 'vexorix',
          base_price_usd: basePrice,
          cost_with_platform_fee_usd: applyPlatformFee(basePrice),
          stock: Number(item.stock ?? item.inventory ?? item.available ?? 0),
          category: cleanUpstreamText(item.category) || catInfo.category,
          icon: catInfo.icon,
          description: cleanUpstreamDescription(item.description || item.how_to_use),
        });
      }
    } catch (err: any) {
      console.warn('Vexorix catalog fetch warning:', err.response?.data || err.message);
    }
  }

  // 4. Fetch from ProdSeller (Mogent V4)
  if (prodsellerKey) {
    try {
      const res = await axios.get(`${UPSTREAM_PRODSELLER_BASE_URL}/v1/products`, {
        headers: { 'X-API-Key': prodsellerKey },
        timeout: 10000,
      });
      const prods = Array.isArray(res.data?.products) ? res.data.products : [];

      // Concurrently fetch exact live numeric stock for in-stock items
      const stockMap = new Map<string, number>();
      const inStockItems = prods.filter((p: any) => p.inStock !== false);

      const BATCH_SIZE = 15;
      for (let i = 0; i < inStockItems.length; i += BATCH_SIZE) {
        const batch = inStockItems.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(async (p: any) => {
            try {
              const detailRes = await axios.get(`${UPSTREAM_PRODSELLER_BASE_URL}/v1/products/${p.id}`, {
                headers: { 'X-API-Key': prodsellerKey },
                timeout: 6000,
              });
              const rawStock = detailRes.data?.stock;
              const numericStock = typeof rawStock === 'number' ? rawStock : (Number(rawStock) || 0);
              stockMap.set(p.id, Math.max(0, numericStock));
            } catch {
              stockMap.set(p.id, 0);
            }
          })
        );
      }

      for (const item of prods) {
        const basePrice = Number(item.price ?? item.finalPrice ?? item.publicPrice ?? 0);
        const cleanName = cleanUpstreamText(item.name);
        const catInfo = extractCategoryFromProduct(cleanName, item.id);
        const stock = item.inStock === false ? 0 : (stockMap.get(item.id) ?? 0);
        allProducts.push({
          id: `ps_${item.id}`,
          name: cleanName || 'Unnamed Wholesale Item',
          provider: 'prodseller',
          base_price_usd: basePrice,
          cost_with_platform_fee_usd: applyPlatformFee(basePrice),
          stock,
          category: catInfo.category,
          icon: catInfo.icon,
          description: cleanUpstreamDescription(item.description),
        });
      }
    } catch (err: any) {
      console.warn('ProdSeller catalog fetch warning:', err.response?.data || err.message);
    }
  }

  // 5. Fetch from SsonDigital (Mogent V5)
  if (ssondigitalKey) {
    try {
      const cleanKey = ssondigitalKey.trim().replace(/^Bearer\s+/i, '');
      const res = await axios.get(`${UPSTREAM_SSON_BASE_URL}?action=products`, {
        headers: {
          'Authorization': `Bearer ${cleanKey}`,
          'X-API-Key': cleanKey,
        },
        params: {
          action: 'products',
          api_key: cleanKey,
        },
        timeout: 10000,
      });

      let prods: any[] = [];
      if (Array.isArray(res.data)) {
        prods = res.data;
      } else if (Array.isArray(res.data?.products)) {
        prods = res.data.products;
      } else if (Array.isArray(res.data?.data)) {
        prods = res.data.data;
      } else if (Array.isArray(res.data?.data?.products)) {
        prods = res.data.data.products;
      } else if (Array.isArray(res.data?.items)) {
        prods = res.data.items;
      } else if (Array.isArray(res.data?.result)) {
        prods = res.data.result;
      }

      console.log(`[SsonDigital] Fetched ${prods.length} products`);

      for (const item of prods) {
        const prodId = String(item.id || item.product_id || item.productId || item._id || item.code || '');
        if (!prodId) continue;
        const rawName = item.name || item.title || item.product_name || item.productName || 'Unnamed Wholesale Item';
        const prodName = cleanUpstreamText(rawName);
        const basePrice = Number(item.price ?? item.cost ?? item.wholesale_price ?? item.rate ?? item.amount ?? 0);
        const catInfo = extractCategoryFromProduct(prodName, prodId);
        const rawCat = item.category || item.category_name || item.folder || '';
        const cleanCat = rawCat ? cleanUpstreamText(rawCat) : catInfo.category;
        const rawDesc = item.description || item.details || item.desc || item.info || '';
        const cleanDesc = cleanUpstreamDescription(rawDesc);
        const stock = parseSsonDigitalStock(item);
        allProducts.push({
          id: `sd_${prodId}`,
          name: prodName,
          provider: 'ssondigital',
          base_price_usd: basePrice,
          cost_with_platform_fee_usd: applyPlatformFee(basePrice),
          stock,
          category: cleanCat || catInfo.category,
          icon: catInfo.icon,
          description: cleanDesc,
        });
      }
    } catch (err: any) {
      console.warn('SsonDigital catalog fetch warning:', err.response?.status, err.response?.data || err.message);
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

export async function fetchLiveWholesaleCatalogForMerchant(merchantPlanId = 'starter', searchQuery?: string, forceRefresh = false): Promise<WholesaleProductDTO[]> {
  let fullCatalog = await fetchLiveWholesaleCatalog(forceRefresh);
  if (fullCatalog.length === 0 && !forceRefresh) {
    fullCatalog = await fetchLiveWholesaleCatalog(true);
  }
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
  provider: 'digitalcore' | 'canboso' | 'vexorix' | 'prodseller' | 'ssondigital';
  providerProductId: string;
  quantity: number;
}): Promise<{ success: boolean; deliveredItems: string[]; orderId: string; error?: string }> {
  const { provider, providerProductId, quantity } = params;
  const { digitalcoreKey, canbosoKey, vexorixKey, prodsellerKey, ssondigitalKey } = getGlobalWholesaleConfig();

  if (provider === 'ssondigital') {
    if (!ssondigitalKey) {
      return { success: false, deliveredItems: [], orderId: '', error: 'SsonDigital API Key is not configured' };
    }
    const cleanKey = ssondigitalKey.trim().replace(/^Bearer\s+/i, '');
    const rawId = providerProductId.replace(/^sd_/, '');
    const externalOrderId = 'mg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    console.log(`[Wholesale Upstream] Attempting SsonDigital purchase for rawId="${rawId}", count=${quantity}`);
    try {
      const res = await axios.post(
        `${UPSTREAM_SSON_BASE_URL}?action=order`,
        {
          product_id: rawId,
          quantity,
          external_order_id: externalOrderId,
        },
        {
          headers: {
            'Authorization': `Bearer ${cleanKey}`,
            'X-API-Key': cleanKey,
            'Content-Type': 'application/json',
          },
          params: {
            action: 'order',
            api_key: cleanKey,
          },
          timeout: 25000,
        }
      );

      const data = res.data;
      const orderId = String(data?.order_id || data?.orderId || data?.id || externalOrderId);
      let deliveredItems: string[] = [];

      if (Array.isArray(data?.items)) {
        deliveredItems = data.items.map((i: any) => typeof i === 'string' ? i : (i.content || i.code || i.key || i.serial || JSON.stringify(i))).filter(Boolean);
      } else if (Array.isArray(data?.delivered_items)) {
        deliveredItems = data.delivered_items.map((i: any) => typeof i === 'string' ? i : (i.content || i.code || i.key || JSON.stringify(i))).filter(Boolean);
      } else if (Array.isArray(data?.deliveredKeys)) {
        deliveredItems = data.deliveredKeys.filter(Boolean);
      } else if (Array.isArray(data?.keys)) {
        deliveredItems = data.keys.filter(Boolean);
      } else if (data?.code || data?.serial || data?.key || data?.account || data?.delivered_data) {
        deliveredItems = [String(data.code || data.serial || data.key || data.account || data.delivered_data)];
      } else if (data?.order?.items && Array.isArray(data.order.items)) {
        deliveredItems = data.order.items.map((i: any) => typeof i === 'string' ? i : (i.content || i.code || i.key || JSON.stringify(i))).filter(Boolean);
      }

      if (deliveredItems.length > 0) {
        return {
          success: true,
          deliveredItems,
          orderId,
        };
      }

      if (data?.status === 'success' || data?.status === 'completed' || data?.success === true) {
        return {
          success: true,
          deliveredItems: [`Order Submitted (ID: ${orderId}). Status: Processing ASAP.`],
          orderId,
        };
      }

      return {
        success: false,
        deliveredItems: [],
        orderId,
        error: data?.error || data?.message || data?.detail || 'No digital serial keys delivered by SsonDigital',
      };
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.response?.data?.detail || err.message;
      return {
        success: false,
        deliveredItems: [],
        orderId: '',
        error: errMsg,
      };
    }
  }

  if (provider === 'prodseller') {
    if (!prodsellerKey) {
      return { success: false, deliveredItems: [], orderId: '', error: 'ProdSeller API Key is not configured' };
    }
    const rawId = providerProductId.replace(/^ps_/, '');
    const idempotencyKey = 'mg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    console.log(`[Wholesale Upstream] Attempting ProdSeller purchase for rawId="${rawId}", count=${quantity}`);
    try {
      const res = await axios.post(
        `${UPSTREAM_PRODSELLER_BASE_URL}/v1/orders`,
        {
          productId: rawId,
          quantity,
        },
        {
          headers: {
            'X-API-Key': prodsellerKey,
            'Idempotency-Key': idempotencyKey,
            'Content-Type': 'application/json',
          },
          timeout: 25000,
        }
      );

      const data = res.data;
      const orderId = String(data?.orderId || data?.id || idempotencyKey);
      let deliveredItems: string[] = [];

      if (Array.isArray(data?.deliveredKeys)) {
        deliveredItems = data.deliveredKeys.filter(Boolean);
      } else if (data?.deliveredKey) {
        deliveredItems = [String(data.deliveredKey)];
      }

      if (deliveredItems.length > 0) {
        return {
          success: true,
          deliveredItems,
          orderId,
        };
      }

      if (data?.status === 'paid' && data?.activation) {
        return {
          success: true,
          deliveredItems: [`Order Submitted for Activation (ID: ${orderId}). Status: Processing ASAP.`],
          orderId,
        };
      }

      return {
        success: false,
        deliveredItems: [],
        orderId,
        error: data?.error || 'No digital serial keys delivered by ProdSeller',
      };
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      return {
        success: false,
        deliveredItems: [],
        orderId: '',
        error: errMsg,
      };
    }
  }

  if (provider === 'vexorix') {
    if (!vexorixKey) {
      return { success: false, deliveredItems: [], orderId: '', error: 'Vexorix API Key is not configured' };
    }
    const rawId = providerProductId.replace(/^vx_/, '');
    const externalOrderId = 'mg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    console.log(`[Wholesale Upstream] Attempting Vexorix purchase for rawId="${rawId}", count=${quantity}`);
    try {
      const res = await axios.post(
        `${UPSTREAM_VEXORIX_BASE_URL}/api/reseller/orders`,
        {
          product_id: rawId,
          quantity,
          external_order_id: externalOrderId,
        },
        {
          headers: {
            'X-Reseller-Key': vexorixKey,
            'Idempotency-Key': externalOrderId,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );

      const data = res.data;
      const orderId = String(data?.order?.id || data?.id || externalOrderId);
      const items = Array.isArray(data?.order?.items) ? data.order.items : (Array.isArray(data?.items) ? data.items : []);
      const deliveredItems: string[] = items.map((i: any) => i.content || i.code || JSON.stringify(i)).filter(Boolean);

      if (deliveredItems.length > 0) {
        return {
          success: true,
          deliveredItems,
          orderId,
        };
      }

      return {
        success: false,
        deliveredItems: [],
        orderId,
        error: data?.error?.message || 'No digital serial codes returned from Vexorix',
      };
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
      return {
        success: false,
        deliveredItems: [],
        orderId: '',
        error: errMsg,
      };
    }
  }

  if (provider === 'digitalcore') {
    if (!digitalcoreKey) {
      return { success: false, deliveredItems: [], orderId: '', error: 'DigitalCore API Key is not configured' };
    }
    const rawId = providerProductId.replace(/^dc_/, '');
    console.log(`[Wholesale Upstream] Attempting DigitalCore purchase for rawId="${rawId}", count=${quantity}`);
    try {
      const res = await axios.post(
        `${UPSTREAM_DIGITALCORE_BASE_URL}/api/user/buy`,
        { id: rawId, count: quantity },
        { headers: { 'Api-Key': digitalcoreKey }, timeout: 15000 }
      );
      console.log(`[Wholesale Upstream] DigitalCore response:`, JSON.stringify(res.data));
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
        error: res.data?.msg || res.data?.message || 'Purchase failed at DigitalCore: ' + JSON.stringify(res.data),
      };
    } catch (err: any) {
      console.error(`[Wholesale Upstream] DigitalCore purchase error:`, err.response?.data || err.message);
      return {
        success: false,
        deliveredItems: [],
        orderId: '',
        error: err.response?.data?.msg || err.response?.data?.message || err.message,
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

