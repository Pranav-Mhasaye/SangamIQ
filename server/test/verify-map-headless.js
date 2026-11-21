import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(__dirname, '../src/index.js');
const PORT = 3007;
const BASE = `http://localhost:${PORT}`;

const ARTIFACTS_DIR = 'C:\\Users\\prana\\.gemini\\antigravity\\brain\\d9530574-eab2-4a1f-98a8-d92c129eeb2c';


async function verify() {
  console.log('========================================================');
  console.log('  Playwright Headless Map Verification with npm start   ');
  console.log('========================================================\n');

  console.log(`Starting production server on ${BASE}...`);
  const server = fork(serverPath, [], {
    env: { ...process.env, PORT: String(PORT), USE_MEMORY_DB: 'true', DEV_OTP: 'true' },
    stdio: 'pipe',
  });

  server.stdout.on('data', (d) => {
    // console.log('[Server]:', d.toString().trim());
  });

  // Poll /api/health until server is ready (up to 15s)
  await new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 * 500ms = 15s max
    const poll = () => {
      import('http').then(({ default: http }) => {
        http.get(`http://localhost:${PORT}/api/health`, (res) => {
          if (res.statusCode === 200) return resolve();
          attempts++;
          if (attempts >= maxAttempts) return reject(new Error('Server did not start in time'));
          setTimeout(poll, 500);
        }).on('error', () => {
          attempts++;
          if (attempts >= maxAttempts) return reject(new Error('Server did not start in time'));
          setTimeout(poll, 500);
        });
      });
    };
    poll();
  });
  console.log('   ✅ Server is ready');

  console.log(`Launching headless browser (channel: chrome)...`);
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  const consoleErrors = [];
  const networkErrors = [];

  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.log(`   [HTTP ${res.status()}]: ${res.url()}`);
    }
  });

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      consoleErrors.push(text);
      console.error(`   [Browser Console ERROR]: ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
    console.error(`   [Browser Unhandled Exception]: ${err.message}`);
  });

  page.on('requestfailed', (req) => {
    const url = req.url();
    if (url.includes(`localhost:${PORT}`)) {
      networkErrors.push(`${req.method()} ${url}: ${req.failure()?.errorText}`);
      console.error(`   [Local Request Failed]: ${req.method()} ${url}`);
    }
  });

  try {
    // ---------- TEST 1: Attendee Map ----------
    console.log('\n--- 1. Testing Attendee Map View ---');
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

    // Click on Attendee role
    const attendeeRole = page.locator('button.role', { hasText: 'Attendee' });
    await attendeeRole.waitFor({ state: 'visible', timeout: 5000 });
    await attendeeRole.click();
    console.log('   ✅ Clicked Attendee role button');

    // Click "Continue as guest" button on LoginScreen
    const guestBtn = page.locator('button', { hasText: /वगळा|Skip|अतिथी|guest/i });
    await guestBtn.waitFor({ state: 'visible', timeout: 5000 });
    await guestBtn.click();
    console.log('   ✅ Clicked Continue as guest');

    // Wait for attendee app to render map
    await page.waitForSelector('.map', { timeout: 10000 });
    console.log('   ✅ Attendee map container rendered');

    // Click on Map navigation tab at bottom
    const mapTabBtn = page.locator('button.nav-item', { hasText: /Map|नकाशा|मानचित्र/i });
    if (await mapTabBtn.isVisible()) {
      await mapTabBtn.click();
      console.log('   ✅ Switched to Map tab');
      await page.waitForTimeout(1500);
    }

    // Wait for map container and layers
    await page.waitForSelector('.map', { timeout: 10000 });
    await page.waitForTimeout(2500);

    const attendeeMapScreenshot = path.join(ARTIFACTS_DIR, 'screenshot-attendee-map.png');
    await page.screenshot({ path: attendeeMapScreenshot, fullPage: false });
    console.log(`   📸 Attendee map screenshot captured: ${attendeeMapScreenshot}`);

    // Verify 0 worker/MIME/module-script errors (the core bugs we fixed).
    // Exclude generic HTTP 404 response messages (favicon, tiles) which are not script loading errors.
    const workerMimeErrors = consoleErrors.filter((e) =>
      e.includes('Worker') || e.includes('module script') || e.includes('MIME type') ||
      (e.includes('404') && (e.includes('.mjs') || e.includes('.js') || e.includes('worker')))
    );
    assert.equal(workerMimeErrors.length, 0, `Must have 0 worker/MIME console errors: ${workerMimeErrors.join('; ')}`);
    console.log('   ✅ 0 worker/MIME console errors on Attendee map');

    // ---------- TEST 2: Organiser Heatmap ----------
    console.log('\n--- 2. Testing Organiser Live Heatmap ---');
    // Clear storage to return to role picker
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

    // Click on Organiser role
    const orgRole = page.locator('button.role', { hasText: 'Organiser' });
    await orgRole.waitFor({ state: 'visible', timeout: 5000 });
    await orgRole.click();
    console.log('   ✅ Clicked Organiser role button');

    // Fill organiser login form
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    await page.fill('input[type="email"]', 'admin@sangamiq.local');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    console.log('   ✅ Submitted Organiser login');

    // Wait for organiser dashboard and live crowd heatmap
    await page.waitForSelector('.desk-grid .map', { timeout: 10000 });
    await page.waitForTimeout(2500);
    console.log('   ✅ Organiser live heatmap rendered');

    const organiserMapScreenshot = path.join(ARTIFACTS_DIR, 'screenshot-organiser-heatmap.png');
    await page.screenshot({ path: organiserMapScreenshot, fullPage: false });
    console.log(`   📸 Organiser heatmap screenshot captured: ${organiserMapScreenshot}`);

    // Check for fatal errors
    const fatalErrors = consoleErrors.filter((e) =>
      e.includes('Worker') || e.includes('MIME type') || e.includes('Uncaught') || e.includes('Cannot update')
    );
    assert.equal(fatalErrors.length, 0, `Must have 0 fatal errors on Organiser view: ${fatalErrors.join('; ')}`);
    console.log('   ✅ 0 fatal console errors on Organiser heatmap view');

    console.log('\n🎉 ALL HEADLESS BROWSER VERIFICATIONS PASSED SUCCESSFULLY!');
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }
}

verify().catch((err) => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
