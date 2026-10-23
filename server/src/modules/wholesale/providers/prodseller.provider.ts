import axios from 'axios';
import { UPSTREAM_PRODSELLER_BASE_URL } from '../../../../../shared/constants';
import { WholesaleProductDTO } from '../../../../../shared/types';
import { cleanUpstreamText, cleanUpstreamDescription, extractCategoryFromProduct } from '../cleaner';
import { IWholesaleProvider, ProviderBalance, WholesaleOrderResult } from './types';

export class ProdSellerProvider implements IWholesaleProvider {
  readonly name = 'prodseller' as const;
  readonly displayName = 'Mogent V4 (ProdSeller)';
  readonly prefix = 'ps_';

  async getBalance(apiKey: string): Promise<ProviderBalance | null> {
    if (!apiKey) return null;
    try {
      const res = await axios.get(`${UPSTREAM_PRODSELLER_BASE_URL}/v1/balance`, {
        headers: { 'X-API-Key': apiKey },
        timeout: 8000,
      });
      const d = res.data || {};
      return {
        balance: Number(d.balance || 0),
        currency: 'USD',
        username: d.username || (d.telegramId ? String(d.telegramId) : ''),
      };
    } catch (err: any) {
      console.error('[ProdSeller] Balance check failed:', err.response?.data || err.message);
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
      const res = await axios.get(`${UPSTREAM_PRODSELLER_BASE_URL}/v1/products`, {
        headers: { 'X-API-Key': apiKey },
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
                headers: { 'X-API-Key': apiKey },
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
        products.push({
          id: `${this.prefix}${item.id}`,
          name: cleanName || 'Unnamed Wholesale Item',
          provider: this.name,
          base_price_usd: basePrice,
          cost_with_platform_fee_usd: applyPlatformFee(basePrice),
          stock,
          category: catInfo.category,
          icon: catInfo.icon,
          description: cleanUpstreamDescription(item.description),
        });
      }
    } catch (err: any) {
      console.warn('[ProdSeller] Catalog fetch warning:', err.response?.data || err.message);
    }
    return products;
  }

  async purchase(
    apiKey: string,
    providerProductId: string,
    quantity: number
  ): Promise<WholesaleOrderResult> {
    if (!apiKey) {
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
            'X-API-Key': apiKey,
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
}
