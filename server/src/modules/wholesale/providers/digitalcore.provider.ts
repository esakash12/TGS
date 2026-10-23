import axios from 'axios';
import { UPSTREAM_DIGITALCORE_BASE_URL } from '../../../../../shared/constants';
import { WholesaleProductDTO } from '../../../../../shared/types';
import { cleanUpstreamText, cleanUpstreamDescription, extractCategoryFromProduct } from '../cleaner';
import { IWholesaleProvider, ProviderBalance, WholesaleOrderResult } from './types';

export class DigitalCoreProvider implements IWholesaleProvider {
  readonly name = 'digitalcore' as const;
  readonly displayName = 'Mogent V1 (DigitalCore)';
  readonly prefix = 'dc_';

  async getBalance(apiKey: string): Promise<ProviderBalance | null> {
    if (!apiKey) return null;
    try {
      const res = await axios.get(`${UPSTREAM_DIGITALCORE_BASE_URL}/api/user/me`, {
        headers: { 'Api-Key': apiKey },
        timeout: 8000,
      });
      return {
        balance: Number(res.data.balance || 0),
        currency: res.data.currency || 'USD',
      };
    } catch (err: any) {
      console.error('[DigitalCore] Balance check failed:', err.message);
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
      const res = await axios.get(`${UPSTREAM_DIGITALCORE_BASE_URL}/api/user/products`, {
        headers: { 'Api-Key': apiKey },
        timeout: 10000,
      });
      if (Array.isArray(res.data)) {
        for (const item of res.data) {
          const basePrice = Number(item.price || 0);
          const cleanName = cleanUpstreamText(item.name);
          const catInfo = extractCategoryFromProduct(cleanName, item.id);
          products.push({
            id: `${this.prefix}${item.id}`,
            name: cleanName,
            provider: this.name,
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
      console.warn('[DigitalCore] Catalog fetch warning:', err.message);
    }
    return products;
  }

  async purchase(
    apiKey: string,
    providerProductId: string,
    quantity: number
  ): Promise<WholesaleOrderResult> {
    if (!apiKey) {
      return { success: false, deliveredItems: [], orderId: '', error: 'DigitalCore API Key is not configured' };
    }
    const rawId = providerProductId.replace(/^dc_/, '');
    console.log(`[Wholesale Upstream] Attempting DigitalCore purchase for rawId="${rawId}", count=${quantity}`);
    try {
      const res = await axios.post(
        `${UPSTREAM_DIGITALCORE_BASE_URL}/api/user/buy`,
        { id: rawId, count: quantity },
        { headers: { 'Api-Key': apiKey }, timeout: 15000 }
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
}
