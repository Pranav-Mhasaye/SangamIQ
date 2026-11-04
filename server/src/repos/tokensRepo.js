import { isMemory, query } from './db.js';
import { db } from '../data.js';

export async function saveRefreshToken(token, userId, expiresAt) {
  if (isMemory()) {
    db.refreshTokens.push({ token, userId, expiresAt });
    return;
  }

  const sql = `
    INSERT INTO refresh_tokens (token, user_id, expires_at, created_at)
    VALUES ($1, $2, to_timestamp($3 / 1000.0), now());
  `;
  await query(sql, [token, userId, expiresAt]);
}

export async function consumeRefreshToken(token) {
  if (isMemory()) {
    const idx = db.refreshTokens.findIndex(
      (r) => r.token === token && r.expiresAt > Date.now()
    );
    if (idx === -1) return null;
    const entry = db.refreshTokens[idx];
    db.refreshTokens.splice(idx, 1);
    return entry.userId;
  }

  const checkSql = `
    SELECT user_id AS "userId", expires_at
    FROM refresh_tokens
    WHERE token = $1 AND expires_at > now();
  `;
  const { rows } = await query(checkSql, [token]);
  if (!rows.length) return null;

  const userId = rows[0].userId;
  await query(`DELETE FROM refresh_tokens WHERE token = $1;`, [token]);
  return userId;
}

export async function revokeRefreshToken(token) {
  if (isMemory()) {
    const idx = db.refreshTokens.findIndex((r) => r.token === token);
    if (idx !== -1) db.refreshTokens.splice(idx, 1);
    return;
  }

  await query(`DELETE FROM refresh_tokens WHERE token = $1;`, [token]);
}
