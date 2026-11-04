# SangamIQ - working prototype

## Live links
- **Landing page:** https://pranav-mhasaye.github.io/SangamIQ/
- **Working prototype:** https://sangamiq.onrender.com

AI-assisted real-time help for large gatherings (built around Alandi / Ashadhi Wari, Pune).
Three apps in one: **Attendee** (phone-style UI), **Volunteer** dashboard, **Organiser** control room.

## Run it

Requires Node.js 20+.

```bash
npm run setup     # installs root, server and client dependencies
npm run dev       # API http://localhost:3001  +  web http://localhost:5173
```

Open http://localhost:5173 and pick a role. Best demo: open **Attendee** in one window (or on your phone, same Wi-Fi, using the Network URL Vite prints) and **Volunteer** + **Organiser** in others, then send a help request and watch it move live.

Production-style single server: `npm run build && npm start` then open http://localhost:3001.

## What works

- **Attendee:** nearby medical / water / food / toilet / help desk / transport on a map, request help (with Emergency option), live request tracking, call volunteer, get walking directions, alerts, profile, Marathi / Hindi / English, large-text mode.
- **Voice AI:** tap the mic and speak (Chrome / Edge / Android Chrome) or type: "मला पाणी हवे आहे", "doctor", "where is the toilet". The reply is read aloud in the chosen language and a request is created.
- **Volunteer:** register or sign in with phone + OTP, pending approval screen until approved, go online/offline, requests ranked by match + distance, accept, mark done, directions.
- **Organiser:** sign in with email + password (`admin@sangamiq.local` / `admin123`), live crowd heatmap, 15-minute forecast per zone, automatic crowd alerts, broadcast alerts in 3 languages, request table, KPIs, "Simulate surge" button, and a dedicated **Volunteers** tab to approve, reject or suspend volunteers.
- **Authentication & Security:** Pluggable OTP provider (console prints code, dev OTP `123456`, SMS stubs for Twilio/MSG91/Exotel), bcrypt for organiser passwords, short-lived JWT access tokens + httpOnly refresh tokens, `express-rate-limit`, `helmet`, and anonymous guest mode for attendees in emergencies.
- **Matching:** nearest online verified & approved volunteers scored by distance, skill fit and current workload.

## Sample data and limits

All places, volunteers and crowd numbers are fake sample data near Alandi. The attendee app uses a fixed demo location in Alandi (Profile -> "Use my real GPS location" switches to your GPS, though the sample places will then be far away). The voice NLU is keyword based, crowd data is simulated, there is no login, and data lives in memory (resets on server restart; `POST /api/demo/reset` also resets it). See `PROJECT_SPEC.md` for the roadmap.

Map tiles come from OpenStreetMap, so the browser needs internet access.

## Known limitations

1. **In-Memory Store (No Database)**: Seeded and runtime data lives in process memory (`server/src/data.js`). Data resets on server restart or via `POST /api/demo/reset`. Production target schema is provided in `docs/schema.sql` (PostgreSQL + PostGIS).
2. **Development OTP & In-Memory Sessions**: SMS OTP defaults to the console provider with dev code `123456` when `DEV_OTP=true` (stubs ready for Twilio/MSG91/Exotel). Active sessions and refresh tokens are kept in memory until the database layer is connected.
3. **In-Browser Voice Only (No IVR Dial-in)**: Voice assistance utilizes the browser's Web Speech API and keyword NLU; cloud IVR / telephony dial-in for basic feature phones (e.g. via Twilio or Exotel) is not yet integrated.
4. **No Real Emergency Dispatch**: Requests flagged as "Emergency" or "critical" notify and prioritize in-app volunteers only; they do not dispatch to municipal 108 ambulance or police systems.
5. **Simulated Crowd Intelligence**: The 15-minute zone forecast is driven by an internal simulator and trend extrapolator (`crowd.js`), not real physical CCTV cameras or telecom footfall telemetry.

## Structure

```
server/src/  index.js (API + matching)  voice.js (voice AI)  crowd.js (simulation + forecast)  data.js (seed)  bus.js (SSE)
client/src/  views/ (Attendee, Volunteer, Organiser)  components/ (MapView, VoiceSheet)  i18n.js  api.js  styles.css
docs/schema.sql  target PostgreSQL/PostGIS schema
PROJECT_SPEC.md  product spec + roadmap     AGENTS.md  instructions for AI agents
```

## Using it in Antigravity

Open this folder as the workspace, run `npm run setup && npm run dev` in the terminal, then ask the agent to work through the "Next steps" in `PROJECT_SPEC.md`. `AGENTS.md` and `PROJECT_SPEC.md` give it the context from your venture deck.
