// Auth routes: OTP login (attendee/volunteer), email+password login (organiser),
// volunteer registration, token refresh, logout, and volunteer status management.

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, uid } from '../data.js';
import { otpProvider } from './otp.js';
import { signAccess, createRefresh, consumeRefresh, revokeRefresh, setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE } from './jwt.js';
import { requireAuth } from './middleware.js';
import { broadcast } from '../bus.js';

const router = Router();

// ---------- helpers ----------

function findUserByPhone(phone) {
  return db.users.find((u) => u.phone === phone);
}
function findUserByEmail(email) {
  return db.users.find((u) => u.email === email.toLowerCase());
}
function findUserById(id) {
  return db.users.find((u) => u.id === id);
}

function issueTokens(res, user) {
  const accessToken = signAccess(user);
  const refreshToken = createRefresh(user.id);
  setRefreshCookie(res, refreshToken);
  return { accessToken, user: publicUser(user) };
}

function publicUser(u) {
  return {
    id: u.id, role: u.role, name: u.name, phone: u.phone || null,
    email: u.email || null, volunteerId: u.volunteerId || null,
    volunteerStatus: u.volunteerStatus || null,
  };
}

// ---------- OTP flow (attendee + volunteer) ----------

// POST /api/auth/send-otp  { phone }
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body || {};
  if (!phone || typeof phone !== 'string' || phone.length < 10) {
    return res.status(400).json({ error: 'Valid phone number required' });
  }
  const normalized = phone.replace(/[\s-]/g, '');
  try {
    await otpProvider.send(normalized);
    res.json({ ok: true, message: 'OTP sent' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/auth/verify-otp  { phone, otp, role? }
// If no user exists for this phone, creates an attendee account.
router.post('/verify-otp', async (req, res) => {
  const { phone, otp, role = 'attendee' } = req.body || {};
  if (!phone || !otp) return res.status(400).json({ error: 'phone and otp required' });

  const normalized = phone.replace(/[\s-]/g, '');
  const valid = await otpProvider.verify(normalized, otp);
  if (!valid) return res.status(401).json({ error: 'Invalid or expired OTP' });

  let user = findUserByPhone(normalized);
  if (!user) {
    // Auto-create attendee account on first login
    user = {
      id: uid('usr'), phone: normalized, email: null, passwordHash: null,
      role: role === 'volunteer' ? 'volunteer' : 'attendee',
      name: '', createdAt: new Date().toISOString(),
      volunteerId: null, volunteerStatus: null,
    };
    db.users.push(user);
  }

  res.json(issueTokens(res, user));
});

// POST /api/auth/register-volunteer  { phone, otp, name, skills[] }
router.post('/register-volunteer', async (req, res) => {
  const { phone, otp, name, skills = [] } = req.body || {};
  if (!phone || !otp || !name) return res.status(400).json({ error: 'phone, otp and name required' });

  const normalized = phone.replace(/[\s-]/g, '');
  const valid = await otpProvider.verify(normalized, otp);
  if (!valid) return res.status(401).json({ error: 'Invalid or expired OTP' });

  let user = findUserByPhone(normalized);

  if (user && user.role === 'volunteer') {
    // Already registered as volunteer
    return res.json(issueTokens(res, user));
  }

  // Create volunteer record (status: pending, verified: false until approved)
  const vol = {
    id: uid('vol'), name, lat: 18.6764, lng: 73.8977, skills: Array.isArray(skills) ? skills : [],
    online: false, verified: false, status: 'pending',
    phone: normalized, activeRequestId: null,
  };
  db.volunteers.push(vol);

  if (user) {
    // Upgrade existing attendee to volunteer
    user.role = 'volunteer';
    user.name = name;
    user.volunteerId = vol.id;
    user.volunteerStatus = 'pending';
  } else {
    user = {
      id: uid('usr'), phone: normalized, email: null, passwordHash: null,
      role: 'volunteer', name, createdAt: new Date().toISOString(),
      volunteerId: vol.id, volunteerStatus: 'pending',
    };
    db.users.push(user);
  }

  broadcast('volunteer:update', vol);
  res.status(201).json(issueTokens(res, user));
});

// ---------- Organiser email + password login ----------

// POST /api/auth/login-organiser  { email, password }
router.post('/login-organiser', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const user = findUserByEmail(email);
  if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.role !== 'organiser' && user.role !== 'admin') return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  res.json(issueTokens(res, user));
});

// ---------- Token refresh ----------

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  const userId = consumeRefresh(token);
  if (!userId) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const user = findUserById(userId);
  if (!user) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'User not found' });
  }

  // Re-sync volunteer status
  if (user.volunteerId) {
    const vol = db.volunteers.find((v) => v.id === user.volunteerId);
    if (vol) user.volunteerStatus = vol.status;
  }

  res.json(issueTokens(res, user));
});

// ---------- Logout ----------

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) revokeRefresh(token);
  clearRefreshCookie(res);
  res.json({ ok: true });
});

// ---------- Current user ----------

// GET /api/auth/me
router.get('/me', requireAuth(), (req, res) => {
  const user = findUserById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Re-sync volunteer status
  if (user.volunteerId) {
    const vol = db.volunteers.find((v) => v.id === user.volunteerId);
    if (vol) user.volunteerStatus = vol.status;
  }

  res.json({ user: publicUser(user) });
});

// ---------- Volunteer status management (organiser only) ----------

// GET /api/auth/volunteers/pending
router.get('/volunteers/pending', requireAuth('organiser', 'admin'), (_req, res) => {
  const pending = db.volunteers.filter((v) => v.status === 'pending');
  res.json(pending);
});

// GET /api/auth/volunteers/all
router.get('/volunteers/all', requireAuth('organiser', 'admin'), (_req, res) => {
  res.json(db.volunteers.map((v) => ({
    ...v,
    user: db.users.find((u) => u.volunteerId === v.id) || null,
  })));
});

// PATCH /api/auth/volunteers/:id/status  { status: 'approved'|'rejected'|'suspended' }
router.patch('/volunteers/:id/status', requireAuth('organiser', 'admin'), (req, res) => {
  const vol = db.volunteers.find((v) => v.id === req.params.id);
  if (!vol) return res.status(404).json({ error: 'Volunteer not found' });

  const { status } = req.body || {};
  if (!['approved', 'rejected', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved, rejected or suspended' });
  }

  vol.status = status;
  vol.verified = status === 'approved';

  // If suspended or rejected, take offline
  if (status !== 'approved') {
    vol.online = false;
  }

  // Sync user record
  const user = db.users.find((u) => u.volunteerId === vol.id);
  if (user) user.volunteerStatus = status;

  broadcast('volunteer:update', vol);
  res.json(vol);
});

export default router;

