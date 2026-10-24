import { db } from '../../db/database';
import { WholesaleProductDTO } from '../../../../shared/types';
import { fetchLiveWholesaleCatalog, invalidateWholesaleCache } from '../../services/wholesale';

export interface ProviderSyncInfo {
  ok: boolean;
  productCount: number;
  lastError?: string;
  latencyMs?: number;
}

export interface SyncStats {
  lastSyncTimestamp: number | null;
  lastSyncDurationMs: number;
  totalProductsChecked: number;
  totalProductsUpdated: number;
  activeTenantsUpdated: number;
  isRunning: boolean;
  intervalSeconds: number;
  providers: Record<string, ProviderSyncInfo>;
}

export class WholesaleSyncDaemon {
  private timer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private intervalSeconds = 15; // High-frequency 15-second loop

  private stats: SyncStats = {
    lastSyncTimestamp: null,
    lastSyncDurationMs: 0,
    totalProductsChecked: 0,
    totalProductsUpdated: 0,
    activeTenantsUpdated: 0,
    isRunning: false,
    intervalSeconds: 15,
    providers: {
      digitalcore: { ok: true, productCount: 0 },
      vexorix: { ok: true, productCount: 0 },
      canboso: { ok: true, productCount: 0 },
      prodseller: { ok: true, productCount: 0 },
      ssondigital: { ok: true, productCount: 0 },
      blinkey: { ok: true, productCount: 0 },
    },
  };

  /**
   * Start the continuous high-frequency sync loop
   */
  start(intervalSeconds = 15) {
    this.intervalSeconds = Math.max(5, intervalSeconds);
    this.stats.intervalSeconds = this.intervalSeconds;
    this.stats.isRunning = true;

    if (this.timer) {
      clearInterval(this.timer);
    }

    console.log(`[SyncDaemon] 🚀 High-Frequency Sync Engine started (interval: ${this.intervalSeconds}s).`);

    // Initial immediate trigger
    this.syncAll(true).catch(err => {
      console.warn('[SyncDaemon] Initial sync warning:', err.message);
    });

    // Scheduled heartbeat
    this.timer = setInterval(async () => {
      await this.syncAll(false);
    }, this.intervalSeconds * 1000);
  }

  /**
   * Stop the background loop
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stats.isRunning = false;
    console.log('[SyncDaemon] 🛑 High-Frequency Sync Engine stopped.');
  }

  /**
   * Get live diagnostic and telemetry stats
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * Perform single high-performance cross-tenant sync run
   */
  async syncAll(force = false): Promise<{
    durationMs: number;
    updatedCount: number;
    totalWholesaleChecked: number;
  }> {
    if (this.isSyncing) {
      return {
        durationMs: 0,
        updatedCount: 0,
        totalWholesaleChecked: this.stats.totalProductsChecked,
      };
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      // 1. Invalidate cache if forced, then fetch live catalog across all providers in parallel
      if (force) {
        invalidateWholesaleCache();
      }

      const catalog: WholesaleProductDTO[] = await fetchLiveWholesaleCatalog(true);
      const catalogMap = new Map<string, WholesaleProductDTO>();

      // Record per-provider metrics
      const counts: Record<string, number> = {
        digitalcore: 0,
        vexorix: 0,
        canboso: 0,
        prodseller: 0,
        ssondigital: 0,
        blinkey: 0,
      };

      for (const item of catalog) {
        catalogMap.set(item.id, item);
        if (counts[item.provider] !== undefined) {
          counts[item.provider]++;
        }
      }

      for (const [providerKey, count] of Object.entries(counts)) {
        this.stats.providers[providerKey] = {
          ok: count > 0 || this.stats.providers[providerKey]?.ok || false,
          productCount: count,
        };
      }

      // 2. Fetch all wholesale products imported across all active merchant stores
      const importedProducts = db.prepare(`
        SELECT p.id, p.tenant_id, p.provider, p.provider_product_id,
               p.wholesale_price_usd, p.retail_price_usd, p.markup_fixed_usd,
               p.markup_pct, p.pricing_mode, p.stock, p.description
        FROM products p
        JOIN tenants t ON p.tenant_id = t.id
        WHERE p.provider != 'custom'
          AND t.status = 'ACTIVE'
      `).all() as any[];

      let updatedCount = 0;
      const touchedTenants = new Set<string>();

      // 3. High-performance single database transaction
      const syncBatchTx = db.transaction(() => {
        const updateStmt = db.prepare(`
          UPDATE products
          SET wholesale_price_usd = ?,
              retail_price_usd = ?,
              markup_fixed_usd = ?,
              stock = ?,
              description = COALESCE(NULLIF(?, ''), description)
          WHERE id = ? AND tenant_id = ?
        `);

        for (const p of importedProducts) {
          if (!p.provider_product_id) continue;
          const upstream = catalogMap.get(p.provider_product_id);
          if (!upstream) continue;

          const currentUpstreamCost = Number(upstream.cost_with_platform_fee_usd.toFixed(2));
          const currentUpstreamStock = Number(upstream.stock ?? 0);
          const currentUpstreamDesc = upstream.description || '';

          // Determine retail price based on pricing mode
          let newRetailPrice = p.retail_price_usd;
          let fixedMargin = p.markup_fixed_usd !== undefined && p.markup_fixed_usd !== null
            ? Number(p.markup_fixed_usd)
            : Math.max(0, Number((p.retail_price_usd - p.wholesale_price_usd).toFixed(2)));

          if (p.pricing_mode === 'pct' && p.markup_pct) {
            newRetailPrice = Number((currentUpstreamCost * (1 + Number(p.markup_pct) / 100)).toFixed(2));
          } else {
            newRetailPrice = Number((currentUpstreamCost + fixedMargin).toFixed(2));
          }

          // Check if anything actually changed to prevent pointless disk I/O
          const priceChanged = Math.abs(Number(p.wholesale_price_usd) - currentUpstreamCost) > 0.001 ||
                               Math.abs(Number(p.retail_price_usd) - newRetailPrice) > 0.001;
          const stockChanged = Number(p.stock) !== currentUpstreamStock;

          if (priceChanged || stockChanged) {
            updateStmt.run(
              currentUpstreamCost,
              newRetailPrice,
              fixedMargin,
              currentUpstreamStock,
              currentUpstreamDesc,
              p.id,
              p.tenant_id
            );
            updatedCount++;
            touchedTenants.add(p.tenant_id);
          }
        }
      });

      syncBatchTx();

      const durationMs = Date.now() - startTime;
      this.stats.lastSyncTimestamp = Date.now();
      this.stats.lastSyncDurationMs = durationMs;
      this.stats.totalProductsChecked = importedProducts.length;
      this.stats.totalProductsUpdated = updatedCount;
      this.stats.activeTenantsUpdated = touchedTenants.size;

      if (updatedCount > 0) {
        console.log(`[SyncDaemon] ⚡ Synced ${importedProducts.length} items: ${updatedCount} updated across ${touchedTenants.size} stores in ${durationMs}ms.`);
      }

      return {
        durationMs,
        updatedCount,
        totalWholesaleChecked: importedProducts.length,
      };
    } catch (err: any) {
      console.error('[SyncDaemon] Sync error:', err.message);
      return {
        durationMs: Date.now() - startTime,
        updatedCount: 0,
        totalWholesaleChecked: 0,
      };
    } finally {
      this.isSyncing = false;
    }
  }
}

export const wholesaleSyncDaemon = new WholesaleSyncDaemon();
