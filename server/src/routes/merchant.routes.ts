import { Router, Response } from 'express';
import axios from 'axios';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/database';
import { encrypt, decrypt } from '../services/crypto';
import {
  fetchLiveWholesaleCatalog,
  fetchLiveWholesaleCatalogForMerchant,
  syncLivePricesForTenant,
} from '../services/wholesale';
import { verifyMerchantWholesaleTopup, verifyMerchantSubscriptionPayment } from '../services/binance';
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

// Helper: Check if merchant has an active, unexpired subscription
export function checkMerchantSubscription(tenantId: string): { active: boolean; error?: string; plan?: any } {
  const tenant = db.prepare('SELECT plan_id, subscription_status, subscription_expires_at FROM tenants WHERE id = ?').get(tenantId) as any;
  if (!tenant) {
    return { active: false, error: 'Tenant not found.' };
  }

  const isExpired = !tenant.subscription_expires_at || new Date(tenant.subscription_expires_at) < new Date();
  if (tenant.subscription_status !== 'ACTIVE' || isExpired) {
    return {
      active: false,
      error: 'An active subscription plan is required to perform this action. Please activate your store subscription.',
    };
  }

  const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(tenant.plan_id || 'starter') as any;
  return { active: true, plan };
}

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
  const subCheck = checkMerchantSubscription(tenantId);
  if (!subCheck.active) {
    return res.status(403).json({ error: subCheck.error, subscriptionRequired: true });
  }

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
  const subCheck = checkMerchantSubscription(tenantId);
  if (!subCheck.active) {
    return res.status(403).json({ error: subCheck.error, subscriptionRequired: true });
  }

  const { name, category, retailPriceUsd, description, inventoryItems, groupId } = req.body;

  if (!name || !retailPriceUsd) {
    return res.status(400).json({ error: 'Product name and retail price (USD) are required.' });
  }

  // Quota validation: Custom Product Limit
  const plan = subCheck.plan;
  const customLimit = plan?.max_custom_products !== undefined ? Number(plan.max_custom_products) : (plan?.max_products ? Number(plan.max_products) : 50);
  if (customLimit !== -1) {
    const countRow = db.prepare("SELECT COUNT(id) as count FROM products WHERE tenant_id = ? AND provider = 'custom'").get(tenantId) as any;
    if (countRow && countRow.count >= customLimit) {
      return res.status(400).json({
        error: `Custom product quota reached (${customLimit} items) on your current ${plan?.name || 'Starter'} plan. Please upgrade your subscription plan to add more custom products.`,
      });
    }
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
merchantRouter.post('/wholesale/import', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const subCheck = checkMerchantSubscription(tenantId);
  if (!subCheck.active) {
    return res.status(403).json({ error: subCheck.error, subscriptionRequired: true });
  }

  const plan = subCheck.plan;
  if (plan?.allow_wholesale === 0) {
    return res.status(403).json({
      error: 'Wholesale reseller access is not included in your current subscription tier. Please upgrade your plan to unlock wholesale products.',
    });
  }

  const { wholesaleProductId, name, category, wholesaleCostUsd, retailPriceUsd, provider, groupId, description, stock } = req.body;

  if (!wholesaleProductId || !retailPriceUsd) {
    return res.status(400).json({ error: 'Missing product ID or retail price' });
  }

  // Fetch catalog to get live stock & description from upstream if not explicitly provided
  const catalog = await fetchLiveWholesaleCatalog();
  const catalogItem = catalog.find(c => c.id === wholesaleProductId);
  const realStock = stock !== undefined ? Number(stock) : (catalogItem?.stock ?? 999);
  const realDesc = description || catalogItem?.description || '';

  // Check if already imported
  const existing = db.prepare(`
    SELECT id FROM products WHERE tenant_id = ? AND provider_product_id = ?
  `).get(tenantId, wholesaleProductId) as any;

  // Resale Product Quota check (if adding a new wholesale item)
  const resaleLimit = plan?.max_resale_products !== undefined ? Number(plan.max_resale_products) : 5;
  if (!existing && resaleLimit !== -1) {
    const countRow = db.prepare("SELECT COUNT(id) as count FROM products WHERE tenant_id = ? AND provider != 'custom'").get(tenantId) as any;
    if (countRow && countRow.count >= resaleLimit) {
      return res.status(400).json({
        error: `Wholesale resale product limit reached (${resaleLimit} items) on your current ${plan?.name || 'Starter'} plan. Please upgrade your subscription plan to add more items.`,
      });
    }
  }

  const markupFixed = Number((Number(retailPriceUsd) - Number(wholesaleCostUsd)).toFixed(2));

  if (existing) {
    // update price, group, margin and reactivate
    db.prepare(`
      UPDATE products 
      SET retail_price_usd = ?, wholesale_price_usd = ?, markup_fixed_usd = ?, pricing_mode = 'fixed', group_id = COALESCE(?, group_id), is_active = 1,
          stock = ?, description = COALESCE(NULLIF(?, ''), description)
      WHERE tenant_id = ? AND provider_product_id = ?
    `).run(Number(retailPriceUsd), Number(wholesaleCostUsd), markupFixed, groupId || null, realStock, realDesc, tenantId, wholesaleProductId);
    return res.json({ success: true, updated: true, productId: existing.id });
  }

  const productId = 'prd_' + Math.random().toString(36).substring(2, 10);
  db.prepare(`
    INSERT INTO products (
      id, tenant_id, group_id, name, category, provider, provider_product_id,
      wholesale_price_usd, retail_price_usd, markup_fixed_usd, pricing_mode, stock, description, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'fixed', ?, ?, 1)
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
    markupFixed,
    realStock,
    realDesc
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
            SET retail_price_usd = ?, wholesale_price_usd = ?, is_active = 1,
                stock = ?, description = COALESCE(NULLIF(?, ''), description)
            WHERE id = ?
          `).run(retail, cost, item.stock ?? 999, item.description || '', existing.id);
        } else {
          const productId = 'prd_' + Math.random().toString(36).substring(2, 10);
          db.prepare(`
            INSERT INTO products (
              id, tenant_id, name, category, provider, provider_product_id,
              wholesale_price_usd, retail_price_usd, stock, description, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          `).run(
            productId,
            tenantId,
            item.name,
            item.category,
            item.provider,
            item.id,
            cost,
            retail,
            item.stock ?? 999,
            item.description || ''
          );
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

  try {
    tenant.payment_numbers_json = JSON.parse(tenant.payment_numbers_json || '{}');
  } catch (e) {
    tenant.payment_numbers_json = {};
  }
  try {
    const decryptedBinance = decrypt(tenant.binance_config_json_enc);
    tenant.binance_config_json = JSON.parse(decryptedBinance || '{}');
  } catch (e) {
    tenant.binance_config_json = {};
  }

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
    aboutText: tenant.about_text || '',
    supportText: tenant.support_text || '',
    welcomeText: tenant.welcome_text || '',
    categoriesEnabled: tenant.categories_enabled !== undefined && tenant.categories_enabled !== null ? Boolean(tenant.categories_enabled) : true,
  });
});

