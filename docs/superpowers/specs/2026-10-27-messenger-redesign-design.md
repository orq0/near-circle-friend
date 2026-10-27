# Messenger UI Redesign — Design (2026-10-27)

**Goal:** Make Near-Circle read as a plausible native Facebook Messenger feature for the Meta Global AI Hackathon 2026, without touching the working backend, PostGIS discovery, or OSRM routing.

**Approved approach (Option A — restyle in place):** keep the screen-state architecture (`inbox` / `radar` / `friend` / `route`), API calls, radar math, and Leaflet map; rework markup + `App.css` for Messenger chrome.

## Decisions

- **Visual identity:** Messenger blue `#0084ff`, white/soft-gray surfaces (`#f0f2f5` wash), system font stack, circular gradient-initial avatars, rounded-999px controls, subtle borders/shadows. No new dependencies; icons are small original inline SVGs (radar glyph, search glyph). No proprietary logos or artwork.
- **Entry point:** radar-glyph "Near-Circle" action in the inbox header **plus** the existing full-width "Open Near-Circle" CTA (kept for established users/tests).
- **Search:** working client-side filter over the simulated conversation list (name/preview), with a "No conversations match your search." state.
- **Conversation list:** timestamps and unread count badges added to mock friend fixtures (`time`, `unread`) — simulated shell data only; proximity data still comes from PostGIS.
- **Chat panel:** "Today" separator + per-message time labels from mock thread fixtures; bubbles keep blue-out/gray-in alignment; composer stays disabled (no fake messaging).
- **Prototype caption:** banner now reads "Near-Circle — Proposed Facebook Messenger Feature • Meta Global AI Hackathon 2026" as a discreet contextual caption; the unofficial-prototype disclosure remains for screen readers via a visually-hidden span.
- **Radar / friend / route:** same components and states; Messenger-consistent chrome via CSS (cards, stat chips preserved with original formats so RouteScreen tests keep their numeric expectations). Removed stale "Pedestrian routing arrives in Phase 3" copy.

## Non-goals

No backend/API changes, no new packages, no graph/DB work, no fake messaging, no hardcoded proximity/route data.

## Verification

TypeScript typechecks (web + api), frontend test suite (banner assertion updated; new header-entry + search-filter tests), production build, and server-render probes of inbox/radar/friend/route branches.
