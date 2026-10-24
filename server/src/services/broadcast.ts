import { db } from '../db/database';
import { botRegistry } from '../../../bot/src/registry';
import { InlineKeyboard } from 'grammy';

export interface SendCustomBroadcastParams {
  tenantId: string;
  title?: string;
  message: string;
  buttonText?: string;
  buttonUrl?: string;
}

export interface SendPriceChangeBroadcastParams {
  tenantId: string;
  productId: string;
  type: 'PRICE_DROP' | 'PRICE_UPDATE';
  wasPriceUsd: number;
  nowPriceUsd: number;
  customNote?: string;
}

export interface BroadcastResult {
  id: string;
  totalRecipients: number;
  successCount: number;
  failedCount: number;
}

/**
 * Helper to escape HTML characters in dynamic text
 */
function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Generate unique broadcast ID
 */
function generateBroadcastId(): string {
  return 'BC-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);
}

/**
 * Send a custom notice broadcast to all registered bot customers of this tenant
 */
export async function sendCustomBroadcast(params: SendCustomBroadcastParams): Promise<BroadcastResult> {
  const { tenantId, title, message, buttonText, buttonUrl } = params;

  const tenant = db.prepare('SELECT id, bot_token, bot_username FROM tenants WHERE id = ?').get(tenantId) as any;
  if (!tenant) throw new Error('Store not found');

  const bot = botRegistry.getBotInstance(tenantId);
  if (!bot) throw new Error('Store Telegram bot is offline or not configured');

  const customers = db.prepare(`
    SELECT DISTINCT telegram_id FROM customers WHERE tenant_id = ?
  `).all(tenantId) as { telegram_id: number }[];

  const broadcastId = generateBroadcastId();
  const total = customers.length;
  let successCount = 0;
  let failedCount = 0;

  // Build inline keyboard if button provided
  let replyMarkup: InlineKeyboard | undefined;
  if (buttonText && buttonUrl) {
    replyMarkup = new InlineKeyboard().url(buttonText, buttonUrl);
  }

  // Record initial broadcast entry
  db.prepare(`
    INSERT INTO broadcast_history (
      id, tenant_id, broadcast_type, title, message, 
      target_recipients_count, success_count, failed_count
    ) VALUES (?, ?, 'CUSTOM', ?, ?, ?, 0, 0)
  `).run(broadcastId, tenantId, title || 'Custom Notice', message, total);

  // Send in safe rate-limited batches (25 messages per second = 40ms interval)
  for (const c of customers) {
    try {
      if (replyMarkup) {
        await bot.api.sendMessage(c.telegram_id, message, {
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        });
      } else {
        await bot.api.sendMessage(c.telegram_id, message, {
          parse_mode: 'HTML',
        });
      }
      successCount++;
    } catch (err: any) {
      failedCount++;
      // Common Telegram errors (bot blocked, user deleted) are expected
    }

    // 40ms sleep to stay safely under Telegram's 30 msg/sec limit
    await new Promise((resolve) => setTimeout(resolve, 40));
  }

  // Update final status in DB
  db.prepare(`
    UPDATE broadcast_history 
    SET success_count = ?, failed_count = ? 
    WHERE id = ?
  `).run(successCount, failedCount, broadcastId);

  return {
    id: broadcastId,
    totalRecipients: total,
    successCount,
    failedCount,
  };
}

/**
 * Format and broadcast a Price Drop or Price Update notice
 */
export async function sendPriceChangeBroadcast(params: SendPriceChangeBroadcastParams): Promise<BroadcastResult> {
  const { tenantId, productId, type, wasPriceUsd, nowPriceUsd, customNote } = params;

  const tenant = db.prepare('SELECT id, bot_token, bot_username FROM tenants WHERE id = ?').get(tenantId) as any;
  if (!tenant) throw new Error('Store not found');

  const bot = botRegistry.getBotInstance(tenantId);
  if (!bot) throw new Error('Store Telegram bot is offline or not configured');

  const product = db.prepare('SELECT id, name, category, retail_price_usd FROM products WHERE id = ? AND tenant_id = ?').get(productId, tenantId) as any;
  if (!product) throw new Error('Product not found in active store');

  const cleanName = escapeHtml(product.name.replace(/\{pe:\d+\}/gi, '').trim());
  const wasFormatted = Number(wasPriceUsd).toFixed(2);
  const nowFormatted = Number(nowPriceUsd).toFixed(2);

  let formattedMessage = '';
  if (type === 'PRICE_DROP') {
    formattedMessage = [
      `📉 <b>Price Drop!</b>`,
      ``,
      `💎 <b>${cleanName}</b>`,
      ``,
      `💰 Was: $${wasFormatted} USDT`,
      `✅ Now: $${nowFormatted} USDT`,
      ``,
      `<i>${customNote || 'Just limited time offer — buy now!'}</i>`,
    ].join('\n');
  } else {
    formattedMessage = [
      `🔥 <b>Price update</b>`,
      ``,
      `✨ <b>${cleanName}</b>`,
      `🤑 $${wasFormatted} 👉 $${nowFormatted}`,
    ].join('\n');
    if (customNote) {
      formattedMessage += `\n\n<i>${customNote}</i>`;
    }
  }

  // Create Direct Buy Deep-link Button if bot username exists
  let replyMarkup: InlineKeyboard | undefined;
  if (tenant.bot_username) {
    const buyUrl = `https://t.me/${tenant.bot_username}?start=prod_${product.id}`;
    replyMarkup = new InlineKeyboard().url('🛒 Buy in Bot Now', buyUrl);
  }

  const customers = db.prepare(`
    SELECT DISTINCT telegram_id FROM customers WHERE tenant_id = ?
  `).all(tenantId) as { telegram_id: number }[];

  const broadcastId = generateBroadcastId();
  const total = customers.length;
  let successCount = 0;
  let failedCount = 0;

  db.prepare(`
    INSERT INTO broadcast_history (
      id, tenant_id, broadcast_type, product_id, title, message, 
      target_recipients_count, success_count, failed_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
  `).run(broadcastId, tenantId, type, productId, type === 'PRICE_DROP' ? `Price Drop: ${cleanName}` : `Price Update: ${cleanName}`, formattedMessage, total);

  for (const c of customers) {
    try {
      if (replyMarkup) {
        await bot.api.sendMessage(c.telegram_id, formattedMessage, {
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        });
      } else {
        await bot.api.sendMessage(c.telegram_id, formattedMessage, {
          parse_mode: 'HTML',
        });
      }
      successCount++;
    } catch (err: any) {
      failedCount++;
    }

    await new Promise((resolve) => setTimeout(resolve, 40));
  }

  db.prepare(`
    UPDATE broadcast_history 
    SET success_count = ?, failed_count = ? 
    WHERE id = ?
  `).run(successCount, failedCount, broadcastId);

  return {
    id: broadcastId,
    totalRecipients: total,
    successCount,
    failedCount,
  };
}

/**
 * Get broadcast history for a merchant
 */
export function getBroadcastHistory(tenantId: string, limit = 50) {
  return db.prepare(`
    SELECT * FROM broadcast_history 
    WHERE tenant_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(tenantId, limit);
}
