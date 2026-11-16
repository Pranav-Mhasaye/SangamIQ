// Comprehensive lifecycle & state machine test suite for SangamIQ
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { initDb } from '../src/repos/db.js';
import {
  STATUSES,
  VALID_TRANSITIONS,
  canTransition,
  createHelpRequest,
  getHelpRequestById,
  acceptHelpRequest,
  updateRequestStatus,
  releaseHelpRequest,
  submitFeedback,
  escalateHelpRequest,
} from '../src/repos/requestsRepo.js';
import { getAllVolunteers } from '../src/repos/volunteersRepo.js';

const PORT = process.env.TEST_PORT || 3004;
const BASE = `http://localhost:${PORT}`;

async function req(urlPath, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runDirectUnitTests() {
  console.log('--- 1. Testing State Transition Rules & canTransition() ---');

  // Verify valid transitions
  assert.equal(canTransition('open', 'accepted'), true);
  assert.equal(canTransition('open', 'escalated'), true);
  assert.equal(canTransition('open', 'cancelled'), true);

  assert.equal(canTransition('escalated', 'accepted'), true);
  assert.equal(canTransition('escalated', 'escalated'), true);
  assert.equal(canTransition('escalated', 'cancelled'), true);

  assert.equal(canTransition('accepted', 'on_the_way'), true);
  assert.equal(canTransition('accepted', 'open'), true);
  assert.equal(canTransition('accepted', 'cancelled'), true);

  assert.equal(canTransition('on_the_way', 'arrived'), true);
  assert.equal(canTransition('on_the_way', 'open'), true);
  assert.equal(canTransition('on_the_way', 'cancelled'), true);

  assert.equal(canTransition('arrived', 'completed'), true);
  assert.equal(canTransition('arrived', 'open'), true);
  assert.equal(canTransition('arrived', 'cancelled'), true);

  // Verify invalid transitions
  assert.equal(canTransition('open', 'completed'), false);
  assert.equal(canTransition('open', 'on_the_way'), false);
  assert.equal(canTransition('open', 'arrived'), false);

  assert.equal(canTransition('accepted', 'arrived'), false);
  assert.equal(canTransition('accepted', 'completed'), false);

  assert.equal(canTransition('on_the_way', 'completed'), false);

  assert.equal(canTransition('completed', 'open'), false);
  assert.equal(canTransition('completed', 'accepted'), false);
  assert.equal(canTransition('cancelled', 'open'), false);
  assert.equal(canTransition('cancelled', 'accepted'), false);

  console.log('   ✅ All valid & invalid transition rules verified');

  console.log('\n--- 2. Direct Repository Unit Tests ---');
  await initDb();
  const volunteers = await getAllVolunteers();
  assert.ok(volunteers.length > 0, 'Volunteers should be seeded');
  const testVol = volunteers[0];

  // Create initial request
  const devId = 'unit_test_device_' + Date.now();
  const req1 = await createHelpRequest({
    type: 'medical',
    lat: 18.6764,
    lng: 73.8977,
    name: 'Unit Test Pilgrim',
    deviceId: devId,
  });
  assert.ok(req1.id);
  assert.equal(req1.status, 'open');
  assert.ok(Array.isArray(req1.timeline));
  assert.equal(req1.timeline[0].status, 'open');
  console.log('   ✅ Help request created with initial timeline');

  // Duplicate request check within 2 minutes
  let dupThrew = false;
  try {
    await createHelpRequest({
      type: 'medical',
      lat: 18.6764,
      lng: 73.8977,
      deviceId: devId,
    });
  } catch (err) {
    dupThrew = true;
    assert.equal(err.code, 'DUPLICATE_REQUEST');
  }
  assert.equal(dupThrew, true);
  console.log('   ✅ Duplicate open request for same type blocked within 2 min');

  // Different type allows creation
  const reqWater = await createHelpRequest({
    type: 'water',
    lat: 18.6764,
    lng: 73.8977,
    deviceId: devId,
  });
  assert.ok(reqWater.id);
  console.log('   ✅ Request with different type allowed for same device');

  // Test Invalid transition directly
  const badTransition = await updateRequestStatus(req1.id, 'completed', { actor: 'Tester' });
  assert.equal(badTransition.error, 'invalid_transition');
  console.log('   ✅ Direct invalid transition (open -> completed) rejected');

  // Accept request (open -> accepted)
  const acceptRes = await acceptHelpRequest(req1.id, testVol.id);
  assert.equal(acceptRes.request.status, 'accepted');
  assert.equal(acceptRes.request.acceptedBy, testVol.id);
  assert.equal(acceptRes.request.timeline.length, 2);
  assert.equal(acceptRes.request.timeline[1].status, 'accepted');
  console.log('   ✅ Request accepted (open -> accepted) with timeline entry');

  // Release request (accepted -> open)
  const releaseRes = await releaseHelpRequest(req1.id, testVol.id, testVol.name);
  assert.equal(releaseRes.request.status, 'open');
  assert.equal(releaseRes.request.acceptedBy, null);
  assert.equal(releaseRes.request.timeline.slice(-1)[0].status, 'open');
  assert.equal(releaseRes.request.timeline.slice(-1)[0].note, 'Released back to open pool');
  console.log('   ✅ Volunteer released task back to open pool');

  // Re-accept and advance through state machine
  await acceptHelpRequest(req1.id, testVol.id);
  const onTheWayRes = await updateRequestStatus(req1.id, 'on_the_way', { actor: testVol.name });
  assert.equal(onTheWayRes.request.status, 'on_the_way');

  const arrivedRes = await updateRequestStatus(req1.id, 'arrived', { actor: testVol.name });
  assert.equal(arrivedRes.request.status, 'arrived');

  const completedRes = await updateRequestStatus(req1.id, 'completed', { actor: testVol.name });
  assert.equal(completedRes.request.status, 'completed');
  assert.ok(completedRes.request.completedAt);
  console.log('   ✅ Advanced cleanly: accepted -> on_the_way -> arrived -> completed');

  // Rating and Feedback
  const badRating = await submitFeedback(req1.id, { rating: 6 });
  assert.equal(badRating.error, 'invalid_rating');

  const goodRating = await submitFeedback(req1.id, { rating: 5, comment: 'Helpful volunteer, reached quickly!' });
  assert.equal(goodRating.request.rating, 5);
  assert.equal(goodRating.request.feedback, 'Helpful volunteer, reached quickly!');
  console.log('   ✅ Post-completion feedback submitted and recorded');

  // Escalation testing
  const reqEsc = await createHelpRequest({
    type: 'toilet',
    lat: 18.6764,
    lng: 73.8977,
  });
  const esc1 = await escalateHelpRequest(reqEsc.id, 1);
  assert.equal(esc1.status, 'escalated');
  assert.equal(esc1.escalationRound, 1);
  assert.equal(esc1.maxEscalated, false);

  const esc2 = await escalateHelpRequest(reqEsc.id, 2);
  assert.equal(esc2.escalationRound, 2);

  const esc3 = await escalateHelpRequest(reqEsc.id, 3);
  assert.equal(esc3.escalationRound, 3);
  assert.equal(esc3.maxEscalated, true);
  console.log('   ✅ Escalation rounds 1..3 tested, maxEscalated flag raised on round 3');
}

async function runHttpIntegrationTests() {
  console.log('\n--- 3. HTTP Server Endpoints & Security Integration ---');

  // Start standalone server on TEST_PORT
  const serverPath = path.resolve(__dirname, '../src/index.js');
  const serverProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      PORT: String(PORT),
      USE_MEMORY_DB: 'true',
      DEV_OTP: 'true',
    },
    stdio: 'pipe',
  });

  try {
    // Wait for server to boot
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await req('/api/health');
        if (res.status === 200) {
          ready = true;
          break;
        }
      } catch {
        // wait
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(ready, 'Test server failed to start within 6s');
    console.log(`   ✅ Test server started on http://localhost:${PORT}`);

    // Create request via API (guest attendee)
    const attendeeDevice = 'dev_http_test_' + Date.now();
    const createRes = await req('/api/requests', {
      method: 'POST',
      body: {
        type: 'medical',
        lat: 18.6764,
        lng: 73.8977,
        name: 'Gita Devi',
        deviceId: attendeeDevice,
      },
    });
    assert.ok(createRes.status === 200 || createRes.status === 201);
    const reqId = createRes.data.id;
    assert.equal(createRes.data.status, 'open');

    // Duplicate request check (HTTP 429)
    const dupRes = await req('/api/requests', {
      method: 'POST',
      body: {
        type: 'medical',
        lat: 18.6764,
        lng: 73.8977,
        deviceId: attendeeDevice,
      },
    });
    assert.equal(dupRes.status, 429);
    console.log('   ✅ HTTP 429 duplicate request returned for repeated request within 2 min');

    // Fetch volunteers list to get a valid phone
    const volListRes = await req('/api/volunteers');
    assert.equal(volListRes.status, 200);
    const firstVol = volListRes.data[0];

    // Login as volunteer (Dev OTP)
    await req('/api/auth/send-otp', {
      method: 'POST',
      body: { phone: firstVol.phone },
    });
    const volLogin = await req('/api/auth/verify-otp', {
      method: 'POST',
      body: { phone: firstVol.phone, otp: '123456', role: 'volunteer' },
    });
    assert.equal(volLogin.status, 200);
    const volToken = volLogin.data.accessToken;

    // Put volunteer online
    await req(`/api/volunteers/${volLogin.data.user.volunteerId}`, {
      method: 'PATCH',
      token: volToken,
      body: { online: true },
    });

    // Accept request
    const acceptRes = await req(`/api/requests/${reqId}/accept`, {
      method: 'POST',
      token: volToken,
      body: { volunteerId: volLogin.data.user.volunteerId },
    });
    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.data.status, 'accepted');

    // Invalid transition test via API (accepted -> arrived should fail 400)
    const badArrive = await req(`/api/requests/${reqId}/arrived`, {
      method: 'POST',
      token: volToken,
    });
    assert.equal(badArrive.status, 400);
    console.log('   ✅ Invalid transition (accepted -> arrived) blocked with HTTP 400');

    // Valid: on_the_way
    const onWayRes = await req(`/api/requests/${reqId}/on_the_way`, {
      method: 'POST',
      token: volToken,
    });
    assert.equal(onWayRes.status, 200);
    assert.equal(onWayRes.data.status, 'on_the_way');

    // Release from on_the_way back to open
    const releaseRes = await req(`/api/requests/${reqId}/release`, {
      method: 'POST',
      token: volToken,
    });
    assert.equal(releaseRes.status, 200);
    assert.equal(releaseRes.data.status, 'open');
    assert.equal(releaseRes.data.acceptedBy, null);
    console.log('   ✅ Volunteer released task; verified status returned to open');

    // Re-accept, advance to arrived then completed
    await req(`/api/requests/${reqId}/accept`, {
      method: 'POST',
      token: volToken,
      body: { volunteerId: volLogin.data.user.volunteerId },
    });
    await req(`/api/requests/${reqId}/on_the_way`, {
      method: 'POST',
      token: volToken,
    });
    const arrRes = await req(`/api/requests/${reqId}/arrived`, {
      method: 'POST',
      token: volToken,
    });
    assert.equal(arrRes.status, 200);
    assert.equal(arrRes.data.status, 'arrived');

    const doneRes = await req(`/api/requests/${reqId}/complete`, {
      method: 'POST',
      token: volToken,
    });
    assert.equal(doneRes.status, 200);
    assert.equal(doneRes.data.status, 'completed');
    console.log('   ✅ Request completed through HTTP API');

    // Post-completion rating via API
    const rateRes = await req(`/api/requests/${reqId}/feedback`, {
      method: 'POST',
      body: { rating: 5, comment: 'Great service' },
    });
    assert.equal(rateRes.status, 200);
    assert.equal(rateRes.data.rating, 5);
    assert.equal(rateRes.data.feedback, 'Great service');
    console.log('   ✅ Rating & feedback submitted successfully via HTTP API');

  } finally {
    serverProcess.kill('SIGTERM');
  }
}

async function main() {
  console.log('========================================================');
  console.log('  SangamIQ Help Request Lifecycle & State Machine Tests  ');
  console.log('========================================================\n');

  await runDirectUnitTests();
  await runHttpIntegrationTests();

  console.log('\n🎉 ALL LIFECYCLE & STATE MACHINE TESTS PASSED!\n');
}

main().catch((err) => {
  console.error('\n❌ Lifecycle test failed:', err);
  process.exit(1);
});
