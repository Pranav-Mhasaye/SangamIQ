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

### Database & Docker (PostgreSQL + PostGIS)

SangamIQ supports PostgreSQL with PostGIS for spatial indexing, KNN volunteer matching, and persistent crowd monitoring:

```bash
# 1. Start PostgreSQL + PostGIS via Docker
docker compose up -d

# 2. Run schema migrations
npm run db:migrate

# 3. Seed Alandi sample data (services, volunteers, zones, requests)
npm run db:seed
```

**Zero-database fallback**: If Docker is not running or `USE_MEMORY_DB=true` is set, the repository layer automatically falls back to the in-memory store so you can demo without any external dependencies.

## What works

- **Attendee:** nearby medical / water / food / toilet / help desk / transport on a map, request help (with Emergency option), live request tracking, call volunteer, get walking directions, alerts, profile, Marathi / Hindi / English, large-text mode.
- **Voice AI & NLU:**
  - **Speech-to-Text (`POST /api/voice/transcribe`):** Pluggable STT provider supporting OpenAI Whisper and Google Cloud Speech-to-Text with language hints for Marathi (`mr`), Hindi (`hi`), and English (`en-IN`), with browser `SpeechRecognition` and `MediaRecorder` as free fallbacks. Raw audio content is never logged or persisted.
  - **LLM Intent Classification:** Powered by configurable LLM (`gemini`, `claude`, `openai`, or `keyword` fallback) returning strict JSON: `intent` (`request_help`, `find_service`, `report_lost_person`, `ask_info`, `unknown`), `type`, `emergency`, `urgency` (1–5), `confidence`, and `extractedDetails` (who, symptoms, landmark).
  - **Unbypassable Safety Overrides:** Mentions of chest pain, unconsciousness, heavy bleeding, breathing trouble, or suicide keywords unconditionally trigger `emergency=true`, `urgency=5`, and `priority='critical'`. The system replies with safe instructions to stay calm and stay put while alerting volunteers, strictly withholding unauthorized medical advice.
  - **Multi-Turn Confirmation:** Low-confidence results (< 0.75) or ambiguous queries trigger multi-turn confirmation ("Did you say you need water?") supported both by spoken yes/no and two prominent touch buttons.
  - **Text-to-Speech (`POST /api/voice/tts`):** Browser `speechSynthesis` by default, with optional server TTS (Google Cloud Text-to-Speech) for high-quality natural Marathi neural voices (`mr-IN-Wavenet-A`).
  - **Accuracy Evaluation:** Comprehensive 69-phrase benchmark across Marathi, Hindi, English, Hinglish, Romanised Marathi, and noisy phrases runnable with `npm run eval:voice`.
- **Volunteer:** register or sign in with phone + OTP, pending approval screen until approved, go online/offline, reports live location every 10s while online, requests ranked by match + distance, accept, set on the way, mark arrived, complete, release task back to open pool, directions.
- **Hardened Help-Request Lifecycle:**
  - Formal state machine (`open -> accepted -> on_the_way -> arrived -> completed`, plus `cancelled` and `escalated`).
  - Full request audit timeline (status, actor, timestamp, note) viewable in Attendee track screen and Organiser requests table.
  - Auto-escalation engine: unaccepted requests escalate after 90s (critical: 30s), expanding volunteer match radius; after 3 rounds, an alert is raised and attendee is shown directions to the nearest physical help point.
  - Live volunteer tracking & ETA: attendee Track screen shows approaching volunteer moving live on the map.
  - Duplicate request protection: blocks spam/duplicate open requests of the same type within 2 minutes (HTTP 429).
  - Post-completion rating: 1-5 emoji ratings with optional comment, with average rating and response KPIs displayed on the Organiser dashboard.
- **Organiser:** sign in with email + password (`admin@sangamiq.local` / `admin123`), live crowd heatmap, 15-minute forecast per zone, automatic crowd alerts, broadcast alerts in 3 languages, request table with lifecycle timeline and ratings, KPIs (avg rating, avg response time), "Simulate surge" button, and a dedicated **Volunteers** tab to approve, reject or suspend volunteers.
- **Authentication & Security:** Pluggable OTP provider (console prints code, dev OTP `123456`, SMS stubs for Twilio/MSG91/Exotel), bcrypt for organiser passwords, short-lived JWT access tokens + httpOnly refresh tokens, `express-rate-limit`, `helmet`, and anonymous guest mode for attendees in emergencies.
- **Matching:** nearest online verified & approved volunteers scored by distance, skill fit and current workload.

