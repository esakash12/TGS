import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/database';
import { encrypt, decrypt } from '../services/crypto';
import {
  fetchLiveWholesaleCatalog,
  fetchLiveWholesaleCatalogForMerchant,
  syncLivePricesForTenant,
} from '../services/wholesale';
import { verifyMerchantWholesaleTopup } from '../services/binance';
import { botRegistry } from '../../../bot/src/registry';

export const merchantRouter = Router();

// Apply requireAuth to all merchant routes
merchantRouter.use(requireAuth);

// Middleware: ensure user belongs to an active tenant
function ensureTenant(req: AuthenticatedRequest, res: Response, next: Function) {
  if (!req.tenant) {
    return res.status(403).json({ error: 'Tenant context required.' });
  }
  next();
}

merchantRouter.use(ensureTenant);

// ==========================================
// 1. Dashboard Overview Metrics
// ==========================================
merchantRouter.get('/overview', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;

  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as any;

  // Total Orders & Revenue & Net Profit
  const orderStats = db.prepare(`
    SELECT 
      COUNT(id) as total_orders,
      COALESCE(SUM(total_price_usd), 0) as total_revenue_usd,
      COALESCE(SUM(profit_usd), 0) as total_profit_usd
    FROM orders 
    WHERE tenant_id = ? AND status = 'COMPLETED'
  `).get(tenantId) as any;

  // Total Customers
  const customerCount = db.prepare(`
    SELECT COUNT(id) as count FROM customers WHERE tenant_id = ?
  `).get(tenantId) as any;

  // Pending Deposits
  const pendingDeposits = db.prepare(`
    SELECT COUNT(id) as count FROM deposits WHERE tenant_id = ? AND status = 'PENDING'
  `).get(tenantId) as any;

  // Bot Status
  const botStatus = botRegistry.getBotStatus(tenantId);

  res.json({
    storeName: tenant.name,
    slug: tenant.slug,
    walletUsd: Number(tenant.wallet_usd || 0),
    usdToBdtRate: Number(tenant.usd_to_bdt_rate || 125.0),
    totalOrders: Number(orderStats.total_orders || 0),
    totalRevenueUsd: Number(orderStats.total_revenue_usd || 0),
    totalProfitUsd: Number(orderStats.total_profit_usd || 0),
    totalCustomers: Number(customerCount.count || 0),
    pendingDepositsCount: Number(pendingDeposits.count || 0),
    botStatus,
  });
});

// ==========================================
// 1.1. Merchant Custom Product Groups & Folders
// ==========================================
merchantRouter.get('/groups', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const groups = db.prepare(`
    SELECT g.*, COUNT(p.id) as product_count
    FROM product_groups g
    LEFT JOIN products p ON p.group_id = g.id AND p.tenant_id = g.tenant_id
    WHERE g.tenant_id = ?
    GROUP BY g.id
    ORDER BY g.sort_order ASC, g.created_at ASC
  `).all(tenantId);
  res.json(groups);
});

merchantRouter.post('/groups', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const { name, icon, sortOrder } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Group name is required.' });
  }

  const groupId = 'grp_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO product_groups (id, tenant_id, name, icon, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(groupId, tenantId, name.trim(), icon?.trim() || '📁', Number(sortOrder || 0));

  const created = db.prepare('SELECT * FROM product_groups WHERE id = ?').get(groupId);
  res.status(201).json(created);
});

merchantRouter.put('/groups/:id', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const groupId = req.params.id;
  const { name, icon, sortOrder } = req.body;

  db.prepare(`
    UPDATE product_groups
    SET name = COALESCE(?, name),
        icon = COALESCE(?, icon),
        sort_order = COALESCE(?, sort_order)
    WHERE id = ? AND tenant_id = ?
  `).run(name ? name.trim() : null, icon ? icon.trim() : null, sortOrder !== undefined ? Number(sortOrder) : null, groupId, tenantId);

  const updated = db.prepare('SELECT * FROM product_groups WHERE id = ?').get(groupId);
  res.json(updated);
});

