import axios from 'axios';
import { UPSTREAM_CANBOSO_BASE_URL } from '../../../../../shared/constants';
import { WholesaleProductDTO } from '../../../../../shared/types';
import { cleanUpstreamText, cleanUpstreamDescription, extractCategoryFromProduct } from '../cleaner';
import { IWholesaleProvider, ProviderBalance, WholesaleOrderResult } from './types';

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

export class CanbosoProvider implements IWholesaleProvider {
  readonly name = 'canboso' as const;
  readonly displayName = 'Mogent V3 (Canboso)';
  readonly prefix = 'cb_';

  async getBalance(apiKey: string): Promise<ProviderBalance | null> {
    if (!apiKey) return null;
    try {
      const res = await axios.get(`${UPSTREAM_CANBOSO_BASE_URL}/api/v2/telegram-buyer/balance`, {
        params: { key: apiKey },
        timeout: 8000,
      });
      return {
        balance: Number(res.data.balanceUsd || 0),
        currency: 'USD',
        balanceVnd: Number(res.data.balance || 0),
      };
    } catch (err: any) {
      console.error('[Canboso] Balance check failed:', err.message);
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
      const res = await axios.get(`${UPSTREAM_CANBOSO_BASE_URL}/api/v2/telegram-buyer/products`, {
        params: { key: apiKey },
        timeout: 10000,
      });
      if (res.data?.success && Array.isArray(res.data.products)) {
        for (const item of res.data.products) {
          const basePrice = Number(item.price?.amount || 0);
          const cleanName = cleanUpstreamText(item.name);
          const catInfo = extractCategoryFromProduct(cleanName, String(item.productId), item.emoji);
          const stock = parseCanbosoStock(item);
          products.push({
            id: `${this.prefix}${item.productId}`,
            name: cleanName,
            provider: this.name,
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
      console.warn('[Canboso] Catalog fetch warning:', err.message);
    }
    return products;
  }

  async purchase(
    apiKey: string,
    providerProductId: string,
    quantity: number
  ): Promise<WholesaleOrderResult> {
    if (!apiKey) {
      return { success: false, deliveredItems: [], orderId: '', error: 'Canboso API Key is not configured' };
    }
    const rawId = providerProductId.replace(/^cb_/, '');
    try {
      const res = await axios.post(
        `${UPSTREAM_CANBOSO_BASE_URL}/api/v2/telegram-buyer/order`,
        { key: apiKey, product_id: rawId, quantity },
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
}
