# SangamIQ Technologies - project spec (source of truth for contributors and AI agents)

**One line:** AI-powered platform connecting people, volunteers, service providers and organisers in real time, making large gatherings (Wari, Kumbh, festivals, concerts) safer and smarter.

**Origin:** Wadhwani Foundation venture-viability deck, MIT Academy of Engineering, Alandi, Pune. Field context: Ashadhi Wari visit; Maha Kumbh 2025 (660M+ visitors) as scale reference.

## Users
| Role | Who | What they need |
|---|---|---|
| Primary - Attendee | Senior citizens, low digital access (persona: Vithoba Kaka, 68, small town, WhatsApp only, traditional media, low tech comfort) | Find medical help, food, water, shelter, toilets; say where they are; no complex smartphone UI |
| Secondary | Local NGOs, volunteer groups, resource donors | See where help is needed; be matched to nearby requests |
| Buyer | Event organisers, hospitals, local authorities, event-management companies | Real-time visibility, coordination, crowd risk early-warning |

Jobs to be done: *functional* (find services, communicate need + location without complex apps), *emotional* (feel safe, independent, confident), *social* (stay connected, not be a burden, be seen as capable).

## Feature map: deck -> code (status)
| Deck feature | Where in code | Status |
|---|---|---|
| Nearby help locations (medical/food/water/toilet/help desk/transport) | `GET /api/services`, `AttendeeApp` home + map | Working (sample data) |
| Simple help request + location sharing | `POST /api/requests`, `RequestScreen` | Working |
| Language selection (Marathi / Hindi / English) | `client/src/i18n.js`, `ctx.jsx` | Working for attendee UI + alerts |
| Basic volunteer contact (call) | `tel:` links in Detail/Track screens | Working |
| AI-powered assistance requests: real-time matching to nearby verified help | `matchVolunteers()` in `server/src/index.js` (distance + skill fit + workload score) | Working (rule-based; model-ready seam) |
| Real-time volunteer dispatch + volunteer dashboard | `VolunteerApp`, `/accept`, `/complete`, SSE stream | Working |
| Request lifecycle & auto-escalation | State machine (`open -> accepted -> on_the_way -> arrived -> completed`, `cancelled`, `escalated`), timeline audit, 90s/30s escalation worker, volunteer release, 10s GPS ping + live ETA, duplicate protection, post-completion 1-5 rating | Working |
| Voice AI with STT & LLM | `server/src/voice/` (safety, keyword, llm, stt, tts) + `POST /api/voice/transcribe` + `POST /api/voice/tts` + LLM intent classification | Working (pluggable STT & LLM; keyword fallback; 69-phrase eval benchmark 100%) |
| Emergency alerts | `POST /api/alerts`, Alerts tab, home banner, organiser broadcast form | Working |
| Crowd monitoring, heatmaps, organiser dashboard | `OrganiserApp`, `server/src/crowd.js` | Working on simulated crowd data |
| Predictive crowd intelligence | 15-min linear-trend forecast + automatic alerts in `crowd.js` | Working (simple model) |
| Verified services / volunteers | `verified` flag, `status` (pending/approved/rejected/suspended), Organiser Volunteers tab | Working (volunteer registration + pending queue + organiser approval workflow) |
| Authentication & Role Protection | Phone+OTP (console/stubs), bcrypt email login for organisers, JWT access + refresh tokens, Helmet, Rate limiting | Working (with senior-friendly anonymous guest mode) |
| Large-text / senior-friendly UI | Profile -> Large text, 52px touch targets | Working |

## Explicitly NOT in the prototype (per deck "Functionality NOT included")
Live LLM integration, real emergency dispatch to 108/police, payment processing, verified live service availability feeds, advanced crowd prediction, government-system integration.

## Business model (for pricing / paywall work)
Primary **freemium** (attendees free; basic organiser tier free), secondary **subscription** (organisers / event-management companies / hospitals: advanced dashboards, forecasts, SLA). Channels: mobile app, website, B2B partnerships. Geography: Pune first -> Mumbai, Nashik -> rest of Maharashtra. Key metrics: response time, people assisted, emergencies resolved, volunteer response rate, user satisfaction.

