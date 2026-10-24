import { WholesaleProductDTO } from '../../../../../shared/types';

export type WholesaleProviderName = 'digitalcore' | 'canboso' | 'vexorix' | 'prodseller' | 'ssondigital' | 'blinkey';

export interface ProviderBalance {
  balance: number;
  currency: string;
  username?: string;
  balanceVnd?: number;
}

export interface WholesaleOrderResult {
  success: boolean;
  deliveredItems: string[];
  orderId: string;
  error?: string;
}

export interface IWholesaleProvider {
  readonly name: WholesaleProviderName;
  readonly displayName: string;
  readonly prefix: string;

  /**
   * Fetch live upstream reseller wallet balance
   */
  getBalance(apiKey: string): Promise<ProviderBalance | null>;

  /**
   * Fetch and map catalog items from upstream into standard WholesaleProductDTO format
   */
  fetchCatalog(
    apiKey: string,
    applyPlatformFee: (basePrice: number) => number
  ): Promise<WholesaleProductDTO[]>;

  /**
   * Purchase an upstream product and return delivered digital keys/serials
   */
  purchase(
    apiKey: string,
    providerProductId: string,
    quantity: number
  ): Promise<WholesaleOrderResult>;
}
