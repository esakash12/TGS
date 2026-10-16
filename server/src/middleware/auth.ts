import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../services/auth';
import { db } from '../db/database';
import { GODMODE_SECRET_TOKEN } from '../../../shared/constants';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  tenant?: any;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. No Bearer token provided.' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session. Please login again.' });
  }

  req.user = payload;

  if (payload.tenantId) {
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(payload.tenantId) as any;
    if (tenant) {
      if (tenant.status === 'SUSPENDED') {
        return res.status(403).json({ error: 'Your merchant account has been suspended by administration.' });
      }
      req.tenant = tenant;
    }
  }

  next();
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Check secret token header or query parameter
  const secretHeader = req.headers['x-godmode-token'] || req.query.token;
  if (secretHeader === GODMODE_SECRET_TOKEN) {
    return next();
  }

  // Alternatively check JWT super_admin role
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const payload = verifyToken(authHeader.split(' ')[1]);
    if (payload && payload.role === 'super_admin') {
      req.user = payload;
      return next();
    }
  }

  return res.status(403).json({ error: 'Access denied. God-Mode secret authentication failed.' });
}
