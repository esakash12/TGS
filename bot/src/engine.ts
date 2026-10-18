import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { db } from '../../server/src/db/database';
import { processCustomerPurchase } from '../../server/src/services/inventory';
import { verifyCustomerRetailBinanceDeposit } from '../../server/src/services/binance';
import { decrypt } from '../../server/src/services/crypto';
import { getCachedProductLiveStock } from '../../server/src/services/wholesale';

// In-memory conversation state for multi-step prompts (deposits & custom qty)
interface UserConversationState {
  step: 'AWAITING_LOCAL_USD_AMOUNT' | 'AWAITING_BDT_AMOUNT' | 'AWAITING_LOCAL_TRX_ID' | 'AWAITING_BINANCE_TX_ID' | 'AWAITING_BINANCE_AMOUNT' | 'AWAITING_CUSTOM_QTY';
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

  // Top-Level Active Subscription & Status Guard Middleware
  bot.use(async (ctx, next) => {
    const tenant = db.prepare(`
      SELECT status, subscription_status, subscription_expires_at 
      FROM tenants WHERE id = ?
    `).get(tenantId) as any;

    if (!tenant || tenant.status !== 'ACTIVE') {
      if (ctx.callbackQuery) {
        return ctx.answerCallbackQuery({ text: '⚠️ This store is currently suspended.', show_alert: true });
      }
      return ctx.reply('⚠️ <b>Store Suspended</b>\nThis bot is temporarily disabled.', { parse_mode: 'HTML' });
    }

    const isSubActive = tenant.subscription_status === 'ACTIVE' && 
      (!tenant.subscription_expires_at || new Date(tenant.subscription_expires_at).getTime() > Date.now());

    if (!isSubActive) {
      if (ctx.callbackQuery) {
        return ctx.answerCallbackQuery({
          text: '⚠️ Store bot is inactive because the merchant subscription has expired.',
          show_alert: true,
        });
      }
      return ctx.reply(
        '⚠️ <b>Store Bot Inactive</b>\n\n' +
        'This store bot is currently offline because the merchant subscription has expired. Please contact the store administrator.',
        { parse_mode: 'HTML' }
      );
    }

    return next();
  });

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
           `🆔 <b>ID:</b> <code>${from.id}</code>\n\n` +
           `💶 <b>Wallet Balance:</b> $${balance} USD\n\n`;
    if (tenant?.welcome_text && tenant.welcome_text.trim()) {
      card += `💬 ${tenant.welcome_text.trim()}\n\n`;
    }
    card += `Choose an option below 👇`;
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
    if (/gemini/i.test(combined)) return '✨';
    if (/chatgpt|openai|gpt/i.test(combined)) return '🤖';
    if (/claude|anthropic/i.test(combined)) return '🧠';
    if (/cursor/i.test(combined)) return '⚡';
    if (/midjourney/i.test(combined)) return '🎨';
    if (/notion/i.test(combined)) return '📝';
    if (/github/i.test(combined)) return '🐙';
    if (/capcut/i.test(combined)) return '🎬';
    if (/grok|x\.ai/i.test(combined)) return '🚀';
    if (/canva/i.test(combined)) return '🎨';
    if (/loveable/i.test(combined)) return '❤️';
    if (/telegram|tg\s*prem/i.test(combined)) return '⭐';
    if (/discord/i.test(combined)) return '👾';
    if (/vpn|nord|express|surfshark/i.test(combined)) return '🛡️';
    if (/youtube/i.test(combined)) return '▶️';
    if (/spotify/i.test(combined)) return '🎵';
    if (/netflix/i.test(combined)) return '🍿';
    if (/disney/i.test(combined)) return '🏰';
    if (/prime|amazon/i.test(combined)) return '📦';
    if (/crunchyroll/i.test(combined)) return '🍥';
    if (/apple|itunes/i.test(combined)) return '🍏';
    if (/windows|office|microsoft/i.test(combined)) return '🪟';
    if (/steam|game|playstation|xbox/i.test(combined)) return '🎮';
    if (/email|gmail|mail/i.test(combined)) return '📧';
    if (/figma/i.test(combined)) return '📐';
    if (/duolingo/i.test(combined)) return '🦉';
    if (/leonardo/i.test(combined)) return '🖌️';
    if (/api/i.test(combined)) return '🔑';
    if (/account|login/i.test(combined)) return '👤';
    return '💎';
  };

  // Helper: Fetch Categories & Product Groups
  const getCategoriesForTenant = () => {
    const tenant = getTenant();
    const categoriesEnabled = tenant.categories_enabled !== undefined && tenant.categories_enabled !== null 
      ? Boolean(tenant.categories_enabled) 
      : true;

    // If merchant turned off categories, return empty so it displays direct flat product list
    if (!categoriesEnabled) {
      return [];
    }

    // 1. Fetch custom folders/groups
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

    // 2. Fetch products that have no group_id (e.g. category = 'General' or other custom category)
    const ungroupedCats = db.prepare(`
      SELECT p.category, COUNT(p.id) as active_count
      FROM products p
      LEFT JOIN platform_wholesale_rules r ON p.provider_product_id = r.provider_product_id
      WHERE p.tenant_id = ?
        AND p.is_active = 1
        AND p.group_id IS NULL
        AND (p.provider = 'custom' OR r.is_active IS NULL OR r.is_active = 1)
      GROUP BY p.category
      ORDER BY p.category ASC
    `).all(tenantId) as any[];

    for (const uc of ungroupedCats) {
      const catName = uc.category || 'General';
      const icon = getProductIcon('', catName);
      categoryList.push({
        id: catName,
        name: catName,
        icon: icon && icon !== '💎' ? icon : '📁',
        isGroup: false,
        count: Number(uc.active_count),
      });
    }

    return categoryList;
  };

  // Helper: Fetch products in category or group (or all active products)
  const getProductsByCategoryOrGroup = (selector: { groupId?: string; categoryName?: string; allProducts?: boolean }) => {
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
    } else if (selector.allProducts) {
      // Return all active products without category grouping
    }

    query += ` ORDER BY p.retail_price_usd ASC`;
    const results = db.prepare(query).all(...params) as any[];

    // Ensure real live stock is attached for wholesale products
    return results.map(p => {
      if (p.provider !== 'custom' && p.provider_product_id) {
        const liveStock = getCachedProductLiveStock(p.provider_product_id);
        if (liveStock !== null) {
          return { ...p, stock: liveStock };
        }
      }
      return p;
    });
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
  // ==========================================
  // 2. Category Browser or Direct Product List
  // ==========================================
  const showCategoryBrowser = async (ctx: any) => {
    const tenant = getTenant();
    const categoriesEnabled = tenant.categories_enabled !== undefined && tenant.categories_enabled !== null 
      ? Boolean(tenant.categories_enabled) 
      : true;

    // If categories are OFF: Directly render flat list of all products!
    if (!categoriesEnabled) {
      return handleShowProductsList(ctx, { allProducts: true });
    }

    const categories = getCategoriesForTenant();

    if (categories.length === 0) {
      // Categories are enabled, but merchant hasn't created any custom category yet
      return handleShowProductsList(ctx, { allProducts: true });
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
  // 3. Products in Category / Store (Matching Screenshot 3)
  // Format: Name — $Price [Stock]
  // ==========================================
  const handleShowProductsList = async (ctx: any, selector: { groupId?: string; categoryName?: string; allProducts?: boolean }) => {
    const products = getProductsByCategoryOrGroup(selector);

    if (products.length === 0) {
      const emptyMsg = '🛍️ <b>No available products in this section.</b>\nPlease check back soon!';
      const kb = new InlineKeyboard().text('⬅️ Back', 'nav_start');
      if (ctx.callbackQuery) {
        await ctx.editMessageText(emptyMsg, { parse_mode: 'HTML', reply_markup: kb });
        return ctx.answerCallbackQuery();
      }
      return ctx.reply(emptyMsg, { parse_mode: 'HTML', reply_markup: kb });
    }

    const keyboard = new InlineKeyboard();
    for (const p of products) {
      const icon = getProductIcon(p.name, p.category);
      const priceFormatted = Number(p.retail_price_usd).toFixed(2);
      const stock = p.stock !== undefined && p.stock !== null ? Number(p.stock) : 0;
      const stockBadge = stock > 0 ? `[${stock}]` : '[0]';
      const suffix = ` — $${priceFormatted} ${stockBadge}`;

      // Telegram buttons can visually truncate if too long, cutting off price & stock.
      // We guarantee price & stock are 100% visible by truncating the product name when long.
      const maxNameLen = 22;
      const cleanName = p.name ? p.name.trim() : 'Product';
      const truncatedName = cleanName.length > maxNameLen
        ? `${cleanName.substring(0, maxNameLen).trim()}…`
        : cleanName;

      // Required Format: [Icon] [Name] — $[Price] [Number] (only number in brackets)
      keyboard.text(`${icon} ${truncatedName}${suffix}`, `view_p_${p.id}`).row();
    }

    const tenant = getTenant();
    const categoriesEnabled = tenant.categories_enabled !== undefined && tenant.categories_enabled !== null 
      ? Boolean(tenant.categories_enabled) 
      : true;
    const hasCategories = categoriesEnabled && getCategoriesForTenant().length > 0;

    // Back button routes to category browser if categories active, else to home menu
    keyboard.text('⬅️ Back', hasCategories ? 'nav_products' : 'nav_start');

    const title = '<b>Select a product:</b>';
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

    if (product.provider !== 'custom' && product.provider_product_id) {
      const liveStock = getCachedProductLiveStock(product.provider_product_id);
      if (liveStock !== null) {
        product.stock = liveStock;
      }
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
      `🎁 <b>Stock:</b> ${stock > 0 ? `${stock} available` : '❌ Out of stock'}`;

    const keyboard = new InlineKeyboard();
    if (stock > 0) {
      keyboard.text('🛒 Buy Now', `qty_menu_${product.id}`).row();
    }

    const tenant = getTenant();
    const categoriesEnabled = tenant.categories_enabled !== undefined && tenant.categories_enabled !== null 
      ? Boolean(tenant.categories_enabled) 
      : true;
    const hasCategories = categoriesEnabled && getCategoriesForTenant().length > 0;

    let backCallback = 'nav_products';
    if (!hasCategories) {
      backCallback = 'nav_products';
    } else if (product.group_id) {
      backCallback = `view_grp_${product.group_id}`;
    } else if (product.category) {
      backCallback = `view_cat_${encodeURIComponent(product.category)}`;
    }

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
        `🟡 <b>Binance Pay (Instant Auto-Deposit)</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Merchant Binance Pay UID:\n\n` +
        `<code>${binance.uid}</code>\n\n` +
        `1. Open Binance App &rarr; Pay &rarr; Send &rarr; Enter UID above.\n` +
        `2. Transfer USDT.\n\n` +
        `👉 <b>How much USD (USDT) did you send?</b>\n` +
        `Enter the exact USD amount sent (e.g. 5 or 10):`;

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
      step: 'AWAITING_LOCAL_USD_AMOUNT',
      method: methodName,
      updatedAt: Date.now(),
    });

    const promptMsg =
      `📱 <b>${methodName} Deposit</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💱 <b>Rate:</b> $1.00 USD = ${rate.toFixed(0)} BDT\n\n` +
      `👉 <b>How much USD do you want to deposit?</b>\n` +
      `Enter USD amount (e.g. 2, 5, or 10):`;

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

    // STEP B: Awaiting Local Deposit USD Amount
    if (state.step === 'AWAITING_LOCAL_USD_AMOUNT' || state.step === 'AWAITING_BDT_AMOUNT') {
      const usd = parseFloat(text);
      if (isNaN(usd) || usd <= 0) {
        return ctx.reply('❌ Please enter a valid number for USD (e.g. 2, 5, or 10):');
      }

      const numbers = tenant?.payment_numbers_json || {};
      const methodKey = (state.method?.toLowerCase() || 'bkash') as 'bkash' | 'nagad' | 'rocket';
      const targetNumber = numbers[methodKey] || 'Not Configured';

      // Calculate required BDT (rounded cleanly)
      const calculatedBdt = Math.round(usd * rate);
      state.amountUsd = Number(usd.toFixed(2));
      state.amountBdt = calculatedBdt;
      state.step = 'AWAITING_LOCAL_TRX_ID';
      state.updatedAt = Date.now();

      const paymentInstructions =
        `📱 <b>${state.method} Deposit</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `${state.method} Personal Number:\n\n` +
        `<code>${targetNumber}</code>\n\n` +
        `(Send Money)\n\n` +
        `💵 Deposit Amount: $${state.amountUsd.toFixed(2)} USD\n` +
        `৳     Total Payable: ${calculatedBdt} BDT\n\n` +
        `💱 Rate: $1.00 USD = ${rate.toFixed(0)} BDT\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👉 Send exact ${calculatedBdt} BDT to the number above via Send Money.\n` +
        `After sending, enter your payment Transaction ID (TrxID):`;

      return ctx.reply(paymentInstructions, {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Cancel', 'nav_deposit'),
      });
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

      const insertResult = db.prepare(`
        INSERT INTO deposits (
          tenant_id, customer_telegram_id, customer_username, method, amount_bdt, amount_usd, trx_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `).run(tenantId, ctx.from.id, ctx.from.username || null, state.method || 'bKash', state.amountBdt, state.amountUsd, trxId);

      const depositId = insertResult.lastInsertRowid;
      userStates.delete(ctx.from.id);

      const confirmMsg =
        `🎉 <b>Deposit Request Submitted!</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `💳 Method: <b>${state.method}</b>\n` +
        `💵 Amount: <b>$${state.amountUsd?.toFixed(2)} USD (${state.amountBdt} BDT)</b>\n` +
        `🧾 TrxID: <code>${trxId}</code>\n` +
        `⏳ Status: <b>PENDING</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `<i>Your balance will be credited as soon as store administration verifies the transaction.</i>`;

      await ctx.reply(confirmMsg, { parse_mode: 'HTML' });

      // Notify Store Admin via Telegram with 1-click [Approve] & [Reject] buttons
      if (tenant?.admin_telegram_id) {
        const customerName = ctx.from.first_name || 'Customer';
        const customerHandle = ctx.from.username ? `@${ctx.from.username}` : `ID: ${ctx.from.id}`;
        const adminAlert =
          `🔔 <b>New Manual Deposit Alert!</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `👤 Customer: <b>${customerName}</b> (${customerHandle})\n` +
          `💳 Method: <b>${state.method}</b>\n` +
          `💵 Amount BDT: <b>${state.amountBdt} BDT</b>\n` +
          `💶 Equivalent USD: <b>$${state.amountUsd?.toFixed(2)} USD</b>\n` +
          `🧾 TrxID: <code>${trxId}</code>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `Please verify the transaction in your mobile app and click an action below:`;

        const adminKeyboard = new InlineKeyboard()
          .text('✅ Approve & Credit', `adm_app_${depositId}`)
          .text('❌ Reject', `adm_rej_${depositId}`);

        bot.api.sendMessage(tenant.admin_telegram_id, adminAlert, {
          parse_mode: 'HTML',
          reply_markup: adminKeyboard,
        }).catch((err: any) => {
          console.warn(`[Bot Engine] Could not deliver deposit notification to admin ${tenant.admin_telegram_id}:`, err.message);
        });
      }
      return;
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

  // ==========================================
  // 12. Admin 1-Click Approve & Reject Callback Handlers
  // ==========================================
  bot.callbackQuery(/^adm_app_(\d+)$/, async (ctx) => {
    const depositId = ctx.match[1];
    const tenant = getTenant();
    if (!tenant?.admin_telegram_id || ctx.from.id !== tenant.admin_telegram_id) {
      return ctx.answerCallbackQuery({
        text: '❌ Unauthorized. Only the store owner can approve this deposit.',
        show_alert: true,
      });
    }

    const deposit = db.prepare('SELECT * FROM deposits WHERE id = ? AND tenant_id = ?').get(depositId, tenantId) as any;
    if (!deposit) {
      return ctx.answerCallbackQuery({ text: 'Deposit record not found.', show_alert: true });
    }

    if (deposit.status === 'APPROVED') {
      return ctx.answerCallbackQuery({ text: 'Already approved!', show_alert: true });
    }

    const approveTx = db.transaction(() => {
      db.prepare(`UPDATE deposits SET status = 'APPROVED', processed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(depositId);
      db.prepare(`UPDATE customers SET balance_usd = balance_usd + ? WHERE tenant_id = ? AND telegram_id = ?`)
        .run(deposit.amount_usd, tenantId, deposit.customer_telegram_id);
    });

    approveTx();

    await ctx.editMessageText(
      ctx.callbackQuery.message?.text + `\n\n✅ <b>APPROVED & CREDITED by Admin</b> (${new Date().toLocaleTimeString()})`,
      { parse_mode: 'HTML' }
    ).catch(() => {});

    await ctx.answerCallbackQuery({ text: '✅ Approved! Customer wallet credited.' });

    // Notify customer
    bot.api.sendMessage(
      deposit.customer_telegram_id,
      `🎉 <b>Deposit Approved!</b>\n\n` +
      `Amount: <b>$${deposit.amount_usd.toFixed(2)} USD</b> (${deposit.amount_bdt} BDT)\n` +
      `Method: <b>${deposit.method}</b>\n` +
      `TrxID: <code>${deposit.trx_id}</code>\n\n` +
      `Your wallet balance has been updated. Happy shopping! 🛍️`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  });

  bot.callbackQuery(/^adm_rej_(\d+)$/, async (ctx) => {
    const depositId = ctx.match[1];
    const tenant = getTenant();
    if (!tenant?.admin_telegram_id || ctx.from.id !== tenant.admin_telegram_id) {
      return ctx.answerCallbackQuery({
        text: '❌ Unauthorized. Only the store owner can reject this deposit.',
        show_alert: true,
      });
    }

    const deposit = db.prepare('SELECT * FROM deposits WHERE id = ? AND tenant_id = ?').get(depositId, tenantId) as any;
    if (!deposit) {
      return ctx.answerCallbackQuery({ text: 'Deposit record not found.', show_alert: true });
    }

    db.prepare(`UPDATE deposits SET status = 'REJECTED', processed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(depositId);

    await ctx.editMessageText(
      ctx.callbackQuery.message?.text + `\n\n❌ <b>REJECTED by Admin</b> (${new Date().toLocaleTimeString()})`,
      { parse_mode: 'HTML' }
    ).catch(() => {});

    await ctx.answerCallbackQuery({ text: '❌ Deposit Rejected.' });

    // Notify customer
    bot.api.sendMessage(
      deposit.customer_telegram_id,
      `❌ <b>Deposit Verification Failed</b>\n\n` +
      `Method: <b>${deposit.method}</b>\n` +
      `TrxID: <code>${deposit.trx_id}</code>\n\n` +
      `The store administration could not verify this transaction. Please double check your TrxID or contact support.`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  });

  return bot;
}
