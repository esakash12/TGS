import { Router, Request, Response } from 'express';
import os from 'os';
import { requireSuperAdmin } from '../middleware/auth';
import { signToken } from '../services/auth';
import { db } from '../db/database';
import { encrypt, decrypt } from '../services/crypto';
import {
  getDigitalCoreBalance,
  getCanbosoBalance,
  fetchLiveWholesaleCatalog,
  invalidateWholesaleCache,
} from '../services/wholesale';
import { botRegistry } from '../../../bot/src/registry';
import { GODMODE_SECRET_TOKEN } from '../../../shared/constants';

export const godmodeRouter = Router();

// Dedicated God-Mode Login Endpoint
godmodeRouter.post('/login', (req: Request, res: Response) => {
  const { token } = req.body;
  const expectedToken = process.env.GODMODE_SECRET_TOKEN || GODMODE_SECRET_TOKEN;

  if (!token || token.trim() !== expectedToken) {
    return res.status(401).json({ error: 'Access denied: Invalid God-Mode Secret Token' });
  }

  const sessionToken = signToken({
    userId: 0,
    tenantId: null,
    username: 'super_admin',
    role: 'super_admin',
  });

  res.json({ success: true, token: sessionToken });
});

// Enforce God-Mode Secret Guard across all subsequent endpoints in this router
godmodeRouter.use(requireSuperAdmin);

// ==========================================
// 1. God-Mode Cyber Command Center Overview
// ==========================================
godmodeRouter.get('/overview', async (_req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const totalSystemMem = os.totalmem();
  const freeSystemMem = os.freemem();

  // Fetch Live Wholesale Balances concurrently
  const [digitalCoreBal, canbosoBal] = await Promise.all([
    getDigitalCoreBalance(),
    getCanbosoBalance(),
  ]);

  // Aggregate stats across all stores
  const storeStats = db.prepare(`
    SELECT 
      COUNT(id) as total_merchants,
      SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_merchants,
      SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) as suspended_merchants,
      COALESCE(SUM(wallet_usd), 0) as total_merchant_wallets_usd
    FROM tenants
  `).get() as any;

  const orderStats = db.prepare(`
    SELECT 
      COUNT(id) as total_orders,
      COALESCE(SUM(total_price_usd), 0) as gross_volume_usd,
      COALESCE(SUM(wholesale_cost_usd), 0) as wholesale_volume_usd
    FROM orders WHERE status = 'COMPLETED'
  `).get() as any;

  res.json({
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      nodeMemoryRssMb: Number((memUsage.rss / 1024 / 1024).toFixed(1)),
      nodeMemoryHeapMb: Number((memUsage.heapUsed / 1024 / 1024).toFixed(1)),
      osFreeMemMb: Number((freeSystemMem / 1024 / 1024).toFixed(1)),
      osTotalMemMb: Number((totalSystemMem / 1024 / 1024).toFixed(1)),
      cpuLoad: os.loadavg(),
    },
    wholesaleBalances: {
      digitalcore: digitalCoreBal,
      canboso: canbosoBal,
    },
    fleet: {
      totalMerchants: Number(storeStats.total_merchants || 0),
      activeMerchants: Number(storeStats.active_merchants || 0),
      suspendedMerchants: Number(storeStats.suspended_merchants || 0),
      totalMerchantWalletsUsd: Number(storeStats.total_merchant_wallets_usd || 0),
      totalCompletedOrders: Number(orderStats.total_orders || 0),
      grossVolumeUsd: Number(orderStats.gross_volume_usd || 0),
    },
  });
});