merchantRouter.delete('/groups/:id', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const groupId = req.params.id;

  const deleteTx = db.transaction(() => {
    // Unlink products in this group safely
    db.prepare(`
      UPDATE products SET group_id = NULL WHERE tenant_id = ? AND group_id = ?
    `).run(tenantId, groupId);

    db.prepare(`
      DELETE FROM product_groups WHERE id = ? AND tenant_id = ?
    `).run(groupId, tenantId);
  });

  deleteTx();
  res.json({ success: true, message: 'Group deleted. Associated products are now in General.' });
});

// ==========================================
// 2. Products & Inventory Management
// ==========================================
merchantRouter.get('/products', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const type = req.query.type as string; // 'custom' | 'wholesale'

  let query = `
    SELECT p.*, g.name as group_name, g.icon as group_icon
    FROM products p
    LEFT JOIN product_groups g ON p.group_id = g.id
    WHERE p.tenant_id = ?
  `;
  const params: any[] = [tenantId];

  if (type === 'custom') {
    query += ` AND p.provider = 'custom'`;
  } else if (type === 'wholesale') {
    query += ` AND p.provider != 'custom'`;
  }

  query += ` ORDER BY p.created_at DESC`;

  const products = db.prepare(query).all(...params);
  res.json(products);
});

// 1-Click Instant Product ON/OFF Toggle
merchantRouter.patch('/products/:id/toggle', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const productId = req.params.id;

  const product = db.prepare('SELECT id, is_active FROM products WHERE id = ? AND tenant_id = ?').get(productId, tenantId) as any;
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const newActive = product.is_active ? 0 : 1;
  db.prepare('UPDATE products SET is_active = ? WHERE id = ? AND tenant_id = ?').run(newActive, productId, tenantId);

  const updated = db.prepare(`
    SELECT p.*, g.name as group_name, g.icon as group_icon
    FROM products p
    LEFT JOIN product_groups g ON p.group_id = g.id
    WHERE p.id = ?
  `).get(productId);

  res.json({ success: true, is_active: newActive, product: updated });
});

