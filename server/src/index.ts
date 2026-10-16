import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initDatabase } from './db/database';
import { authRouter } from './routes/auth.routes';
import { merchantRouter } from './routes/merchant.routes';
import { godmodeRouter } from './routes/godmode.routes';
import { botRegistry } from '../../bot/src/registry';

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

  // Initialize and run all registered tenant Telegram bots
  await botRegistry.initAllActiveBots();
});
