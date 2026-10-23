import axios from 'axios';
import { UPSTREAM_VEXORIX_BASE_URL } from '../../../../../shared/constants';
import { WholesaleProductDTO } from '../../../../../shared/types';
import { cleanUpstreamText, cleanUpstreamDescription, extractCategoryFromProduct } from '../cleaner';
import { IWholesaleProvider, ProviderBalance, WholesaleOrderResult } from './types';

export class VexorixProvider implements IWholesaleProvider {
  readonly name = 'vexorix' as const;
  readonly displayName = 'Mogent V2 (Vexorix)';
  readonly prefix = 'vx_';

  async getBalance(apiKey: string): Promise<ProviderBalance | null> {
    if (!apiKey) return null;
    try {
      const res = await axios.get(`${UPSTREAM_VEXORIX_BASE_URL}/api/reseller/me`, {
        headers: { 'X-Reseller-Key': apiKey },
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
        balance: isNaN(bal) ? 0 : bal,
        currency: curr,
        username: user,
      };
    } catch (err: any) {
      console.error('[Vexorix] Balance check failed:', err.response?.data || err.message);
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
      const res = await axios.get(`${UPSTREAM_VEXORIX_BASE_URL}/api/reseller/products`, {
        headers: { 'X-Reseller-Key': apiKey },
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
        products.push({
          id: `${this.prefix}${item.id}`,
          name: cleanName || 'Unnamed Wholesale Item',
          provider: this.name,
          base_price_usd: basePrice,
          cost_with_platform_fee_usd: applyPlatformFee(basePrice),
          stock: Number(item.stock ?? item.inventory ?? item.available ?? 0),
          category: cleanUpstreamText(item.category) || catInfo.category,
          icon: catInfo.icon,
          description: cleanUpstreamDescription(item.description || item.how_to_use),
        });
      }
    } catch (err: any) {
      console.warn('[Vexorix] Catalog fetch warning:', err.response?.data || err.message);
    }
    return products;
  }

  async purchase(
    apiKey: string,
    providerProductId: string,
    quantity: number
  ): Promise<WholesaleOrderResult> {
    if (!apiKey) {
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
            'X-Reseller-Key': apiKey,
            'Idempotency-Key': externalOrderId,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );

      const data = res.data;
      const orderId = String(data?.order?.id || data?.id || externalOrderId);
      const items = Array.isArray(data?.order?.items)
        ? data.order.items
        : Array.isArray(data?.items)
        ? data.items
        : [];
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
}
