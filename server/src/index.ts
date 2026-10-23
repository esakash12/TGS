import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initDatabase, db } from './db/database';
import { authRouter } from './routes/auth.routes';
import { merchantRouter } from './routes/merchant.routes';
import { godmodeRouter } from './routes/godmode.routes';
import { zinipayRouter, approveZinipayInvoice } from './routes/zinipay.routes';
import { botRegistry } from '../../bot/src/registry';
import { wholesaleSyncDaemon } from './modules/wholesale/sync-daemon';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.use(cors());
app.use(express.json());

// Initialize SQLite WAL Database
initDatabase();

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/merchant', merchantRouter);
app.use('/api/godmode', godmodeRouter);
app.use('/api/zinipay', zinipayRouter);

// Public Plans Endpoint (for Landing Page & Pricing)
app.get('/api/public/plans', (_req: Request, res: Response) => {
  try {
    const plans = db.prepare('SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order ASC').all() as any[];
    const formatted = plans.map((p) => {
      let features: string[] = [];
      try {
        features = JSON.parse(p.features_json || '[]');
      } catch (e) {
        features = [];
      }
      return {
        ...p,
        features_json: features,
        price_monthly_usd: Number(p.price_monthly_usd),
        price_yearly_usd: Number(p.price_yearly_usd),
        max_products: Number(p.max_products),
        max_resale_products: p.max_resale_products !== undefined && p.max_resale_products !== null ? Number(p.max_resale_products) : 5,
        max_custom_products: p.max_custom_products !== undefined && p.max_custom_products !== null ? Number(p.max_custom_products) : Number(p.max_products || 50),
      };
    });
    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch public plans: ' + err.message });
  }
});

// Telegram Webhook Endpoint for Multi-Bot Routing
app.post('/api/webhook/telegram/:slug', async (req: Request, res: Response) => {
  const slug = String(req.params.slug);
  const update = req.body;

  try {
    const handled = await botRegistry.handleWebhookUpdate(slug, update);
    if (!handled) {
      console.warn(`[Webhook] No active bot found for slug: ${slug}`);
    }
  } catch (err: any) {
    console.error(`[Webhook] Error dispatching update for slug ${slug}:`, err.message);
  }

  // Telegram always expects a 200 OK fast
  res.sendStatus(200);
});

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    memoryRssMb: (mem.rss / 1024 / 1024).toFixed(1),
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend static build if exists
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('{*path}', (req: Request, res: Response) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Bot by mogent API Server is online. Frontend client build not yet detected.');
    }
  });
});

// Start Server
app.listen(PORT, async () => {
  console.log(`
  ==============================================================
  🚀 Bot by mogent (bot.mogent.tech) Cloud Engine is LIVE!
  📡 Server Listening on Port: http://localhost:${PORT}
  🛡️ Secret God-Mode: http://localhost:${PORT}/secure/hkjhl/sadmin
  💾 Database: SQLite WAL High-Performance Engine
  ==============================================================
  `);

  // Start High-Frequency Wholesale Price & Stock Synchronization Engine (every 15s)
  wholesaleSyncDaemon.start(15);

  // Background Auto-Reconciliation Poller for ZiniPay Deposits (every 30 seconds)
  // Ensures any completed payment is credited even if the user closed the popup before redirect
  // or if the external webhook failed to reach the server.
  setInterval(async () => {
    try {
      const pendingDeposits = db.prepare(`
        SELECT trx_id FROM deposits 
        WHERE method = 'ZiniPay' 
          AND status = 'PENDING'
          AND created_at >= datetime('now', '-45 minutes')
        ORDER BY id DESC LIMIT 20
      `).all() as { trx_id: string }[];

      for (const row of pendingDeposits) {
        if (!row.trx_id) continue;
        try {
          await approveZinipayInvoice(row.trx_id);
        } catch (itemErr: any) {
          // ignore individual item verify errors
        }
      }
    } catch (pollErr: any) {
      // silent background poller catch
    }
  }, 30 * 1000);

  // Initialize and run all registered tenant Telegram bots
  await botRegistry.initAllActiveBots();
});
