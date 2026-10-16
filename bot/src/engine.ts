import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { db } from '../../server/src/db/database';
import { processCustomerPurchase } from '../../server/src/services/inventory';
import { verifyCustomerRetailBinanceDeposit } from '../../server/src/services/binance';
import { decrypt } from '../../server/src/services/crypto';

// In-memory conversation state for multi-step prompts (deposits)
interface UserConversationState {
  step: 'AWAITING_BDT_AMOUNT' | 'AWAITING_LOCAL_TRX_ID' | 'AWAITING_BINANCE_TX_ID' | 'AWAITING_BINANCE_AMOUNT';
  method?: 'bKash' | 'Nagad' | 'Rocket' | 'Binance';
  amountBdt?: number;
  amountUsd?: number;
  updatedAt: number;
}

const userStates = new Map<number, UserConversationState>();

// Clear state older than 15 minutes to preserve RAM
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

  // Helper: get tenant
  const getTenant = () => {
    const raw = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as any;
    if (raw) {
      raw.payment_numbers_json = JSON.parse(raw.payment_numbers_json || '{}');
      const decBinance = decrypt(raw.binance_config_json_enc);
      raw.binance_config_json = JSON.parse(decBinance || '{}');
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
        VALUES (?, ?, ?, ?, 0.0, 'bn')
      `).run(tenantId, from.id, from.username || null, from.first_name || 'Customer');

      customer = db.prepare(`
        SELECT * FROM customers WHERE tenant_id = ? AND telegram_id = ?
      `).get(tenantId, from.id);
    }
    return customer;
  };

  // Main persistent navigation keyboard
  const getMainKeyboard = (lang: string = 'bn') => {
    const isBn = lang === 'bn';
    return new Keyboard()
      .text(isBn ? '🛍️ প্রোডাক্ট কিনুন' : '🛍️ Products')
      .text(isBn ? '💰 আমার ওয়ালেট' : '💰 My Wallet')
      .row()
      .text(isBn ? '➕ ব্যালেন্স রিচার্জ' : '➕ Add Funds')
      .text(isBn ? '📦 অর্ডার হিস্টোরি' : '📦 My Orders')
      .row()
      .text(isBn ? '🌐 ভাষা (English)' : '🌐 Language (বাংলা)')
      .text(isBn ? '📞 হেল্পলাইন' : '📞 Live Support')
      .resized();
  };

  // 1. /start command
  bot.command('start', async (ctx) => {
    const tenant = getTenant();
    if (!tenant) return;

    const customer = getOrCreateCustomer(ctx.from);
    userStates.delete(ctx.from.id);

    const isBn = customer.language === 'bn';
    const storeName = tenant.name || 'Bot by mogent';

    const welcomeMsg = isBn
      ? `👋 স্বাগতম <b>${ctx.from.first_name || 'গ্রাহক'}</b>!\n\n🏪 <b>${storeName}</b>-এ আপনাকে স্বাগতম। এখানে আপনি ১০০% ইনস্ট্যান্ট ডেলিভারিতে সকল প্রিমিয়াম ডিজিটাল প্রোডাক্ট কিনতে পারবেন।\n\n💵 আপনার বর্তমান ব্যালেন্স: <b>$${Number(customer.balance_usd || 0).toFixed(2)} USD</b>\n\nকেনাকাটা শুরু করতে নিচের মেনু বাটন ব্যবহার করুন:`
      : `👋 Welcome <b>${ctx.from.first_name || 'Customer'}</b>!\n\n🏪 Welcome to <b>${storeName}</b>. Buy digital accounts and license keys with instant automated delivery.\n\n💵 Your Balance: <b>$${Number(customer.balance_usd || 0).toFixed(2)} USD</b>\n\nUse the menu buttons below to proceed:`;

    await ctx.reply(welcomeMsg, {
      parse_mode: 'HTML',
      reply_markup: getMainKeyboard(customer.language),
    });
  });

  // 2. Language Toggle
  bot.hears([/🌐 ভাষা/i, /🌐 Language/i], async (ctx) => {
    const customer = getOrCreateCustomer(ctx.from);
    const newLang = customer.language === 'bn' ? 'en' : 'bn';

    db.prepare(`
      UPDATE customers SET language = ? WHERE tenant_id = ? AND telegram_id = ?
    `).run(newLang, tenantId, ctx.from.id);

    const msg = newLang === 'bn' ? '✅ ভাষা সফলভাবে বাংলায় পরিবর্তন করা হয়েছে।' : '✅ Language switched to English successfully.';
    await ctx.reply(msg, { reply_markup: getMainKeyboard(newLang) });
  });

  // 3. My Wallet
  bot.hears([/💰 আমার ওয়ালেট/i, /💰 My Wallet/i], async (ctx) => {
    const customer = getOrCreateCustomer(ctx.from);
    const isBn = customer.language === 'bn';

    const msg = isBn
      ? `👤 <b>কাস্টমার প্রোফাইল:</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🆔 আপনার আইডি: <code>${ctx.from.id}</code>\n` +
        `💰 বর্তমান ব্যালেন্স: <b>$${Number(customer.balance_usd || 0).toFixed(2)} USD</b>\n` +
        `🛒 মোট কেনাকাটা: <b>$${Number(customer.total_spent_usd || 0).toFixed(2)} USD</b>\n` +
        `📦 সফল অর্ডার: <b>${customer.orders_count || 0}টি</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `<i>ব্যালেন্স যুক্ত করতে নিচের "➕ ব্যালেন্স রিচার্জ" বাটনে চাপুন।</i>`
      : `👤 <b>Customer Profile:</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🆔 Telegram ID: <code>${ctx.from.id}</code>\n` +
        `💰 Current Balance: <b>$${Number(customer.balance_usd || 0).toFixed(2)} USD</b>\n` +
        `🛒 Total Spent: <b>$${Number(customer.total_spent_usd || 0).toFixed(2)} USD</b>\n` +
        `📦 Completed Orders: <b>${customer.orders_count || 0}</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `<i>To top-up your balance, press "➕ Add Funds".</i>`;

    await ctx.reply(msg, { parse_mode: 'HTML' });
  });

  // Helper to fetch active products for this tenant (respects merchant is_active AND platform wholesale rules)
  const getActiveProductsForTenant = (groupId?: string | null) => {
    let query = `
      SELECT p.*, g.name as group_name, g.icon as group_icon
      FROM products p
      LEFT JOIN product_groups g ON p.group_id = g.id
      LEFT JOIN platform_wholesale_rules r ON p.provider_product_id = r.provider_product_id
      WHERE p.tenant_id = ?
        AND p.is_active = 1
        AND (p.provider = 'custom' OR r.is_active IS NULL OR r.is_active = 1)
    `;
    const params: any[] = [tenantId];

    if (groupId === 'general') {
      query += ` AND p.group_id IS NULL`;
    } else if (groupId) {
      query += ` AND p.group_id = ?`;
      params.push(groupId);
    }

    query += ` ORDER BY p.retail_price_usd ASC`;
    return db.prepare(query).all(...params) as any[];
  };

  // Helper to fetch active groups with product counts
  const getActiveGroupsForTenant = () => {
    const groups = db.prepare(`
      SELECT g.*, COUNT(p.id) as active_count
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
      SELECT COUNT(p.id) as active_count
      FROM products p
      LEFT JOIN platform_wholesale_rules r ON p.provider_product_id = r.provider_product_id
      WHERE p.tenant_id = ?
        AND p.group_id IS NULL
        AND p.is_active = 1
        AND (p.provider = 'custom' OR r.is_active IS NULL OR r.is_active = 1)
    `).get(tenantId) as any;

    return {
      groups,
      ungroupedCount: Number(ungrouped?.active_count || 0),
    };
  };

  // 4. Products Catalog (2-Tap Category Browsing)
  bot.hears([/🛍️ প্রোডাক্ট কিনুন/i, /🛍️ Products/i], async (ctx) => {
    const customer = getOrCreateCustomer(ctx.from);
    const isBn = customer.language === 'bn';

    const { groups, ungroupedCount } = getActiveGroupsForTenant();
    const totalActive = groups.reduce((acc, g) => acc + g.active_count, 0) + ungroupedCount;

    if (totalActive === 0) {
      const emptyMsg = isBn
        ? '🛍️ বর্তমানে স্টোরে কোনো পণ্য স্টক নেই। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
        : '🛍️ No products currently available in this store. Please check back soon.';
      return ctx.reply(emptyMsg);
    }

    // If groups exist, render 2-Tap Category Selection
    if (groups.length > 0) {
      const keyboard = new InlineKeyboard();
      for (const g of groups) {
        keyboard.text(`${g.icon || '📁'} ${g.name} (${g.active_count})`, `view_grp_${g.id}`).row();
      }
      if (ungroupedCount > 0) {
        keyboard.text(isBn ? `📦 সাধারণ আইটেম (${ungroupedCount})` : `📦 General Items (${ungroupedCount})`, `view_grp_general`).row();
      }

      const title = isBn
        ? `📁 <b>প্রোডাক্ট ক্যাটাগরি / ফোল্ডার:</b>\nনিচে থেকে আপনার পছন্দের ক্যাটাগরিটি নির্বাচন করুন:`
        : `📁 <b>Product Categories & Folders:</b>\nSelect a category from below:`;

      return ctx.reply(title, { parse_mode: 'HTML', reply_markup: keyboard });
    }

    // Direct product listing if no custom groups defined
    const products = getActiveProductsForTenant();
    const keyboard = new InlineKeyboard();
    for (const p of products) {
      const stockBadge = p.stock > 0 ? `($${Number(p.retail_price_usd).toFixed(2)})` : `(Out of stock)`;
      keyboard.text(`${p.name} - ${stockBadge}`, `view_p_${p.id}`).row();
    }

    const title = isBn
      ? `🛍️ <b>প্রোডাক্ট ক্যাটালগ:</b>\nনিচে থেকে আপনার পছন্দের আইটেমটি সিলেক্ট করুন:`
      : `🛍️ <b>Product Catalog:</b>\nSelect an item from below:`;

    await ctx.reply(title, { parse_mode: 'HTML', reply_markup: keyboard });
  });

  // Handle Group Selection Callback
  bot.callbackQuery(/^view_grp_(.+)$/, async (ctx) => {
    const grpId = ctx.match[1];
    const customer = getOrCreateCustomer(ctx.from);
    const isBn = customer.language === 'bn';

    const products = getActiveProductsForTenant(grpId);
    let groupTitle = isBn ? '📦 সাধারণ আইটেম' : '📦 General Items';

    if (grpId !== 'general') {
      const group = db.prepare('SELECT * FROM product_groups WHERE id = ? AND tenant_id = ?').get(grpId, tenantId) as any;
      if (group) {
        groupTitle = `${group.icon || '📁'} ${group.name}`;
      }
    }

    if (products.length === 0) {
      return ctx.answerCallbackQuery({
        text: isBn ? 'এই ক্যাটাগরিতে বর্তমানে কোনো পণ্য নেই।' : 'No products in this category.',
        show_alert: true,
      });
    }

    const keyboard = new InlineKeyboard();
    for (const p of products) {
      const stockBadge = p.stock > 0 ? `($${Number(p.retail_price_usd).toFixed(2)})` : `(Out of stock)`;
      keyboard.text(`${p.name} - ${stockBadge}`, `view_p_${p.id}`).row();
    }
    keyboard.text(isBn ? '⬅️ ক্যাটাগরি লিস্টে ফেরত যান' : '⬅️ Back to Categories', 'back_groups');

    const text = isBn
      ? `📁 <b>ক্যাটাগরি: ${groupTitle}</b>\n\nনিচের তালিকা থেকে আপনার কাঙ্খিত পণ্যটি বাছাই করুন:`
      : `📁 <b>Category: ${groupTitle}</b>\n\nSelect a product from the list below:`;

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Back to Categories Callback
  bot.callbackQuery('back_groups', async (ctx) => {
    const customer = getOrCreateCustomer(ctx.from);
    const isBn = customer.language === 'bn';
    const { groups, ungroupedCount } = getActiveGroupsForTenant();

    if (groups.length > 0) {
      const keyboard = new InlineKeyboard();
      for (const g of groups) {
        keyboard.text(`${g.icon || '📁'} ${g.name} (${g.active_count})`, `view_grp_${g.id}`).row();
      }
      if (ungroupedCount > 0) {
        keyboard.text(isBn ? `📦 সাধারণ আইটেম (${ungroupedCount})` : `📦 General Items (${ungroupedCount})`, `view_grp_general`).row();
      }

      const title = isBn
        ? `📁 <b>প্রোডাক্ট ক্যাটাগরি / ফোল্ডার:</b>\nনিচে থেকে আপনার পছন্দের ক্যাটাগরিটি নির্বাচন করুন:`
        : `📁 <b>Product Categories & Folders:</b>\nSelect a category from below:`;

      await ctx.editMessageText(title, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      const products = getActiveProductsForTenant();
      const keyboard = new InlineKeyboard();
      for (const p of products) {
        const stockBadge = p.stock > 0 ? `($${Number(p.retail_price_usd).toFixed(2)})` : `(Out of stock)`;
        keyboard.text(`${p.name} - ${stockBadge}`, `view_p_${p.id}`).row();
      }
      const title = isBn
        ? `🛍️ <b>প্রোডাক্ট ক্যাটালগ:</b>\nনিচে থেকে আপনার পছন্দের আইটেমটি সিলেক্ট করুন:`
        : `🛍️ <b>Product Catalog:</b>\nSelect an item from below:`;
      await ctx.editMessageText(title, { parse_mode: 'HTML', reply_markup: keyboard });
    }

    await ctx.answerCallbackQuery();
  });

  // Handle Product View Callback
  bot.callbackQuery(/^view_p_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    const customer = getOrCreateCustomer(ctx.from);
    const isBn = customer.language === 'bn';

    const product = db.prepare(`
      SELECT p.*, g.name as group_name, g.icon as group_icon, r.is_active as platform_active
      FROM products p
      LEFT JOIN product_groups g ON p.group_id = g.id
      LEFT JOIN platform_wholesale_rules r ON p.provider_product_id = r.provider_product_id
      WHERE p.id = ? AND p.tenant_id = ? AND p.is_active = 1
    `).get(productId, tenantId) as any;

    // Check if merchant disabled product OR site owner disabled wholesale product globally
    if (!product || (product.provider !== 'custom' && product.platform_active === 0)) {
      return ctx.answerCallbackQuery({
        text: isBn ? 'পণ্যটি বর্তমানে অনুপলব্ধ।' : 'Product is currently unavailable.',
        show_alert: true,
      });
    }

    const price = Number(product.retail_price_usd).toFixed(2);
    const stock = product.stock;
    const categoryName = product.group_name ? `${product.group_icon || '📁'} ${product.group_name}` : product.category;

    const desc = product.description ? `\n📝 ${product.description}\n` : '';
    const text = isBn
      ? `📦 <b>${product.name}</b>\n` +
        `📂 ক্যাটাগরি: ${categoryName}\n` +
        `💵 মূল্য: <b>$${price} USD</b>\n` +
        `📊 বর্তমান স্টক: <b>${stock > 0 ? stock + ' টি এভেইলেবল' : 'আউট অব স্টক'}</b>\n` +
        desc +
        `\nআপনার বর্তমান ওয়ালেট: <b>$${Number(customer.balance_usd || 0).toFixed(2)} USD</b>`
      : `📦 <b>${product.name}</b>\n` +
        `📂 Category: ${categoryName}\n` +
        `💵 Price: <b>$${price} USD</b>\n` +
        `📊 Stock: <b>${stock > 0 ? stock + ' in stock' : 'Out of stock'}</b>\n` +
        desc +
        `\nYour Wallet: <b>$${Number(customer.balance_usd || 0).toFixed(2)} USD</b>`;

    const keyboard = new InlineKeyboard();
    if (stock > 0) {
      keyboard.text(isBn ? '⚡ এখনি কিনুন (১টি)' : '⚡ Buy Now (1x)', `buy_${product.id}_1`).row();
    }

    if (product.group_id) {
      keyboard.text(isBn ? `⬅️ ব্যাকে যান (${product.group_name})` : `⬅️ Back to (${product.group_name})`, `view_grp_${product.group_id}`);
    } else {
      keyboard.text(isBn ? '⬅️ ব্যাকে যান' : '⬅️ Back to Categories', 'back_groups');
    }

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    await ctx.answerCallbackQuery();
  });

  // Handle Buy Product Callback
  bot.callbackQuery(/^buy_(.+)_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    const quantity = parseInt(ctx.match[2]) || 1;
    const customer = getOrCreateCustomer(ctx.from);
    const isBn = customer.language === 'bn';

    await ctx.answerCallbackQuery({ text: isBn ? 'প্রসেসিং হচ্ছে...' : 'Processing order...' });

    const result = await processCustomerPurchase({
      tenantId,
      customerTelegramId: ctx.from.id,
      productId,
      quantity,
    });

    if (!result.success) {
      const errorMsg = isBn ? `❌ <b>অর্ডার ব্যর্থ হয়েছে:</b>\n${result.error}` : `❌ <b>Order Failed:</b>\n${result.error}`;
      return ctx.reply(errorMsg, { parse_mode: 'HTML' });
    }

    // Success response with instant delivery in monospace block
    const successMsg = isBn
      ? `🎉 <b>অর্ডার সফল হয়েছে!</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🧾 অর্ডার নাম্বার: <code>#${result.orderNumber}</code>\n` +
        `💵 মোট পরিশোধ: <b>$${result.totalPriceUsd?.toFixed(2)} USD</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🔑 <b>আপনার ডেলিভারি কোড / একাউন্ট তথ্য:</b>\n\n` +
        `<pre><code>${result.deliveredData}</code></pre>\n\n` +
        `<i>ভবিষ্যতে দেখার জন্য এটি "📦 অর্ডার হিস্টোরি"-তেও সংরক্ষিত থাকবে। ধন্যবাদ!</i>`
      : `🎉 <b>Order Completed Successfully!</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🧾 Order Number: <code>#${result.orderNumber}</code>\n` +
        `💵 Total Paid: <b>$${result.totalPriceUsd?.toFixed(2)} USD</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🔑 <b>Delivered Serials / Account Credentials:</b>\n\n` +
        `<pre><code>${result.deliveredData}</code></pre>\n\n` +
        `<i>Saved permanently in your "📦 My Orders" history. Thank you!</i>`;

    await ctx.reply(successMsg, { parse_mode: 'HTML' });
  });


  // 5. Add Funds (Deposit)
  bot.hears([/➕ ব্যালেন্স রিচার্জ/i, /➕ Add Funds/i], async (ctx) => {
    const tenant = getTenant();
    const customer = getOrCreateCustomer(ctx.from);
    const isBn = customer.language === 'bn';

    const numbers = tenant?.payment_numbers_json || {};
    const binance = tenant?.binance_config_json || {};
    const rate = Number(tenant?.usd_to_bdt_rate || 125.0);

    const keyboard = new InlineKeyboard();
    if (numbers.bkash) keyboard.text('📱 bKash (বিকাশ)', 'dep_bkash').row();
    if (numbers.nagad) keyboard.text('📱 Nagad (নগদ)', 'dep_nagad').row();
    if (numbers.rocket) keyboard.text('📱 Rocket (রকেট)', 'dep_rocket').row();
    if (binance.uid) keyboard.text('🟡 Binance Pay (USDT)', 'dep_binance').row();

    const text = isBn
      ? `➕ <b>ব্যালেন্স রিচার্জ মেনু:</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `💱 আজকের ডলার রেট: <b>$1.00 USD = ${rate.toFixed(0)} ৳ BDT</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `আপনার পছন্দের পেমেন্ট মেথডটি নির্বাচন করুন:`
      : `➕ <b>Add Funds Menu:</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `💱 Exchange Rate: <b>$1.00 USD = ${rate.toFixed(0)} BDT</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Select your preferred payment method:`;

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  });

  // Handle Deposit Selection (Option B: BDT input -> USD conversion)
  bot.callbackQuery(/^dep_(bkash|nagad|rocket|binance)$/, async (ctx) => {
    const methodKey = ctx.match[1];
    const tenant = getTenant();
    const customer = getOrCreateCustomer(ctx.from);
    const isBn = customer.language === 'bn';
    const rate = Number(tenant?.usd_to_bdt_rate || 125.0);

    if (methodKey === 'binance') {
      const binance = tenant?.binance_config_json || {};
      if (!binance.uid) {
        return ctx.answerCallbackQuery({ text: 'Binance Pay is not configured by merchant.', show_alert: true });
      }

      userStates.set(ctx.from.id, {
        step: 'AWAITING_BINANCE_AMOUNT',
        method: 'Binance',
        updatedAt: Date.now(),
      });

      const binanceMsg = isBn
        ? `🟡 <b>Binance Pay (ইনস্ট্যান্ট অটো-ডিপোজিট)</b>\n\n` +
          `মার্চেন্টের Binance Pay UID:\n<code>${binance.uid}</code>\n\n` +
          `USDT সেন্ড করে আপনি কত ডলার ($) ডিপোজিট করতে চান তা লিখুন (যেমন: 5 বা 10):`
        : `🟡 <b>Binance Pay (Instant Auto-Deposit)</b>\n\n` +
          `Merchant Binance Pay UID:\n<code>${binance.uid}</code>\n\n` +
          `Please send USDT and enter the USD amount you deposited (e.g. 5 or 10):`;

      await ctx.editMessageText(binanceMsg, { parse_mode: 'HTML' });
      return ctx.answerCallbackQuery();
    }

    // Local bKash/Nagad/Rocket
    const methodNames: Record<string, 'bKash' | 'Nagad' | 'Rocket'> = {
      bkash: 'bKash',
      nagad: 'Nagad',
      rocket: 'Rocket',
    };
    const methodName = methodNames[methodKey];
    const numbers = tenant?.payment_numbers_json || {};
    const targetNumber = numbers[methodKey];

    if (!targetNumber) {
      return ctx.answerCallbackQuery({ text: `${methodName} number is not set.`, show_alert: true });
    }

    // Set state to await BDT amount
    userStates.set(ctx.from.id, {
      step: 'AWAITING_BDT_AMOUNT',
      method: methodName,
      updatedAt: Date.now(),
    });

    const promptMsg = isBn
      ? `📱 <b>${methodName} ডিপোজিট</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `মার্চেন্ট পার্সোনাল নাম্বার:\n<code>${targetNumber}</code> (Send Money)\n\n` +
        `💱 রেট: $1 = ${rate.toFixed(0)} ৳\n\n` +
        `👉 <b>আপনি কত টাকা পাঠিয়েছেন বা পাঠাবেন?</b>\nটাকার পরিমাণ লিখে পাঠান (যেমন: 250 বা 500):`
      : `📱 <b>${methodName} Deposit</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Merchant Personal Number:\n<code>${targetNumber}</code> (Send Money)\n\n` +
        `💱 Rate: $1 = ${rate.toFixed(0)} BDT\n\n` +
        `👉 <b>How much BDT did you send?</b>\nEnter BDT amount (e.g. 250 or 500):`;

    await ctx.editMessageText(promptMsg, { parse_mode: 'HTML' });
    await ctx.answerCallbackQuery();
  });

  // Handle Text Message (State Machine for Multi-Step Form)
  bot.on('message:text', async (ctx) => {
    const state = userStates.get(ctx.from.id);
    if (!state) return;

    const tenant = getTenant();
    const customer = getOrCreateCustomer(ctx.from);
    const isBn = customer.language === 'bn';
    const rate = Number(tenant?.usd_to_bdt_rate || 125.0);
    const text = ctx.message.text.trim();

    // STEP 1: Awaiting BDT Amount
    if (state.step === 'AWAITING_BDT_AMOUNT') {
      const bdt = parseFloat(text);
      if (isNaN(bdt) || bdt <= 0) {
        return ctx.reply(isBn ? '❌ অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন (যেমন: 250)।' : '❌ Please enter a valid number (e.g. 250).');
      }

      const calculatedUsd = Number((bdt / rate).toFixed(2));
      state.amountBdt = bdt;
      state.amountUsd = calculatedUsd;
      state.step = 'AWAITING_LOCAL_TRX_ID';
      state.updatedAt = Date.now();

      const nextPrompt = isBn
        ? `✅ <b>টাকার পরিমাণ: ${bdt} ৳ BDT (~$${calculatedUsd.toFixed(2)} USD)</b>\n\n` +
          `টাকা পাঠানোর পর প্রাপ্ত <b>Transaction ID (TrxID)</b>-টি লিখে পাঠান:`
        : `✅ <b>Amount: ${bdt} BDT (~$${calculatedUsd.toFixed(2)} USD)</b>\n\n` +
          `Now please enter your payment <b>Transaction ID (TrxID)</b>:`;

      return ctx.reply(nextPrompt, { parse_mode: 'HTML' });
    }

    // STEP 2: Awaiting Local TrxID
    if (state.step === 'AWAITING_LOCAL_TRX_ID') {
      const trxId = text.toUpperCase().replace(/\s+/g, '');
      if (trxId.length < 5) {
        return ctx.reply(isBn ? '❌ ট্রানজেকশন আইডি খুব ছোট। সঠিক TrxID লিখুন:' : '❌ TrxID is too short. Please enter a valid TrxID:');
      }

      // Check if already PENDING or APPROVED for this store
      const existing = db.prepare(`
        SELECT id, status FROM deposits WHERE tenant_id = ? AND trx_id = ? AND status IN ('PENDING', 'APPROVED')
      `).get(tenantId, trxId) as any;

      if (existing) {
        return ctx.reply(
          isBn
            ? `⚠️ এই TrxID-টি ইতোমধ্যেই প্রসেসিং বা অনুমোদিত অবস্থায় রয়েছে। অন্য TrxID ব্যবহার করুন:`
            : `⚠️ This TrxID is already pending or approved. Please use a different one:`
        );
      }

      // Insert Deposit as PENDING
      db.prepare(`
        INSERT INTO deposits (
          tenant_id, customer_telegram_id, customer_username, method, amount_bdt, amount_usd, trx_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
      `).run(tenantId, ctx.from.id, ctx.from.username || null, state.method || 'bKash', state.amountBdt, state.amountUsd, trxId);

      userStates.delete(ctx.from.id);

      const confirmMsg = isBn
        ? `🎉 <b>ডিপোজিট রিকোয়েস্ট সফলভাবে জমা হয়েছে!</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `💳 মেথড: <b>${state.method}</b>\n` +
          `💵 পরিমাণ: <b>${state.amountBdt} ৳ (~$${state.amountUsd?.toFixed(2)} USD)</b>\n` +
          `🧾 TrxID: <code>${trxId}</code>\n` +
          `⏳ স্ট্যাটাস: <b>PENDING (অপেক্ষমান)</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `<i>মার্চেন্ট ভেরিফাই করে অনুমোদন করলেই আপনার ওয়ালেটে ব্যালেন্স যুক্ত হবে এবং আপনি কনফার্মেশন মেসেজ পাবেন।</i>`
        : `🎉 <b>Deposit Request Submitted!</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `💳 Method: <b>${state.method}</b>\n` +
          `💵 Amount: <b>${state.amountBdt} BDT (~$${state.amountUsd?.toFixed(2)} USD)</b>\n` +
          `🧾 TrxID: <code>${trxId}</code>\n` +
          `⏳ Status: <b>PENDING</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `<i>Your balance will be credited as soon as the merchant approves it. You will receive an instant notification.</i>`;

      return ctx.reply(confirmMsg, { parse_mode: 'HTML' });
    }

    // STEP 3: Binance Amount
    if (state.step === 'AWAITING_BINANCE_AMOUNT') {
      const usd = parseFloat(text);
      if (isNaN(usd) || usd <= 0) {
        return ctx.reply('Please enter a valid USD amount (e.g. 5).');
      }

      state.amountUsd = usd;
      state.step = 'AWAITING_BINANCE_TX_ID';
      state.updatedAt = Date.now();

      return ctx.reply(
        isBn
          ? `✅ <b>পরিমাণ: $${usd.toFixed(2)} USDT</b>\n\nএবার বাইনান্স পে থেকে প্রাপ্ত ১৭/১৯ ডিজিটের <b>Order ID / Transaction ID</b>-টি পেস্ট করুন:`
          : `✅ <b>Amount: $${usd.toFixed(2)} USDT</b>\n\nNow paste your 17/19 digit Binance <b>Order ID / Transaction ID</b>:`
      );
    }

    // STEP 4: Binance TxID Verification
    if (state.step === 'AWAITING_BINANCE_TX_ID') {
      const txId = text.trim();
      await ctx.reply(isBn ? '⚡ বাইনান্স সার্ভারে ভেরিফাই করা হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...' : '⚡ Verifying transaction with Binance SAPI, please wait...');

      const result = await verifyCustomerRetailBinanceDeposit({
        tenantId,
        customerTelegramId: ctx.from.id,
        trxId: txId,
        amountUsd: state.amountUsd || 0,
      });

      userStates.delete(ctx.from.id);

      if (!result.success) {
        return ctx.reply(`❌ <b>Verification Failed:</b>\n${result.error}`, { parse_mode: 'HTML' });
      }

      return ctx.reply(
        isBn
          ? `🎉 <b>বাইনান্স ডিপোজিট ভেরিফাইড ও সফল!</b>\n\nআপনার ওয়ালেটে <b>$${result.amountUsd?.toFixed(2)} USD</b> যোগ হয়েছে। কেনাকাটা উপভোগ করুন! 🛍️`
          : `🎉 <b>Binance Deposit Verified Successfully!</b>\n\nCredited <b>$${result.amountUsd?.toFixed(2)} USD</b> to your wallet. Happy shopping! 🛍️`,
        { parse_mode: 'HTML' }
      );
    }
  });

  // 6. Orders History
  bot.hears([/📦 অর্ডার হিস্টোরি/i, /📦 My Orders/i], async (ctx) => {
    const customer = getOrCreateCustomer(ctx.from);
    const isBn = customer.language === 'bn';

    const recentOrders = db.prepare(`
      SELECT * FROM orders WHERE tenant_id = ? AND customer_telegram_id = ? ORDER BY created_at DESC LIMIT 5
    `).all(tenantId, ctx.from.id) as any[];

    if (recentOrders.length === 0) {
      return ctx.reply(isBn ? '📦 আপনার কোনো পূর্ববর্তী অর্ডার রেকর্ড নেই।' : '📦 You have not placed any orders yet.');
    }

    let response = isBn ? `📦 <b>আপনার সাম্প্রতিক ৫টি অর্ডার:</b>\n\n` : `📦 <b>Your Recent 5 Orders:</b>\n\n`;

    for (const o of recentOrders) {
      response +=
        `🧾 <b>#${o.order_number}</b> - ${o.product_name}\n` +
        `💵 মূল্য: $${Number(o.total_price_usd).toFixed(2)} USD (${o.created_at})\n` +
        `🔑 কোড:\n<pre><code>${o.delivered_data}</code></pre>\n` +
        `─────────────────────\n`;
    }

    await ctx.reply(response, { parse_mode: 'HTML' });
  });

  // 7. Live Support
  bot.hears([/📞 হেল্পলাইন/i, /📞 Live Support/i], async (ctx) => {
    const tenant = getTenant();
    const isBn = getOrCreateCustomer(ctx.from).language === 'bn';

    const contact = tenant.owner_email ? `ইমেইল: ${tenant.owner_email}` : 'টেলিগ্রাম সাপোর্টে যোগাযোগ করুন।';
    const msg = isBn
      ? `📞 <b>লাইভ সাপোর্ট:</b>\n\nযেকোনো সমস্যায় আমাদের এডমিনের সাথে যোগাযোগ করুন:\n${contact}`
      : `📞 <b>Live Support:</b>\n\nContact store administration:\n${contact}`;

    await ctx.reply(msg, { parse_mode: 'HTML' });
  });

  return bot;
}
