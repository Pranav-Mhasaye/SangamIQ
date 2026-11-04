import { isMemory, query } from './db.js';
import { db } from '../data.js';

export async function getStats() {
  if (isMemory()) {
    const accepted = db.requests.filter((r) => r.acceptedAt);
    const avgSec = accepted.length
      ? Math.round(
          accepted.reduce(
            (s, r) => s + (new Date(r.acceptedAt) - new Date(r.createdAt)) / 1000,
            0
          ) / accepted.length
        )
      : 0;
    const count = (st) => db.requests.filter((r) => r.status === st).length;
    return {
      open: count('open'),
      inProgress: count('accepted'),
      completed: count('completed'),
      critical: db.requests.filter(
        (r) => r.priority === 'critical' && ['open', 'accepted'].includes(r.status)
      ).length,
      volunteersOnline: db.volunteers.filter((v) => v.online).length,
      volunteersTotal: db.volunteers.length,
      avgResponseSec: avgSec,
      voiceRequests: db.requests.filter((r) => r.channel === 'voice').length,
    };
  }

  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE status = 'open') AS open,
      COUNT(*) FILTER (WHERE status = 'accepted') AS in_progress,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(*) FILTER (WHERE priority = 'critical' AND status IN ('open', 'accepted')) AS critical,
      COUNT(*) FILTER (WHERE channel = 'voice') AS voice_requests,
      COALESCE(
        ROUND(
          AVG(EXTRACT(EPOCH FROM (accepted_at - created_at)))
          FILTER (WHERE accepted_at IS NOT NULL)
        ), 0
      ) AS avg_response_sec
    FROM help_requests;
  `;

  const volSql = `
    SELECT
      COUNT(*) AS volunteers_total,
      COUNT(*) FILTER (WHERE online = TRUE) AS volunteers_online
    FROM volunteers;
  `;

  const [{ rows: reqRows }, { rows: volRows }] = await Promise.all([
    query(sql),
    query(volSql),
  ]);

  const r = reqRows[0];
  const v = volRows[0];

  return {
    open: Number(r.open) || 0,
    inProgress: Number(r.in_progress) || 0,
    completed: Number(r.completed) || 0,
    critical: Number(r.critical) || 0,
    volunteersOnline: Number(v.volunteers_online) || 0,
    volunteersTotal: Number(v.volunteers_total) || 0,
    avgResponseSec: Number(r.avg_response_sec) || 0,
    voiceRequests: Number(r.voice_requests) || 0,
  };
}
