import { db } from '../db/database';
import { botRegistry } from '../../../bot/src/registry';

export interface DepositLogParams {
  tenantId: string;
  customerTelegramId: number | string;
  amountUsd: number;
  method?: string;
  trxId?: string;
}

export interface PurchaseLogParams {
  tenantId: string;
  customerTelegramId: number | string;
  productName: string;
  planName?: string;
  orderNumber: string;
  quantity?: number;
  totalPriceUsd: number;
  viaReseller?: boolean;
}

/**
 * Mask customer telegram id for privacy (e.g. 740123403 -> 740***03)
 */
export function maskTelegramId(id: number | string): string {
  const str = String(id).trim();
  if (str.length <= 4) return str + '***';
  const prefix = str.slice(0, 3);
  const suffix = str.slice(-2);
  return `${prefix}***${suffix}`;
}

/**
 * Mask transaction ID / code for privacy (e.g. VEX012345VZ -> VEX0••••5VZ)
 */
export function maskTxCode(code?: string): string {
  if (!code || !code.trim()) {
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TX••••${randomHex}`;
  }
  const clean = code.trim();
  if (clean.length <= 6) return clean.slice(0, 2) + '••••' + clean.slice(-2);
  const prefix = clean.slice(0, 4);
  const suffix = clean.slice(-3);
  return `${prefix}••••${suffix}`;
}

/**
 * Escape HTML special chars for safe Telegram rendering
 */
function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Dispatch real-time deposit / topup log to merchant's Telegram channel or group
 */
export async function dispatchDepositLog(params: DepositLogParams): Promise<boolean> {
  const { tenantId, customerTelegramId, amountUsd, trxId } = params;

  try {
    const tenant = db.prepare(`
      SELECT log_channel_id, log_deposits_enabled, bot_token 
      FROM tenants WHERE id = ?
    `).get(tenantId) as any;

    if (!tenant) return false;
    const channelId = tenant.log_channel_id?.trim();
    if (!channelId || tenant.log_deposits_enabled === 0) {
      return false; // Logging disabled or channel not configured
    }

    const bot = botRegistry.getBotInstance(tenantId);
    if (!bot) {
      console.warn(`[LogChannel] Bot instance not active for tenant ${tenantId}, skipping deposit log.`);
      return false;
    }

    const maskedUser = maskTelegramId(customerTelegramId);
    const maskedCode = maskTxCode(trxId);

    const message = [
      `👤 <b>User:</b> <code>${maskedUser}</code>`,
      `💰 <b>Amount:</b> ${Number(amountUsd).toFixed(2)} USDT`,
      `🧾 <b>Code:</b> <code>${maskedCode}</code>`,
    ].join('\n');

    await bot.api.sendMessage(channelId, message, { parse_mode: 'HTML' });
    console.log(`[LogChannel] Dispatched deposit log for tenant ${tenantId} to channel ${channelId}`);
    return true;
  } catch (err: any) {
    console.warn(`[LogChannel] Failed to dispatch deposit log for tenant ${tenantId}:`, err.message);
    return false;
  }
}

/**
 * Dispatch real-time purchase log to merchant's Telegram channel or group
 */
export async function dispatchPurchaseLog(params: PurchaseLogParams): Promise<boolean> {
  const { tenantId, customerTelegramId, productName, planName, orderNumber, quantity, totalPriceUsd, viaReseller } = params;

  try {
    const tenant = db.prepare(`
      SELECT log_channel_id, log_purchases_enabled, bot_token 
      FROM tenants WHERE id = ?
    `).get(tenantId) as any;

    if (!tenant) return false;
    const channelId = tenant.log_channel_id?.trim();
    if (!channelId || tenant.log_purchases_enabled === 0) {
      return false; // Logging disabled or channel not configured
    }

    const bot = botRegistry.getBotInstance(tenantId);
    if (!bot) {
      console.warn(`[LogChannel] Bot instance not active for tenant ${tenantId}, skipping purchase log.`);
      return false;
    }

    const maskedUser = maskTelegramId(customerTelegramId);
    const cleanService = escapeHtml(productName.replace(/\{pe:\d+\}/gi, '').trim());
    const cleanPlan = escapeHtml((planName || productName).replace(/\{pe:\d+\}/gi, '').trim());
    const cleanOrderNo = escapeHtml(orderNumber);

    const lines = [
      `💥 <b>New Purchase!</b>`,
      ``,
      `📦 <b>Service:</b> ${cleanService}`,
      `👤 <b>By:</b> <code>${maskedUser}</code>`,
      `💎 <b>Plan:</b> ${cleanPlan}`,
      `🔮 <b>Order No.:</b> <code>${cleanOrderNo}</code>`,
      `QTY: ${quantity || 1}`,
    ];

    if (viaReseller) {
      lines.push(`🚀 <b>Via:</b> Reseller API`);
    }

    lines.push(`📈 <b>Total Purchase:</b> $${Number(totalPriceUsd).toFixed(2)} USDT`);

    const message = lines.join('\n');

    await bot.api.sendMessage(channelId, message, { parse_mode: 'HTML' });
    console.log(`[LogChannel] Dispatched purchase log for tenant ${tenantId} to channel ${channelId}`);
    return true;
  } catch (err: any) {
    console.warn(`[LogChannel] Failed to dispatch purchase log for tenant ${tenantId}:`, err.message);
    return false;
  }
}

/**
 * Send a verification test message to the specified or configured log channel
 */
export async function testLogChannelConnection(tenantId: string, customChannelId?: string): Promise<{ success: boolean; message: string }> {
  try {
    const tenant = db.prepare(`
      SELECT log_channel_id, bot_token, bot_username 
      FROM tenants WHERE id = ?
    `).get(tenantId) as any;

    if (!tenant) {
      return { success: false, message: 'Store not found' };
    }

    const channelId = (customChannelId || tenant.log_channel_id || '').trim();
    if (!channelId) {
      return { success: false, message: 'Channel or Group ID is required (e.g. @my_logs or -1001234567890)' };
    }

    const bot = botRegistry.getBotInstance(tenantId);
    if (!bot) {
      return { success: false, message: 'Your Telegram bot is not currently active. Please connect your bot token first.' };
    }

    const testMsg = [
      `⚡ <b>Test Notification from Store Bot</b>`,
      `✅ Log Channel connected successfully!`,
      `Order and deposit announcements will appear here in real-time.`,
      `🕒 <i>Time: ${new Date().toUTCString()}</i>`,
    ].join('\n');

    await bot.api.sendMessage(channelId, testMsg, { parse_mode: 'HTML' });
    return { success: true, message: `Test message successfully sent to ${channelId}!` };
  } catch (err: any) {
    const desc = err.description || err.message || 'Telegram API error';
    return {
      success: false,
      message: `Failed to send to channel: ${desc}. Make sure the bot is added as an Administrator in that channel/group with "Post Messages" permission.`,
    };
  }
}