### Map Tiles & Spatial Layers

The app renders maps via Leaflet using **OpenFreeMap** vector tiles rendered with MapLibre GL by default. OpenFreeMap is completely free, requires no API key, imposes no request caps, and permits commercial use.

If you outgrow the free OpenFreeMap tier, need custom styles, or want an enterprise SLA, you can switch to any raster tile provider by setting environment variables in client configuration:

- **CARTO Basemaps (Voyager / Positron)**: Free key (no credit card) at https://carto.com/basemaps/apikey (1M–5M tiles/month free):
  ```env
  VITE_TILE_URL=https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=YOUR_API_KEY
  VITE_TILE_ATTRIBUTION=© <a href="https://carto.com">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>
  ```
- **MapTiler**: Free tier (100k requests/month, no credit card) at https://cloud.maptiler.com:
  ```env
  VITE_TILE_URL=https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=YOUR_API_KEY
  ```
- **Stadia Maps**: Free tier (200k tiles/month, no credit card) at https://client.stadiamaps.com:
  ```env
  VITE_TILE_URL=https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png?api_key=YOUR_API_KEY
  ```
- **Self-Hosted Protomaps / TileServer GL**: For 100% offline or on-premises deployments:
  ```env
  VITE_TILE_URL=http://localhost:8080/tiles/{z}/{x}/{y}.png
  ```

**Offline / Error Graceful Degradation:**
If the configured tile server fails or network is lost (5+ consecutive tile load errors), the map automatically falls back to an offline canvas grid with a subtle *"Map tiles unavailable"* badge. Crucially, all interactive layers — emergency pins, crowd zone circles, volunteer markers, and user GPS locations — remain fully interactive and visible.

## Sample data and limits

All places, volunteers and crowd numbers are fake sample data near Alandi. The attendee app uses a fixed demo location in Alandi (Profile → "Use my real GPS location" switches to your GPS, though the sample places will then be far away). Voice NLU runs via pluggable LLM (keyword fallback when no API key is set), crowd data is simulated, and data lives in memory by default (resets on server restart; `POST /api/demo/reset` also resets it). See `PROJECT_SPEC.md` for the roadmap.

## Known limitations

1. **Database Mode & In-Memory Fallback**: Production PostgreSQL + PostGIS database is supported via Docker and `node-pg-migrate`. When running without a live database or with `USE_MEMORY_DB=true`, data lives in memory and resets on restart.
2. **Development OTP**: SMS OTP defaults to the console provider with dev code `123456` when `DEV_OTP=true` (stubs ready for Twilio/MSG91/Exotel).
3. **In-Browser Voice Only (No IVR Dial-in)**: Voice AI supports pluggable STT (Whisper / Google Cloud STT) and LLM intent classification (Gemini / Claude / OpenAI), falling back to browser Web Speech API and keyword NLU when no API keys are configured. Cloud IVR / telephony dial-in for basic feature phones (e.g. via Twilio or Exotel) is not yet integrated.
4. **No Real Emergency Dispatch**: Requests flagged as "Emergency" or "critical" notify and prioritize in-app volunteers only; they do not dispatch to municipal 108 ambulance or police systems.
5. **Simulated Crowd Intelligence**: The 15-minute zone forecast is driven by an internal simulator and trend extrapolator (`crowd.js`), not real physical CCTV cameras or telecom footfall telemetry.

## Structure

```
server/src/repos/  db.js (pool/fallback)  servicesRepo  volunteersRepo  requestsRepo  zonesRepo  alertsRepo  usersRepo  tokensRepo  statsRepo
server/src/        index.js (API)  voice.js (orchestrator)  crowd.js (simulation + forecast)  data.js (seed)  bus.js (SSE)
server/src/voice/  safety.js  keyword.js  llm.js  stt.js  tts.js
server/migrations/ 001_init_postgis_schema.cjs
client/src/        views/ (Attendee, Volunteer, Organiser)  components/ (MapView, VoiceSheet)  auth.jsx  i18n.js  api.js  styles.css
docker-compose.yml PostGIS container setup
PROJECT_SPEC.md    product spec + roadmap     AGENTS.md  instructions for AI agents
```

## Using it in Antigravity

Open this folder as the workspace, run `npm run setup && npm run dev` in the terminal, then ask the agent to work through the "Next steps" in `PROJECT_SPEC.md`. `AGENTS.md` and `PROJECT_SPEC.md` give it the context from your venture deck.
