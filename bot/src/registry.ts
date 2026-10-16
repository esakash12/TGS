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

class DynamicBotRegistry {
  private activeBots = new Map<string, ActiveBotEntry>(); // keyed by tenantId
  private slugToTenantId = new Map<string, string>(); // for fast webhook routing

  /**
   * Initialize all active bots on server startup
   */
  public async initAllActiveBots() {
    console.log('🤖 [BotRegistry] Initializing active merchant bots...');
    const tenants = db.prepare(`
      SELECT id, slug, name, bot_token, status FROM tenants 
      WHERE status = 'ACTIVE' AND bot_token IS NOT NULL AND TRIM(bot_token) != ''
    `).all() as any[];

    for (const t of tenants) {
      try {
        await this.loadBot(t.id, t.bot_token, t.slug);
      } catch (err: any) {
        console.error(`Failed to load bot for store "${t.name}" (${t.slug}):`, err.message);
      }
    }

    console.log(`🤖 [BotRegistry] Successfully running ${this.activeBots.size} Telegram bot instances.`);
  }

  /**
   * Load or replace a bot for a specific tenant
   */
  public async loadBot(tenantId: string, botToken: string, slug: string): Promise<boolean> {
    // If bot already exists, stop it first
    await this.stopBot(tenantId);

    if (!botToken || botToken.trim() === '') {
      return false;
    }

    try {
      const bot = createBotEngine(tenantId, botToken.trim());
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

      const appUrl = process.env.APP_URL || (process.env.APP_DOMAIN ? `https://${process.env.APP_DOMAIN}` : '');
      const isWebhookMode = process.env.BOT_RUNNER_MODE !== 'polling' && Boolean(appUrl) && appUrl.startsWith('https://');

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
        // Polling mode: always clear any webhook registered on Telegram to prevent 409 Conflict
        await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => {});
        bot.start({
          onStart: () => console.log(`🚀 [@${botInfo.username}] Long-polling started for tenant: ${slug}`),
        }).catch(err => console.error(`[@${botInfo.username}] Polling error:`, err));
      }

      return true;
    } catch (err: any) {
      console.error(`[BotRegistry] Error registering bot token for tenant ${tenantId}:`, err.message);
      return false;
    }
  }

  /**
   * Reload bot when merchant updates token or settings
   */
  public async reloadBot(tenantId: string): Promise<boolean> {
    const tenant = db.prepare('SELECT id, slug, bot_token, status FROM tenants WHERE id = ?').get(tenantId) as any;
    if (!tenant || tenant.status === 'SUSPENDED' || !tenant.bot_token) {
      await this.stopBot(tenantId);
      return false;
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
}

export const botRegistry = new DynamicBotRegistry();
