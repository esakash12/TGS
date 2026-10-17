import { Bot, webhookCallback } from 'grammy';
import { db } from '../../server/src/db/database';
import { createBotEngine } from './engine';

export interface ActiveBotEntry {
  bot: Bot;
  tenantId: string;
  slug: string;
  username: string | null;
  startedAt: number;
}

export interface BotLaunchResult {
  success: boolean;
  username?: string;
  error?: string;
}

class DynamicBotRegistry {
  private activeBots = new Map<string, ActiveBotEntry>(); // keyed by tenantId
  private slugToTenantId = new Map<string, string>(); // for fast webhook routing

  /**
   * Initialize all active bots on server startup
   */
  public async initAllActiveBots() {
    console.log('🤖 [BotRegistry] Initializing active merchant bots...');
    const tenants = db.prepare(`
      SELECT id, slug, name, bot_token, status, subscription_status, subscription_expires_at FROM tenants 
      WHERE status = 'ACTIVE' 
        AND subscription_status = 'ACTIVE'
        AND (subscription_expires_at IS NULL OR datetime(subscription_expires_at) > datetime('now'))
        AND bot_token IS NOT NULL AND TRIM(bot_token) != ''
    `).all() as any[];

    for (const t of tenants) {
      try {
        const res = await this.loadBot(t.id, t.bot_token, t.slug);
        if (res.success) {
          console.log(`✅ [BotRegistry] Successfully launched bot @${res.username} for "${t.name}" (${t.slug})`);
        } else {
          console.warn(`⚠️ [BotRegistry] Could not launch bot for "${t.name}" (${t.slug}): ${res.error}`);
        }
      } catch (err: any) {
        console.error(`Failed to load bot for store "${t.name}" (${t.slug}):`, err.message);
      }
    }

    console.log(`🤖 [BotRegistry] Successfully running ${this.activeBots.size} Telegram bot instances.`);
  }

  /**
   * Load or replace a bot for a specific tenant
   */
  public async loadBot(tenantId: string, botToken: string, slug: string): Promise<BotLaunchResult> {
    // If bot already exists, stop it first
    await this.stopBot(tenantId);

    if (!botToken || botToken.trim() === '') {
      return { success: false, error: 'Bot token is empty' };
    }

    // Verify tenant account and active subscription status
    const tenant = db.prepare(`
      SELECT id, name, status, subscription_status, subscription_expires_at
      FROM tenants WHERE id = ?
    `).get(tenantId) as any;

    if (!tenant) {
      return { success: false, error: 'Store not found' };
    }

    if (tenant.status !== 'ACTIVE') {
      return { success: false, error: 'Store account is suspended' };
    }

    const isSubActive = tenant.subscription_status === 'ACTIVE' &&
      (!tenant.subscription_expires_at || new Date(tenant.subscription_expires_at).getTime() > Date.now());

    if (!isSubActive) {
      return {
        success: false,
        error: 'Merchant subscription is inactive or expired. Please activate your subscription with Binance Pay to launch your bot.'
      };
    }

    try {
      const cleanToken = botToken.trim();
      const bot = createBotEngine(tenantId, cleanToken);
      const botInfo = await bot.api.getMe();

      // Save bot username in DB if not set
      db.prepare('UPDATE tenants SET bot_username = ? WHERE id = ?').run(botInfo.username, tenantId);

      const entry: ActiveBotEntry = {
        bot,
        tenantId,
        slug,
        username: botInfo.username,
        startedAt: Date.now(),
      };

      this.activeBots.set(tenantId, entry);
      this.slugToTenantId.set(slug, tenantId);

      const appUrl = process.env.APP_URL || '';
      // Webhook mode is ONLY activated if explicitly requested AND not using default dummy domain
      const isWebhookMode = process.env.BOT_RUNNER_MODE === 'webhook' && 
                            Boolean(appUrl) && 
                            appUrl.startsWith('https://') && 
                            !appUrl.includes('bot.mogent.tech') && 
                            !appUrl.includes('localhost');

      bot.catch((err) => {
        console.error(`[@${botInfo.username || slug}] Bot unhandled error:`, err.message || err);
      });

      if (isWebhookMode) {
        try {
          const webhookUrl = `${appUrl}/api/webhook/telegram/${slug}`;
          await bot.api.setWebhook(webhookUrl);
          console.log(`🌐 [@${botInfo.username}] Webhook registered successfully: ${webhookUrl}`);
        } catch (webhookErr: any) {
          console.warn(`[BotRegistry] Webhook set failed for @${botInfo.username}, falling back to polling:`, webhookErr.message);
          await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
          bot.start({
            onStart: () => console.log(`🚀 [@${botInfo.username}] Polling fallback started for tenant: ${slug}`),
          }).catch(err => console.error(`[@${botInfo.username}] Polling error:`, err));
        }
      } else {
        // Polling mode: ALWAYS delete any existing webhook on Telegram servers to clear conflicts and receive getUpdates
        await bot.api.deleteWebhook({ drop_pending_updates: false }).catch((e) => {
          console.warn(`[BotRegistry] Notice clearing webhook for @${botInfo.username}:`, e.message);
        });
        bot.start({
          onStart: () => console.log(`🚀 [@${botInfo.username}] Long-polling LIVE and listening for updates (${slug})`),
        }).catch(err => console.error(`[@${botInfo.username}] Polling error:`, err));
      }

      return { success: true, username: botInfo.username };
    } catch (err: any) {
      console.error(`[BotRegistry] Error registering bot token for tenant ${tenantId}:`, err.message);
      return { success: false, error: err.message || 'Failed to authenticate with Telegram' };
    }
  }

