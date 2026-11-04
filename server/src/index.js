import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { TYPES, CENTER, seed } from './data.js';
import { addClient, broadcast } from './bus.js';
import { classify, replyFor } from './voice.js';
import { snapshot, startCrowdSim, surgeZone } from './crowd.js';
import authRouter from './auth/routes.js';
import { requireAuth, optionalAuth } from './auth/middleware.js';
import { initDb, isMemory } from './repos/db.js';
import { nearestServices, getServiceById } from './repos/servicesRepo.js';
import { getAllVolunteers, getVolunteerById, updateVolunteer } from './repos/volunteersRepo.js';
import {
  createHelpRequest,
  getHelpRequestById,
  listHelpRequests,
  acceptHelpRequest,
  closeHelpRequest,
  recomputeOpenMatches,
} from './repos/requestsRepo.js';
import { getAllAlerts, createAlert } from './repos/alertsRepo.js';
import { getStats } from './repos/statsRepo.js';

const app = express();

// ---------- security ----------
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Rate limiters
const otpLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, message: { error: 'Too many OTP requests, try again in a minute' } });
const requestLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Too many requests, slow down' } });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many login attempts' } });

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const here = (q) => ({ lat: num(q.lat, CENTER.lat), lng: num(q.lng, CENTER.lng) });

// ---------- auth routes ----------
app.use('/api/auth/send-otp', otpLimiter);
app.use('/api/auth/verify-otp', authLimiter);
app.use('/api/auth/login-organiser', authLimiter);
app.use('/api/auth', authRouter);

// ---------- public routes ----------
app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    center: CENTER,
    types: TYPES,
    storage: isMemory() ? 'in-memory' : 'postgresql+postgis',
  })
);
app.get('/api/stream', addClient);

app.get('/api/services', async (req, res) => {
  try {
    const { type } = req.query;
    const services = await nearestServices(type, here(req.query));
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/services/:id', async (req, res) => {
  try {
    const s = await getServiceById(req.params.id, here(req.query));
    if (!s) return res.status(404).json({ error: 'service not found' });
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- request creation (guest or authed) ----------
app.post('/api/requests', requestLimiter, optionalAuth, async (req, res) => {
  try {
    const body = req.body || {};
    body.userId = req.user?.sub || null;
    const request = await createHelpRequest(body);
    res.status(201).json(request);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.get('/api/requests', optionalAuth, async (req, res) => {
  try {
    const { status, volunteerId } = req.query;
    const list = await listHelpRequests({ status, volunteerId });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/requests/:id', async (req, res) => {
  try {
    const r = await getHelpRequestById(req.params.id);
    if (!r) return res.status(404).json({ error: 'request not found' });
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- volunteer actions (requires volunteer role) ----------
app.post('/api/requests/:id/accept', requireAuth('volunteer'), async (req, res) => {
  try {
    const volunteerId = req.user.volunteerId || req.body?.volunteerId;
    const result = await acceptHelpRequest(req.params.id, volunteerId);
    if (result.error === 'not_found') return res.status(404).json({ error: 'request or volunteer not found' });
    if (result.error === 'not_approved') return res.status(403).json({ error: 'Volunteer not approved' });
    if (result.error === 'conflict') return res.status(409).json({ error: 'request already taken' });
    res.json(result.request);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function close(status) {
  return async (req, res) => {
    try {
      const closed = await closeHelpRequest(req.params.id, status);
      if (!closed) return res.status(404).json({ error: 'request not found' });
      res.json(closed);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}
app.post('/api/requests/:id/complete', requireAuth('volunteer', 'organiser', 'admin'), close('completed'));
app.post('/api/requests/:id/cancel', optionalAuth, close('cancelled'));

// ---------- volunteer self-management ----------
app.get('/api/volunteers', optionalAuth, async (_req, res) => {
  try {
    const volunteers = await getAllVolunteers();
    res.json(volunteers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/volunteers/:id', requireAuth('volunteer', 'organiser', 'admin'), async (req, res) => {
  try {
    const v = await getVolunteerById(req.params.id);
    if (!v) return res.status(404).json({ error: 'volunteer not found' });

    // Volunteers can only update their own record
    if (req.user.role === 'volunteer' && req.user.volunteerId !== v.id) {
      return res.status(403).json({ error: 'Cannot update another volunteer' });
    }

    const prevOnline = v.online;
    const patch = {};
    if (typeof req.body?.online === 'boolean') patch.online = req.body.online;
    if (Number.isFinite(req.body?.lat) && Number.isFinite(req.body?.lng)) {
      patch.lat = req.body.lat;
      patch.lng = req.body.lng;
    }

    const updated = await updateVolunteer(v.id, patch);
    broadcast('volunteer:update', updated);

    // If online status or location changed, recompute matches and notify listeners
    if (prevOnline !== updated.online || patch.lat != null) {
      await recomputeOpenMatches();
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- alerts (public read, organiser write) ----------
app.get('/api/alerts', async (_req, res) => {
  try {
    const alerts = await getAllAlerts();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/alerts', requireAuth('organiser', 'admin'), async (req, res) => {
  try {
    const { level = 'info', title, message, hi, mr, zone = null } = req.body || {};
    if (!title || !message) return res.status(400).json({ error: 'title and message are required' });
    const alert = await createAlert({ level, title, message, hi, mr, zone });
    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- crowd (public read, organiser surge) ----------
app.get('/api/crowd', async (_req, res) => {
  try {
    const sn = await snapshot();
    res.json(sn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/crowd/:id/surge', requireAuth('organiser', 'admin'), async (req, res) => {
  try {
    const z = await surgeZone(req.params.id);
    if (!z) return res.status(404).json({ error: 'zone not found' });
    res.json({ ok: true, zone: z.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- voice AI (guest or authed) ----------
app.post('/api/voice/intent', requestLimiter, optionalAuth, async (req, res) => {
  try {
    const { text = '', language = 'en', lat, lng, create = true, channel = 'voice' } = req.body || {};
    const pos = { lat: num(lat, CENTER.lat), lng: num(lng, CENTER.lng) };
    const parsed = classify(text);
    const nearestList = parsed.type ? await nearestServices(parsed.type, pos, 1) : [];
    const nearest = nearestList[0] || null;
    const reply = replyFor(parsed, language, nearest);
    let request = null;

    if (create && (parsed.intent === 'request_help' || parsed.intent === 'generic_help')) {
      request = await createHelpRequest({
        type: parsed.type,
        ...pos,
        note: text,
        language,
        channel,
        emergency: parsed.emergency,
        priority: parsed.priority,
        userId: req.user?.sub || null,
      });
    }

    res.json({ ...parsed, reply, nearest, request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- stats (organiser only) ----------
app.get('/api/stats', requireAuth('organiser', 'admin'), async (_req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- demo reset (organiser/admin only) ----------
app.post('/api/demo/reset', requireAuth('organiser', 'admin'), async (_req, res) => {
  try {
    seed();
    broadcast('request:update', {});
    broadcast('volunteer:update', {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

async function bootstrap() {
  await initDb();
  startCrowdSim();
  app.listen(PORT, () => console.log(`SangamIQ API running on http://localhost:${PORT}`));
}

bootstrap();
