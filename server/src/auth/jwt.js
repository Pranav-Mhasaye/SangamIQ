// JWT access + refresh token utilities.
// Access tokens: short-lived (15 min), carried in Authorization header.
// Refresh tokens: longer-lived (7 days), stored as httpOnly cookie + in-memory map.

import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { db } from '../data.js';

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

// ---------- Refresh tokens (opaque UUIDs, stored in-memory) ----------

export function createRefresh(userId) {
  const token = randomUUID();
  const expiresAt = Date.now() + REFRESH_TTL_MS;
  db.refreshTokens.push({ token, userId, expiresAt });
  return token;
}

export function consumeRefresh(token) {
  const idx = db.refreshTokens.findIndex((r) => r.token === token && r.expiresAt > Date.now());
  if (idx === -1) return null;
  const entry = db.refreshTokens[idx];
  // Rotate: remove old token (a new one will be issued)
  db.refreshTokens.splice(idx, 1);
  return entry.userId;
}

export function revokeRefresh(token) {
  const idx = db.refreshTokens.findIndex((r) => r.token === token);
  if (idx !== -1) db.refreshTokens.splice(idx, 1);
}

// Periodic cleanup (called from seed or on interval)
export function cleanupExpiredTokens() {
  const now = Date.now();
  db.refreshTokens = db.refreshTokens.filter((r) => r.expiresAt > now);
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

