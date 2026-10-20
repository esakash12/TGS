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

// Delete Single Merchant Store (God-Mode)
godmodeRouter.delete('/merchants/:id', async (req: Request, res: Response) => {
  const tenantId = String(req.params.id);
  const tenant = db.prepare('SELECT id, name, slug FROM tenants WHERE id = ?').get(tenantId) as any;
  if (!tenant) {
    return res.status(404).json({ error: 'Merchant store not found' });
  }

  // 1. Stop bot instance if running
  try {
    await botRegistry.stopBot(tenantId);
  } catch (err: any) {
    console.warn(`[GodMode] Warning stopping bot for tenant ${tenantId}:`, err.message);
  }

  // 2. Cascade delete all child data cleanly inside an atomic transaction
  const deleteTx = db.transaction(() => {
    db.prepare('DELETE FROM orders WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM deposits WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM customers WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM custom_inventory WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM products WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM product_groups WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM subscription_history WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM crypto_verified_transactions WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM admin_users WHERE tenant_id = ?').run(tenantId);
    db.prepare('DELETE FROM tenants WHERE id = ?').run(tenantId);
  });

  deleteTx();
  console.log(`[GodMode Audit] Merchant "${tenant.name}" (${tenant.slug}, ID: ${tenantId}) permanently deleted.`);

  res.json({ success: true, message: `Merchant "${tenant.name}" deleted successfully.` });
});

// Purge ALL Test Merchants (God-Mode Clean Slate)
godmodeRouter.post('/merchants/purge-all', async (_req: Request, res: Response) => {
  const allTenants = db.prepare('SELECT id, name, slug FROM tenants').all() as any[];

  // 1. Stop all running merchant bots
  for (const t of allTenants) {
    try {
      await botRegistry.stopBot(t.id);
    } catch (e: any) {
      // ignore
    }
  }

  // 2. Atomic purge of all merchant records
  const purgeTx = db.transaction(() => {
    db.prepare('DELETE FROM orders').run();
    db.prepare('DELETE FROM deposits').run();
    db.prepare('DELETE FROM customers').run();
    db.prepare('DELETE FROM custom_inventory').run();
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM product_groups').run();
    db.prepare('DELETE FROM subscription_history').run();
    db.prepare('DELETE FROM crypto_verified_transactions WHERE tenant_id IS NOT NULL').run();
    db.prepare("DELETE FROM admin_users WHERE role != 'super_admin' AND tenant_id IS NOT NULL").run();
    db.prepare('DELETE FROM tenants').run();
  });

  purgeTx();
  console.log(`[GodMode Audit] Completely purged ${allTenants.length} test merchants from the database.`);

  res.json({
    success: true,
    purgedCount: allTenants.length,
    message: `All ${allTenants.length} test merchants and associated store data have been completely purged.`,
  });
});

// ==========================================
// 3. Wholesale Providers & Margin Engine Config
// ==========================================
godmodeRouter.get('/config', (_req: Request, res: Response) => {
  const config = db.prepare('SELECT * FROM global_system_config WHERE id = 1').get() as any;

  res.json({
    digitalcoreKey: config?.wholesale_digitalcore_key || '',
    vexorixKey: config?.wholesale_vexorix_key || '',
    canbosoKey: config?.wholesale_canboso_key || '',
    platformFeeFixedUsd: Number(config?.platform_fee_fixed_usd ?? 0.01),
    platformFeePct: Number(config?.platform_fee_pct ?? 0.0),
    ownerBinanceUid: config?.owner_binance_uid || '',
    ownerBinanceApiKey: config?.owner_binance_api_key_enc ? '••••••••' + decrypt(config.owner_binance_api_key_enc).slice(-4) : '',
    ownerBinanceHasSecret: Boolean(config?.owner_binance_api_secret_enc),
    godmodeTelegramId: config?.godmode_telegram_id || null,
    godmodeBotToken: config?.godmode_bot_token || '',
  });
});

