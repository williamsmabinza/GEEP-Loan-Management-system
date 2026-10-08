import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { UserRole } from '../../shared/types/index.js';
import { getPermissionsForRole } from '../../shared/constants/roles.js';

export interface JwtUserPayload {
  userId: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  permissions?: string[];
}

export function generateAccessToken(payload: Omit<JwtUserPayload, 'permissions'> & { permissions?: string[] }): string {
  const permissions = payload.permissions || getPermissionsForRole(payload.role);
  return jwt.sign(
    {
      ...payload,
      permissions,
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn, // e.g., "8h" or "15m" in prod
      issuer: 'nexa-lms-auth',
    } as jwt.SignOptions
  );
}

export function generateRefreshToken(userId: string): { token: string; hash: string } {
  // Generate random 64-byte hex token for high-entropy refresh token
  const rawToken = crypto.randomBytes(40).toString('hex');
  const hash = hashToken(rawToken);
  return { token: rawToken, hash };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateResetToken(): { token: string; hash: string; expiresAt: Date } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour validity
  return { token: rawToken, hash, expiresAt };
}

export function verifyAccessToken(token: string): JwtUserPayload {
  return jwt.verify(token, config.jwt.secret, {
    issuer: 'nexa-lms-auth',
  }) as JwtUserPayload;
}
