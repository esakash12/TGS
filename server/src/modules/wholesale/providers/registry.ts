import { CanbosoProvider } from './canboso.provider';
import { DigitalCoreProvider } from './digitalcore.provider';
import { ProdSellerProvider } from './prodseller.provider';
import { SsonDigitalProvider } from './ssondigital.provider';
import { IWholesaleProvider, WholesaleProviderName } from './types';
import { VexorixProvider } from './vexorix.provider';

export class WholesaleProviderRegistry {
  private readonly providers: Map<WholesaleProviderName, IWholesaleProvider> = new Map();

  constructor() {
    this.register(new DigitalCoreProvider());
    this.register(new VexorixProvider());
    this.register(new CanbosoProvider());
    this.register(new ProdSellerProvider());
    this.register(new SsonDigitalProvider());
  }

  register(provider: IWholesaleProvider) {
    this.providers.set(provider.name, provider);
  }

  get(name: string): IWholesaleProvider | undefined {
    return this.providers.get(name as WholesaleProviderName);
  }

  getAll(): IWholesaleProvider[] {
    return Array.from(this.providers.values());
  }

  getByPrefix(productId: string): IWholesaleProvider | undefined {
    if (productId.startsWith('dc_')) return this.get('digitalcore');
    if (productId.startsWith('vx_')) return this.get('vexorix');
    if (productId.startsWith('cb_')) return this.get('canboso');
    if (productId.startsWith('ps_')) return this.get('prodseller');
    if (productId.startsWith('sd_')) return this.get('ssondigital');
    return undefined;
  }
}

export const wholesaleRegistry = new WholesaleProviderRegistry();