// ==========================================
// 2. Merchant Fleet Management & Killswitch
// ==========================================
godmodeRouter.get('/merchants', (_req: Request, res: Response) => {
  const merchants = db.prepare(`
    SELECT 
      t.id, t.name, t.slug, t.owner_email, t.bot_token, t.bot_username,
      t.plan_id, t.status, t.wallet_usd, t.created_at,
      COUNT(o.id) as orders_count,
      COALESCE(SUM(o.total_price_usd), 0) as store_revenue_usd
    FROM tenants t
    LEFT JOIN orders o ON t.id = o.tenant_id AND o.status = 'COMPLETED'
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all() as any[];

  // Attach live bot health
  const enriched = merchants.map(m => {
    const status = botRegistry.getBotStatus(m.id);
    return {
      ...m,
      botOnline: status.is_online,
      botHasToken: Boolean(m.bot_token),
    };
  });

  res.json(enriched);
});

// 1-Click Emergency Killswitch (Toggle SUSPENDED / ACTIVE)
godmodeRouter.post('/merchants/:id/status', async (req: Request, res: Response) => {
  const tenantId = String(req.params.id);
  const { status } = req.body;

  if (status !== 'ACTIVE' && status !== 'SUSPENDED') {
    return res.status(400).json({ error: 'Status must be ACTIVE or SUSPENDED' });
  }

  db.prepare('UPDATE tenants SET status = ? WHERE id = ?').run(status, tenantId);

  // If suspended, stop bot immediately
  if (status === 'SUSPENDED') {
    await botRegistry.stopBot(tenantId);
  } else {
    await botRegistry.reloadBot(tenantId);
  }

  res.json({ success: true, tenantId, newStatus: status });
});

// Adjust Merchant Wholesale Wallet Balance
godmodeRouter.post('/merchants/:id/adjust-wallet', (req: Request, res: Response) => {
  const tenantId = String(req.params.id);
  const { amountDeltaUsd, note } = req.body;

  if (amountDeltaUsd === undefined || isNaN(Number(amountDeltaUsd))) {
    return res.status(400).json({ error: 'Valid amount delta is required' });
  }

  db.prepare(`
    UPDATE tenants SET wallet_usd = wallet_usd + ? WHERE id = ?
  `).run(Number(amountDeltaUsd), tenantId);

  const updated = db.prepare('SELECT id, name, wallet_usd FROM tenants WHERE id = ?').get(tenantId);
  console.log(`[GodMode Audit] Merchant ${tenantId} wallet adjusted by $${amountDeltaUsd}. Note: ${note || 'None'}`);

  res.json({ success: true, updated });
});

// ==========================================
// 3. Wholesale Providers & Margin Engine Config
// ==========================================
godmodeRouter.get('/config', (_req: Request, res: Response) => {
  const config = db.prepare('SELECT * FROM global_system_config WHERE id = 1').get() as any;

  res.json({
    digitalcoreKey: config?.wholesale_digitalcore_key || '',
    canbosoKey: config?.wholesale_canboso_key || '',
    platformFeeFixedUsd: Number(config?.platform_fee_fixed_usd ?? 0.01),
    platformFeePct: Number(config?.platform_fee_pct ?? 0.0),
    ownerBinanceUid: config?.owner_binance_uid || '',
    ownerBinanceApiKey: config?.owner_binance_api_key_enc ? '••••••••' + decrypt(config.owner_binance_api_key_enc).slice(-4) : '',
    ownerBinanceHasSecret: Boolean(config?.owner_binance_api_secret_enc),
  });
});

godmodeRouter.put('/config', (req: Request, res: Response) => {
  const {
    digitalcoreKey,
    canbosoKey,
    platformFeeFixedUsd,
    platformFeePct,
    ownerBinanceUid,
    ownerBinanceApiKey,
    ownerBinanceApiSecret,
  } = req.body;

  const current = db.prepare('SELECT * FROM global_system_config WHERE id = 1').get() as any;

  let newApiKeyEnc = current?.owner_binance_api_key_enc || '';
  if (ownerBinanceApiKey && !ownerBinanceApiKey.includes('••••')) {
    newApiKeyEnc = encrypt(ownerBinanceApiKey.trim());
  }

  let newApiSecretEnc = current?.owner_binance_api_secret_enc || '';
  if (ownerBinanceApiSecret) {
    newApiSecretEnc = encrypt(ownerBinanceApiSecret.trim());
  }

  db.prepare(`
    UPDATE global_system_config
    SET wholesale_digitalcore_key = COALESCE(?, wholesale_digitalcore_key),
        wholesale_canboso_key = COALESCE(?, wholesale_canboso_key),
        platform_fee_fixed_usd = COALESCE(?, platform_fee_fixed_usd),
        platform_fee_pct = COALESCE(?, platform_fee_pct),
        owner_binance_uid = COALESCE(?, owner_binance_uid),
        owner_binance_api_key_enc = COALESCE(?, owner_binance_api_key_enc),
        owner_binance_api_secret_enc = COALESCE(?, owner_binance_api_secret_enc),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(
    digitalcoreKey !== undefined ? digitalcoreKey.trim() : null,
    canbosoKey !== undefined ? canbosoKey.trim() : null,
    platformFeeFixedUsd !== undefined ? Number(platformFeeFixedUsd) : null,
    platformFeePct !== undefined ? Number(platformFeePct) : null,
    ownerBinanceUid !== undefined ? ownerBinanceUid.trim() : null,
    newApiKeyEnc,
    newApiSecretEnc
  );

  res.json({ success: true, message: 'Global system configuration updated.' });
});

// ==========================================
// 4. Wholesale Governance & Catalog Gating
// ==========================================
godmodeRouter.get('/wholesale-catalog', async (req: Request, res: Response) => {
  try {
    const catalog = await fetchLiveWholesaleCatalog(req.query.refresh === 'true');
    const search = req.query.q ? String(req.query.q).toLowerCase().trim() : '';

    let result = catalog;
    if (search) {
      result = catalog.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.category.toLowerCase().includes(search) ||
        p.provider.toLowerCase().includes(search) ||
        p.id.toLowerCase().includes(search)
      );
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch upstream wholesale catalog: ' + err.message });
  }
});

// Update or set wholesale product rule (active status, minimum plan tier, custom name)
godmodeRouter.put('/wholesale-rules/:id', (req: Request, res: Response) => {
  const providerProductId = req.params.id;
  const { isActive, minPlanTier, customName } = req.body;

  db.prepare(`
    INSERT INTO platform_wholesale_rules (
      provider_product_id, is_active, min_plan_tier, custom_name, updated_at
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(provider_product_id) DO UPDATE SET
      is_active = COALESCE(?, is_active),
      min_plan_tier = COALESCE(?, min_plan_tier),
      custom_name = COALESCE(?, custom_name),
      updated_at = CURRENT_TIMESTAMP
  `).run(
    providerProductId,
    isActive !== undefined ? (isActive ? 1 : 0) : 1,
    minPlanTier || 'starter',
    customName || null,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    minPlanTier || null,
    customName || null
  );

  invalidateWholesaleCache();
  res.json({ success: true, providerProductId });
});

// 1-Click Delete / Disable Wholesale Product Globally
godmodeRouter.delete('/wholesale-rules/:id', (req: Request, res: Response) => {
  const providerProductId = req.params.id;

  db.prepare(`
    INSERT INTO platform_wholesale_rules (provider_product_id, is_active, updated_at)
    VALUES (?, 0, CURRENT_TIMESTAMP)
    ON CONFLICT(provider_product_id) DO UPDATE SET
      is_active = 0,
      updated_at = CURRENT_TIMESTAMP
  `).run(providerProductId);

  invalidateWholesaleCache();
  res.json({ success: true, message: `Product ${providerProductId} globally disabled/deleted from platform.` });
});