merchantRouter.put('/settings', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const {
    storeName,
    botToken,
    usdToBdtRate,
    paymentNumbers,
    binanceConfig,
    autoMarkup,
    aboutText,
    supportText,
    welcomeText,
    categoriesEnabled,
  } = req.body;

  const current = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as any;

  // Handle Binance Config Encryption
  let newBinanceEnc = current.binance_config_json_enc;
  if (binanceConfig) {
    let existingConfig: any = {};
    try {
      existingConfig = JSON.parse(decrypt(current.binance_config_json_enc) || '{}');
    } catch (e) {
      existingConfig = {};
    }
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
        global_markup_fixed_usd = COALESCE(?, global_markup_fixed_usd),
        about_text = COALESCE(?, about_text),
        support_text = COALESCE(?, support_text),
        welcome_text = COALESCE(?, welcome_text),
        categories_enabled = COALESCE(?, categories_enabled)
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
    aboutText !== undefined ? String(aboutText) : null,
    supportText !== undefined ? String(supportText) : null,
    welcomeText !== undefined ? String(welcomeText) : null,
    categoriesEnabled !== undefined ? (categoriesEnabled ? 1 : 0) : null,
    tenantId
  );

  // If botToken was changed or updated, dynamically reload in BotRegistry
  let botLaunchStatus = undefined;
  if (botToken !== undefined) {
    botLaunchStatus = await botRegistry.reloadBot(tenantId);
  }

  res.json({
    success: true,
    message: 'Settings saved successfully',
    botStatus: botLaunchStatus,
  });
});

