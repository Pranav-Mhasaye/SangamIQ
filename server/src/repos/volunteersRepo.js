import { isMemory, query } from './db.js';
import { db } from '../data.js';
import { distanceM, etaMin } from '../geo.js';

export function matchVolunteersInMemory(type, pos, limit = 3, critical = false) {
  return db.volunteers
    .filter((v) => v.online && v.verified && v.status === 'approved')
    .map((v) => {
      const d = distanceM(pos, v);
      const directFit = v.skills.includes(type) || (type === 'medical' && v.skills.includes('first-aid'));
      const medicalFit = critical && (v.skills.includes('medical') || v.skills.includes('first-aid'));
      const skillFit = directFit || medicalFit;
      const skillPenalty = directFit ? 0 : (medicalFit ? 150 : 600);
      const busy = v.activeRequestId ? 400 : 0;
      const score = d + skillPenalty + busy;
      return { volunteerId: v.id, name: v.name, phone: v.phone, distanceM: d, etaMin: etaMin(d), skillFit, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ score, ...rest }) => rest);
}

export async function matchVolunteersInDb(type, pos, limit = 3, critical = false) {
  const sql = `
    WITH candidates AS (
      SELECT
        id AS "volunteerId",
        name,
        phone,
        skills,
        ST_Y(geom::geometry) AS lat,
        ST_X(geom::geometry) AS lng,
        ST_Distance(geom, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS "dist",
        active_request_id,
        (
          $3::text = ANY(skills) OR ($3::text = 'medical' AND 'first-aid' = ANY(skills))
        ) AS direct_fit,
        (
          $4::boolean = TRUE AND ('medical' = ANY(skills) OR 'first-aid' = ANY(skills))
        ) AS medical_fit
      FROM volunteers
      WHERE online = TRUE AND verified = TRUE AND status = 'approved' AND geom IS NOT NULL
      ORDER BY geom <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      LIMIT 30
    )
    SELECT
      "volunteerId",
      name,
      phone,
      ROUND("dist")::int AS "distanceM",
      GREATEST(1, CEIL("dist" / 75.0))::int AS "etaMin",
      (direct_fit OR medical_fit) AS "skillFit",
      (
        "dist" + 
        CASE WHEN direct_fit THEN 0 WHEN medical_fit THEN 150 ELSE 600 END + 
        CASE WHEN active_request_id IS NOT NULL THEN 400 ELSE 0 END
      ) AS score
    FROM candidates
    ORDER BY score ASC
    LIMIT $5;
  `;

  const { rows } = await query(sql, [pos.lat, pos.lng, type || '', Boolean(critical), limit]);
  return rows.map(({ score, ...rest }) => ({
    ...rest,
    distanceM: Number(rest.distanceM),
    etaMin: Number(rest.etaMin),
    skillFit: Boolean(rest.skillFit),
  }));
}

export async function matchVolunteers(type, pos, limit = 3, critical = false) {
  if (isMemory()) {
    return matchVolunteersInMemory(type, pos, limit, critical);
  }
  return matchVolunteersInDb(type, pos, limit, critical);
}

export async function getAllVolunteers() {
  if (isMemory()) {
    return db.volunteers;
  }

  const sql = `
    SELECT
      id, name, phone, skills, verified, status, online, active_request_id AS "activeRequestId",
      ST_Y(geom::geometry) AS lat,
      ST_X(geom::geometry) AS lng,
      updated_at AS "updatedAt"
    FROM volunteers
    ORDER BY name ASC;
  `;
  const { rows } = await query(sql);
  return rows.map((r) => ({
    ...r,
    lat: r.lat ? Number(r.lat) : 18.6764,
    lng: r.lng ? Number(r.lng) : 73.8977,
  }));
}

export async function getVolunteerById(id) {
  if (isMemory()) {
    return db.volunteers.find((v) => v.id === id) || null;
  }

  const sql = `
    SELECT
      id, name, phone, skills, verified, status, online, active_request_id AS "activeRequestId",
      ST_Y(geom::geometry) AS lat,
      ST_X(geom::geometry) AS lng,
      updated_at AS "updatedAt"
    FROM volunteers
    WHERE id = $1;
  `;
  const { rows } = await query(sql, [id]);
  if (!rows.length) return null;
  const r = rows[0];
  return {
    ...r,
    lat: r.lat ? Number(r.lat) : 18.6764,
    lng: r.lng ? Number(r.lng) : 73.8977,
  };
}

export async function updateVolunteer(id, patch) {
  if (isMemory()) {
    const v = db.volunteers.find((x) => x.id === id);
    if (!v) return null;
    if (typeof patch.online === 'boolean') v.online = patch.online;
    if (typeof patch.verified === 'boolean') v.verified = patch.verified;
    if (patch.status) v.status = patch.status;
    if (patch.activeRequestId !== undefined) v.activeRequestId = patch.activeRequestId;
    if (Number.isFinite(patch.lat) && Number.isFinite(patch.lng)) {
      v.lat = patch.lat;
      v.lng = patch.lng;
    }
    return v;
  }

  const current = await getVolunteerById(id);
  if (!current) return null;

  const newOnline = typeof patch.online === 'boolean' ? patch.online : current.online;
  const newVerified = typeof patch.verified === 'boolean' ? patch.verified : current.verified;
  const newStatus = patch.status || current.status;
  const newActiveReq = patch.activeRequestId !== undefined ? patch.activeRequestId : current.activeRequestId;
  const newLat = Number.isFinite(patch.lat) ? patch.lat : current.lat;
  const newLng = Number.isFinite(patch.lng) ? patch.lng : current.lng;

  const sql = `
    UPDATE volunteers
    SET
      online = $2,
      verified = $3,
      status = $4,
      active_request_id = $5,
      geom = ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography,
      updated_at = now()
    WHERE id = $1
    RETURNING
      id, name, phone, skills, verified, status, online, active_request_id AS "activeRequestId",
      ST_Y(geom::geometry) AS lat,
      ST_X(geom::geometry) AS lng,
      updated_at AS "updatedAt";
  `;

  const { rows } = await query(sql, [id, newOnline, newVerified, newStatus, newActiveReq, newLat, newLng]);
  const r = rows[0];
  return {
    ...r,
    lat: Number(r.lat),
    lng: Number(r.lng),
  };
}

export async function createVolunteer(vol) {
  if (isMemory()) {
    db.volunteers.push(vol);
    return vol;
  }

  const sql = `
    INSERT INTO volunteers (id, name, phone, skills, verified, status, online, active_request_id, geom)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_MakePoint($10, $9), 4326)::geography)
    RETURNING
      id, name, phone, skills, verified, status, online, active_request_id AS "activeRequestId",
      ST_Y(geom::geometry) AS lat,
      ST_X(geom::geometry) AS lng,
      updated_at AS "updatedAt";
  `;

  const { rows } = await query(sql, [
    vol.id,
    vol.name,
    vol.phone,
    vol.skills || [],
    Boolean(vol.verified),
    vol.status || 'pending',
    Boolean(vol.online),
    vol.activeRequestId || null,
    vol.lat || 18.6764,
    vol.lng || 73.8977,
  ]);
  const r = rows[0];
  return {
    ...r,
    lat: Number(r.lat),
    lng: Number(r.lng),
  };
}
