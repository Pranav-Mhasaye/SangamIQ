# Instructions for AI coding agents

Read `PROJECT_SPEC.md` first - it has the product goals, feature map and roadmap.

- Stack: React 18 + Vite (client), Node 20+/Express (server, ES modules), Leaflet maps, Server-Sent Events for live updates.
- Run: `npm run setup` once, then `npm run dev` (API on :3001, web on :5173).
- Keep the client dependency-light; do not add a state library unless asked.
- Every new attendee-facing string must exist in English, Hindi and Marathi (`client/src/i18n.js`).
- Keep touch targets >= 48px and text readable for elderly users; test the "Large text" mode.
- Seed/sample data lives in `server/src/data.js`; do not mix real personal data into it.
- Do not claim real emergency dispatch exists - requests only reach volunteers inside this app.
