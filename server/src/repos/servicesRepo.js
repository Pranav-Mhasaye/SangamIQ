import { isMemory, query } from './db.js';
import { db } from '../data.js';
import { distanceM, etaMin } from '../geo.js';
import { matchVolunteersInDb, matchVolunteersInMemory } from './volunteersRepo.js';

export async function nearestServices(type, pos, limit = 50) {
  if (isMemory()) {
    return db.services
      .filter((s) => !type || s.type === type)
      .map((s) => {
        const d = distanceM(pos, s);
        return { ...s, distanceM: d, etaMin: etaMin(d) };
      })
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, limit);
  }

  const sql = `
    SELECT
      id, type, name, name_mr, name_hi, operator, hours, services, verified,
      ST_Y(geom::geometry) AS lat,
      ST_X(geom::geometry) AS lng,
      ROUND(ST_Distance(geom, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)) AS "distanceM"
    FROM services
    WHERE ($3::text IS NULL OR type = $3)
    ORDER BY geom <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
    LIMIT $4;
  `;

  const { rows } = await query(sql, [pos.lat, pos.lng, type || null, limit]);
  return rows.map((r) => ({
    ...r,
    distanceM: Number(r.distanceM),
    etaMin: Math.ceil(Number(r.distanceM) / 75) || 1,
  }));
}

export async function getServiceById(id, pos) {
  if (isMemory()) {
    const s = db.services.find((x) => x.id === id);
    if (!s) return null;
    const d = distanceM(pos, s);
    const contact = matchVolunteersInMemory(s.type, s, 1)[0] || null;
    return { ...s, distanceM: d, etaMin: etaMin(d), contact };
  }

  const sql = `
    SELECT
      id, type, name, name_mr, name_hi, operator, hours, services, verified,
      ST_Y(geom::geometry) AS lat,
      ST_X(geom::geometry) AS lng,
      ROUND(ST_Distance(geom, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)) AS "distanceM"
    FROM services
    WHERE id = $3;
  `;

  const { rows } = await query(sql, [pos.lat, pos.lng, id]);
  if (!rows.length) return null;

  const s = rows[0];
  const d = Number(s.distanceM);
  const contacts = await matchVolunteersInDb(s.type, s, 1);
  return {
    ...s,
    distanceM: d,
    etaMin: Math.ceil(d / 75) || 1,
    contact: contacts[0] || null,
  };
}