// Create Custom Product (with custom group selection)
merchantRouter.post('/products', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const { name, category, retailPriceUsd, description, inventoryItems, groupId } = req.body;

  if (!name || !retailPriceUsd) {
    return res.status(400).json({ error: 'Product name and retail price (USD) are required.' });
  }

  const productId = 'prd_' + Math.random().toString(36).substring(2, 10);
  const items: string[] = Array.isArray(inventoryItems)
    ? inventoryItems
    : typeof inventoryItems === 'string'
    ? inventoryItems.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
    : [];

  const createTx = db.transaction(() => {
    // 1. Insert product
    db.prepare(`
      INSERT INTO products (
        id, tenant_id, group_id, name, category, provider, retail_price_usd, stock, description
      ) VALUES (?, ?, ?, ?, ?, 'custom', ?, ?, ?)
    `).run(productId, tenantId, groupId || null, name.trim(), category || 'General', Number(retailPriceUsd), items.length, description || '');

    // 2. Insert inventory items
    if (items.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO custom_inventory (tenant_id, product_id, item_data, status)
        VALUES (?, ?, ?, 'AVAILABLE')
      `);
      for (const item of items) {
        insertStmt.run(tenantId, productId, item);
      }
    }
  });

  createTx();
  const created = db.prepare(`
    SELECT p.*, g.name as group_name, g.icon as group_icon
    FROM products p
    LEFT JOIN product_groups g ON p.group_id = g.id
    WHERE p.id = ?
  `).get(productId);
  res.status(201).json(created);
});

// Add stock keys to custom product
merchantRouter.post('/products/:id/stock', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const productId = req.params.id;
  const { itemsText } = req.body;

  if (!itemsText) {
    return res.status(400).json({ error: 'No inventory items provided.' });
  }

  const items: string[] = itemsText.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
  if (items.length === 0) {
    return res.status(400).json({ error: 'No valid lines detected.' });
  }

  const addStockTx = db.transaction(() => {
    const insertStmt = db.prepare(`
      INSERT INTO custom_inventory (tenant_id, product_id, item_data, status)
      VALUES (?, ?, ?, 'AVAILABLE')
    `);
    for (const item of items) {
      insertStmt.run(tenantId, productId, item);
    }

    db.prepare(`
      UPDATE products SET stock = stock + ? WHERE id = ? AND tenant_id = ?
    `).run(items.length, productId, tenantId);
  });

  addStockTx();
  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  res.json({ success: true, addedCount: items.length, product: updated });
});

// Update product
merchantRouter.put('/products/:id', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const productId = req.params.id;
  const { name, category, retailPriceUsd, isActive, description, groupId } = req.body;

  const current = db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').get(productId, tenantId) as any;
  if (!current) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  let markupFixed = current.markup_fixed_usd;
  if (retailPriceUsd && current.provider !== 'custom') {
    markupFixed = Number((Number(retailPriceUsd) - Number(current.wholesale_price_usd)).toFixed(2));
  }

  db.prepare(`
    UPDATE products 
    SET name = COALESCE(?, name),
        category = COALESCE(?, category),
        retail_price_usd = COALESCE(?, retail_price_usd),
        markup_fixed_usd = COALESCE(?, markup_fixed_usd),
        pricing_mode = 'fixed',
        is_active = COALESCE(?, is_active),
        description = COALESCE(?, description),
        group_id = CASE WHEN ? IS NOT NULL THEN ? ELSE group_id END
    WHERE id = ? AND tenant_id = ?
  `).run(
    name ? name.trim() : null,
    category ? category.trim() : null,
    retailPriceUsd ? Number(retailPriceUsd) : null,
    markupFixed !== undefined ? Number(markupFixed) : null,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    description,
    groupId !== undefined ? groupId : null,
    groupId !== undefined ? (groupId || null) : null,
    productId,
    tenantId
  );

  const updated = db.prepare(`
    SELECT p.*, g.name as group_name, g.icon as group_icon
    FROM products p
    LEFT JOIN product_groups g ON p.group_id = g.id
    WHERE p.id = ?
  `).get(productId);
  res.json(updated);
});

// Bulk Clear / Delete Products (all, wholesale only, or custom only)
merchantRouter.delete('/products/clear-all', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const type = (req.query.type as string) || 'all'; // 'all' | 'wholesale' | 'custom'

  let deleteSql = 'DELETE FROM products WHERE tenant_id = ?';
  if (type === 'wholesale') {
    deleteSql += " AND provider != 'custom'";
  } else if (type === 'custom') {
    deleteSql += " AND provider = 'custom'";
  }

  const result = db.prepare(deleteSql).run(tenantId);
  res.json({ success: true, count: result.changes, message: `Successfully deleted ${result.changes} products from your store.` });
});

// Apply Global Profit Margin across all wholesale products
merchantRouter.post('/products/apply-margin', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const { marginFixedUsd, marginPct, mode } = req.body;
  const pricingMode = mode === 'pct' ? 'pct' : 'fixed';

  const wholesaleProducts = db.prepare(`
    SELECT id, wholesale_price_usd FROM products WHERE tenant_id = ? AND provider != 'custom'
  `).all(tenantId) as any[];

  const updateTx = db.transaction(() => {
    for (const p of wholesaleProducts) {
      let newRetail = 0;
      if (pricingMode === 'pct') {
        const pct = Number(marginPct || 20);
        newRetail = Number((p.wholesale_price_usd * (1 + pct / 100)).toFixed(2));
        db.prepare(`
          UPDATE products 
          SET retail_price_usd = ?, markup_pct = ?, pricing_mode = 'pct'
          WHERE id = ? AND tenant_id = ?
        `).run(newRetail, pct, p.id, tenantId);
      } else {
        const fixed = Number(marginFixedUsd || 0.20);
        newRetail = Number((p.wholesale_price_usd + fixed).toFixed(2));
        db.prepare(`
          UPDATE products 
          SET retail_price_usd = ?, markup_fixed_usd = ?, pricing_mode = 'fixed'
          WHERE id = ? AND tenant_id = ?
        `).run(newRetail, fixed, p.id, tenantId);
      }
    }

    db.prepare(`
      UPDATE tenants 
      SET global_markup_fixed_usd = COALESCE(?, global_markup_fixed_usd),
          global_markup_pct = COALESCE(?, global_markup_pct)
      WHERE id = ?
    `).run(marginFixedUsd !== undefined ? Number(marginFixedUsd) : null, marginPct !== undefined ? Number(marginPct) : null, tenantId);
  });

  updateTx();
  res.json({ success: true, updatedCount: wholesaleProducts.length, pricingMode });
});

// Sync live upstream wholesale prices & auto-adjust retail selling prices based on margins
merchantRouter.post('/products/sync-prices', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant.id;
    const result = await syncLivePricesForTenant(tenantId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to sync prices: ' + err.message });
  }
});

// Delete product
merchantRouter.delete('/products/:id', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const productId = req.params.id;
  db.prepare('DELETE FROM products WHERE id = ? AND tenant_id = ?').run(productId, tenantId);
  res.json({ success: true });
});

// ==========================================
// 3. Upstream Wholesale Catalog & Search & Import
// ==========================================
merchantRouter.get('/wholesale/catalog', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.tenant.id;
    const tenant = db.prepare('SELECT plan_id FROM tenants WHERE id = ?').get(tenantId) as any;
    const search = req.query.q ? String(req.query.q) : undefined;

    // Filters out globally deleted/disabled wholesale products
    const catalog = await fetchLiveWholesaleCatalogForMerchant(tenant?.plan_id || 'starter', search);
    res.json(catalog);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch wholesale catalog: ' + err.message });
  }
});

// Import wholesale product into store (with optional custom group)
merchantRouter.post('/wholesale/import', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const { wholesaleProductId, name, category, wholesaleCostUsd, retailPriceUsd, provider, groupId } = req.body;

  if (!wholesaleProductId || !retailPriceUsd) {
    return res.status(400).json({ error: 'Missing product ID or retail price' });
  }

  const markupFixed = Number((Number(retailPriceUsd) - Number(wholesaleCostUsd)).toFixed(2));

  // Check if already imported
  const existing = db.prepare(`
    SELECT id FROM products WHERE tenant_id = ? AND provider_product_id = ?
  `).get(tenantId, wholesaleProductId) as any;

  if (existing) {
    // update price, group, margin and reactivate
    db.prepare(`
      UPDATE products 
      SET retail_price_usd = ?, wholesale_price_usd = ?, markup_fixed_usd = ?, pricing_mode = 'fixed', group_id = COALESCE(?, group_id), is_active = 1 
      WHERE tenant_id = ? AND provider_product_id = ?
    `).run(Number(retailPriceUsd), Number(wholesaleCostUsd), markupFixed, groupId || null, tenantId, wholesaleProductId);
    return res.json({ success: true, updated: true, productId: existing.id });
  }

  const productId = 'prd_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO products (
      id, tenant_id, group_id, name, category, provider, provider_product_id,
      wholesale_price_usd, retail_price_usd, markup_fixed_usd, pricing_mode, stock, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'fixed', 999, 1)
  `).run(
    productId,
    tenantId,
    groupId || null,
    name.trim(),
    category || 'Wholesale',
    provider || 'digitalcore',
    wholesaleProductId,
    Number(wholesaleCostUsd),
    Number(retailPriceUsd),
    markupFixed
  );

  res.status(201).json({ success: true, productId });
});

// Bulk auto-import wholesale products with global margin
merchantRouter.post('/wholesale/bulk-enable', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const { markupPct = 20, markupFixedUsd = 0.50 } = req.body;

  try {
    const catalog = await fetchLiveWholesaleCatalog();
    let imported = 0;

    const bulkTx = db.transaction(() => {
      for (const item of catalog) {
        const cost = item.cost_with_platform_fee_usd;
        const retail = Number((cost * (1 + markupPct / 100) + markupFixedUsd).toFixed(2));

        const existing = db.prepare(`
          SELECT id FROM products WHERE tenant_id = ? AND provider_product_id = ?
        `).get(tenantId, item.id) as any;

        if (existing) {
          db.prepare(`
            UPDATE products 
            SET retail_price_usd = ?, wholesale_price_usd = ?, is_active = 1
            WHERE id = ?
          `).run(retail, cost, existing.id);
        } else {
          const productId = 'prd_' + Math.random().toString(36).substring(2, 10);
          db.prepare(`
            INSERT INTO products (
              id, tenant_id, name, category, provider, provider_product_id,
              wholesale_price_usd, retail_price_usd, stock, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          `).run(productId, tenantId, item.name, item.category, item.provider, item.id, cost, retail, item.stock || 999);
        }
        imported++;
      }

      // Update tenant auto markup config
      db.prepare(`
        UPDATE tenants 
        SET global_markup_pct = ?, global_markup_fixed_usd = ?, auto_markup_enabled = 1
        WHERE id = ?
      `).run(markupPct, markupFixedUsd, tenantId);
    });

    bulkTx();
    res.json({ success: true, count: imported });
  } catch (err: any) {
    res.status(500).json({ error: 'Bulk import failed: ' + err.message });
  }
});

