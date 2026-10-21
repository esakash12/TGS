import { db } from '../db/database';
import { purchaseUpstreamProduct, getGlobalWholesaleConfig } from './wholesale';

export interface PurchaseResult {
  success: boolean;
  orderNumber?: string;
  deliveredData?: string;
  totalPriceUsd?: number;
  error?: string;
}

export async function processCustomerPurchase(params: {
  tenantId: string;
  customerTelegramId: number;
  productId: string;
  quantity?: number;
}): Promise<PurchaseResult> {
  const { tenantId, customerTelegramId, productId } = params;
  const quantity = params.quantity || 1;

  // 1. Fetch Product
  const product = db.prepare(`
    SELECT * FROM products WHERE id = ? AND tenant_id = ? AND is_active = 1
  `).get(productId, tenantId) as any;

  if (!product) {
    return { success: false, error: 'Product not found or currently unavailable' };
  }

  // 2. Fetch Customer & check balance
  const customer = db.prepare(`
    SELECT * FROM customers WHERE tenant_id = ? AND telegram_id = ?
  `).get(tenantId, customerTelegramId) as any;

  if (!customer) {
    return { success: false, error: 'Customer account not found' };
  }

  const totalPriceUsd = Number((product.retail_price_usd * quantity).toFixed(2));
  if (customer.balance_usd < totalPriceUsd) {
    return {
      success: false,
      error: `Insufficient balance! You need $${totalPriceUsd.toFixed(2)}, but have $${customer.balance_usd.toFixed(2)}.`,
    };
  }

  const orderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

  // ==========================================
  // CASE A: Custom Merchant Product (Serial Keys)
  // ==========================================
  if (product.provider === 'custom') {
    let deliveredItems: string[] = [];

    // Atomic transaction to pop items safely
    const popTx = db.transaction(() => {
      const availableItems = db.prepare(`
        SELECT id, item_data FROM custom_inventory 
        WHERE product_id = ? AND tenant_id = ? AND status = 'AVAILABLE'
        LIMIT ?
      `).all(productId, tenantId, quantity) as any[];

      if (availableItems.length < quantity) {
        throw new Error(`Out of stock! Only ${availableItems.length} items available.`);
      }

      deliveredItems = availableItems.map(i => i.item_data);
      const itemIds = availableItems.map(i => i.id);

      // Mark items as delivered
      const updateStmt = db.prepare(`
        UPDATE custom_inventory 
        SET status = 'DELIVERED', delivered_to_order_id = ? 
        WHERE id = ?
      `);
      for (const id of itemIds) {
        updateStmt.run(orderNumber, id);
      }

      // Decrement product stock
      db.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `).run(quantity, productId);

      // Deduct customer balance & increment stats
      db.prepare(`
        UPDATE customers 
        SET balance_usd = balance_usd - ?, total_spent_usd = total_spent_usd + ?, orders_count = orders_count + 1
        WHERE tenant_id = ? AND telegram_id = ?
      `).run(totalPriceUsd, totalPriceUsd, tenantId, customerTelegramId);

      // Record Order
      const profitUsd = totalPriceUsd; // for custom product, retail is pure gross revenue
      db.prepare(`
        INSERT INTO orders (
          tenant_id, order_number, customer_telegram_id, product_id, product_name,
          quantity, total_price_usd, wholesale_cost_usd, profit_usd, delivered_data, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?, 'COMPLETED')
      `).run(tenantId, orderNumber, customerTelegramId, productId, product.name, quantity, totalPriceUsd, profitUsd, deliveredItems.join('\n'));
    });

    try {
      popTx();
      return {
        success: true,
        orderNumber,
        deliveredData: deliveredItems.join('\n'),
        totalPriceUsd,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ==========================================
  // CASE B: Wholesale Provider Product (DigitalCore / Canboso)
  // ==========================================
  if (product.provider === 'digitalcore' || product.provider === 'vexorix' || product.provider === 'canboso' || product.provider === 'prodseller') {
    const tenant = db.prepare('SELECT wallet_usd FROM tenants WHERE id = ?').get(tenantId) as any;
    const { platformFeeFixed, platformFeePct } = getGlobalWholesaleConfig();

    const wholesaleBaseCost = Number(product.wholesale_price_usd) * quantity;
    const platformFee = wholesaleBaseCost * (platformFeePct / 100) + platformFeeFixed * quantity;
    const totalMerchantWholesaleCost = Number((wholesaleBaseCost + platformFee).toFixed(2));

    // Multi-API Dedicated Wallet Check with fallback for digitalcore
    const providerWalletRow = db.prepare(
      'SELECT wallet_usd FROM tenant_api_wallets WHERE tenant_id = ? AND provider = ?'
    ).get(tenantId, product.provider) as any;

    let currentProviderBalance = Number(providerWalletRow?.wallet_usd || 0);
    let useLegacyWalletDeduction = false;
    if (product.provider === 'digitalcore' && currentProviderBalance < totalMerchantWholesaleCost) {
      const legacyBal = Number(tenant?.wallet_usd || 0);
      if (legacyBal >= totalMerchantWholesaleCost) {
        currentProviderBalance = legacyBal;
        useLegacyWalletDeduction = true;
      }
    }

    // Two-Phase Precheck: Merchant must have enough USD in the dedicated wholesale wallet
    if (currentProviderBalance < totalMerchantWholesaleCost) {
      console.warn(`[Wholesale Wallet Depleted] Tenant "${tenantId}" wholesale wallet balance ($${Number(tenant?.wallet_usd || 0).toFixed(2)}) is less than required wholesale cost ($${totalMerchantWholesaleCost.toFixed(2)}). Merchant needs to top up wholesale wallet.`);
      return {
        success: false,
        error: 'Product is temporarily unavailable due to store restocking. Please try again shortly or contact support.',
      };
    }

    // Call upstream API
    const upstreamRes = await purchaseUpstreamProduct({
      provider: product.provider,
      providerProductId: product.provider_product_id || product.id,
      quantity,
    });

    if (!upstreamRes.success || upstreamRes.deliveredItems.length === 0) {
      return {
        success: false,
        error: upstreamRes.error || 'Upstream provider delivery failed. Your balance was not deducted.',
      };
    }

    const deliveredText = upstreamRes.deliveredItems.join('\n');
    const merchantProfitUsd = Number((totalPriceUsd - totalMerchantWholesaleCost).toFixed(2));

    // Commit atomic deduction across customer and merchant wallet
    const wholesaleCommitTx = db.transaction(() => {
      // 1. Deduct customer balance
      db.prepare(`
        UPDATE customers 
        SET balance_usd = balance_usd - ?, total_spent_usd = total_spent_usd + ?, orders_count = orders_count + 1
        WHERE tenant_id = ? AND telegram_id = ?
      `).run(totalPriceUsd, totalPriceUsd, tenantId, customerTelegramId);

      // 2. Deduct merchant wholesale wallet (dedicated provider wallet or fallback legacy)
      if (useLegacyWalletDeduction) {
        db.prepare(`
          UPDATE tenants SET wallet_usd = wallet_usd - ? WHERE id = ?
        `).run(totalMerchantWholesaleCost, tenantId);
      } else {
        db.prepare(`
          INSERT INTO tenant_api_wallets (tenant_id, provider, wallet_usd)
          VALUES (?, ?, 0)
          ON CONFLICT(tenant_id, provider) DO UPDATE SET wallet_usd = wallet_usd - ?
        `).run(tenantId, product.provider, totalMerchantWholesaleCost);
      }

      // 3. Record order
      db.prepare(`
        INSERT INTO orders (
          tenant_id, order_number, customer_telegram_id, product_id, product_name,
          quantity, total_price_usd, wholesale_cost_usd, profit_usd, delivered_data, provider_order_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
      `).run(
        tenantId,
        orderNumber,
        customerTelegramId,
        productId,
        product.name,
        quantity,
        totalPriceUsd,
        totalMerchantWholesaleCost,
        merchantProfitUsd,
        deliveredText,
        upstreamRes.orderId
      );
    });

    try {
      wholesaleCommitTx();
      return {
        success: true,
        orderNumber,
        deliveredData: deliveredText,
        totalPriceUsd,
      };
    } catch (err: any) {
      return { success: false, error: 'Database commit error: ' + err.message };
    }
  }

  return { success: false, error: 'Unsupported product provider' };
}
