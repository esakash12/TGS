import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { db } from '../../server/src/db/database';
import { processCustomerPurchase } from '../../server/src/services/inventory';
import { verifyCustomerRetailBinanceDeposit } from '../../server/src/services/binance';
import { decrypt } from '../../server/src/services/crypto';

// In-memory conversation state for multi-step prompts (deposits & custom qty)
interface UserConversationState {
  step: 'AWAITING_BDT_AMOUNT' | 'AWAITING_LOCAL_TRX_ID' | 'AWAITING_BINANCE_TX_ID' | 'AWAITING_BINANCE_AMOUNT' | 'AWAITING_CUSTOM_QTY';
  productId?: string;
  method?: 'bKash' | 'Nagad' | 'Rocket' | 'Binance';
  amountBdt?: number;
  amountUsd?: number;
  updatedAt: number;
}

const userStates = new Map<number, UserConversationState>();

// Clear state older than 15 minutes to preserve memory
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of userStates.entries()) {
    if (now - state.updatedAt > 15 * 60 * 1000) {
      userStates.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function createBotEngine(tenantId: string, botToken: string): Bot {
  const bot = new Bot(botToken);

  // Helper: safely get tenant details
  const getTenant = () => {
    const raw = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as any;
    if (raw) {
      try {
        raw.payment_numbers_json = JSON.parse(raw.payment_numbers_json || '{}');
      } catch (e) {
        raw.payment_numbers_json = {};
      }
      try {
        const decBinance = decrypt(raw.binance_config_json_enc);
        raw.binance_config_json = JSON.parse(decBinance || '{}');
      } catch (e) {
        raw.binance_config_json = {};
      }
    }
    return raw;
  };

  // Helper: get or create customer record
  const getOrCreateCustomer = (from: any) => {
    let customer = db.prepare(`
      SELECT * FROM customers WHERE tenant_id = ? AND telegram_id = ?
    `).get(tenantId, from.id) as any;

    if (!customer) {
      db.prepare(`
        INSERT INTO customers (tenant_id, telegram_id, username, first_name, balance_usd, language)
        VALUES (?, ?, ?, ?, 0.0, 'en')
      `).run(tenantId, from.id, from.username || null, from.first_name || 'Customer');

      customer = db.prepare(`
        SELECT * FROM customers WHERE tenant_id = ? AND telegram_id = ?
      `).get(tenantId, from.id);
    }
    return customer;
  };

  // Build /start User Profile Card
  const buildStartCard = (customer: any, from: any, tenant: any) => {
    const name = from.first_name ? `${from.first_name} ${from.last_name || ''}`.trim() : 'Customer';
    const balance = Number(customer?.balance_usd || 0).toFixed(2);
    let card = `🥷 <b>Name:</b> ${name}\n` +
           `🆔 <b>ID:</b> <code>${from.id}</code>\n` +
           `💶 <b>Wallet Balance:</b> $${balance} USD\n`;
    if (tenant?.welcome_text && tenant.welcome_text.trim()) {
      card += `\n💬 ${tenant.welcome_text.trim()}\n`;
    }
    card += `\nChoose an option below 👇`;
    return card;
  };

  // Build /start 2-Column Inline Keyboard
  const buildStartInlineKeyboard = () => {
    return new InlineKeyboard()
      .text('🛍️ Products', 'nav_products')
      .text('💰 Deposit', 'nav_deposit')
      .row()
      .text('📦 My Orders', 'nav_orders')
      .text('🗣️ Support', 'nav_support')
      .row()
      .text('🌐 About', 'nav_about');
  };

  // Persistent bottom Quick Menu Keyboard
  const getMainKeyboard = () => {
    return new Keyboard()
      .text('🛍️ Products')
      .text('💰 Deposit')
      .row()
      .text('📦 My Orders')
      .text('🗣️ Support')
      .resized();
  };

  // Helper: brand icon extractor for products
  const getProductIcon = (name: string, category?: string) => {
    const combined = `${name || ''} ${category || ''}`.toLowerCase();
    if (/gemini/i.test(combined)) return '🇬';
    if (/chatgpt|openai|gpt/i.test(combined)) return '🤖';
    if (/claude|anthropic/i.test(combined)) return '☀️';
    if (/notion/i.test(combined)) return '🗃';
    if (/github/i.test(combined)) return '🐙';
    if (/capcut/i.test(combined)) return '🎬';
    if (/grok|x\.ai/i.test(combined)) return '𝕏';
    if (/canva/i.test(combined)) return '🎨';
    if (/loveable/i.test(combined)) return '🚀';
    if (/telegram|tg\s*prem/i.test(combined)) return '✈️';
    if (/vpn|nord|express|surfshark/i.test(combined)) return '🛡️';
    if (/youtube/i.test(combined)) return '▶️';
    if (/email|gmail|mail/i.test(combined)) return '✉️';
    if (/figma/i.test(combined)) return '🖋️';
    if (/duolingo/i.test(combined)) return '🦉';
    if (/leonardo/i.test(combined)) return '🎨';
    if (/muse/i.test(combined)) return '♾️';
    if (/netflix|spotify|disney|prime|streaming/i.test(combined)) return '🍿';
    if (/api/i.test(combined)) return '🔑';
    return '📦';
  };

  // Helper: Fetch Categories & Product Groups
  const getCategoriesForTenant = () => {
    const customGroups = db.prepare(`
      SELECT g.id, g.name, g.icon, COUNT(p.id) as active_count
      FROM product_groups g
      JOIN products p ON p.group_id = g.id
      LEFT JOIN platform_wholesale_rules r ON p.provider_product_id = r.provider_product_id
      WHERE g.tenant_id = ?
        AND p.is_active = 1
        AND (p.provider = 'custom' OR r.is_active IS NULL OR r.is_active = 1)
      GROUP BY g.id
      ORDER BY g.sort_order ASC, g.name ASC
    `).all(tenantId) as any[];

    const ungrouped = db.prepare(`
      SELECT p.category, COUNT(p.id) as active_count
      FROM products p
      LEFT JOIN platform_wholesale_rules r ON p.provider_product_id = r.provider_product_id
      WHERE p.tenant_id = ?
        AND p.group_id IS NULL
        AND p.is_active = 1
        AND (p.provider = 'custom' OR r.is_active IS NULL OR r.is_active = 1)
      GROUP BY p.category
      ORDER BY p.category ASC
    `).all(tenantId) as any[];

    const categoryList: Array<{ id: string; name: string; icon: string; isGroup: boolean; count: number }> = [];

    for (const cg of customGroups) {
      categoryList.push({
        id: cg.id,
        name: cg.name,
        icon: cg.icon || '📁',
        isGroup: true,
        count: Number(cg.active_count),
      });
    }

    for (const ug of ungrouped) {
      const catName = ug.category || 'General';
      const icon = getProductIcon(catName);
      categoryList.push({
        id: catName,
        name: catName,
        icon,
        isGroup: false,
        count: Number(ug.active_count),
      });
    }

    return categoryList;
  };

  // Helper: Fetch products in category or group
  const getProductsByCategoryOrGroup = (selector: { groupId?: string; categoryName?: string }) => {
    let query = `
      SELECT p.*, g.name as group_name, g.icon as group_icon, r.is_active as platform_active
      FROM products p
      LEFT JOIN product_groups g ON p.group_id = g.id
      LEFT JOIN platform_wholesale_rules r ON p.provider_product_id = r.provider_product_id
      WHERE p.tenant_id = ?
        AND p.is_active = 1
        AND (p.provider = 'custom' OR r.is_active IS NULL OR r.is_active = 1)
    `;
    const params: any[] = [tenantId];

    if (selector.groupId) {
      query += ` AND p.group_id = ?`;
      params.push(selector.groupId);
    } else if (selector.categoryName) {
      query += ` AND p.group_id IS NULL AND p.category = ?`;
      params.push(selector.categoryName);
    }

    query += ` ORDER BY p.retail_price_usd ASC`;
    return db.prepare(query).all(...params) as any[];
  };

  // ==========================================
  // 1. /start Command (Matching Screenshot 1)
  // ==========================================
  bot.command('start', async (ctx) => {
    try {
      console.log(`📥 [Bot Engine] Received /start from user: ${ctx.from?.id} (@${ctx.from?.username || ''})`);
      const tenant = getTenant();
      if (!tenant || !ctx.from) {
        console.warn(`⚠️ [Bot Engine] /start ignored: tenant=${Boolean(tenant)}, from=${Boolean(ctx.from)}`);
        return;
      }

      if (tenant.status === 'SUSPENDED' || tenant.subscription_status === 'EXPIRED' || (tenant.subscription_expires_at && new Date(tenant.subscription_expires_at) < new Date())) {
        return ctx.reply('⚠️ <b>Store Maintenance</b>\n\nThis store is currently undergoing maintenance. Please check back shortly.', { parse_mode: 'HTML' });
      }

      const customer = getOrCreateCustomer(ctx.from);
      userStates.delete(ctx.from.id);

      const card = buildStartCard(customer, ctx.from, tenant);
      const keyboard = buildStartInlineKeyboard();

      await ctx.reply(card, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      console.log(`✅ [Bot Engine] /start menu delivered to ${ctx.from.id}`);
    } catch (err: any) {
      console.error(`❌ [Bot Engine] Error replying /start to ${ctx.from?.id}:`, err.message || err);
    }
  });

  // Callback to return to Start Card
  bot.callbackQuery('nav_start', async (ctx) => {
    try {
      const tenant = getTenant();
      const customer = getOrCreateCustomer(ctx.from);
      userStates.delete(ctx.from.id);

      const card = buildStartCard(customer, ctx.from, tenant);
      const keyboard = buildStartInlineKeyboard();

      try {
        await ctx.editMessageText(card, { parse_mode: 'HTML', reply_markup: keyboard });
      } catch (e) {
        await ctx.reply(card, { parse_mode: 'HTML', reply_markup: keyboard });
      }
      await ctx.answerCallbackQuery();
    } catch (err: any) {
      console.error('❌ [Bot Engine] Error handling nav_start:', err.message || err);
    }
  });

  // ==========================================
  // 2. Category Browser (Matching Screenshot 2)
  // ==========================================
  const showCategoryBrowser = async (ctx: any) => {
    const categories = getCategoriesForTenant();

    if (categories.length === 0) {
      const emptyMsg = '🛍️ <b>No products currently in stock.</b>\nPlease check back soon!';
      const kb = new InlineKeyboard().text('⬅️ Back', 'nav_start');
      if (ctx.callbackQuery) {
        await ctx.editMessageText(emptyMsg, { parse_mode: 'HTML', reply_markup: kb });
        return ctx.answerCallbackQuery();
      }
      return ctx.reply(emptyMsg, { parse_mode: 'HTML', reply_markup: kb });
    }

    // 2-Column Inline Button Grid
    const keyboard = new InlineKeyboard();
    for (let i = 0; i < categories.length; i += 2) {
      const c1 = categories[i];
      const c2 = categories[i + 1];

      const callback1 = c1.isGroup ? `view_grp_${c1.id}` : `view_cat_${encodeURIComponent(c1.id)}`;
      keyboard.text(`${c1.icon} ${c1.name}`, callback1);

      if (c2) {
        const callback2 = c2.isGroup ? `view_grp_${c2.id}` : `view_cat_${encodeURIComponent(c2.id)}`;
        keyboard.text(`${c2.icon} ${c2.name}`, callback2);
      }
      keyboard.row();
    }
    keyboard.text('⬅️ Back', 'nav_start');

    const title = '🛒 <b>Choose a category:</b>';

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(title, { parse_mode: 'HTML', reply_markup: keyboard });
      } catch (e) {
        await ctx.reply(title, { parse_mode: 'HTML', reply_markup: keyboard });
      }
      await ctx.answerCallbackQuery();
    } else {
      await ctx.reply(title, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  };

  bot.callbackQuery('nav_products', showCategoryBrowser);
  bot.hears([/🛍️ Products/i, /🛍️ প্রোডাক্ট কিনুন/i], showCategoryBrowser);

  // ==========================================
  // 3. Products in Category (Matching Screenshot 3)
  // ==========================================
  const handleShowProductsList = async (ctx: any, selector: { groupId?: string; categoryName?: string }) => {
    const products = getProductsByCategoryOrGroup(selector);

    if (products.length === 0) {
      return ctx.answerCallbackQuery({
        text: 'No available products in this category.',
        show_alert: true,
      });
    }

    const keyboard = new InlineKeyboard();
    for (const p of products) {
      const icon = getProductIcon(p.name, p.category);
      const priceFormatted = Number(p.retail_price_usd).toFixed(2);
      keyboard.text(`${icon} ${p.name} — $${priceFormatted}`, `view_p_${p.id}`).row();
    }
    keyboard.text('⬅️ Back', 'nav_products');

    const title = '<b>Select a product:</b>';
    await ctx.editMessageText(title, { parse_mode: 'HTML', reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  };

  bot.callbackQuery(/^view_grp_(.+)$/, async (ctx) => {
    const groupId = ctx.match[1];
    await handleShowProductsList(ctx, { groupId });
  });

  bot.callbackQuery(/^view_cat_(.+)$/, async (ctx) => {
    const categoryName = decodeURIComponent(ctx.match[1]);
    await handleShowProductsList(ctx, { categoryName });
  });

  // ==========================================
  // 4. Product Details Card (Matching Screenshot 4)
  // ==========================================
  bot.callbackQuery(/^view_p_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    const customer = getOrCreateCustomer(ctx.from);

    const product = db.prepare(`
      SELECT p.*, g.name as group_name, g.icon as group_icon, r.is_active as platform_active
      FROM products p
      LEFT JOIN product_groups g ON p.group_id = g.id
      LEFT JOIN platform_wholesale_rules r ON p.provider_product_id = r.provider_product_id
      WHERE p.id = ? AND p.tenant_id = ? AND p.is_active = 1
    `).get(productId, tenantId) as any;

    if (!product || (product.provider !== 'custom' && product.platform_active === 0)) {
      return ctx.answerCallbackQuery({
        text: 'Product is currently unavailable.',
        show_alert: true,
      });
    }

    const price = Number(product.retail_price_usd).toFixed(2);
    const stock = product.stock > 0 ? product.stock : 0;
    const descContent = product.description && product.description.trim()
      ? product.description.trim()
      : `Access via Instant API Gateway\n\nFast • Simple • Ready to use in minutes\n\nInstructions: This is an automated code / license. Redeem directly upon receipt.`;

    const text =
      `<b>${product.name}</b>\n\n` +
      `<blockquote>${descContent}</blockquote>\n\n` +
      `💵 <b>Unit Price:</b> $${price}\n` +
      `🎁 <b>Stock:</b> ${stock > 0 ? stock : 'Out of stock'}`;

    const keyboard = new InlineKeyboard();
    if (stock > 0) {
      keyboard.text('🛒 Buy Now', `qty_menu_${product.id}`).row();
    }

    const backCallback = product.group_id
      ? `view_grp_${product.group_id}`
      : `view_cat_${encodeURIComponent(product.category || 'General')}`;

    keyboard.text('⬅️ Back', backCallback);

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // ==========================================
  // 5. Quantity Selector (Matching Screenshot 5)
  // ==========================================
  bot.callbackQuery(/^qty_menu_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').get(productId, tenantId) as any;

    if (!product) {
      return ctx.answerCallbackQuery({ text: 'Product not found.', show_alert: true });
    }

    const price = Number(product.retail_price_usd).toFixed(2);
    const icon = getProductIcon(product.name, product.category);

    const text =
      `<b>Select Quantity</b>\n\n` +
      `${icon} <b>${product.name}</b>\n` +
      `💵 <b>$${price} / code</b>\n\n` +
      `How many codes do you want?`;

    const keyboard = new InlineKeyboard()
      .text('1', `buy_${product.id}_1`)
      .text('2', `buy_${product.id}_2`)
      .text('3', `buy_${product.id}_3`)
      .text('5', `buy_${product.id}_5`)
      .row()
      .text('10', `buy_${product.id}_10`)
      .text('15', `buy_${product.id}_15`)
      .text('20', `buy_${product.id}_20`)
      .text('25', `buy_${product.id}_25`)
      .row()
      .text('✏️ Custom qty', `custom_qty_${product.id}`)
      .row()
      .text('⬅️ Back to Product', `view_p_${product.id}`)
      .text('❌ Cancel', 'nav_products');

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Prompt for Custom Quantity
  bot.callbackQuery(/^custom_qty_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    userStates.set(ctx.from.id, {
      step: 'AWAITING_CUSTOM_QTY',
      productId,
      updatedAt: Date.now(),
    });

    const promptText = `✏️ <b>Enter Custom Quantity:</b>\n\nPlease type the number of units/codes you would like to purchase (e.g. 4 or 50):`;
    await ctx.editMessageText(promptText, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('❌ Cancel', `qty_menu_${productId}`),
    });
    await ctx.answerCallbackQuery();
  });

  // ==========================================
  // 6. Buy Execution with Zero-Balance Upstream Guard
  // ==========================================
  const executePurchase = async (ctx: any, productId: string, quantity: number) => {
    const customer = getOrCreateCustomer(ctx.from);

    const product = db.prepare(`
      SELECT p.*, r.is_active as platform_active
      FROM products p
      LEFT JOIN platform_wholesale_rules r ON p.provider_product_id = r.provider_product_id
      WHERE p.id = ? AND p.tenant_id = ? AND p.is_active = 1
    `).get(productId, tenantId) as any;

    if (!product || (product.provider !== 'custom' && product.platform_active === 0)) {
      return ctx.reply('❌ <b>Product is currently unavailable.</b>', { parse_mode: 'HTML' });
    }

    const unitPrice = Number(product.retail_price_usd);
    const totalCost = Number((unitPrice * quantity).toFixed(2));
    const customerBalance = Number(customer.balance_usd || 0);

    // =========================================================================
    // STRICT ZERO-BALANCE GUARD:
    // If customer does not have sufficient wallet balance, NEVER call upstream API!
    // =========================================================================
    if (customerBalance < totalCost) {
      const shortage = (totalCost - customerBalance).toFixed(2);
      const keyboard = new InlineKeyboard()
        .text('💰 Deposit / Add Funds', 'nav_deposit')
        .row()
        .text('⬅️ Back to Products', 'nav_products');

      const msg =
        `❌ <b>Insufficient Balance!</b>\n\n` +
        `📦 <b>Product:</b> ${product.name} (x${quantity})\n` +
        `💵 <b>Total Required:</b> <b>$${totalCost.toFixed(2)} USD</b>\n` +
        `👛 <b>Your Balance:</b> <b>$${customerBalance.toFixed(2)} USD</b>\n` +
        `⚠️ <b>Shortage:</b> <b>$${shortage} USD</b>\n\n` +
        `Please add funds to your wallet to complete this purchase.`;

      return ctx.reply(msg, { parse_mode: 'HTML', reply_markup: keyboard });
    }

    // Customer has enough balance -> proceed to atomic checkout
    await ctx.reply('⚡ <i>Processing order and generating credentials...</i>', { parse_mode: 'HTML' });

    const result = await processCustomerPurchase({
      tenantId,
      customerTelegramId: ctx.from.id,
      productId,
      quantity,
    });

    if (!result.success) {
      return ctx.reply(`❌ <b>Order Failed:</b>\n${result.error}`, { parse_mode: 'HTML' });
    }

    // Order Success & Instant Monospace Delivery Receipt
    const successMsg =
      `🎉 <b>Order Completed Successfully!</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🧾 Order Number: <code>#${result.orderNumber}</code>\n` +
      `📦 Product: <b>${product.name} (x${quantity})</b>\n` +
      `💵 Total Paid: <b>$${result.totalPriceUsd?.toFixed(2)} USD</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🔑 <b>Delivered Serials / Account Credentials:</b>\n\n` +
      `<pre><code>${result.deliveredData}</code></pre>\n\n` +
      `<i>Saved permanently in your "📦 My Orders" history. Thank you!</i>`;

    const afterKeyboard = new InlineKeyboard()
      .text('🛍️ Continue Shopping', 'nav_products')
      .text('📦 My Orders', 'nav_orders');

    await ctx.reply(successMsg, { parse_mode: 'HTML', reply_markup: afterKeyboard });
  };

  bot.callbackQuery(/^buy_(.+)_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    const quantity = parseInt(ctx.match[2]) || 1;
    await ctx.answerCallbackQuery();
    await executePurchase(ctx, productId, quantity);
  });

  // ==========================================
  // 7. Deposit Menu & Binance Pay Engine
  // ==========================================
  const showDepositMenu = async (ctx: any) => {
    const tenant = getTenant();
    const customer = getOrCreateCustomer(ctx.from);
    const rate = Number(tenant?.usd_to_bdt_rate || 125.0);

    const keyboard = new InlineKeyboard()
      .text('🟡 Binance Pay (USDT Auto)', 'dep_binance').row()
      .text('📱 bKash (বিকাশ)', 'dep_bkash')
      .text('📱 Nagad (নগদ)', 'dep_nagad').row()
      .text('📱 Rocket (রকেট)', 'dep_rocket').row()
      .text('⬅️ Back', 'nav_start');

    const text =
      `💰 <b>Deposit & Recharge Wallet:</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👛 Your Balance: <b>$${Number(customer.balance_usd || 0).toFixed(2)} USD</b>\n` +
      `💱 Exchange Rate: <b>$1.00 USD = ${rate.toFixed(0)} BDT</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `<b>Available Payment Methods:</b>\n` +
      `• 🟡 <b>Binance Pay:</b> Instant 0% fee auto-credit (USDT)\n` +
      `• 📱 <b>bKash:</b> Personal Send Money\n` +
      `• 📱 <b>Nagad:</b> Personal Send Money\n` +
      `• 📱 <b>Rocket:</b> Personal Send Money\n\n` +
      `Select your payment method below:`;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      } catch (e) {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
      }
      await ctx.answerCallbackQuery();
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
  };

  bot.callbackQuery('nav_deposit', showDepositMenu);
  bot.hears([/💰 Deposit/i, /➕ ব্যালেন্স রিচার্জ/i, /➕ Add Funds/i], showDepositMenu);

  // Handle Deposit Selection
  bot.callbackQuery(/^dep_(bkash|nagad|rocket|binance)$/, async (ctx) => {
    const methodKey = ctx.match[1];
    const tenant = getTenant();
    const rate = Number(tenant?.usd_to_bdt_rate || 125.0);

    // Automated Binance Pay
    if (methodKey === 'binance') {
      const binance = tenant?.binance_config_json || {};
      if (!binance.uid) {
        return ctx.answerCallbackQuery({
          text: '⚠️ Binance Pay is not yet configured by the store owner. Please try bKash or Nagad, or contact support.',
          show_alert: true,
        });
      }

      userStates.set(ctx.from.id, {
        step: 'AWAITING_BINANCE_AMOUNT',
        method: 'Binance',
        updatedAt: Date.now(),
      });

      const binanceMsg =
        `🟡 <b>Binance Pay (Instant Auto-Deposit)</b>\n\n` +
        `Merchant Binance Pay UID:\n<code>${binance.uid}</code>\n\n` +
        `1. Open Binance App &rarr; Pay &rarr; Send &rarr; Enter UID above.\n` +
        `2. Transfer USDT.\n` +
        `3. Enter the exact USD amount sent (e.g. 5 or 10):`;

      await ctx.editMessageText(binanceMsg, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Cancel', 'nav_deposit'),
      });
      return ctx.answerCallbackQuery();
    }

    // Local bKash / Nagad / Rocket
    const methodNames: Record<string, 'bKash' | 'Nagad' | 'Rocket'> = {
      bkash: 'bKash',
      nagad: 'Nagad',
      rocket: 'Rocket',
    };
    const methodName = methodNames[methodKey];
    const numbers = tenant?.payment_numbers_json || {};
    const targetNumber = numbers[methodKey];

    if (!targetNumber) {
      return ctx.answerCallbackQuery({
        text: `⚠️ ${methodName} is not yet configured by the store owner. Please try another method or contact support.`,
        show_alert: true,
      });
    }

    userStates.set(ctx.from.id, {
      step: 'AWAITING_BDT_AMOUNT',
      method: methodName,
      updatedAt: Date.now(),
    });

    const promptMsg =
      `📱 <b>${methodName} Deposit</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `Merchant Personal Number:\n<code>${targetNumber}</code> (Send Money)\n\n` +
      `💱 Rate: $1.00 USD = ${rate.toFixed(0)} BDT\n\n` +
      `👉 <b>How much BDT did you send?</b>\nEnter BDT amount (e.g. 250 or 500):`;

    await ctx.editMessageText(promptMsg, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('❌ Cancel', 'nav_deposit'),
    });
    await ctx.answerCallbackQuery();
  });

  // ==========================================
  // 8. Multi-Step Form Handlers (Text Messages)
  // ==========================================
  bot.on('message:text', async (ctx) => {
    const state = userStates.get(ctx.from.id);
    if (!state) return;

    const tenant = getTenant();
    const rate = Number(tenant?.usd_to_bdt_rate || 125.0);
    const text = ctx.message.text.trim();

    // STEP A: Custom Quantity
    if (state.step === 'AWAITING_CUSTOM_QTY' && state.productId) {
      const qty = parseInt(text);
      if (isNaN(qty) || qty <= 0) {
        return ctx.reply('❌ Please enter a valid positive number for quantity:');
      }
      userStates.delete(ctx.from.id);
      return executePurchase(ctx, state.productId, qty);
    }

    // STEP B: Awaiting BDT Amount
    if (state.step === 'AWAITING_BDT_AMOUNT') {
      const bdt = parseFloat(text);
      if (isNaN(bdt) || bdt <= 0) {
        return ctx.reply('❌ Please enter a valid number for BDT (e.g. 250):');
      }

      const calculatedUsd = Number((bdt / rate).toFixed(2));
      state.amountBdt = bdt;
      state.amountUsd = calculatedUsd;
      state.step = 'AWAITING_LOCAL_TRX_ID';
      state.updatedAt = Date.now();

      const nextPrompt =
        `✅ <b>Amount: ${bdt} BDT (~$${calculatedUsd.toFixed(2)} USD)</b>\n\n` +
        `Now enter your payment <b>Transaction ID (TrxID)</b>:`;

      return ctx.reply(nextPrompt, { parse_mode: 'HTML' });
    }

    // STEP C: Awaiting Local TrxID
    if (state.step === 'AWAITING_LOCAL_TRX_ID') {
      const trxId = text.toUpperCase().replace(/\s+/g, '');
      if (trxId.length < 5) {
        return ctx.reply('❌ TrxID is too short. Please enter a valid TrxID:');
      }

      const existing = db.prepare(`
        SELECT id FROM deposits WHERE tenant_id = ? AND trx_id = ? AND status IN ('PENDING', 'APPROVED')
      `).get(tenantId, trxId);

      if (existing) {
        return ctx.reply('⚠️ This TrxID is already registered or approved. Please use a unique TrxID:');
      }

      db.prepare(`
        INSERT INTO deposits (
          tenant_id, customer_telegram_id, customer_username, method, amount_bdt, amount_usd, trx_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `).run(tenantId, ctx.from.id, ctx.from.username || null, state.method || 'bKash', state.amountBdt, state.amountUsd, trxId);

      userStates.delete(ctx.from.id);

      const confirmMsg =
        `🎉 <b>Deposit Request Submitted!</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `💳 Method: <b>${state.method}</b>\n` +
        `💵 Amount: <b>${state.amountBdt} BDT (~$${state.amountUsd?.toFixed(2)} USD)</b>\n` +
        `🧾 TrxID: <code>${trxId}</code>\n` +
        `⏳ Status: <b>PENDING</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `<i>Your balance will be credited as soon as store administration verifies the transaction.</i>`;

      return ctx.reply(confirmMsg, { parse_mode: 'HTML' });
    }

    // STEP D: Binance Amount
    if (state.step === 'AWAITING_BINANCE_AMOUNT') {
      const usd = parseFloat(text);
      if (isNaN(usd) || usd <= 0) {
        return ctx.reply('❌ Please enter a valid USD amount (e.g. 10):');
      }

      state.amountUsd = usd;
      state.step = 'AWAITING_BINANCE_TX_ID';
      state.updatedAt = Date.now();

      return ctx.reply(
        `✅ <b>Amount: $${usd.toFixed(2)} USDT</b>\n\n` +
        `Now paste your 17/19 digit Binance <b>Order ID / Transaction ID</b>:`,
        { parse_mode: 'HTML' }
      );
    }

    // STEP E: Binance TxID Verification
    if (state.step === 'AWAITING_BINANCE_TX_ID') {
      const txId = text.trim();
      await ctx.reply('⚡ <i>Verifying transaction with Binance SAPI, please wait...</i>', { parse_mode: 'HTML' });

      const result = await verifyCustomerRetailBinanceDeposit({
        tenantId,
        customerTelegramId: ctx.from.id,
        trxId: txId,
        amountUsd: state.amountUsd || 0,
      });

      userStates.delete(ctx.from.id);

      if (!result.success) {
        return ctx.reply(`❌ <b>Binance Verification Failed:</b>\n${result.error}`, { parse_mode: 'HTML' });
      }

      const verifiedMsg =
        `🎉 <b>Binance Deposit Verified Successfully!</b>\n\n` +
        `Credited <b>$${result.amountUsd?.toFixed(2)} USD</b> to your wallet.\n` +
        `Happy shopping! 🛍️`;

      return ctx.reply(verifiedMsg, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🛍️ Browse Products', 'nav_products'),
      });
    }
  });

  // ==========================================
  // 9. Orders History (nav_orders)
  // ==========================================
  const showOrdersHistory = async (ctx: any) => {
    const recentOrders = db.prepare(`
      SELECT * FROM orders WHERE tenant_id = ? AND customer_telegram_id = ? ORDER BY created_at DESC LIMIT 5
    `).all(tenantId, ctx.from.id) as any[];

    if (recentOrders.length === 0) {
      const msg = '📦 <b>You have not placed any orders yet.</b>';
      const kb = new InlineKeyboard().text('🛍️ Browse Products', 'nav_products');
      if (ctx.callbackQuery) {
        await ctx.editMessageText(msg, { parse_mode: 'HTML', reply_markup: kb });
        return ctx.answerCallbackQuery();
      }
      return ctx.reply(msg, { parse_mode: 'HTML', reply_markup: kb });
    }

    let response = `📦 <b>Your Recent Orders:</b>\n\n`;
    for (const o of recentOrders) {
      response +=
        `🧾 <b>#${o.order_number}</b> — ${o.product_name}\n` +
        `💵 Total: $${Number(o.total_price_usd).toFixed(2)} USD (${o.created_at})\n` +
        `🔑 Credentials:\n<pre><code>${o.delivered_data}</code></pre>\n` +
        `─────────────────────\n`;
    }

    const kb = new InlineKeyboard().text('⬅️ Back', 'nav_start');
    if (ctx.callbackQuery) {
      await ctx.editMessageText(response, { parse_mode: 'HTML', reply_markup: kb });
      await ctx.answerCallbackQuery();
    } else {
      await ctx.reply(response, { parse_mode: 'HTML', reply_markup: kb });
    }
  };

  bot.callbackQuery('nav_orders', showOrdersHistory);
  bot.hears([/📦 My Orders/i, /📦 অর্ডার হিস্টোরি/i], showOrdersHistory);

  // ==========================================
  // 10. Support (nav_support)
  // ==========================================
  const showSupport = async (ctx: any) => {
    const tenant = getTenant();
    const defaultContact = tenant?.owner_email ? `Email: ${tenant.owner_email}` : 'Contact store administrator on Telegram.';
    const customSupport = tenant?.support_text ? tenant.support_text.trim() : null;

    const text = customSupport
      ? `🗣️ <b>Customer Support:</b>\n\n${customSupport}`
      : `🗣️ <b>Customer Support:</b>\n\n` +
        `Have a question about an account or deposit?\n\n` +
        `Our team is available to assist you.\n` +
        `📩 <b>Support Channel:</b> ${defaultContact}`;

    const kb = new InlineKeyboard().text('⬅️ Back', 'nav_start');
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      await ctx.answerCallbackQuery();
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  };

  bot.callbackQuery('nav_support', showSupport);
  bot.hears([/🗣️ Support/i, /📞 হেল্পলাইন/i, /📞 Live Support/i], showSupport);

  // ==========================================
  // 11. About (nav_about)
  // ==========================================
  bot.callbackQuery('nav_about', async (ctx) => {
    const tenant = getTenant();
    const storeName = tenant?.name || 'Store';
    const customAbout = tenant?.about_text ? tenant.about_text.trim() : null;

    const text = customAbout
      ? `🌐 <b>About ${storeName}:</b>\n\n${customAbout}`
      : `🌐 <b>About ${storeName}:</b>\n\n` +
        `Autonomous digital accounts and subscriptions cloud platform.\n\n` +
        `⚡ 100% Instant Automated Delivery\n` +
        `🛡️ Full Warranty on all accounts\n` +
        `💳 Automated Binance Pay and Local Payments`;

    const kb = new InlineKeyboard().text('⬅️ Back', 'nav_start');
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  return bot;
}
