import express from 'express';
import cors from 'cors';
import { db, uid, TYPES, CENTER, seed } from './data.js';
import { distanceM, etaMin } from './geo.js';
import { addClient, broadcast } from './bus.js';
import { classify, replyFor, isCritical } from './voice.js';
import { snapshot, startCrowdSim, surgeZone } from './crowd.js';

const app = express();
app.use(cors());
app.use(express.json());

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const here = (q) => ({ lat: num(q.lat, CENTER.lat), lng: num(q.lng, CENTER.lng) });

// ---------- matching (the "AI-driven real-time matching") ----------
function nearestServices(type, pos, limit = 50) {
  return db.services
    .filter((s) => !type || s.type === type)
    .map((s) => {
      const d = distanceM(pos, s);
      return { ...s, distanceM: d, etaMin: etaMin(d) };
    })
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

function matchVolunteers(type, pos, limit = 3, critical = false) {
  return db.volunteers
    .filter((v) => v.online && v.verified)
    .map((v) => {
      const d = distanceM(pos, v);
      const directFit = v.skills.includes(type) || (type === 'medical' && v.skills.includes('first-aid'));
      const medicalFit = critical && (v.skills.includes('medical') || v.skills.includes('first-aid'));
      const skillFit = directFit || medicalFit;
      const skillPenalty = directFit ? 0 : (medicalFit ? 150 : 600);
      const busy = v.activeRequestId ? 400 : 0; // prefer free volunteers
      const score = d + skillPenalty + busy; // lower is better
      return { volunteerId: v.id, name: v.name, phone: v.phone, distanceM: d, etaMin: etaMin(d), skillFit, score };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ score, ...rest }) => rest);
}

const withVol = (r) => ({
  ...r,
  volunteer: r.acceptedBy ? db.volunteers.find((v) => v.id === r.acceptedBy) || null : null,
  matched: r.status === 'open' ? matchVolunteers(r.type, r, 3, r.priority === 'critical') : (r.matched || []),
});

function createRequest({ type, lat, lng, note = '', language = 'en', channel = 'app', emergency = false, name = '', priority }) {
  const chosenType = type || (emergency ? 'medical' : null);
  if (!TYPES.includes(chosenType)) throw Object.assign(new Error(`type must be one of ${TYPES.join(', ')}`), { status: 400 });
  const pos = { lat: num(lat, CENTER.lat), lng: num(lng, CENTER.lng) };
  const critical = Boolean(emergency) || isCritical(note);
  const finalPriority = priority || (critical ? 'critical' : (chosenType === 'medical' ? 'high' : 'normal'));
  const req = {
    id: uid('req'), type: chosenType, ...pos, note: String(note).slice(0, 280), language, channel, requester: String(name).slice(0, 60),
    priority: finalPriority,
    status: 'open', createdAt: new Date().toISOString(), acceptedBy: null, acceptedAt: null, completedAt: null,
    matched: matchVolunteers(chosenType, pos, 3, critical),
    nearestService: nearestServices(chosenType, pos, 1)[0] || null,
  };
  db.requests.unshift(req);
  broadcast('request:new', withVol(req));
  return withVol(req);
}

// ---------- routes ----------
app.get('/api/health', (_req, res) => res.json({ ok: true, center: CENTER, types: TYPES }));
app.get('/api/stream', addClient);

app.get('/api/services', (req, res) => {
  const { type } = req.query;
  res.json(nearestServices(type, here(req.query)));
});

app.get('/api/services/:id', (req, res) => {
  const s = db.services.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'service not found' });
  const pos = here(req.query);
  const d = distanceM(pos, s);
  const contact = matchVolunteers(s.type, s, 1)[0] || null; // closest online volunteer who can help at this place
  res.json({ ...s, distanceM: d, etaMin: etaMin(d), contact });
});

