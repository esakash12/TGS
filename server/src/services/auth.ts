import jwt from 'jsonwebtoken';
import { db } from '../db/database';
import { hashPassword, comparePassword, decrypt } from './crypto';
import { AdminUser, Tenant, AuthResponse } from '../../../shared/types';
import { DEFAULT_USD_TO_BDT_RATE } from '../../../shared/constants';

const JWT_SECRET = process.env.JWT_SECRET || 'mogent-jwt-secret-key-2026-production-token';

export interface TokenPayload {
  userId: number;
  tenantId: string | null;
  username: string;
  role: 'super_admin' | 'merchant_admin';
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (err) {
    return null;
  }
}

export async function registerMerchant(params: {
  storeName: string;
  slug: string;
  ownerEmail: string;
  password: string;
  botToken?: string;
}): Promise<AuthResponse> {
  const { storeName, slug, ownerEmail, password, botToken } = params;

  // Validate slug uniqueness
  const existingTenant = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);
  if (existingTenant) {
    throw new Error('Store subdomain/slug is already taken. Please choose another.');
  }

  // Validate email/username
  const existingUser = db.prepare('SELECT id FROM admin_users WHERE email = ? OR username = ?').get(ownerEmail, slug);
  if (existingUser) {
    throw new Error('An account with this email or store slug already exists.');
  }

  const tenantId = 'tnt_' + Math.random().toString(36).substring(2, 10);
  const passwordHash = await hashPassword(password);

  // Run atomic creation inside transaction
  const createTx = db.transaction(() => {
    // 1. Create clean tenant with 7-day free trial
    db.prepare(`
      INSERT INTO tenants (
        id, name, slug, owner_email, bot_token, plan_id, status,
        wallet_usd, usd_to_bdt_rate, global_markup_pct, global_markup_fixed_usd, auto_markup_enabled,
        subscription_cycle, subscription_status, subscription_started_at, subscription_expires_at, trial_ends_at
      ) VALUES (?, ?, ?, ?, ?, 'starter', 'ACTIVE', 0.0, ?, 20.0, 0.50, 1, 'MONTHLY', 'TRIAL', CURRENT_TIMESTAMP, datetime('now', '+7 days'), datetime('now', '+7 days'))
    `).run(tenantId, storeName, slug, ownerEmail, botToken || null, DEFAULT_USD_TO_BDT_RATE);

    // 2. Create merchant admin user
    const userResult = db.prepare(`
      INSERT INTO admin_users (tenant_id, username, email, password_hash, role)
      VALUES (?, ?, ?, ?, 'merchant_admin')
    `).run(tenantId, slug, ownerEmail, passwordHash);

    const userId = Number(userResult.lastInsertRowid);
    return { userId, tenantId };
  });

  const { userId } = createTx();

  const user = db.prepare('SELECT id, username, email, role, tenant_id FROM admin_users WHERE id = ?').get(userId) as any;
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId) as any;

  // Parse JSON fields safely
  if (tenant) {
    try {
      tenant.payment_numbers_json = JSON.parse(tenant.payment_numbers_json || '{}');
    } catch (e) {
      tenant.payment_numbers_json = {};
    }
    try {
      const decBinance = decrypt(tenant.binance_config_json_enc);
      tenant.binance_config_json = JSON.parse(decBinance || '{}');
    } catch (e) {
      tenant.binance_config_json = {};
    }
  }

  const token = signToken({
    userId: user.id,
    tenantId: user.tenant_id,
    username: user.username,
    role: user.role,
  });

  return { token, user, tenant };
}

export async function loginMerchant(identifier: string, password: string): Promise<AuthResponse> {
  // Allow login by either email or username
  const user = db.prepare(`
    SELECT * FROM admin_users WHERE email = ? OR username = ?
  `).get(identifier, identifier) as AdminUser | undefined;

  if (!user) {
    throw new Error('Invalid email/username or password');
  }

  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    throw new Error('Invalid email/username or password');
  }

  let tenant: Tenant | undefined;
  if (user.tenant_id) {
    const rawTenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(user.tenant_id) as any;
    if (rawTenant) {
      if (rawTenant.status === 'SUSPENDED') {
        throw new Error('This store has been suspended. Please contact platform administration.');
      }
      try {
        rawTenant.payment_numbers_json = JSON.parse(rawTenant.payment_numbers_json || '{}');
      } catch (e) {
        rawTenant.payment_numbers_json = {};
      }
      try {
        const decBinance = decrypt(rawTenant.binance_config_json_enc);
        rawTenant.binance_config_json = JSON.parse(decBinance || '{}');
      } catch (e) {
        rawTenant.binance_config_json = {};
      }
      tenant = rawTenant;
    }
  }

  const token = signToken({
    userId: user.id,
    tenantId: user.tenant_id,
    username: user.username,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
    },
    tenant,
  };
}
