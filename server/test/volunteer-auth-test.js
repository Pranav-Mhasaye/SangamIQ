// API tests for volunteer self-update, role authorization, and static SPA routing.
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(__dirname, '../src/index.js');
const PORT = 3006;
const BASE = `http://localhost:${PORT}`;

async function runTests() {
  console.log('========================================================');
  console.log('  SangamIQ Volunteer Auth & Static SPA Routing Tests    ');
  console.log('========================================================\n');

  const child = fork(serverPath, [], {
    env: { ...process.env, PORT: String(PORT), USE_MEMORY_DB: 'true', DEV_OTP: 'true' },
    stdio: 'pipe',
  });

  child.stdout.on('data', (d) => {
    // console.log('[Server stdout]:', d.toString());
  });
  child.stderr.on('data', (d) => {
    // console.error('[Server stderr]:', d.toString());
  });

  // Wait for server to come up
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    // 1. Check static file routing vs SPA catch-all
    console.log('--- 1. Testing Static File Routing & 404 Behavior ---');
    
    // Missing asset with file extension must return 404
    const resMissingAsset = await fetch(`${BASE}/assets/non-existent-worker.mjs`);
    assert.equal(resMissingAsset.status, 404, 'Missing asset with extension must return 404');
    const missingAssetText = await resMissingAsset.text();
    assert.ok(!missingAssetText.includes('<!doctype html>'), 'Missing asset must not return HTML');
    console.log('   ✅ Missing asset /assets/non-existent-worker.mjs returned 404, not index.html');

    // Missing JS file must return 404
    const resMissingJs = await fetch(`${BASE}/assets/missing.js`);
    assert.equal(resMissingJs.status, 404, 'Missing .js file must return 404');
    console.log('   ✅ Missing .js asset returned 404');

    // SPA navigation route (no extension) with Accept: text/html must return 200 and index.html
    const resSpa = await fetch(`${BASE}/attendee`, { headers: { Accept: 'text/html' } });
    assert.equal(resSpa.status, 200, 'SPA route must return 200');
    const spaText = await resSpa.text();
    assert.ok(spaText.includes('<!doctype html>'), 'SPA route must return index.html');
    console.log('   ✅ SPA navigation route /attendee returned index.html');

    // Existing asset (worker or index.html)
    const resRoot = await fetch(`${BASE}/`);
    assert.equal(resRoot.status, 200);
    console.log('   ✅ Root / returned 200 index.html');

    // 2. Testing Volunteer Auth & Authorization
    console.log('\n--- 2. Testing Volunteer Self-Management & Security ---');

    // Unauthenticated PATCH /api/volunteers/vol_116 -> 401
    const resUnauth = await fetch(`${BASE}/api/volunteers/vol_116`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ online: true }),
    });
    assert.equal(resUnauth.status, 401, 'Unauthenticated patch must return 401');
    console.log('   ✅ Unauthenticated PATCH /api/volunteers/:id returns 401');

    // Log in as seeded volunteer Sneha Kulkarni (+91900000116)
    // Sneha's volunteer record is vol_116
    const resLoginVol116 = await fetch(`${BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+91900000116', otp: '123456', role: 'volunteer' }),
    });
    assert.equal(resLoginVol116.status, 200, 'Login as vol_116 should succeed');
    const dataVol116 = await resLoginVol116.json();
    assert.ok(dataVol116.accessToken, 'Must return accessToken');
    assert.equal(dataVol116.user.volunteerId, 'vol_116', 'User must be linked to vol_116');
    const tokenVol116 = dataVol116.accessToken;
    console.log('   ✅ Logged in as volunteer vol_116 successfully');

    // Log in as seeded volunteer Rahul Jadhav (+91900000117)
    // Rahul's volunteer record is vol_117
    const resLoginVol117 = await fetch(`${BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+91900000117', otp: '123456', role: 'volunteer' }),
    });
    assert.equal(resLoginVol117.status, 200, 'Login as vol_117 should succeed');
    const dataVol117 = await resLoginVol117.json();
    assert.equal(dataVol117.user.volunteerId, 'vol_117', 'User must be linked to vol_117');
    const tokenVol117 = dataVol117.accessToken;
    console.log('   ✅ Logged in as volunteer vol_117 successfully');

    // Test 1: Volunteer updates SELF -> 200 OK
    const resUpdateSelf = await fetch(`${BASE}/api/volunteers/vol_116`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol116}`,
      },
      body: JSON.stringify({ online: true, lat: 18.6770, lng: 73.8980 }),
    });
    assert.equal(resUpdateSelf.status, 200, 'Volunteer updating self must return 200');
    const updatedSelf = await resUpdateSelf.json();
    assert.equal(updatedSelf.id, 'vol_116');
    assert.equal(updatedSelf.online, true);
    console.log('   ✅ Volunteer updates self: 200 OK');

    // Test 2: Volunteer updates ANOTHER volunteer -> 403 Forbidden
    const resUpdateOther = await fetch(`${BASE}/api/volunteers/vol_116`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenVol117}`, // token for vol_117 trying to patch vol_116!
      },
      body: JSON.stringify({ online: false }),
    });
    assert.equal(resUpdateOther.status, 403, 'Volunteer updating another volunteer must return 403');
    const errData = await resUpdateOther.json();
    assert.equal(errData.code, 'FORBIDDEN_VOLUNTEER_MISMATCH');
    console.log('   ✅ Volunteer updates another volunteer: 403 Forbidden (FORBIDDEN_VOLUNTEER_MISMATCH)');

    // Test 3: Organiser updates ANY volunteer -> 200 OK
    const resLoginOrg = await fetch(`${BASE}/api/auth/login-organiser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@sangamiq.local', password: 'admin123' }),
    });
    assert.equal(resLoginOrg.status, 200, 'Organiser login should succeed');
    const dataOrg = await resLoginOrg.json();
    const tokenOrg = dataOrg.accessToken;

    const resOrgUpdate = await fetch(`${BASE}/api/volunteers/vol_116`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOrg}`,
      },
      body: JSON.stringify({ online: false }),
    });
    assert.equal(resOrgUpdate.status, 200, 'Organiser must be able to update any volunteer');
    console.log('   ✅ Organiser updates any volunteer: 200 OK');

    // Test 4: New volunteer login via verify-otp auto-creates linked volunteer record
    const resNewVol = await fetch(`${BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+919888877777', otp: '123456', role: 'volunteer' }),
    });
    assert.equal(resNewVol.status, 200);
    const dataNewVol = await resNewVol.json();
    assert.ok(dataNewVol.user.volunteerId, 'New volunteer user must have a non-null volunteerId');
    
    // Verify that the new volunteer can update their own location
    const resNewUpdate = await fetch(`${BASE}/api/volunteers/${dataNewVol.user.volunteerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataNewVol.accessToken}`,
      },
      body: JSON.stringify({ online: true, lat: 18.6775, lng: 73.8985 }),
    });
    assert.equal(resNewUpdate.status, 200, 'Newly registered volunteer can update self');
    console.log('   ✅ Newly registered volunteer automatically gets linked record and 200 on self-update');

    console.log('\n🎉 ALL VOLUNTEER AUTH & SPA ROUTING TESTS PASSED!');
  } finally {
    child.kill('SIGTERM');
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