godmodeRouter.put('/config', (req: Request, res: Response) => {
  const {
    digitalcoreKey,
    vexorixKey,
    canbosoKey,
    platformFeeFixedUsd,
    platformFeePct,
    ownerBinanceUid,
    ownerBinanceApiKey,
    ownerBinanceApiSecret,
    godmodeTelegramId,
    godmodeBotToken,
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
        wholesale_vexorix_key = COALESCE(?, wholesale_vexorix_key),
        wholesale_canboso_key = COALESCE(?, wholesale_canboso_key),
        platform_fee_fixed_usd = COALESCE(?, platform_fee_fixed_usd),
        platform_fee_pct = COALESCE(?, platform_fee_pct),
        owner_binance_uid = COALESCE(?, owner_binance_uid),
        owner_binance_api_key_enc = COALESCE(?, owner_binance_api_key_enc),
        owner_binance_api_secret_enc = COALESCE(?, owner_binance_api_secret_enc),
        godmode_telegram_id = CASE WHEN ? IS NOT NULL THEN ? ELSE godmode_telegram_id END,
        godmode_bot_token = COALESCE(?, godmode_bot_token),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(
    digitalcoreKey !== undefined ? digitalcoreKey.trim() : null,
    vexorixKey !== undefined ? vexorixKey.trim() : null,
    canbosoKey !== undefined ? canbosoKey.trim() : null,
    platformFeeFixedUsd !== undefined ? Number(platformFeeFixedUsd) : null,
    platformFeePct !== undefined ? Number(platformFeePct) : null,
    ownerBinanceUid !== undefined ? ownerBinanceUid.trim() : null,
    newApiKeyEnc,
    newApiSecretEnc,
    godmodeTelegramId !== undefined ? 1 : null,
    godmodeTelegramId !== undefined ? (godmodeTelegramId ? Number(godmodeTelegramId) : null) : null,
    godmodeBotToken !== undefined ? godmodeBotToken.trim() : null
  );

  invalidateWholesaleCache();

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

// Update or set wholesale product rule (active status, minimum plan tier, custom name, custom price)
godmodeRouter.put('/wholesale-rules/:id', (req: Request, res: Response) => {
  const providerProductId = req.params.id;
  const { isActive, minPlanTier, customName, customPriceUsd } = req.body;

  const parsedCustomPrice =
    customPriceUsd !== undefined && customPriceUsd !== null && customPriceUsd !== ''
      ? Number(customPriceUsd)
      : null;

  db.prepare(`
    INSERT INTO platform_wholesale_rules (
      provider_product_id, is_active, min_plan_tier, custom_name, custom_price_usd, updated_at
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(provider_product_id) DO UPDATE SET
      is_active = COALESCE(?, is_active),
      min_plan_tier = COALESCE(?, min_plan_tier),
      custom_name = COALESCE(?, custom_name),
      custom_price_usd = CASE WHEN ? IS NOT NULL THEN ? ELSE custom_price_usd END,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    providerProductId,
    isActive !== undefined ? (isActive ? 1 : 0) : 1,
    minPlanTier || 'starter',
    customName || null,
    parsedCustomPrice,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    minPlanTier || null,
    customName || null,
    customPriceUsd !== undefined ? 1 : null,
    parsedCustomPrice
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

// 1-Click Bulk Wholesale Governance (Disable All, Enable All, or Bulk Set Minimum Plan Tier)
godmodeRouter.post('/wholesale-rules/bulk', async (req: Request, res: Response) => {
  const { action, provider, minPlanTier, productIds } = req.body;
  // action: 'disable_all' | 'enable_all' | 'set_tier'

  try {
    const catalog = await fetchLiveWholesaleCatalog();
    let targetProducts = catalog;

    if (Array.isArray(productIds) && productIds.length > 0) {
      targetProducts = catalog.filter(p => productIds.includes(p.id));
    } else if (provider && provider !== 'all') {
      targetProducts = catalog.filter(p => p.provider.toLowerCase() === provider.toLowerCase());
    }

    const stmt = db.prepare(`
      INSERT INTO platform_wholesale_rules (
        provider_product_id, is_active, min_plan_tier, updated_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(provider_product_id) DO UPDATE SET
        is_active = COALESCE(?, is_active),
        min_plan_tier = COALESCE(?, min_plan_tier),
        updated_at = CURRENT_TIMESTAMP
    `);

    const bulkTx = db.transaction(() => {
      for (const p of targetProducts) {
        if (action === 'disable_all') {
          stmt.run(p.id, 0, p.min_plan_tier || 'starter', 0, null);
        } else if (action === 'enable_all') {
          stmt.run(p.id, 1, p.min_plan_tier || 'starter', 1, null);
        } else if (action === 'set_tier' && minPlanTier) {
          stmt.run(p.id, 1, minPlanTier, null, minPlanTier);
        }
      }
    });

    bulkTx();
    invalidateWholesaleCache();

    res.json({
      success: true,
      action,
      affectedCount: targetProducts.length,
      message: `Successfully executed ${action} across ${targetProducts.length} wholesale products.`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Bulk update failed: ' + err.message });
  }
});

// ==========================================
// 6. Subscription Plans Management (God-Mode)
// ==========================================
godmodeRouter.get('/plans', (_req: Request, res: Response) => {
  try {
    const plans = db.prepare('SELECT * FROM subscription_plans ORDER BY sort_order ASC, created_at ASC').all() as any[];
    const formatted = plans.map(p => {
      let features: string[] = [];
      try {
        features = JSON.parse(p.features_json || '[]');
      } catch {
        features = [];
      }
      return {
        ...p,
        features_json: features,
        price_monthly_usd: Number(p.price_monthly_usd),
        price_yearly_usd: Number(p.price_yearly_usd),
        max_products: Number(p.max_products),
        max_resale_products: p.max_resale_products !== undefined && p.max_resale_products !== null ? Number(p.max_resale_products) : 5,
        max_custom_products: p.max_custom_products !== undefined && p.max_custom_products !== null ? Number(p.max_custom_products) : Number(p.max_products || 50),
      };
    });
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch plans: ' + err.message });
  }
});

godmodeRouter.post('/plans', (req: Request, res: Response) => {
  const {
    id,
    name,
    description,
    priceMonthlyUsd,
    priceYearlyUsd,
    maxProducts,
    maxResaleProducts,
    maxCustomProducts,
    allowWholesale,
    allowBinancePay,
    allowCustomBranding,
    features,
    isPopular,
    isActive,
    sortOrder,
  } = req.body;

  if (!id || !name || priceMonthlyUsd === undefined) {
    return res.status(400).json({ error: 'id, name, and priceMonthlyUsd are required' });
  }

  const planId = String(id).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
  const existing = db.prepare('SELECT id FROM subscription_plans WHERE id = ?').get(planId);
  if (existing) {
    return res.status(400).json({ error: 'Plan with this ID already exists' });
  }

  const featuresJson = JSON.stringify(Array.isArray(features) ? features : []);
  const customLimit = maxCustomProducts !== undefined ? Number(maxCustomProducts) : (maxProducts !== undefined ? Number(maxProducts) : 50);
  const resaleLimit = maxResaleProducts !== undefined ? Number(maxResaleProducts) : 5;

  db.prepare(`
    INSERT INTO subscription_plans (
      id, name, description, price_monthly_usd, price_yearly_usd, max_products, max_resale_products, max_custom_products,
      allow_wholesale, allow_binance_pay, allow_custom_branding, features_json, is_popular, is_active, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    planId,
    name,
    description || '',
    Number(priceMonthlyUsd) || 0,
    priceYearlyUsd !== undefined ? Number(priceYearlyUsd) : (Number(priceMonthlyUsd) * 10),
    customLimit,
    resaleLimit,
    customLimit,
    allowWholesale ? 1 : 0,
    allowBinancePay ? 1 : 0,
    allowCustomBranding ? 1 : 0,
    featuresJson,
    isPopular ? 1 : 0,
    isActive !== undefined ? (isActive ? 1 : 0) : 1,
    Number(sortOrder) || 0
  );

  res.json({ success: true, message: `Plan "${name}" created successfully.` });
});

godmodeRouter.put('/plans/:id', (req: Request, res: Response) => {
  const planId = req.params.id;
  const {
    name,
    description,
    priceMonthlyUsd,
    priceYearlyUsd,
    maxProducts,
    maxResaleProducts,
    maxCustomProducts,
    allowWholesale,
    allowBinancePay,
    allowCustomBranding,
    features,
    isPopular,
    isActive,
    sortOrder,
  } = req.body;

  const current = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(planId) as any;
  if (!current) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  const featuresJson = features !== undefined ? JSON.stringify(Array.isArray(features) ? features : []) : current.features_json;

  db.prepare(`
    UPDATE subscription_plans
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        price_monthly_usd = COALESCE(?, price_monthly_usd),
        price_yearly_usd = COALESCE(?, price_yearly_usd),
        max_products = COALESCE(?, max_products),
        max_resale_products = COALESCE(?, max_resale_products),
        max_custom_products = COALESCE(?, max_custom_products),
        allow_wholesale = COALESCE(?, allow_wholesale),
        allow_binance_pay = COALESCE(?, allow_binance_pay),
        allow_custom_branding = COALESCE(?, allow_custom_branding),
        features_json = ?,
        is_popular = COALESCE(?, is_popular),
        is_active = COALESCE(?, is_active),
        sort_order = COALESCE(?, sort_order),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name ?? null,
    description ?? null,
    priceMonthlyUsd !== undefined ? Number(priceMonthlyUsd) : null,
    priceYearlyUsd !== undefined ? Number(priceYearlyUsd) : null,
    maxProducts !== undefined ? Number(maxProducts) : null,
    maxResaleProducts !== undefined ? Number(maxResaleProducts) : null,
    maxCustomProducts !== undefined ? Number(maxCustomProducts) : null,
    allowWholesale !== undefined ? (allowWholesale ? 1 : 0) : null,
    allowBinancePay !== undefined ? (allowBinancePay ? 1 : 0) : null,
    allowCustomBranding !== undefined ? (allowCustomBranding ? 1 : 0) : null,
    featuresJson,
    isPopular !== undefined ? (isPopular ? 1 : 0) : null,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    sortOrder !== undefined ? Number(sortOrder) : null,
    planId
  );

  res.json({ success: true, message: 'Plan updated successfully' });
});

godmodeRouter.delete('/plans/:id', (req: Request, res: Response) => {
  const planId = req.params.id;
  const inUse = db.prepare('SELECT COUNT(id) as count FROM tenants WHERE plan_id = ?').get(planId) as any;
  if (inUse && inUse.count > 0) {
    db.prepare('UPDATE subscription_plans SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(planId);
    return res.json({ success: true, message: `Plan is currently used by ${inUse.count} merchants, so it was deactivated instead of deleted.` });
  }

  db.prepare('DELETE FROM subscription_plans WHERE id = ?').run(planId);
  res.json({ success: true, message: 'Plan deleted successfully' });
});

// ==========================================
// 7. Coupons Management (God-Mode)
// ==========================================
godmodeRouter.get('/coupons', (_req: Request, res: Response) => {
  try {
    const coupons = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all() as any[];
    res.json(coupons);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch coupons: ' + err.message });
  }
});

godmodeRouter.post('/coupons', (req: Request, res: Response) => {
  const {
    code,
    discountType,
    discountValue,
    applicablePlanId,
    applicableCycle,
    minSpendUsd,
    maxUses,
    expiresAt,
  } = req.body;

  if (!code || !discountType || discountValue === undefined) {
    return res.status(400).json({ error: 'code, discountType, and discountValue are required' });
  }

  const cleanCode = String(code).toUpperCase().trim();
  const existing = db.prepare('SELECT id FROM coupons WHERE code = ?').get(cleanCode);
  if (existing) {
    return res.status(400).json({ error: 'A coupon with this code already exists' });
  }

  db.prepare(`
    INSERT INTO coupons (
      code, discount_type, discount_value, applicable_plan_id, applicable_cycle,
      min_spend_usd, max_uses, expires_at, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    cleanCode,
    discountType === 'FIXED_USD' ? 'FIXED_USD' : 'PERCENTAGE',
    Number(discountValue),
    applicablePlanId || 'ALL',
    applicableCycle || 'ALL',
    Number(minSpendUsd) || 0.0,
    maxUses !== undefined ? Number(maxUses) : -1,
    expiresAt || null
  );

  res.json({ success: true, message: `Coupon "${cleanCode}" created successfully.` });
});

godmodeRouter.put('/coupons/:id', (req: Request, res: Response) => {
  const couponId = req.params.id;
  const { isActive, discountValue, maxUses, expiresAt } = req.body;

  const current = db.prepare('SELECT * FROM coupons WHERE id = ?').get(couponId);
  if (!current) {
    return res.status(404).json({ error: 'Coupon not found' });
  }

  db.prepare(`
    UPDATE coupons
    SET is_active = COALESCE(?, is_active),
        discount_value = COALESCE(?, discount_value),
        max_uses = COALESCE(?, max_uses),
        expires_at = COALESCE(?, expires_at)
    WHERE id = ?
  `).run(
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    discountValue !== undefined ? Number(discountValue) : null,
    maxUses !== undefined ? Number(maxUses) : null,
    expiresAt !== undefined ? expiresAt : null,
    couponId
  );

  res.json({ success: true, message: 'Coupon updated successfully' });
});

godmodeRouter.delete('/coupons/:id', (req: Request, res: Response) => {
  const couponId = req.params.id;
  db.prepare('DELETE FROM coupons WHERE id = ?').run(couponId);
  res.json({ success: true, message: 'Coupon deleted successfully' });
});

// ==========================================
// 8. Subscription Invoices & Ledger (God-Mode)
// ==========================================
godmodeRouter.get('/subscriptions', (_req: Request, res: Response) => {
  try {
    const history = db.prepare(`
      SELECT 
        sh.*,
        t.name as tenant_name,
        t.slug as tenant_slug,
        sp.name as plan_name,
        c.code as coupon_code
      FROM subscription_history sh
      JOIN tenants t ON sh.tenant_id = t.id
      JOIN subscription_plans sp ON sh.plan_id = sp.id
      LEFT JOIN coupons c ON sh.coupon_id = c.id
      ORDER BY sh.created_at DESC
      LIMIT 100
    `).all() as any[];

    const stats = db.prepare(`
      SELECT 
        COUNT(id) as total_subscriptions_count,
        COALESCE(SUM(final_amount_paid_usd), 0) as total_revenue_usd
      FROM subscription_history
    `).get() as any;

    res.json({
      history,
      totalRevenueUsd: Number(stats.total_revenue_usd || 0),
      totalSubscriptionsCount: Number(stats.total_subscriptions_count || 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch subscription history: ' + err.message });
  }
});



