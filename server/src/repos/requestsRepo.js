import { isMemory, query } from './db.js';
import { db, uid } from '../data.js';
import { distanceM, etaMin } from '../geo.js';
import { matchVolunteers } from './volunteersRepo.js';
import { nearestServices } from './servicesRepo.js';
import { broadcast } from '../bus.js';

export async function enrichRequest(r) {
  if (!r) return null;

  let volunteer = null;
  if (r.acceptedBy) {
    if (isMemory()) {
      volunteer = db.volunteers.find((v) => v.id === r.acceptedBy) || null;
    } else {
      const { rows } = await query(
        `SELECT id, name, phone, skills, verified, status, online, active_request_id AS "activeRequestId",
                ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
         FROM volunteers WHERE id = $1`,
        [r.acceptedBy]
      );
      if (rows.length) {
        volunteer = {
          ...rows[0],
          lat: Number(rows[0].lat),
          lng: Number(rows[0].lng),
        };
      }
    }
  }

  const matched =
    r.status === 'open'
      ? await matchVolunteers(r.type, { lat: r.lat, lng: r.lng }, 3, r.priority === 'critical')
      : r.matched || [];

  return {
    ...r,
    volunteer,
    matched,
  };
}

export async function createHelpRequest({
  type,
  lat,
  lng,
  note = '',
  language = 'en',
  channel = 'app',
  emergency = false,
  name = '',
  priority,
  deviceId = null,
  userId = null,
}) {
  const chosenType = type || (emergency ? 'medical' : null);
  const critical = Boolean(emergency) || (note && note.toLowerCase().includes('emergency'));
  const finalPriority = priority || (critical ? 'critical' : chosenType === 'medical' ? 'high' : 'normal');
  const pos = { lat: Number(lat) || 18.6764, lng: Number(lng) || 73.8977 };
  const id = uid('req');
  const nowIso = new Date().toISOString();

  const matched = await matchVolunteers(chosenType, pos, 3, critical);
  const nearestList = await nearestServices(chosenType, pos, 1);
  const nearestService = nearestList[0] || null;

  const reqObj = {
    id,
    type: chosenType,
    ...pos,
    note: String(note).slice(0, 280),
    language,
    channel,
    requester: String(name).slice(0, 60),
    priority: finalPriority,
    status: 'open',
    createdAt: nowIso,
    acceptedBy: null,
    acceptedAt: null,
    completedAt: null,
    deviceId: deviceId || null,
    userId: userId || null,
    matched,
    nearestService,
  };

  if (isMemory()) {
    db.requests.unshift(reqObj);
  } else {
    const sql = `
      INSERT INTO help_requests (
        id, type, priority, status, channel, language, note, requester,
        user_id, device_id, geom, created_at
      ) VALUES (
        $1, $2, $3, 'open', $4, $5, $6, $7,
        $8, $9, ST_SetSRID(ST_MakePoint($11, $10), 4326)::geography, now()
      );
    `;
    await query(sql, [
      id,
      chosenType,
      finalPriority,
      channel,
      language,
      reqObj.note,
      reqObj.requester,
      userId,
      deviceId,
      pos.lat,
      pos.lng,
    ]);
  }

  const enriched = await enrichRequest(reqObj);
  broadcast('request:new', enriched);
  return enriched;
}

export async function getHelpRequestById(id) {
  if (isMemory()) {
    const r = db.requests.find((x) => x.id === id);
    if (!r) return null;
    return enrichRequest(r);
  }

  const sql = `
    SELECT
      id, type, priority, status, channel, language, note, requester,
      user_id AS "userId", device_id AS "deviceId", accepted_by AS "acceptedBy",
      ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng,
      created_at AS "createdAt", accepted_at AS "acceptedAt", completed_at AS "completedAt"
    FROM help_requests
    WHERE id = $1;
  `;
  const { rows } = await query(sql, [id]);
  if (!rows.length) return null;

  const r = {
    ...rows[0],
    lat: Number(rows[0].lat),
    lng: Number(rows[0].lng),
    createdAt: new Date(rows[0].createdAt).toISOString(),
    acceptedAt: rows[0].acceptedAt ? new Date(rows[0].acceptedAt).toISOString() : null,
    completedAt: rows[0].completedAt ? new Date(rows[0].completedAt).toISOString() : null,
  };

  const nearestList = await nearestServices(r.type, { lat: r.lat, lng: r.lng }, 1);
  r.nearestService = nearestList[0] || null;

  return enrichRequest(r);
}

