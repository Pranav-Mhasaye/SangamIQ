import { isMemory, query } from './db.js';
import { db, uid } from '../data.js';
import { distanceM, etaMin } from '../geo.js';
import { matchVolunteers } from './volunteersRepo.js';
import { nearestServices } from './servicesRepo.js';
import { broadcast } from '../bus.js';

export const STATUSES = [
  'open',
  'accepted',
  'on_the_way',
  'arrived',
  'completed',
  'cancelled',
  'escalated',
];

export const VALID_TRANSITIONS = {
  open: ['accepted', 'escalated', 'cancelled'],
  escalated: ['accepted', 'escalated', 'cancelled'],
  accepted: ['on_the_way', 'open', 'cancelled'],
  on_the_way: ['arrived', 'open', 'cancelled'],
  arrived: ['completed', 'open', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  return Boolean(allowed && allowed.includes(newStatus));
}

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

  const matchLimit = r.status === 'escalated' ? 3 + ((r.escalationRound || 1) * 3) : 3;
  const matched =
    ['open', 'escalated'].includes(r.status)
      ? await matchVolunteers(r.type, { lat: r.lat, lng: r.lng }, matchLimit, r.priority === 'critical')
      : r.matched || [];

  return {
    ...r,
    volunteer,
    matched,
    timeline: Array.isArray(r.timeline) ? r.timeline : [],
    escalationRound: r.escalationRound || 0,
    maxEscalated: Boolean(r.maxEscalated),
    rating: r.rating || null,
    feedback: r.feedback || null,
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

  // Duplicate protection: attendee cannot create > 1 open request of same type within 2 minutes
  const twoMinAgo = Date.now() - 120000;
  if (isMemory()) {
    const dup = db.requests.find((existing) => {
      if (!['open', 'escalated'].includes(existing.status)) return false;
      if (existing.type !== chosenType) return false;
      const isSameClient =
        (userId && existing.userId === userId) || (deviceId && existing.deviceId === deviceId);
      if (!isSameClient) return false;
      return new Date(existing.createdAt).getTime() > twoMinAgo;
    });
    if (dup) {
      throw Object.assign(
        new Error('You already have an active request for this service. Please wait before creating another.'),
        { status: 429, code: 'DUPLICATE_REQUEST' }
      );
    }
  } else {
    const dupSql = `
      SELECT id FROM help_requests
      WHERE status IN ('open', 'escalated')
        AND type = $1
        AND (($2::text IS NOT NULL AND user_id = $2) OR ($3::text IS NOT NULL AND device_id = $3))
        AND created_at > now() - interval '2 minutes';
    `;
    const { rows: dupRows } = await query(dupSql, [chosenType, userId, deviceId]);
    if (dupRows.length > 0) {
      throw Object.assign(
        new Error('You already have an active request for this service. Please wait before creating another.'),
        { status: 429, code: 'DUPLICATE_REQUEST' }
      );
    }
  }

  const matched = await matchVolunteers(chosenType, pos, 3, critical);
  const nearestList = await nearestServices(chosenType, pos, 1);
  const nearestService = nearestList[0] || null;

  const timeline = [
    {
      status: 'open',
      actor: name || 'Attendee',
      timestamp: nowIso,
    },
  ];

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
    timeline,
    escalationRound: 0,
    lastEscalatedAt: null,
    maxEscalated: false,
    rating: null,
    feedback: null,
    ratedAt: null,
  };

  if (isMemory()) {
    db.requests.unshift(reqObj);
  } else {
    const sql = `
      INSERT INTO help_requests (
        id, type, priority, status, channel, language, note, requester,
        user_id, device_id, geom, created_at, timeline, escalation_round, max_escalated
      ) VALUES (
        $1, $2, $3, 'open', $4, $5, $6, $7,
        $8, $9, ST_SetSRID(ST_MakePoint($11, $10), 4326)::geography, now(), $12, 0, false
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
      JSON.stringify(timeline),
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
      created_at AS "createdAt", accepted_at AS "acceptedAt", completed_at AS "completedAt",
      timeline, escalation_round AS "escalationRound", last_escalated_at AS "lastEscalatedAt",
      max_escalated AS "maxEscalated", rating, feedback, rated_at AS "ratedAt"
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
    lastEscalatedAt: rows[0].lastEscalatedAt ? new Date(rows[0].lastEscalatedAt).toISOString() : null,
    ratedAt: rows[0].ratedAt ? new Date(rows[0].ratedAt).toISOString() : null,
    timeline: typeof rows[0].timeline === 'string' ? JSON.parse(rows[0].timeline) : (rows[0].timeline || []),
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
        created_at AS "createdAt", accepted_at AS "acceptedAt", completed_at AS "completedAt",
        timeline, escalation_round AS "escalationRound", last_escalated_at AS "lastEscalatedAt",
        max_escalated AS "maxEscalated", rating, feedback, rated_at AS "ratedAt"
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
          lastEscalatedAt: row.lastEscalatedAt ? new Date(row.lastEscalatedAt).toISOString() : null,
          ratedAt: row.ratedAt ? new Date(row.ratedAt).toISOString() : null,
          timeline: typeof row.timeline === 'string' ? JSON.parse(row.timeline) : (row.timeline || []),
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
    if (!['open', 'escalated'].includes(r.status)) return { error: 'conflict' };

    const nowIso = new Date().toISOString();
    r.status = 'accepted';
    r.acceptedBy = v.id;
    r.acceptedAt = nowIso;
    v.activeRequestId = r.id;

    if (!Array.isArray(r.timeline)) r.timeline = [];
    r.timeline.push({
      status: 'accepted',
      actor: v.name,
      timestamp: nowIso,
    });

    const enriched = await enrichRequest(r);
    broadcast('request:update', enriched);
    broadcast('volunteer:update', v);
    return { ok: true, request: enriched };
  }

  const checkSql = `
    SELECT r.id, r.status, r.timeline, v.id AS vol_id, v.status AS vol_status, v.name AS vol_name
    FROM help_requests r
    CROSS JOIN volunteers v
    WHERE r.id = $1 AND v.id = $2;
  `;
  const { rows } = await query(checkSql, [requestId, volunteerId]);
  if (!rows.length) return { error: 'not_found' };
  if (rows[0].vol_status !== 'approved') return { error: 'not_approved' };
  if (!['open', 'escalated'].includes(rows[0].status)) return { error: 'conflict' };

  const nowIso = new Date().toISOString();
  const volName = rows[0].vol_name;
  let timeline = typeof rows[0].timeline === 'string' ? JSON.parse(rows[0].timeline) : (rows[0].timeline || []);
  timeline.push({ status: 'accepted', actor: volName, timestamp: nowIso });

  await query(
    `UPDATE help_requests
     SET status = 'accepted', accepted_by = $2, accepted_at = now(), timeline = $3
     WHERE id = $1;`,
    [requestId, volunteerId, JSON.stringify(timeline)]
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

export async function updateRequestStatus(requestId, newStatus, { actor = 'Volunteer', note = '', volunteerId = null } = {}) {
  const current = await getHelpRequestById(requestId);
  if (!current) return { error: 'not_found' };

  if (!canTransition(current.status, newStatus)) {
    return {
      error: 'invalid_transition',
      message: `Invalid state transition from '${current.status}' to '${newStatus}'`,
    };
  }

  const nowIso = new Date().toISOString();
  const timelineEntry = {
    status: newStatus,
    actor,
    timestamp: nowIso,
    ...(note ? { note } : {}),
  };

  if (isMemory()) {
    const r = db.requests.find((x) => x.id === requestId);
    r.status = newStatus;
    if (newStatus === 'completed') r.completedAt = nowIso;
    if (!Array.isArray(r.timeline)) r.timeline = [];
    r.timeline.push(timelineEntry);

    // If completed or cancelled, free volunteer
    if (['completed', 'cancelled'].includes(newStatus)) {
      const v = db.volunteers.find((x) => x.id === r.acceptedBy);
      if (v && v.activeRequestId === r.id) {
        v.activeRequestId = null;
        broadcast('volunteer:update', v);
      }
    }

    const enriched = await enrichRequest(r);
    broadcast('request:update', enriched);
    return { ok: true, request: enriched };
  }

  let timeline = Array.isArray(current.timeline) ? [...current.timeline] : [];
  timeline.push(timelineEntry);

  const completedSql = newStatus === 'completed' ? ', completed_at = now()' : '';
  await query(
    `UPDATE help_requests
     SET status = $2, timeline = $3 ${completedSql}
     WHERE id = $1;`,
    [requestId, newStatus, JSON.stringify(timeline)]
  );

  if (['completed', 'cancelled'].includes(newStatus) && current.acceptedBy) {
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
  return { ok: true, request: updated };
}

export async function releaseHelpRequest(requestId, volunteerId, actorName = 'Volunteer') {
  const current = await getHelpRequestById(requestId);
  if (!current) return { error: 'not_found' };

  if (!['accepted', 'on_the_way', 'arrived'].includes(current.status)) {
    return { error: 'invalid_status', message: 'Only in-progress requests can be released' };
  }

  if (volunteerId && current.acceptedBy && current.acceptedBy !== volunteerId) {
    return { error: 'unauthorized', message: 'You are not assigned to this request' };
  }

  const nowIso = new Date().toISOString();
  const timelineEntry = {
    status: 'open',
    actor: actorName,
    note: 'Released back to open pool',
    timestamp: nowIso,
  };

  if (isMemory()) {
    const r = db.requests.find((x) => x.id === requestId);
    r.status = 'open';
    const prevVolId = r.acceptedBy;
    r.acceptedBy = null;
    r.acceptedAt = null;
    if (!Array.isArray(r.timeline)) r.timeline = [];
    r.timeline.push(timelineEntry);

    if (prevVolId) {
      const v = db.volunteers.find((x) => x.id === prevVolId);
      if (v && v.activeRequestId === r.id) {
        v.activeRequestId = null;
        broadcast('volunteer:update', v);
      }
    }

    r.matched = await matchVolunteers(r.type, r, 3, r.priority === 'critical');
    const enriched = await enrichRequest(r);
    broadcast('request:update', enriched);
    return { ok: true, request: enriched };
  }

  let timeline = Array.isArray(current.timeline) ? [...current.timeline] : [];
  timeline.push(timelineEntry);

  await query(
    `UPDATE help_requests
     SET status = 'open', accepted_by = NULL, accepted_at = NULL, timeline = $2
     WHERE id = $1;`,
    [requestId, JSON.stringify(timeline)]
  );

  if (current.acceptedBy) {
    await query(
      `UPDATE volunteers
       SET active_request_id = NULL
       WHERE id = $1;`,
      [current.acceptedBy]
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
  return { ok: true, request: updated };
}

export async function submitFeedback(requestId, { rating, comment = '' }) {
  const numericRating = Number(rating);
  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    return { error: 'invalid_rating', message: 'Rating must be an integer between 1 and 5' };
  }

  const current = await getHelpRequestById(requestId);
  if (!current) return { error: 'not_found' };

  const nowIso = new Date().toISOString();
  const timelineEntry = {
    status: 'rated',
    actor: current.requester || 'Attendee',
    note: `Rated ${numericRating}/5${comment ? ': ' + comment : ''}`,
    timestamp: nowIso,
  };

  if (isMemory()) {
    const r = db.requests.find((x) => x.id === requestId);
    r.rating = numericRating;
    r.feedback = String(comment).slice(0, 500);
    r.ratedAt = nowIso;
    if (!Array.isArray(r.timeline)) r.timeline = [];
    r.timeline.push(timelineEntry);

    const enriched = await enrichRequest(r);
    broadcast('request:update', enriched);
    return { ok: true, request: enriched };
  }

  let timeline = Array.isArray(current.timeline) ? [...current.timeline] : [];
  timeline.push(timelineEntry);

  await query(
    `UPDATE help_requests
     SET rating = $2, feedback = $3, rated_at = now(), timeline = $4
     WHERE id = $1;`,
    [requestId, numericRating, String(comment).slice(0, 500), JSON.stringify(timeline)]
  );

  const updated = await getHelpRequestById(requestId);
  broadcast('request:update', updated);
  return { ok: true, request: updated };
}

export async function escalateHelpRequest(requestId, nextRound) {
  const nowIso = new Date().toISOString();
  const timelineEntry = {
    status: 'escalated',
    actor: 'System (Auto-escalation)',
    note: `Escalation round ${nextRound}`,
    timestamp: nowIso,
  };

  const isMax = nextRound >= 3;

  if (isMemory()) {
    const r = db.requests.find((x) => x.id === requestId);
    if (!r) return null;
    r.status = 'escalated';
    r.escalationRound = nextRound;
    r.lastEscalatedAt = nowIso;
    r.maxEscalated = isMax;
    if (!Array.isArray(r.timeline)) r.timeline = [];
    r.timeline.push(timelineEntry);

    const enriched = await enrichRequest(r);
    broadcast('request:update', enriched);
    return enriched;
  }

  const current = await getHelpRequestById(requestId);
  if (!current) return null;

  let timeline = Array.isArray(current.timeline) ? [...current.timeline] : [];
  timeline.push(timelineEntry);

  await query(
    `UPDATE help_requests
     SET status = 'escalated', escalation_round = $2, last_escalated_at = now(),
         max_escalated = $3, timeline = $4
     WHERE id = $1;`,
    [requestId, nextRound, isMax, JSON.stringify(timeline)]
  );

  const updated = await getHelpRequestById(requestId);
  broadcast('request:update', updated);
  return updated;
}

export async function closeHelpRequest(requestId, status) {
  return updateRequestStatus(requestId, status, { actor: 'User' });
}

export async function recomputeOpenMatches() {
  if (isMemory()) {
    for (const r of db.requests) {
      if (['open', 'escalated'].includes(r.status)) {
        const limit = r.status === 'escalated' ? 3 + ((r.escalationRound || 1) * 3) : 3;
        r.matched = await matchVolunteers(r.type, r, limit, r.priority === 'critical');
        const enriched = await enrichRequest(r);
        broadcast('request:update', enriched);
      }
    }
  } else {
    const { rows } = await query(
      `SELECT id FROM help_requests WHERE status IN ('open', 'escalated');`
    );
    for (const row of rows) {
      const enriched = await getHelpRequestById(row.id);
      broadcast('request:update', enriched);
    }
  }
}
