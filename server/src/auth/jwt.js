// JWT access + refresh token utilities.
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { saveRefreshToken, consumeRefreshToken, revokeRefreshToken } from '../repos/tokensRepo.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sangamiq-dev-secret-change-in-production';
const ACCESS_TTL = '15m';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------- Access tokens ----------

export function signAccess(user) {
  const payload = {
    sub: user.id,
    role: user.role,
    name: user.name,
    phone: user.phone || undefined,
    email: user.email || undefined,
    volunteerId: user.volunteerId || undefined,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

export function verifyAccess(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ---------- Refresh tokens ----------

export async function createRefresh(userId) {
  const token = randomUUID();
  const expiresAt = Date.now() + REFRESH_TTL_MS;
  await saveRefreshToken(token, userId, expiresAt);
  return token;
}

export async function consumeRefresh(token) {
  return consumeRefreshToken(token);
}

export async function revokeRefresh(token) {
  return revokeRefreshToken(token);
}

// Cookie helpers
export const REFRESH_COOKIE = 'siq_refresh';

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TTL_MS,
    path: '/api/auth',
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}