// ==========================================
// 7. Bot Connection & Restart Control
// ==========================================
merchantRouter.post('/bot/restart', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const result = await botRegistry.reloadBot(tenantId);
  if (!result.success) {
    return res.status(400).json({ error: result.error || 'Failed to connect bot' });
  }
  res.json({
    success: true,
    username: result.username,
    message: `Bot @${result.username} is connected and running!`,
  });
});

// 7.1. Bot Profile & Metadata Editor (Direct Telegram Bot API Sync - No Server Storage)
merchantRouter.get('/bot/profile', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const tenant = db.prepare('SELECT bot_token, bot_username FROM tenants WHERE id = ?').get(tenantId) as any;

  if (!tenant?.bot_token) {
    return res.status(400).json({ error: 'Please save a valid Bot Token first.' });
  }

  const token = tenant.bot_token.trim();
  try {
    const [meRes, nameRes, descRes, shortDescRes, commandsRes] = await Promise.all([
      axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 8000 }).catch(() => null),
      axios.get(`https://api.telegram.org/bot${token}/getMyName`, { timeout: 8000 }).catch(() => null),
      axios.get(`https://api.telegram.org/bot${token}/getMyDescription`, { timeout: 8000 }).catch(() => null),
      axios.get(`https://api.telegram.org/bot${token}/getMyShortDescription`, { timeout: 8000 }).catch(() => null),
      axios.get(`https://api.telegram.org/bot${token}/getMyCommands`, { timeout: 8000 }).catch(() => null),
    ]);

    res.json({
      success: true,
      username: meRes?.data?.result?.username || tenant.bot_username || '',
      name: nameRes?.data?.result?.name || meRes?.data?.result?.first_name || '',
      about: shortDescRes?.data?.result?.short_description || '',
      description: descRes?.data?.result?.description || '',
      commands: commandsRes?.data?.result || [
        { command: 'start', description: 'Open Store Menu' },
        { command: 'help', description: 'Customer Support' }
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch bot profile from Telegram: ' + (err.message || err) });
  }
});

merchantRouter.put('/bot/profile', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const tenant = db.prepare('SELECT bot_token, bot_username FROM tenants WHERE id = ?').get(tenantId) as any;

  if (!tenant?.bot_token) {
    return res.status(400).json({ error: 'Please save a valid Bot Token first.' });
  }

  const token = tenant.bot_token.trim();
  const { name, about, description, commands } = req.body;

  const updates: Promise<any>[] = [];

  // 1. Update Bot Display Name
  if (name !== undefined) {
    updates.push(
      axios.post(`https://api.telegram.org/bot${token}/setMyName`, { name: String(name).slice(0, 64) }, { timeout: 8000 })
    );
  }

  // 2. Update About (Short Description on Bot Profile, max 120 chars)
  if (about !== undefined) {
    updates.push(
      axios.post(`https://api.telegram.org/bot${token}/setMyShortDescription`, { short_description: String(about).slice(0, 120) }, { timeout: 8000 })
    );
  }

  // 3. Update Description ("What can this bot do?" welcome text, max 512 chars)
  if (description !== undefined) {
    updates.push(
      axios.post(`https://api.telegram.org/bot${token}/setMyDescription`, { description: String(description).slice(0, 512) }, { timeout: 8000 })
    );
  }

  // 4. Update Slash Commands
  if (Array.isArray(commands)) {
    const validCommands = commands
      .filter((c: any) => c.command && c.command.trim())
      .map((c: any) => ({
        command: c.command.trim().replace(/^\//, '').toLowerCase().slice(0, 32),
        description: (c.description || 'Command').trim().slice(0, 256),
      }));

    if (validCommands.length > 0) {
      updates.push(
        axios.post(`https://api.telegram.org/bot${token}/setMyCommands`, { commands: validCommands }, { timeout: 8000 })
      );
    }
  }

  try {
    await Promise.all(updates);
    res.json({
      success: true,
      message: 'Bot profile & commands updated directly on Telegram!',
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'Failed to update on Telegram: ' + (err.response?.data?.description || err.message),
    });
  }
});