  /**
   * Reload bot when merchant updates token or settings
   */
  public async reloadBot(tenantId: string): Promise<BotLaunchResult> {
    const tenant = db.prepare('SELECT id, slug, bot_token, status FROM tenants WHERE id = ?').get(tenantId) as any;
    if (!tenant || tenant.status === 'SUSPENDED') {
      await this.stopBot(tenantId);
      return { success: false, error: 'Store is inactive or suspended' };
    }
    if (!tenant.bot_token || tenant.bot_token.trim() === '') {
      await this.stopBot(tenantId);
      return { success: false, error: 'No bot token configured yet' };
    }
    return this.loadBot(tenant.id, tenant.bot_token, tenant.slug);
  }

  /**
   * Gracefully stop a running bot
   */
  public async stopBot(tenantId: string) {
    const existing = this.activeBots.get(tenantId);
    if (existing) {
      try {
        await existing.bot.stop();
      } catch (e) {
        // ignore stop errors
      }
      this.slugToTenantId.delete(existing.slug);
      this.activeBots.delete(tenantId);
      console.log(`🛑 [BotRegistry] Stopped bot for tenant ${tenantId}`);
    }
  }

  /**
   * Handle Webhook Update from Express router
   */
  public async handleWebhookUpdate(slug: string, update: any): Promise<boolean> {
    const tenantId = this.slugToTenantId.get(slug);
    if (!tenantId) return false;

    const entry = this.activeBots.get(tenantId);
    if (!entry) return false;

    try {
      await entry.bot.handleUpdate(update);
      return true;
    } catch (err: any) {
      console.error(`Webhook update error for @${entry.username}:`, err);
      return false;
    }
  }

  /**
   * Send direct notification to end customer
   */
  public async sendNotificationToCustomer(tenantId: string, telegramId: number, htmlMessage: string) {
    const entry = this.activeBots.get(tenantId);
    if (!entry) return false;

    try {
      await entry.bot.api.sendMessage(telegramId, htmlMessage, { parse_mode: 'HTML' });
      return true;
    } catch (err: any) {
      console.error(`Failed to send customer notification (${telegramId}):`, err.message);
      return false;
    }
  }

  /**
   * Get live status of a tenant's bot
   */
  public getBotStatus(tenantId: string) {
    const entry = this.activeBots.get(tenantId);
    return {
      is_online: Boolean(entry),
      bot_username: entry?.username || null,
      started_at: entry ? new Date(entry.startedAt).toISOString() : null,
    };
  }

  /**
   * Get direct bot instance for a tenant
   */
  public getBotInstance(tenantId: string): Bot | null {
    const entry = this.activeBots.get(tenantId);
    return entry ? entry.bot : null;
  }
}

export const botRegistry = new DynamicBotRegistry();
