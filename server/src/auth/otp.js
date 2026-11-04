// OTP provider interface with pluggable backends.
// Set OTP_PROVIDER=twilio|msg91|exotel in env to use a real SMS provider.
// Set DEV_OTP=true (the default when no .env) to accept 123456 for every phone.

import { randomInt } from 'node:crypto';

// In-memory OTP store: phone → { code, expiresAt }
const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function generateOTP() {
  return String(randomInt(100000, 999999));
}

// ---------- Provider interface ----------

class OTPProvider {
  /** @param {string} phone  @returns {Promise<boolean>} */
  async send(phone) { throw new Error('not implemented'); }
  /** @param {string} phone  @param {string} otp  @returns {Promise<boolean>} */
  async verify(phone, otp) { throw new Error('not implemented'); }
}

// ---------- Console provider (development) ----------

class ConsoleProvider extends OTPProvider {
  async send(phone) {
    const code = generateOTP();
    otpStore.set(phone, { code, expiresAt: Date.now() + OTP_TTL_MS });
    console.log(`\n🔑  OTP for ${phone}: ${code}\n`);
    return true;
  }

  async verify(phone, otp) {
    // In dev mode, always accept 123456
    if (process.env.DEV_OTP !== 'false' && otp === '123456') return true;

    const entry = otpStore.get(phone);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) { otpStore.delete(phone); return false; }
    if (entry.code !== otp) return false;
    otpStore.delete(phone);
    return true;
  }
}

// ---------- Twilio stub (production placeholder) ----------

class TwilioProvider extends OTPProvider {
  constructor() {
    super();
    // TODO: initialise Twilio client from env:
    //   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID
    console.warn('TwilioProvider is a stub — implement real SMS sending before production use.');
  }

  async send(phone) {
    // TODO: call Twilio Verify API to send OTP
    // For now, fall back to console
    const code = generateOTP();
    otpStore.set(phone, { code, expiresAt: Date.now() + OTP_TTL_MS });
    console.log(`[TwilioStub] OTP for ${phone}: ${code}`);
    return true;
  }

  async verify(phone, otp) {
    // TODO: call Twilio Verify API to check OTP
    const entry = otpStore.get(phone);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) { otpStore.delete(phone); return false; }
    if (entry.code !== otp) return false;
    otpStore.delete(phone);
    return true;
  }
}

// ---------- MSG91 stub ----------

class MSG91Provider extends OTPProvider {
  constructor() {
    super();
    console.warn('MSG91Provider is a stub — implement real SMS sending before production use.');
  }
  async send(phone) {
    const code = generateOTP();
    otpStore.set(phone, { code, expiresAt: Date.now() + OTP_TTL_MS });
    console.log(`[MSG91Stub] OTP for ${phone}: ${code}`);
    return true;
  }
  async verify(phone, otp) {
    const entry = otpStore.get(phone);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) { otpStore.delete(phone); return false; }
    if (entry.code !== otp) return false;
    otpStore.delete(phone);
    return true;
  }
}

// ---------- Factory ----------

const PROVIDERS = {
  console: ConsoleProvider,
  twilio: TwilioProvider,
  msg91: MSG91Provider,
  exotel: MSG91Provider, // same stub for now
};

const providerName = (process.env.OTP_PROVIDER || 'console').toLowerCase();
const Provider = PROVIDERS[providerName] || ConsoleProvider;

export const otpProvider = new Provider();