## Next steps (suggested order)
1. **Auth + roles** - [COMPLETED] Phone OTP for attendees/volunteers, email+bcrypt password for organisers, short-lived JWT access tokens + httpOnly refresh tokens, role-based middleware (`requireAuth`), rate limiting, Helmet, and volunteer verification workflow in Organiser dashboard.
2. **Postgres/PostGIS** - [COMPLETED] PostGIS database support added via `docker-compose.yml`, `node-pg-migrate` migrations, seed script, repository layer (`server/src/repos/*.js`), `ST_Distance` and KNN (`<->`) spatial index matching, crowd samples and alerts persistence, with in-memory fallback behind `USE_MEMORY_DB=true`.
3. **Real voice AI** - [COMPLETED] Pluggable STT (Whisper / Google Cloud STT) + LLM intent classification (Gemini / Claude / OpenAI) with keyword fallback; unbypassable safety overrides; multi-turn confirmation; server TTS; 69-phrase eval benchmark. **Remaining:** Add an IVR/phone-call webhook (Twilio / Exotel) so feature-phone users can dial in — this is the deck's main differentiator.
4. **Offline-first / low network** - deck lists cell congestion as the top technical risk: PWA + service worker, SMS fallback, queue-and-retry requests.
5. **Push notifications** to volunteers (FCM / web push) instead of only SSE.
6. **Real crowd signals** - replace the simulator in `crowd.js` with sensor/CCTV/telecom footfall input; train a proper forecast model.
7. **Prototype validation** - the deck reports 0 users tested. Run usability tests with seniors (can they find help, send a request and navigate the map unaided?) and record results.
8. **Native shell** - wrap the PWA with Capacitor, or rebuild screens in React Native / Flutter.

## Free-stack rules (binding for every contributor and AI agent)

This project runs at **zero cost**. Every external service must have a genuinely free tier (no credit card required to start) or an open-source self-hostable alternative, be optional behind an env var, and degrade gracefully when its key is missing (no crashes, a clear log message, and the app still works).

| Layer | Free choice | Fallback when key is missing |
|---|---|---|
| **Maps** | Leaflet with OpenFreeMap tiles (`https://tiles.openfreemap.org/styles/liberty/{z}/{x}/{y}.png`) or self-hosted Protomaps. **Do not use `tile.openstreetmap.org`** (their tile usage policy forbids heavy/commercial use). | Leaflet still loads; tiles from env var `TILE_URL` or the OpenFreeMap default. |
| **Database** | PostgreSQL + PostGIS (local Docker; Neon or Supabase free tier for deploy). | `USE_MEMORY_DB=true` — fully functional in-memory store, no external dependency. |
| **Auth** | Email + password (bcrypt) and email magic links for volunteers/organisers. Guest mode (anonymous device ID) for attendees. Phone OTP via pluggable provider with `console` dev provider (prints to log, accepts `123456` when `DEV_OTP=true`). | Console OTP — no SMS account needed. Guest mode always works. |
| **Voice STT** | Browser `SpeechRecognition` (free, no key). Optional: Whisper API (free tier via Groq or local `whisper.cpp`), Google Cloud STT free tier. | Browser recognition or keyword classifier. |
| **Voice LLM** | Keyword classifier (zero cost, built-in). Optional: Gemini free tier, Groq free tier, local Ollama. | Keyword classifier runs automatically. |
| **Voice TTS** | Browser `speechSynthesis` (free). Optional: Google Cloud TTS free tier. | Browser synthesis. |
| **IVR / telephony** | Simulator + provider adapter interface. No telephony account required. Optional: Twilio/Exotel free trial. | IVR simulator for demo; feature-phone dial-in is not available without a provider. |
| **Messaging** | Telegram Bot API (free, unlimited). `wa.me` share links (free, no WhatsApp Business API). `sms:` URI scheme for SMS links. | All three are free or device-native links. No paid messaging API. |
| **Push notifications** | Web Push with self-generated VAPID keys (free, standards-based). | SSE stream (already working) remains the real-time fallback. |
| **Billing** | Model plans and feature flags only. Payments stay in test/mock mode behind `BILLING_ENABLED=false`. | Billing disabled — all features unlocked. |
| **Hosting** | GitHub Pages (landing page), Render free tier (app), GitHub Actions (CI). | Local dev with `npm run dev`. |
| **CI** | GitHub Actions free tier (2 000 min/month for public repos). | Run tests locally with `npm test`. |

**Rules for new features:**
1. Always implement the free/local fallback first and confirm it works before wiring an optional paid provider.
2. Every optional provider is behind an env var. If the var is empty or missing, the fallback activates with a `console.info` message (not a warning or error).
3. `.env.example` lists every var with a comment: required/optional, free/paid, where to get a key.
4. Never commit API keys, tokens or secrets. `.env` is in `.gitignore`.
5. Never add a dependency that requires a paid license for our use case.

## Conventions
- API under `/api`, JSON, ISO timestamps. Live updates through one SSE stream (`/api/stream`): `request:new`, `request:update`, `alert:new`, `crowd:update`, `volunteer:update`.
- Attendee-visible strings go in `client/src/i18n.js` for all 3 languages; keep sentences short and plain.
- Brand: Sangam red `#C00000`, saffron orange `#F26B2A`, navy `#12305B`; font Mukta (Devanagari-safe).
- All seeded places/people/crowd numbers are **sample data** around Alandi - never present them as real.