export async function listHelpRequests({ status, volunteerId } = {}) {
  let list = [];

  if (isMemory()) {
    list = await Promise.all(db.requests.map((r) => enrichRequest(r)));
  } else {
    let sql = `
      SELECT
        id, type, priority, status, channel, language, note, requester,
        user_id AS "userId", device_id AS "deviceId", accepted_by AS "acceptedBy",
        ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng,
        created_at AS "createdAt", accepted_at AS "acceptedAt", completed_at AS "completedAt"
      FROM help_requests
    `;
    const params = [];
    if (status) {
      const statuses = status.split(',');
      params.push(statuses);
      sql += ` WHERE status = ANY($1)`;
    }
    sql += ` ORDER BY created_at DESC;`;

    const { rows } = await query(sql, params);
    list = await Promise.all(
      rows.map(async (row) => {
        const item = {
          ...row,
          lat: Number(row.lat),
          lng: Number(row.lng),
          createdAt: new Date(row.createdAt).toISOString(),
          acceptedAt: row.acceptedAt ? new Date(row.acceptedAt).toISOString() : null,
          completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
        };
        return enrichRequest(item);
      })
    );
  }

  if (volunteerId) {
    let me = null;
    if (isMemory()) {
      me = db.volunteers.find((v) => v.id === volunteerId);
    } else {
      const { rows } = await query(
        `SELECT id, name, phone, ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
         FROM volunteers WHERE id = $1`,
        [volunteerId]
      );
      if (rows.length) {
        me = { ...rows[0], lat: Number(rows[0].lat), lng: Number(rows[0].lng) };
      }
    }

    if (me) {
      list = list.map((r) => {
        const d = distanceM(me, r);
        const matchedToMe = Array.isArray(r.matched) && r.matched.some((m) => m.volunteerId === me.id);
        return {
          ...r,
          distanceM: d,
          etaMin: etaMin(d),
          matchedToMe,
        };
      });
    }
  }

  return list;
}

export async function acceptHelpRequest(requestId, volunteerId) {
  if (isMemory()) {
    const r = db.requests.find((x) => x.id === requestId);
    const v = db.volunteers.find((x) => x.id === volunteerId);
    if (!r || !v) return { error: 'not_found' };
    if (v.status !== 'approved') return { error: 'not_approved' };
    if (r.status !== 'open') return { error: 'conflict' };

    r.status = 'accepted';
    r.acceptedBy = v.id;
    r.acceptedAt = new Date().toISOString();
    v.activeRequestId = r.id;

    const enriched = await enrichRequest(r);
    broadcast('request:update', enriched);
    broadcast('volunteer:update', v);
    return { ok: true, request: enriched };
  }

  // PostgreSQL transaction or safe query
  const checkSql = `
    SELECT r.id, r.status, v.id AS vol_id, v.status AS vol_status
    FROM help_requests r
    CROSS JOIN volunteers v
    WHERE r.id = $1 AND v.id = $2;
  `;
  const { rows } = await query(checkSql, [requestId, volunteerId]);
  if (!rows.length) return { error: 'not_found' };
  if (rows[0].vol_status !== 'approved') return { error: 'not_approved' };
  if (rows[0].status !== 'open') return { error: 'conflict' };

  await query(
    `UPDATE help_requests
     SET status = 'accepted', accepted_by = $2, accepted_at = now()
     WHERE id = $1;`,
    [requestId, volunteerId]
  );
  await query(
    `UPDATE volunteers
     SET active_request_id = $2
     WHERE id = $1;`,
    [volunteerId, requestId]
  );

  const updatedReq = await getHelpRequestById(requestId);
  broadcast('request:update', updatedReq);

  const { rows: vRows } = await query(
    `SELECT id, name, phone, skills, verified, status, online, active_request_id AS "activeRequestId",
            ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
     FROM volunteers WHERE id = $1`,
    [volunteerId]
  );
  if (vRows.length) {
    broadcast('volunteer:update', {
      ...vRows[0],
      lat: Number(vRows[0].lat),
      lng: Number(vRows[0].lng),
    });
  }

  return { ok: true, request: updatedReq };
}

export async function closeHelpRequest(requestId, status) {
  if (isMemory()) {
    const r = db.requests.find((x) => x.id === requestId);
    if (!r) return null;
    if (['completed', 'cancelled'].includes(r.status)) {
      return enrichRequest(r);
    }
    r.status = status;
    r.completedAt = new Date().toISOString();
    const v = db.volunteers.find((x) => x.id === r.acceptedBy);
    if (v && v.activeRequestId === r.id) {
      v.activeRequestId = null;
      broadcast('volunteer:update', v);
    }
    const enriched = await enrichRequest(r);
    broadcast('request:update', enriched);
    return enriched;
  }

  const current = await getHelpRequestById(requestId);
  if (!current) return null;
  if (['completed', 'cancelled'].includes(current.status)) {
    return current;
  }

  await query(
    `UPDATE help_requests
     SET status = $2, completed_at = now()
     WHERE id = $1;`,
    [requestId, status]
  );

  if (current.acceptedBy) {
    await query(
      `UPDATE volunteers
       SET active_request_id = NULL
       WHERE id = $1 AND active_request_id = $2;`,
      [current.acceptedBy, requestId]
    );

    const { rows: vRows } = await query(
      `SELECT id, name, phone, skills, verified, status, online, active_request_id AS "activeRequestId",
              ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
       FROM volunteers WHERE id = $1`,
      [current.acceptedBy]
    );
    if (vRows.length) {
      broadcast('volunteer:update', {
        ...vRows[0],
        lat: Number(vRows[0].lat),
        lng: Number(vRows[0].lng),
      });
    }
  }

  const updated = await getHelpRequestById(requestId);
  broadcast('request:update', updated);
  return updated;
}

export async function recomputeOpenMatches() {
  if (isMemory()) {
    for (const r of db.requests) {
      if (r.status === 'open') {
        r.matched = await matchVolunteers(r.type, r, 3, r.priority === 'critical');
        const enriched = await enrichRequest(r);
        broadcast('request:update', enriched);
      }
    }
  } else {
    const { rows } = await query(
      `SELECT id FROM help_requests WHERE status = 'open';`
    );
    for (const row of rows) {
      const enriched = await getHelpRequestById(row.id);
      broadcast('request:update', enriched);
    }
  }
}
