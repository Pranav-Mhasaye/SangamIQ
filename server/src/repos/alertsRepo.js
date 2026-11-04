import { isMemory, query } from './db.js';
import { db, uid } from '../data.js';
import { broadcast } from '../bus.js';

export async function getAllAlerts(limit = 50) {
  if (isMemory()) {
    return db.alerts.slice(0, limit);
  }

  const sql = `
    SELECT
      id, level, zone_id AS zone, title, messages, auto,
      created_at AS "createdAt"
    FROM alerts
    ORDER BY created_at DESC
    LIMIT $1;
  `;

  const { rows } = await query(sql, [limit]);
  return rows.map((r) => ({
    ...r,
    createdAt: new Date(r.createdAt).toISOString(),
  }));
}

export async function createAlert({
  id = null,
  level = 'info',
  zone = null,
  title,
  message,
  hi,
  mr,
  messages = null,
  auto = false,
}) {
  const alertId = id || uid('alt');
  const nowIso = new Date().toISOString();
  const alertMessages = messages || {
    en: String(message || '').slice(0, 300),
    hi: String(hi || message || '').slice(0, 300),
    mr: String(mr || message || '').slice(0, 300),
  };

  const alertObj = {
    id: alertId,
    level: ['info', 'warning', 'emergency'].includes(level) ? level : 'info',
    zone: zone || null,
    auto: Boolean(auto),
    createdAt: nowIso,
    title: String(title).slice(0, 80),
    messages: alertMessages,
  };

  if (isMemory()) {
    db.alerts.unshift(alertObj);
  } else {
    const sql = `
      INSERT INTO alerts (id, level, zone_id, title, messages, auto, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      RETURNING id, level, zone_id AS zone, title, messages, auto, created_at AS "createdAt";
    `;
    await query(sql, [
      alertObj.id,
      alertObj.level,
      alertObj.zone,
      alertObj.title,
      JSON.stringify(alertObj.messages),
      alertObj.auto,
    ]);
  }

  broadcast('alert:new', alertObj);
  return alertObj;
}
