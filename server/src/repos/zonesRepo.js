import { isMemory, query } from './db.js';
import { db } from '../data.js';

// In-memory zone history tracker for trend forecast
const zoneHistories = new Map();

export async function getAllZones() {
  if (isMemory()) {
    return db.zones;
  }

  const sql = `
    SELECT
      id, name, name_mr, name_hi, capacity, radius, base, density, surge,
      last_alert_at AS "lastAlertAt",
      ST_Y(geom::geometry) AS lat,
      ST_X(geom::geometry) AS lng
    FROM crowd_zones
    ORDER BY id ASC;
  `;

  const { rows } = await query(sql);
  return rows.map((r) => {
    let history = zoneHistories.get(r.id);
    if (!history) {
      history = Array(6).fill(r.density || r.base);
      zoneHistories.set(r.id, history);
    }
    return {
      ...r,
      lat: Number(r.lat),
      lng: Number(r.lng),
      density: Number(r.density),
      history,
    };
  });
}

export async function getZoneById(id) {
  if (isMemory()) {
    return db.zones.find((z) => z.id === id) || null;
  }

  const sql = `
    SELECT
      id, name, name_mr, name_hi, capacity, radius, base, density, surge,
      last_alert_at AS "lastAlertAt",
      ST_Y(geom::geometry) AS lat,
      ST_X(geom::geometry) AS lng
    FROM crowd_zones
    WHERE id = $1;
  `;
  const { rows } = await query(sql, [id]);
  if (!rows.length) return null;
  const r = rows[0];
  let history = zoneHistories.get(r.id) || Array(6).fill(r.density || r.base);
  return {
    ...r,
    lat: Number(r.lat),
    lng: Number(r.lng),
    density: Number(r.density),
    history,
  };
}

export async function saveZoneDensity(zoneId, density) {
  if (isMemory()) {
    const z = db.zones.find((x) => x.id === zoneId);
    if (z) z.density = density;
    return;
  }

  try {
    await query(
      `UPDATE crowd_zones SET density = $2 WHERE id = $1;`,
      [zoneId, density]
    );
    await query(
      `INSERT INTO crowd_samples (zone_id, density, at) VALUES ($1, $2, now());`,
      [zoneId, density]
    );
  } catch (err) {
    console.warn(`Failed to persist crowd sample for zone ${zoneId}:`, err.message);
  }
}

export async function surgeZoneInDb(id, ticks = 14) {
  if (isMemory()) {
    const z = db.zones.find((x) => x.id === id);
    if (!z) return null;
    z.surge = ticks;
    z.lastAlertAt = 0;
    return z;
  }

  const { rows } = await query(
    `UPDATE crowd_zones
     SET surge = $2, last_alert_at = 0
     WHERE id = $1
     RETURNING id, name, density, surge;`,
    [id, ticks]
  );
  return rows[0] || null;
}

export async function updateZoneSurgeAndAlert(id, surge, lastAlertAt) {
  if (isMemory()) {
    const z = db.zones.find((x) => x.id === id);
    if (z) {
      if (surge !== undefined) z.surge = surge;
      if (lastAlertAt !== undefined) z.lastAlertAt = lastAlertAt;
    }
    return;
  }

  await query(
    `UPDATE crowd_zones
     SET surge = COALESCE($2, surge),
         last_alert_at = COALESCE($3, last_alert_at)
     WHERE id = $1;`,
    [id, surge, lastAlertAt]
  );
}