// ==========================================
// 4. Deposits Management
// ==========================================
merchantRouter.get('/deposits', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const deposits = db.prepare(`
    SELECT * FROM deposits WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(tenantId);
  res.json(deposits);
});

// 1-Click Approve Deposit
merchantRouter.post('/deposits/:id/approve', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const depositId = req.params.id;

  const deposit = db.prepare('SELECT * FROM deposits WHERE id = ? AND tenant_id = ?').get(depositId, tenantId) as any;
  if (!deposit) {
    return res.status(404).json({ error: 'Deposit request not found.' });
  }

  if (deposit.status === 'APPROVED') {
    return res.status(400).json({ error: 'Deposit has already been approved.' });
  }

  const approveTx = db.transaction(() => {
    // 1. Mark deposit as APPROVED
    db.prepare(`
      UPDATE deposits SET status = 'APPROVED', processed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(depositId);

    // 2. Credit customer balance_usd atomically
    db.prepare(`
      UPDATE customers SET balance_usd = balance_usd + ? WHERE tenant_id = ? AND telegram_id = ?
    `).run(deposit.amount_usd, tenantId, deposit.customer_telegram_id);
  });

  approveTx();

  // Send bot notification to customer asynchronously
  botRegistry.sendNotificationToCustomer(
    tenantId,
    deposit.customer_telegram_id,
    `🎉 <b>Deposit Approved!</b>\n\nAmount: <b>$${deposit.amount_usd.toFixed(2)} USD</b>\nMethod: ${deposit.method}\nTrxID: <code>${deposit.trx_id}</code>\n\nYour balance is now updated. Enjoy shopping! 🛍️`
  );

  res.json({ success: true, message: 'Deposit approved and customer balance credited.' });
});

