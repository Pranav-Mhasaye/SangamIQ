# Instructions for AI coding agents

Read `PROJECT_SPEC.md` first - it has the product goals, feature map, roadmap and **Free-stack rules**.

## Free-stack rules (always enforced)

This project runs at **zero cost**. Before adding any external service, API or dependency:

1. It **must** have a genuinely free tier (no credit card to start) or be open-source / self-hostable.
2. It **must** be optional behind an env var with a working local/built-in fallback.
3. If the env var is missing or empty, the app still works — log a `console.info`, never crash.
4. Implement the free fallback **first**, confirm it passes tests, then wire the optional provider.
5. List every new env var in `.env.example` with a comment: required/optional, free/paid, where to get it.
6. Never commit API keys. Never add a paid-license dependency.
7. **Maps:** Leaflet + OpenFreeMap tiles (or `TILE_URL` env var). Do **not** use `tile.openstreetmap.org`.
8. **Database:** PostgreSQL + PostGIS, with `USE_MEMORY_DB=true` as zero-dependency demo mode.
9. **Auth:** Email + password, magic links, guest mode. Phone OTP console provider by default — no SMS required.
10. **Voice:** Browser SpeechRecognition/speechSynthesis first; keyword classifier as LLM fallback.
11. **Messaging:** Telegram bot + `wa.me` links + `sms:` URI. No WhatsApp Business API.
12. **Push:** Web Push with self-generated VAPID keys.
13. **Billing:** Plans and feature flags only; `BILLING_ENABLED=false` by default.
14. **Hosting:** GitHub Pages (landing), Render free tier (app), GitHub Actions (CI).

See the full table in `PROJECT_SPEC.md > Free-stack rules`.

## Development guidelines

- Stack: React 18 + Vite (client), Node 20+/Express (server, ES modules), Leaflet maps, Server-Sent Events for live updates.
- Run: `npm run setup` once, then `npm run dev` (API on :3001, web on :5173).
- Keep the client dependency-light; do not add a state library unless asked.
- Every new attendee-facing string must exist in English, Hindi and Marathi (`client/src/i18n.js`).
- Keep touch targets >= 48px and text readable for elderly users; test the "Large text" mode.
- Seed/sample data lives in `server/src/data.js`; do not mix real personal data into it.
- Do not claim real emergency dispatch exists - requests only reach volunteers inside this app.
