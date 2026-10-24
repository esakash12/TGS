import axios from 'axios';
import { randomUUID } from 'node:crypto';
import { UPSTREAM_BLINKEY_BASE_URL } from '../../../../../shared/constants';
import { WholesaleProductDTO } from '../../../../../shared/types';
import { cleanUpstreamDescription, cleanUpstreamText, extractCategoryFromProduct } from '../cleaner';
import { IWholesaleProvider, ProviderBalance, WholesaleOrderResult } from './types';

export class BlinkeyProvider implements IWholesaleProvider {
  readonly name = 'blinkey' as const;
  readonly displayName = 'Mogent V6 (Blinkey.co)';
  readonly prefix = 'bk_';

  /**
   * Fetch live upstream reseller wallet balance
   * GET /v1/balance
   * Response: { "balance": 25.4, "currency": "USD" }
   */
  async getBalance(apiKey: string): Promise<ProviderBalance | null> {
    if (!apiKey) return null;
    try {
      const cleanKey = apiKey.trim().replace(/^Bearer\s+/i, '');
      const res = await axios.get(`${UPSTREAM_BLINKEY_BASE_URL}/balance`, {
        headers: {
          Authorization: `Bearer ${cleanKey}`,
        },
        timeout: 8000,
      });

      return {
        balance: Number(res.data?.balance || 0),
        currency: res.data?.currency || 'USD',
        username: 'Blinkey Wallet',
      };
    } catch (err: any) {
      console.error('[Blinkey] Balance check failed:', err.response?.data || err.message);
      return null;
    }
  }

  /**
   * Fetch and map catalog items from upstream into standard WholesaleProductDTO format
   * GET /v1/products
   * Response: { "products": [ { "id": 12, "name": "...", "price": 1.35, "currency": "USD", "stock": 40, "description": "..." } ] }
   */
  async fetchCatalog(
    apiKey: string,
    applyPlatformFee: (basePrice: number) => number
  ): Promise<WholesaleProductDTO[]> {
    if (!apiKey) return [];
    const products: WholesaleProductDTO[] = [];
    try {
      const cleanKey = apiKey.trim().replace(/^Bearer\s+/i, '');
      const res = await axios.get(`${UPSTREAM_BLINKEY_BASE_URL}/products`, {
        headers: {
          Authorization: `Bearer ${cleanKey}`,
        },
        timeout: 12000,
      });

      const rawProducts = res.data?.products;
      if (Array.isArray(rawProducts)) {
        for (const item of rawProducts) {
          const basePrice = Number(item.price || 0);
          const cleanName = cleanUpstreamText(item.name);
          const catInfo = extractCategoryFromProduct(cleanName, String(item.id));

          products.push({
            id: `${this.prefix}${item.id}`,
            name: cleanName,
            provider: this.name,
            base_price_usd: basePrice,
            cost_with_platform_fee_usd: applyPlatformFee(basePrice),
            stock: Number(item.stock || 0),
            category: catInfo.category,
            icon: catInfo.icon,
            description: cleanUpstreamDescription(item.description),
          });
        }
      }
    } catch (err: any) {
      console.warn('[Blinkey] Catalog fetch warning:', err.response?.data || err.message);
    }
    return products;
  }

  /**
   * Purchase an upstream product and return delivered digital keys/serials
   * POST /v1/buy
   * Body: { "product_id": 12, "quantity": 1, "request_id": "uuid" }
   * Response: { "order_id": 104, "items": ["KEY1", "KEY2"], "status": "paid", ... }
   */
  async purchase(
    apiKey: string,
    providerProductId: string,
    quantity: number
  ): Promise<WholesaleOrderResult> {
    if (!apiKey) {
      return { success: false, deliveredItems: [], orderId: '', error: 'Blinkey API Key is not configured' };
    }

    const cleanKey = apiKey.trim().replace(/^Bearer\s+/i, '');
    const rawIdStr = providerProductId.replace(/^bk_/, '');
    const rawId = parseInt(rawIdStr, 10);
    const requestId = `mogent-${randomUUID()}`;

    console.log(`[Wholesale Upstream] Attempting Blinkey purchase for rawId=${rawId}, quantity=${quantity}, requestId=${requestId}`);

    try {
      const res = await axios.post(
        `${UPSTREAM_BLINKEY_BASE_URL}/buy`,
        {
          product_id: isNaN(rawId) ? rawIdStr : rawId,
          quantity: Math.max(1, quantity),
          request_id: requestId,
        },
        {
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );

      console.log(`[Wholesale Upstream] Blinkey response:`, JSON.stringify(res.data));

      if (res.data && Array.isArray(res.data.items) && res.data.items.length > 0) {
        const deliveredItems = res.data.items.map((it: any) =>
          typeof it === 'string' ? it.trim() : JSON.stringify(it)
        );

        return {
          success: true,
          deliveredItems,
          orderId: String(res.data.order_id || res.data.id || requestId),
        };
      }

      const errMsg = res.data?.error || res.data?.message || 'Blinkey order fulfilled but no delivered items returned';
      return {
        success: false,
        deliveredItems: [],
        orderId: String(res.data?.order_id || ''),
        error: errMsg,
      };
    } catch (err: any) {
      console.error(`[Wholesale Upstream] Blinkey purchase error:`, err.response?.data || err.message);
      const apiErr = err.response?.data?.error || err.response?.data?.message || err.message;
      return {
        success: false,
        deliveredItems: [],
        orderId: '',
        error: `Blinkey Error (${err.response?.status || '500'}): ${apiErr}`,
      };
    }
  }
}