// ==========================================
// 8. Customers & Bot Users Directory
// ==========================================
merchantRouter.get('/customers', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const customers = db.prepare(`
    SELECT 
      c.id,
      c.telegram_id,
      c.username,
      c.first_name,
      c.balance_usd,
      c.total_spent_usd,
      c.orders_count,
      c.language,
      c.created_at
    FROM customers c
    WHERE c.tenant_id = ?
    ORDER BY c.created_at DESC
  `).all(tenantId);

  res.json(customers);
});

// ==========================================
// 9. Merchant Subscription & Billing
// ==========================================
merchantRouter.get('/subscription/current', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as any;
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  // Check if active subscription expired
  let subStatus = tenant.subscription_status || 'TRIAL';
  if (tenant.subscription_expires_at && new Date(tenant.subscription_expires_at) < new Date()) {
    subStatus = 'EXPIRED';
    db.prepare(`UPDATE tenants SET subscription_status = 'EXPIRED' WHERE id = ?`).run(tenantId);
  }

  // Current Plan
  const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(tenant.plan_id || 'starter') as any;
  let features: string[] = [];
  if (plan) {
    try {
      features = JSON.parse(plan.features_json || '[]');
    } catch {
      features = [];
    }
  }

  // Product Usage (Separate Custom vs Wholesale Resale)
  const customCountRow = db.prepare("SELECT COUNT(id) as count FROM products WHERE tenant_id = ? AND provider = 'custom'").get(tenantId) as any;
  const resaleCountRow = db.prepare("SELECT COUNT(id) as count FROM products WHERE tenant_id = ? AND provider != 'custom'").get(tenantId) as any;
  const customProductCount = Number(customCountRow?.count || 0);
  const resaleProductCount = Number(resaleCountRow?.count || 0);

  // Platform Owner Binance UID
  const globalConfig = db.prepare('SELECT owner_binance_uid FROM global_system_config WHERE id = 1').get() as any;

  // Active Plans List for Upgrade Grid
  const allPlans = db.prepare('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order ASC').all() as any[];
  const formattedPlans = allPlans.map(p => {
    let pFeatures: string[] = [];
    try {
      pFeatures = JSON.parse(p.features_json || '[]');
    } catch {
      pFeatures = [];
    }
    return {
      ...p,
      features_json: pFeatures,
      price_monthly_usd: Number(p.price_monthly_usd),
      price_yearly_usd: Number(p.price_yearly_usd),
      max_products: Number(p.max_products),
      max_resale_products: p.max_resale_products !== undefined && p.max_resale_products !== null ? Number(p.max_resale_products) : 5,
      max_custom_products: p.max_custom_products !== undefined && p.max_custom_products !== null ? Number(p.max_custom_products) : Number(p.max_products || 50),
    };
  });

  const expiresAt = tenant.subscription_expires_at || tenant.trial_ends_at;
  const daysRemaining = expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  res.json({
    subscription: {
      planId: tenant.plan_id || 'starter',
      planName: plan?.name || 'Starter Cloud',
      cycle: tenant.subscription_cycle || 'MONTHLY',
      status: subStatus,
      expiresAt,
      trialEndsAt: tenant.trial_ends_at,
      daysRemaining,
      maxProducts: plan ? Number(plan.max_products) : 50,
      maxResaleProducts: plan?.max_resale_products !== undefined ? Number(plan.max_resale_products) : 5,
      maxCustomProducts: plan?.max_custom_products !== undefined ? Number(plan.max_custom_products) : (plan?.max_products ? Number(plan.max_products) : 50),
      productCount: customProductCount + resaleProductCount,
      customProductCount,
      resaleProductCount,
      features,
    },
    ownerBinanceUid: globalConfig?.owner_binance_uid || '',
    plans: formattedPlans,
  });
});

