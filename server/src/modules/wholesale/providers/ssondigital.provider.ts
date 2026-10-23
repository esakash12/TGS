import axios from 'axios';
import { UPSTREAM_SSON_BASE_URL } from '../../../../../shared/constants';
import { WholesaleProductDTO } from '../../../../../shared/types';
import { cleanUpstreamText, cleanUpstreamDescription, extractCategoryFromProduct } from '../cleaner';
import { IWholesaleProvider, ProviderBalance, WholesaleOrderResult } from './types';

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

export class SsonDigitalProvider implements IWholesaleProvider {
  readonly name = 'ssondigital' as const;
  readonly displayName = 'Mogent V5 (SsonDigital)';
  readonly prefix = 'sd_';

  async getBalance(apiKey: string): Promise<ProviderBalance | null> {
    if (!apiKey) return null;
    const cleanKey = apiKey.trim().replace(/^Bearer\s+/i, '');
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
      console.error('[SsonDigital] Balance check failed:', err.response?.status, err.response?.data || err.message);
      return null;
    }
  }

  async fetchCatalog(
    apiKey: string,
    applyPlatformFee: (basePrice: number) => number
  ): Promise<WholesaleProductDTO[]> {
    if (!apiKey) return [];
    const products: WholesaleProductDTO[] = [];
    try {
      const cleanKey = apiKey.trim().replace(/^Bearer\s+/i, '');
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
        products.push({
          id: `${this.prefix}${prodId}`,
          name: prodName,
          provider: this.name,
          base_price_usd: basePrice,
          cost_with_platform_fee_usd: applyPlatformFee(basePrice),
          stock,
          category: cleanCat || catInfo.category,
          icon: catInfo.icon,
          description: cleanDesc,
        });
      }
    } catch (err: any) {
      console.warn('[SsonDigital] Catalog fetch warning:', err.response?.status, err.response?.data || err.message);
    }
    return products;
  }

  async purchase(
    apiKey: string,
    providerProductId: string,
    quantity: number
  ): Promise<WholesaleOrderResult> {
    if (!apiKey) {
      return { success: false, deliveredItems: [], orderId: '', error: 'SsonDigital API Key is not configured' };
    }
    const cleanKey = apiKey.trim().replace(/^Bearer\s+/i, '');
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
}