// 1-Click Reject Deposit
merchantRouter.post('/deposits/:id/reject', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const depositId = req.params.id;
  const { reason } = req.body;

  const deposit = db.prepare('SELECT * FROM deposits WHERE id = ? AND tenant_id = ?').get(depositId, tenantId) as any;
  if (!deposit) {
    return res.status(404).json({ error: 'Deposit request not found.' });
  }

  db.prepare(`
    UPDATE deposits SET status = 'REJECTED', admin_note = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(reason || 'Incorrect TrxID or amount mismatch', depositId);

  botRegistry.sendNotificationToCustomer(
    tenantId,
    deposit.customer_telegram_id,
    `❌ <b>Deposit Rejected</b>\n\nMethod: ${deposit.method}\nTrxID: <code>${deposit.trx_id}</code>\nReason: ${reason || 'Transaction could not be verified'}.\n\nPlease double check and submit again.`
  );

  res.json({ success: true, message: 'Deposit marked as rejected.' });
});

// ==========================================
// 5. Wholesale Wallet (Tier 2 Top-Up)
// ==========================================
merchantRouter.get('/wholesale-wallet/info', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const tenant = db.prepare('SELECT wallet_usd FROM tenants WHERE id = ?').get(tenantId) as any;

  // Fetch Platform Owner Binance Pay Info from Global System Config
  const globalConfig = db.prepare('SELECT owner_binance_uid FROM global_system_config WHERE id = 1').get() as any;

  res.json({
    walletUsd: Number(tenant?.wallet_usd || 0),
    platformOwnerBinanceUid: globalConfig?.owner_binance_uid || 'Configure in God Mode',
  });
});

merchantRouter.post('/wholesale-wallet/verify', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const { trxId, amountUsd } = req.body;

  if (!trxId || !amountUsd) {
    return res.status(400).json({ error: 'Transaction ID and amount (USD) are required.' });
  }

  const result = await verifyMerchantWholesaleTopup({
    tenantId,
    trxId: String(trxId).trim(),
    declaredAmountUsd: Number(amountUsd),
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Verification failed' });
  }

  const updatedTenant = db.prepare('SELECT wallet_usd FROM tenants WHERE id = ?').get(tenantId) as any;
  res.json({
    success: true,
    message: `Successfully verified and credited $${result.amountUsd?.toFixed(2)} USD!`,
    newBalanceUsd: Number(updatedTenant.wallet_usd || 0),
  });
});

// ==========================================
// 6. Settings & Bot Token Setup
// ==========================================
merchantRouter.get('/settings', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as any;

  tenant.payment_numbers_json = JSON.parse(tenant.payment_numbers_json || '{}');
  const decryptedBinance = decrypt(tenant.binance_config_json_enc);
  tenant.binance_config_json = JSON.parse(decryptedBinance || '{}');

  res.json({
    name: tenant.name,
    slug: tenant.slug,
    botToken: tenant.bot_token || '',
    botUsername: tenant.bot_username || '',
    usdToBdtRate: Number(tenant.usd_to_bdt_rate || 125.0),
    paymentNumbers: tenant.payment_numbers_json,
    binanceConfig: {
      uid: tenant.binance_config_json?.uid || '',
      apiKey: tenant.binance_config_json?.apiKey ? '••••••••' + tenant.binance_config_json.apiKey.slice(-4) : '',
      hasSecret: Boolean(tenant.binance_config_json?.apiSecret),
    },
    autoMarkup: {
      enabled: Boolean(tenant.auto_markup_enabled),
      pct: Number(tenant.global_markup_pct || 20),
      fixedUsd: Number(tenant.global_markup_fixed_usd || 0.50),
    },
  });
});

merchantRouter.put('/settings', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const { storeName, botToken, usdToBdtRate, paymentNumbers, binanceConfig, autoMarkup } = req.body;

  const current = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as any;

  // Handle Binance Config Encryption
  let newBinanceEnc = current.binance_config_json_enc;
  if (binanceConfig) {
    const existingConfig = JSON.parse(decrypt(current.binance_config_json_enc) || '{}');
    const merged = {
      uid: binanceConfig.uid ?? existingConfig.uid ?? '',
      apiKey: binanceConfig.apiKey && !binanceConfig.apiKey.includes('••••') ? binanceConfig.apiKey : existingConfig.apiKey ?? '',
      apiSecret: binanceConfig.apiSecret ? binanceConfig.apiSecret : existingConfig.apiSecret ?? '',
    };
    newBinanceEnc = encrypt(JSON.stringify(merged));
  }

  // Update DB
  db.prepare(`
    UPDATE tenants
    SET name = COALESCE(?, name),
        bot_token = COALESCE(?, bot_token),
        usd_to_bdt_rate = COALESCE(?, usd_to_bdt_rate),
        payment_numbers_json = COALESCE(?, payment_numbers_json),
        binance_config_json_enc = COALESCE(?, binance_config_json_enc),
        auto_markup_enabled = COALESCE(?, auto_markup_enabled),
        global_markup_pct = COALESCE(?, global_markup_pct),
        global_markup_fixed_usd = COALESCE(?, global_markup_fixed_usd)
    WHERE id = ?
  `).run(
    storeName,
    botToken !== undefined ? botToken.trim() : null,
    usdToBdtRate ? Number(usdToBdtRate) : null,
    paymentNumbers ? JSON.stringify(paymentNumbers) : null,
    newBinanceEnc,
    autoMarkup?.enabled !== undefined ? (autoMarkup.enabled ? 1 : 0) : null,
    autoMarkup?.pct ? Number(autoMarkup.pct) : null,
    autoMarkup?.fixedUsd ? Number(autoMarkup.fixedUsd) : null,
    tenantId
  );

  // If botToken was changed or updated, dynamically reload in BotRegistry
  if (botToken !== undefined) {
    await botRegistry.reloadBot(tenantId);
  }

  res.json({ success: true, message: 'Settings saved successfully' });
});