app.post('/api/requests', (req, res) => {
  try { res.status(201).json(createRequest(req.body || {})); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

app.get('/api/requests', (req, res) => {
  const { status, volunteerId } = req.query;
  const me = volunteerId ? db.volunteers.find((v) => v.id === volunteerId) : null;
  let list = db.requests.map(withVol);
  if (status) list = list.filter((r) => status.split(',').includes(r.status));
  if (me) {
    list = list.map((r) => {
      const d = distanceM(me, r);
      return { ...r, distanceM: d, etaMin: etaMin(d), matchedToMe: r.matched.some((m) => m.volunteerId === me.id) };
    });
  }
  res.json(list);
});

app.get('/api/requests/:id', (req, res) => {
  const r = db.requests.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'request not found' });
  res.json(withVol(r));
});

app.post('/api/requests/:id/accept', (req, res) => {
  const r = db.requests.find((x) => x.id === req.params.id);
  const v = db.volunteers.find((x) => x.id === req.body?.volunteerId);
  if (!r || !v) return res.status(404).json({ error: 'request or volunteer not found' });
  if (r.status !== 'open') return res.status(409).json({ error: 'request already taken' });
  r.status = 'accepted';
  r.acceptedBy = v.id;
  r.acceptedAt = new Date().toISOString();
  v.activeRequestId = r.id;
  broadcast('request:update', withVol(r));
  broadcast('volunteer:update', v);
  res.json(withVol(r));
});

function close(status) {
  return (req, res) => {
    const r = db.requests.find((x) => x.id === req.params.id);
    if (!r) return res.status(404).json({ error: 'request not found' });
    if (['completed', 'cancelled'].includes(r.status)) return res.json(withVol(r));
    r.status = status;
    r.completedAt = new Date().toISOString();
    const v = db.volunteers.find((x) => x.id === r.acceptedBy);
    if (v && v.activeRequestId === r.id) { v.activeRequestId = null; broadcast('volunteer:update', v); }
    broadcast('request:update', withVol(r));
    res.json(withVol(r));
  };
}
app.post('/api/requests/:id/complete', close('completed'));
app.post('/api/requests/:id/cancel', close('cancelled'));

app.get('/api/volunteers', (_req, res) => res.json(db.volunteers));
app.patch('/api/volunteers/:id', (req, res) => {
  const v = db.volunteers.find((x) => x.id === req.params.id);
  if (!v) return res.status(404).json({ error: 'volunteer not found' });
  const prevOnline = v.online;
  if (typeof req.body?.online === 'boolean') v.online = req.body.online;
  if (Number.isFinite(req.body?.lat) && Number.isFinite(req.body?.lng)) { v.lat = req.body.lat; v.lng = req.body.lng; }
  broadcast('volunteer:update', v);

  // If online status or location changed, recompute matches and notify listeners
  if (prevOnline !== v.online || req.body?.lat != null) {
    for (const r of db.requests) {
      if (r.status === 'open') {
        r.matched = matchVolunteers(r.type, r, 3, r.priority === 'critical');
        broadcast('request:update', withVol(r));
      }
    }
  }
  res.json(v);
});

app.get('/api/alerts', (_req, res) => res.json(db.alerts));
app.post('/api/alerts', (req, res) => {
  const { level = 'info', title, message, hi, mr, zone = null } = req.body || {};
  if (!title || !message) return res.status(400).json({ error: 'title and message are required' });
  const alert = {
    id: uid('alt'), level: ['info', 'warning', 'emergency'].includes(level) ? level : 'info', zone, auto: false,
    createdAt: new Date().toISOString(), title: String(title).slice(0, 80),
    messages: { en: String(message).slice(0, 300), hi: String(hi || message).slice(0, 300), mr: String(mr || message).slice(0, 300) },
  };
  db.alerts.unshift(alert);
  broadcast('alert:new', alert);
  res.status(201).json(alert);
});

app.get('/api/crowd', (_req, res) => res.json(snapshot()));
app.post('/api/crowd/:id/surge', (req, res) => {
  const z = surgeZone(req.params.id);
  if (!z) return res.status(404).json({ error: 'zone not found' });
  res.json({ ok: true, zone: z.id });
});

// Voice AI: text in (from browser speech recognition or an IVR/STT service), intent + spoken reply out.
app.post('/api/voice/intent', (req, res) => {
  const { text = '', language = 'en', lat, lng, create = true, channel = 'voice' } = req.body || {};
  const pos = { lat: num(lat, CENTER.lat), lng: num(lng, CENTER.lng) };
  const parsed = classify(text);
  const nearest = parsed.type ? nearestServices(parsed.type, pos, 1)[0] : null;
  const reply = replyFor(parsed, language, nearest);
  let request = null;
  if (create && (parsed.intent === 'request_help' || parsed.intent === 'generic_help')) {
    request = createRequest({
      type: parsed.type,
      ...pos,
      note: text,
      language,
      channel,
      emergency: parsed.emergency,
      priority: parsed.priority,
    });
  }
  res.json({ ...parsed, reply, nearest, request });
});

app.get('/api/stats', (_req, res) => {
  const accepted = db.requests.filter((r) => r.acceptedAt);
  const avgSec = accepted.length
    ? Math.round(accepted.reduce((s, r) => s + (new Date(r.acceptedAt) - new Date(r.createdAt)) / 1000, 0) / accepted.length)
    : 0;
  const count = (st) => db.requests.filter((r) => r.status === st).length;
  res.json({
    open: count('open'), inProgress: count('accepted'), completed: count('completed'),
    critical: db.requests.filter((r) => r.priority === 'critical' && ['open', 'accepted'].includes(r.status)).length,
    volunteersOnline: db.volunteers.filter((v) => v.online).length, volunteersTotal: db.volunteers.length,
    avgResponseSec: avgSec, voiceRequests: db.requests.filter((r) => r.channel === 'voice').length,
  });
});

app.post('/api/demo/reset', (_req, res) => { seed(); broadcast('request:update', {}); broadcast('volunteer:update', {}); res.json({ ok: true }); });

// serve the built client in production (npm run build && npm start)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = process.env.PORT || 3001;
startCrowdSim();
app.listen(PORT, () => console.log(`SangamIQ API running on http://localhost:${PORT}`));
