import { Router, Request, Response } from 'express';
import { registerMerchant, loginMerchant } from '../services/auth';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { db } from '../db/database';
import { decrypt } from '../services/crypto';
import { botRegistry } from '../../../bot/src/registry';

export const authRouter = Router();

// 1. Merchant Registration (Clean default state)
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { storeName, slug, ownerEmail, password, botToken } = req.body;

    if (!storeName || !slug || !ownerEmail || !password) {
      return res.status(400).json({ error: 'Store name, slug, email, and password are required.' });
    }

    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
    if (cleanSlug.length < 3) {
      return res.status(400).json({ error: 'Store slug must be at least 3 characters long (letters and numbers only).' });
    }

    const result = await registerMerchant({
      storeName: storeName.trim(),
      slug: cleanSlug,
      ownerEmail: ownerEmail.trim().toLowerCase(),
      password,
      botToken: botToken ? botToken.trim() : undefined,
    });

    // If bot token is supplied during registration, start it immediately
    if (botToken && botToken.trim() && result.tenant?.id) {
      botRegistry.loadBot(result.tenant.id, botToken.trim(), cleanSlug).catch(err => {
        console.error(`[Register] Failed to launch bot for new tenant ${cleanSlug}:`, err.message);
      });
    }

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

// 2. Merchant Login (Supports Email OR Username)
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter your email/username and password.' });
    }

    const result = await loginMerchant(identifier.trim(), password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Login failed' });
  }
});

// 3. Current User Session Check
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = db.prepare('SELECT id, username, email, role, tenant_id FROM admin_users WHERE id = ?').get(req.user.userId) as any;
  let tenant = null;

  if (user?.tenant_id) {
    const raw = db.prepare('SELECT * FROM tenants WHERE id = ?').get(user.tenant_id) as any;
    if (raw) {
      try {
        raw.payment_numbers_json = JSON.parse(raw.payment_numbers_json || '{}');
      } catch (e) {
        raw.payment_numbers_json = {};
      }
      try {
        const decryptedBinance = decrypt(raw.binance_config_json_enc);
        raw.binance_config_json = JSON.parse(decryptedBinance || '{}');
      } catch (e) {
        raw.binance_config_json = {};
      }
      tenant = raw;
    }
  }

  res.json({ user, tenant });
});
