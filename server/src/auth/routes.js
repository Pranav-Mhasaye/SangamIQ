// Auth routes: OTP login (attendee/volunteer), email+password login (organiser),
// volunteer registration, token refresh, logout, and volunteer status management.

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { uid } from '../data.js';
import { otpProvider } from './otp.js';
import { signAccess, createRefresh, consumeRefresh, revokeRefresh, setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE } from './jwt.js';
import { requireAuth } from './middleware.js';
import { broadcast } from '../bus.js';
import {
  findUserByPhone,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
} from '../repos/usersRepo.js';
import {
  getAllVolunteers,
  getVolunteerById,
  updateVolunteer,
  createVolunteer,
} from '../repos/volunteersRepo.js';

const router = Router();

async function issueTokens(res, user) {
  const accessToken = signAccess(user);
  const refreshToken = await createRefresh(user.id);
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

  let user = await findUserByPhone(normalized);
  if (!user) {
    // Auto-create attendee account on first login
    user = await createUser({
      id: uid('usr'), phone: normalized, email: null, passwordHash: null,
      role: role === 'volunteer' ? 'volunteer' : 'attendee',
      name: '',
      volunteerId: null, volunteerStatus: null,
    });
  }

  const tokens = await issueTokens(res, user);
  res.json(tokens);
});

// POST /api/auth/register-volunteer  { phone, otp, name, skills[] }
router.post('/register-volunteer', async (req, res) => {
  const { phone, otp, name, skills = [] } = req.body || {};
  if (!phone || !otp || !name) return res.status(400).json({ error: 'phone, otp and name required' });

  const normalized = phone.replace(/[\s-]/g, '');
  const valid = await otpProvider.verify(normalized, otp);
  if (!valid) return res.status(401).json({ error: 'Invalid or expired OTP' });

  let user = await findUserByPhone(normalized);

  if (user && user.role === 'volunteer') {
    // Already registered as volunteer
    const tokens = await issueTokens(res, user);
    return res.json(tokens);
  }

  // Create volunteer record (status: pending, verified: false until approved)
  const vol = await createVolunteer({
    id: uid('vol'), name, lat: 18.6764, lng: 73.8977, skills: Array.isArray(skills) ? skills : [],
    online: false, verified: false, status: 'pending',
    phone: normalized, activeRequestId: null,
  });

  if (user) {
    // Upgrade existing attendee to volunteer
    user = await updateUser(user.id, {
      role: 'volunteer',
      name,
      volunteerId: vol.id,
      volunteerStatus: 'pending',
    });
  } else {
    user = await createUser({
      id: uid('usr'), phone: normalized, email: null, passwordHash: null,
      role: 'volunteer', name,
      volunteerId: vol.id, volunteerStatus: 'pending',
    });
  }

  broadcast('volunteer:update', vol);
  const tokens = await issueTokens(res, user);
  res.status(201).json(tokens);
});

// ---------- Organiser email + password login ----------

// POST /api/auth/login-organiser  { email, password }
router.post('/login-organiser', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const user = await findUserByEmail(email);
  if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.role !== 'organiser' && user.role !== 'admin') return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  const tokens = await issueTokens(res, user);
  res.json(tokens);
});

// ---------- Token refresh ----------

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  const userId = await consumeRefresh(token);
  if (!userId) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  let user = await findUserById(userId);
  if (!user) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'User not found' });
  }

  // Re-sync volunteer status
  if (user.volunteerId) {
    const vol = await getVolunteerById(user.volunteerId);
    if (vol) user.volunteerStatus = vol.status;
  }

  const tokens = await issueTokens(res, user);
  res.json(tokens);
});

// ---------- Logout ----------

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) await revokeRefresh(token);
  clearRefreshCookie(res);
  res.json({ ok: true });
});

// ---------- Current user ----------

// GET /api/auth/me
router.get('/me', requireAuth(), async (req, res) => {
  const user = await findUserById(req.user.sub);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Re-sync volunteer status
  if (user.volunteerId) {
    const vol = await getVolunteerById(user.volunteerId);
    if (vol) user.volunteerStatus = vol.status;
  }

  res.json({ user: publicUser(user) });
});

// ---------- Volunteer status management (organiser only) ----------

// GET /api/auth/volunteers/pending
router.get('/volunteers/pending', requireAuth('organiser', 'admin'), async (_req, res) => {
  const all = await getAllVolunteers();
  const pending = all.filter((v) => v.status === 'pending');
  res.json(pending);
});

// GET /api/auth/volunteers/all
router.get('/volunteers/all', requireAuth('organiser', 'admin'), async (_req, res) => {
  const all = await getAllVolunteers();
  res.json(all);
});

// PATCH /api/auth/volunteers/:id/status  { status: 'approved'|'rejected'|'suspended' }
router.patch('/volunteers/:id/status', requireAuth('organiser', 'admin'), async (req, res) => {
  const vol = await getVolunteerById(req.params.id);
  if (!vol) return res.status(404).json({ error: 'Volunteer not found' });

  const { status } = req.body || {};
  if (!['approved', 'rejected', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved, rejected or suspended' });
  }

  const updatedVol = await updateVolunteer(vol.id, {
    status,
    verified: status === 'approved',
    online: status !== 'approved' ? false : vol.online,
  });

  // Sync user record if linked
  const user = await findUserByPhone(vol.phone);
  if (user) {
    await updateUser(user.id, { volunteerStatus: status });
  }

  broadcast('volunteer:update', updatedVol);
  res.json(updatedVol);
});

export default router;