merchantRouter.post('/subscription/validate-coupon', (req: AuthenticatedRequest, res: Response) => {
  const { code, planId, cycle } = req.body;

  if (!code || !planId || !cycle) {
    return res.status(400).json({ error: 'code, planId, and cycle are required' });
  }

  const cleanCode = String(code).trim().toUpperCase();
  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').get(cleanCode) as any;
  if (!coupon) {
    return res.status(400).json({ error: `Coupon "${cleanCode}" is invalid or inactive` });
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return res.status(400).json({ error: `Coupon "${cleanCode}" has expired` });
  }

  if (coupon.max_uses !== -1 && coupon.used_count >= coupon.max_uses) {
    return res.status(400).json({ error: `Coupon "${cleanCode}" has reached maximum usage limit` });
  }

  if (coupon.applicable_plan_id !== 'ALL' && coupon.applicable_plan_id !== planId) {
    return res.status(400).json({ error: `Coupon "${cleanCode}" is not applicable to this plan` });
  }

  if (coupon.applicable_cycle !== 'ALL' && coupon.applicable_cycle !== cycle) {
    return res.status(400).json({ error: `Coupon "${cleanCode}" is only applicable to ${coupon.applicable_cycle} billing` });
  }

  const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(planId) as any;
  if (!plan) {
    return res.status(400).json({ error: 'Plan not found' });
  }

  const originalPrice = cycle === 'YEARLY' ? Number(plan.price_yearly_usd) : Number(plan.price_monthly_usd);
  let discountAmount = 0.0;

  if (coupon.discount_type === 'PERCENTAGE') {
    discountAmount = originalPrice * (Number(coupon.discount_value) / 100);
  } else {
    discountAmount = Math.min(originalPrice, Number(coupon.discount_value));
  }

  const finalPriceUsd = Math.max(0.01, Number((originalPrice - discountAmount).toFixed(2)));

  res.json({
    valid: true,
    code: cleanCode,
    discountType: coupon.discount_type,
    discountValue: Number(coupon.discount_value),
    originalPriceUsd: originalPrice,
    discountAmountUsd: Number(discountAmount.toFixed(2)),
    finalPriceUsd,
  });
});

merchantRouter.post('/subscription/verify-binance', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const { planId, cycle, couponCode, trxId } = req.body;

  if (!planId || !cycle || !trxId) {
    return res.status(400).json({ error: 'planId, cycle, and trxId are required' });
  }

  try {
    const result = await verifyMerchantSubscriptionPayment({
      tenantId,
      planId,
      cycle,
      couponCode,
      trxId: String(trxId).trim(),
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Auto-reload the merchant bot so if it was paused it immediately resumes
    await botRegistry.reloadBot(tenantId);

    res.json({
      success: true,
      message: `Your ${result.planName} subscription has been successfully activated!`,
      expiresAt: result.expiresAt,
      amountPaidUsd: result.amountPaidUsd,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Subscription verification failed: ' + err.message });
  }
});

merchantRouter.get('/subscription/history', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenant.id;
  const history = db.prepare(`
    SELECT 
      sh.*,
      sp.name as plan_name,
      c.code as coupon_code
    FROM subscription_history sh
    JOIN subscription_plans sp ON sh.plan_id = sp.id
    LEFT JOIN coupons c ON sh.coupon_id = c.id
    WHERE sh.tenant_id = ?
    ORDER BY sh.created_at DESC
  `).all(tenantId);

  res.json(history);
});

