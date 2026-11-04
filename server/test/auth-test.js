// Comprehensive test suite for SangamIQ Auth & Security
import assert from 'node:assert/strict';

const BASE = 'http://localhost:3002';

async function req(path, { method = 'GET', body, token, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (cookie) headers['Cookie'] = cookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, ok: res.ok, data, cookie: setCookie };
}

async function runTests() {
  console.log('🚀 Starting SangamIQ Auth Test Suite...\n');

  // 1. Health check
  console.log('1. Health check');
  const health = await req('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.ok, true);
  console.log('   ✅ API is up\n');

  // 2. OTP flow for Attendee
  console.log('2. OTP send & verify');
  const otpSend = await req('/api/auth/send-otp', {
    method: 'POST',
    body: { phone: '+919876543210' },
  });
  assert.equal(otpSend.status, 200);
  assert.equal(otpSend.data.ok, true);

  // Invalid OTP
  const badOtp = await req('/api/auth/verify-otp', {
    method: 'POST',
    body: { phone: '+919876543210', otp: '000000' },
  });
  assert.equal(badOtp.status, 401);
  console.log('   ✅ Bad OTP rejected (401)');

  // Dev OTP (123456)
  const goodOtp = await req('/api/auth/verify-otp', {
    method: 'POST',
    body: { phone: '+919876543210', otp: '123456', role: 'attendee' },
  });
  assert.equal(goodOtp.status, 200);
  assert.ok(goodOtp.data.accessToken);
  assert.equal(goodOtp.data.user.role, 'attendee');
  const attendeeToken = goodOtp.data.accessToken;
  console.log('   ✅ Dev OTP accepted, attendee token issued');

  // 3. Organiser Email + Password Login
  console.log('\n3. Organiser authentication');
  const badOrg = await req('/api/auth/login-organiser', {
    method: 'POST',
    body: { email: 'admin@sangamiq.local', password: 'wrongpassword' },
  });
  assert.equal(badOrg.status, 401);
  console.log('   ✅ Bad password rejected (401)');

  const goodOrg = await req('/api/auth/login-organiser', {
    method: 'POST',
    body: { email: 'admin@sangamiq.local', password: 'admin123' },
  });
  assert.equal(goodOrg.status, 200);
  assert.ok(goodOrg.data.accessToken);
  assert.equal(goodOrg.data.user.role, 'organiser');
  const organiserToken = goodOrg.data.accessToken;
  console.log('   ✅ Organiser logged in successfully');

  // 4. Role-based endpoint protection
  console.log('\n4. Role-based endpoint protection');

  // POST /api/alerts without token -> 401
  const unauthAlert = await req('/api/alerts', {
    method: 'POST',
    body: { title: 'Test Alert', message: 'Test Message' },
  });
  assert.equal(unauthAlert.status, 401);
  console.log('   ✅ Unauthenticated alerts POST blocked (401)');

  // POST /api/alerts with attendee token -> 403
  const attendeeAlert = await req('/api/alerts', {
    method: 'POST',
    token: attendeeToken,
    body: { title: 'Test Alert', message: 'Test Message' },
  });
  assert.equal(attendeeAlert.status, 403);
  console.log('   ✅ Attendee cannot post alerts (403)');

  // POST /api/alerts with organiser token -> 201
  const orgAlert = await req('/api/alerts', {
    method: 'POST',
    token: organiserToken,
    body: { title: 'Urgent Weather Advisory', message: 'Please seek shelter' },
  });
  assert.equal(orgAlert.status, 201);
  console.log('   ✅ Organiser can post alerts (201)');

  // GET /api/stats with organiser token -> 200, without token -> 401
  const unauthStats = await req('/api/stats');
  assert.equal(unauthStats.status, 401);
  const orgStats = await req('/api/stats', { token: organiserToken });
  assert.equal(orgStats.status, 200);
  assert.ok('volunteersOnline' in orgStats.data);
  console.log('   ✅ Stats endpoint protected for organiser only');

  // 5. Guest Attendee Request Creation (emergency mode)
  console.log('\n5. Guest attendee emergency request creation');
  const guestReq = await req('/api/requests', {
    method: 'POST',
    body: {
      type: 'medical',
      emergency: true,
      note: 'Need oxygen cylinder immediately',
      language: 'mr',
      lat: 18.6764,
      lng: 73.8977,
      deviceId: 'dev_anon_123',
    },
  });
  assert.equal(guestReq.status, 201);
  assert.equal(guestReq.data.priority, 'critical');
  assert.equal(guestReq.data.deviceId, 'dev_anon_123');
  console.log('   ✅ Guest attendee successfully created emergency request without auth');

  // 6. Volunteer Onboarding & Approval Flow
  console.log('\n6. Volunteer onboarding and organiser verification');

  // Register new volunteer
  const volReg = await req('/api/auth/register-volunteer', {
    method: 'POST',
    body: {
      phone: '+919988776655',
      otp: '123456',
      name: 'Vikas Patil',
      skills: ['medical', 'first-aid'],
    },
  });
  assert.equal(volReg.status, 201);
  assert.equal(volReg.data.user.role, 'volunteer');
  assert.equal(volReg.data.user.volunteerStatus, 'pending');
  const vikasVolId = volReg.data.user.volunteerId;
  const vikasToken = volReg.data.accessToken;
  console.log('   ✅ New volunteer registered with pending status');

  // Pending volunteer cannot accept requests
  const tryAccept = await req(`/api/requests/${guestReq.data.id}/accept`, {
    method: 'POST',
    token: vikasToken,
    body: { volunteerId: vikasVolId },
  });
  assert.equal(tryAccept.status, 403);
  console.log('   ✅ Pending volunteer cannot accept requests (403)');

  // Organiser checks pending volunteers list
  const pendingList = await req('/api/auth/volunteers/pending', { token: organiserToken });
  assert.equal(pendingList.status, 200);
  assert.ok(pendingList.data.some((v) => v.id === vikasVolId));
  console.log('   ✅ Organiser sees pending volunteer in list');

  // Organiser approves volunteer
  const approveRes = await req(`/api/auth/volunteers/${vikasVolId}/status`, {
    method: 'PATCH',
    token: organiserToken,
    body: { status: 'approved' },
  });
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.data.status, 'approved');
  assert.equal(approveRes.data.verified, true);
  console.log('   ✅ Organiser approved volunteer');

  // Approved volunteer goes online
  const onlineRes = await req(`/api/volunteers/${vikasVolId}`, {
    method: 'PATCH',
    token: vikasToken,
    body: { online: true },
  });
  assert.equal(onlineRes.status, 200);
  assert.equal(onlineRes.data.online, true);
  console.log('   ✅ Approved volunteer went online');

  // Approved online volunteer can now accept request
  const acceptRes = await req(`/api/requests/${guestReq.data.id}/accept`, {
    method: 'POST',
    token: vikasToken,
    body: { volunteerId: vikasVolId },
  });
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.data.status, 'accepted');
  console.log('   ✅ Approved volunteer accepted request');

  // Complete request
  const completeRes = await req(`/api/requests/${guestReq.data.id}/complete`, {
    method: 'POST',
    token: vikasToken,
  });
  assert.equal(completeRes.status, 200);
  assert.equal(completeRes.data.status, 'completed');
  console.log('   ✅ Volunteer completed request');

  // Organiser suspends volunteer
  const suspendRes = await req(`/api/auth/volunteers/${vikasVolId}/status`, {
    method: 'PATCH',
    token: organiserToken,
    body: { status: 'suspended' },
  });
  assert.equal(suspendRes.status, 200);
  assert.equal(suspendRes.data.status, 'suspended');
  assert.equal(suspendRes.data.online, false);
  console.log('   ✅ Organiser suspended volunteer, forced offline');

  console.log('\n🎉 ALL AUTH & SECURITY TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((e) => {
  console.error('\n❌ Test failed:', e);
  process.exit(1);
});
