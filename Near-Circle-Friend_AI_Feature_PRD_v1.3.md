# Near-Circle-Friend — AI Circle Intelligence Add-on
## Product Requirements Document (PRD) · Add-on Feature · v1.3

**Project:** Near-Circle-Friend (aka Ni-Ce-Friend)  
**Product identity:** Remains Near-Circle-Friend throughout the app, repository, README, demo, and submission. “AI Circle Intelligence” refers only to this optional feature, never a replacement product name.  
**Positioning:** Proposed Facebook Messenger Feature · Meta Global AI Hackathon 2026  
**Theme:** Build for Your World  
**Status:** Implementation-ready specification; validate integration assumptions against repository  
**Hackathon runtime model (locked):** Meta Muse Spark 1.3 (`muse-spark-1.3`) via Meta Model API  
**Proposed first-party production AI:** Existing Meta AI experience inside Facebook/Messenger, assuming Meta's approval and internal integration support *for design purposes only*  
**Proposed user pricing:** No separate Near-Circle-Friend subscription; subject to Meta's eventual product policies  
**Tagline:** **Facebook connects us online. Near-Circle-Friend brings us together in real life.**

> **Product promise:** Help people turn existing online friendships into meaningful, mutually welcome real-world moments. Near-Circle-Friend should recommend *opportunities* to reconnect—not declare whether someone is a good friend, safe to meet, or worthy of a relationship.

## 1. Executive Summary

**AI Circle Intelligence** is an optional, consent-based add-on to **Near-Circle-Friend (Ni-Ce-Friend)**, our proposed Facebook Messenger feature. The product name and existing proximity-discovery/routing experience remain unchanged.

This revision formalizes two different AI workloads:

1. **Persistent Friendship Profile (slow-moving):** With explicit authorization, Meta Muse Spark 1.3 initially estimates a private 1–5 **Circle Closeness Level** from structured friendship signals. That profile is saved in PostgreSQL and reused. Lightweight deterministic event aggregation may request infrequent reassessment after *material* evidence changes; routine views, messages, radar scans and proximity events must not invoke Muse. User overrides always take precedence.
2. **Ask Meta AI — Should We Catch Up Today? (on demand):** The app can list eligible nearby friends using its existing PostGIS/OSRM systems without calling AI. A user may explicitly select a friend and request Meta AI's contextual meetup advice. The backend verifies consent, visibility, and permitted availability before inference; Muse returns a measured, evidence-grounded suggestion and optional editable invitation. The system may reuse a still-valid, consent-authorized result, but never runs meetup inference just because someone appears nearby.

**Two integration horizons (do not conflate them):** The **implemented hackathon prototype** calls the real `muse-spark-1.3` model through Meta Model API. The **proposed native Facebook/Messenger product**, under a hypothetical first-party approval and support assumption, would reuse Meta's existing Meta AI assistant through internal, authorized platform integration. This is a design scenario, **not** a claim of endorsement, Meta approval, Messenger consumer-AI API availability, or live first-party connectivity. No new user subscription is proposed, and using a shared assistant does not erase per-inference compute cost.

**Relationship closeness and recent activity are separate signals.** A close friendship can remain level 4–5 despite a long gap in contact; temporary increases or decreases in message frequency should not cause unstable level changes.

The hackathon prototype uses clearly labeled synthetic friendship identities and aggregated interaction signals. It does **not** presume access to Facebook's private friend graph, Messenger messages, post mentions, location feeds, or restricted Meta platform capabilities. Real model inference is still required for the live judge demonstration.

**Product vision:** Facebook connects us online. Near-Circle-Friend brings us together in real life.

**Design objective:** Meaningful AI where it adds value; deterministic, inexpensive operations where it does not. **No fallback to lower-tier runtime models is required for this hackathon.** Muse Spark 1.3 is the selected runtime model; preserve a clean domain integration boundary so a future Meta-owned deployment could bind to native Meta AI without changing friendship or consent rules.

## 2. Context and Existing Product Boundaries

Preserve the current standalone stack and existing user journey:

- **Frontend:** React + Vite + TypeScript, mobile-friendly, Messenger-inspired UI clearly marked as a *proposed* feature, not an official integration.
- **API:** Fastify + TypeScript; use existing authentication, consent checks, response conventions, and test setup.
- **Data:** PostgreSQL 16 + PostGIS 3.4; consent-filtered nearby-friend queries and visibility settings remain the source of truth for discoverability.
- **Routing:** Isolated pedestrian OSRM for road route, ETA, and steps; Metro Manila demo coverage; routing service may be unavailable when the gated dataset/profile is not present.
- **Startup:** Preserve current Docker Compose profile gating and `npm run startall` startup workflow. Never force OSRM preprocessing, graph downloads, or data regeneration during ordinary startup.
- **Independence:** Do not access, alter, or integrate the separate Tara, Mapa, or Navegar projects.
- **Production assumption boundary:** Describe native Meta AI reuse as a **proposed first-party deployment scenario** with assumed internal approval/support, not a hackathon dependency or a consumer Messenger API that the standalone app can call today.

**Non-destructive integration rule:** Add new migrations, modules, pages/components, and tests without regressing the inbox → radar → friend selection → walking-route demo. Do not rewrite existing proximity authorization logic.

## 3. User Problem and Design Principle

A person can have many Facebook friendships but miss simple chances to reconnect face-to-face. Physical proximity by itself is not enough: some nearby people are acquaintances; other important friends may not have been seen in months. Meanwhile, recommendations must never pressure either party or reveal private information.

**Design principle:** *Make reconnecting easier, not obligatory.* Offer a friendly suggestion, show a grounded reason, and leave the decision entirely with the user.

## 4. Goals, Success Criteria, and Non-goals

### Goals (P0)

1. Maintain a **persistent, owner-private Circle Closeness Profile** per eligible friendship: level 1–5 or insufficient information, evidence quality, explanation, provenance and last assessed time.
2. Trigger initial AI analysis only with valid opt-in and an explicit permitted action; subsequently reassess only after a deterministic, material change threshold or an approved, rate-limited user request. Do not rerun on every call.
3. Keep **long-term friendship closeness** distinct from recent activity/engagement. A dormant longstanding friendship must not automatically be downgraded.
4. Show consent-filtered **nearby eligible friends** without AI inference. Provide an explicit **Ask Meta AI** action on the selected friend to consider whether a catch-up today seems convenient.
5. When expressly requested, use current authorized context and verified proximity/routing to produce a nuanced `suggest | later | insufficient_context` outcome and optionally an editable, low-pressure invitation. Never auto-send.
6. Show at least one genuine **Meta Model API / Muse Spark** inference in the judge demo, with credible live-versus-demo provenance.
7. Preserve existing routing, inbox/radar workflows, privacy and non-destructive startup; fail closed on unauthorized data and gracefully on model outages.
8. Control inference expenditure through a stored profile, event thresholds, cooldown, batching where suitable, rate limits, and idempotency/deduplication.
9. Use **Muse Spark 1.3 as the sole required live inference model for the prototype**, with distinct structured contracts for stored friendship assessments and optional user-triggered meetup advice. Do not downgrade to another model or implement multi-model routing as part of this task.
10. Document the **proposed native Meta AI integration** (assuming first-party Meta approval/support) and a **free-to-user core experience with no separate Near-Circle-Friend subscription**, without representing these hypothetical product decisions as current Meta commitments.

### Proposed demo success measures (not claims of measured results)

- Four core synthetic friendship scenarios pass, plus explicit event/no-event and on-demand request tests.
- 100% of tested denied/unconsented cases yield no unauthorized friend result, private data leak, or inference.
- Opening or refreshing the radar, viewing friends, rerendering the UI, or changing proximity alone causes **zero model calls**.
- A second eligible request for an unchanged, safely cached result does not create duplicate inference; stale/unauthorized results are never served.
- Demonstrate a real structured Muse Spark response for an initial or justified friendship assessment **and** an explicitly requested meetup recommendation, subject to available credentials and API access. Show model/source and optional trace metadata without exposing secrets.
- Existing routing, startup, consent, and regression tests remain passing; `npm run startall` still operates without AI credentials.

### Out of scope for the hackathon add-on

- Reading Messenger messages or scraping posts/mentions, importing Facebook's complete friend graph, or claiming real Facebook platform permissions. If authorized activity metadata could hypothetically be available in future, treat it as a **future integration**, not a present dependency.
- Predicting loyalty, trust, safety, mental health, attraction, personal value, or anyone's willingness to meet.
- AI inference on every request; passive background LLM recommendations; continuous tracking or intrusive notifications.
- Automatically messaging friends, making real-world reservations, revealing precise private locations, training/fine-tuning on user data, or implementing a production-scale distributed event processor for this hackathon.
- Integrating with private Messenger/Meta AI internal APIs, pretending native assistant calls work in the standalone prototype, implementing a separate consumer billing system, or introducing cheaper alternative runtime models without a separately approved future scope.

## 5. Core Experience and User Stories

### US-01: Explicit, separate consent

**As a user**, I want distinct opt-ins for AI friendship analysis, permissible interaction-signal use, discoverability, and meetup availability, so I can control each function.

**Acceptance:** Controls default off where newly introduced; describe which *aggregated* data may be analyzed; revoke immediately; clear or invalidate relevant derived data and pending jobs. Existing location-consent requirements remain authoritative. AI advice for a friend requires the requesting user's opt-in and policy-compliant friend eligibility.

### US-02: Persistent friendship profile

**As a user**, I want to see my private friendship level and a short explanation without waiting for AI each time I open the app.

**Acceptance:** Show persisted estimate 1–5 or `Not enough information`, evidence quality, last assessed timestamp, `AI estimate` or `Your choice` source, and an override control. A read never triggers model inference. AI profile remains private to profile owner.

### US-03: Meaningful and infrequent refresh

**As a user**, I want my relationship profile to adapt when a significant pattern changes, but not fluctuate due to everyday interactions.

**Acceptance:** Incremental, permitted **metadata** events update activity summaries locally; configurable material-change thresholds + hysteresis + cooldown determine whether to queue an assessment. Routine events do not initiate AI calls. User overrides are never silently overwritten.

### US-04: Discover friends without AI

**As a user**, I want Near-Circle to show which friends I am allowed to discover nearby, without waiting for or paying for an AI response.

**Acceptance:** Existing PostGIS/OSRM and location-consent checks serve friend/routing information; a deterministic candidate list can show existing closeness context, when authorized. It never presents model-generated `Good opportunity today` as though it was evaluated when it was not.

### US-05: Ask Meta AI about a meetup

**As a user**, I want an optional **Ask Meta AI — Should We Catch Up Today?** action for an eligible nearby friend, so I can receive a contextual suggestion only when I request one.

**Acceptance:** A click explicitly triggers the advisor (or returns an unchanged and still-authorized cached result); pre- and post-inference checks enforce friendship, discovery, location and permitted availability. Outcome must be `suggest`, `later`, or `insufficient_context`, with a short grounded explanation. No auto-invocation from map movement, nearby alerts, or friend-detail views.

### US-06: Invitation drafting and personal control

**As a user**, I want an editable invitation and the choice to dismiss, snooze, copy, or share it, with no obligation to send anything.

**Acceptance:** Draft avoids pressure, guilt, made-up emotions or availability, and any implied promise that the other party wants to meet. User controls all sharing. Prototype never claims that a Messenger message was sent.

### US-07: AI unavailable or off

**As a user**, I want the map, radar, closeness overrides, and nearby-friend experience to remain useful even without the model.

**Acceptance:** Core application works if AI is disabled, no API key is present, credentials fail, the model times out, or the routing service is absent. State labels distinguish persisted estimates, live advice, fixture data, and unavailability.

### US-08: Clear product vs. prototype expectations

**As a hackathon judge**, I want to see a real Muse Spark 1.3-powered prototype while understanding how the proposed approved-first-party Facebook feature would later rely on native Meta AI, so the distinction is transparent.

**Acceptance:** Runtime results show real model or demo provenance; README/pitch explain the hypothetical production Meta AI integration, the proposed no-extra-subscription user experience, and that actual consumer Messenger AI access is not implemented or claimed.

## 6. Friendship Closeness Model

This is a **private, probabilistic interpretation of observable and user-declared connection context**, not a moral or personal worth judgment. Avoid numerical confidence percentages that the model cannot substantiate.

| Level | UI label | Interpretation |
|---|---|---|
| 5 | Inner Circle | Strong self-reported or long-established connection, even when contact is intermittent |
| 4 | Close Friend | Established and generally reciprocal connection |
| 3 | Regular Friend | Repeated interactions with some continuity |
| 2 | Casual Friend | Occasional interactions with limited history |
| 1 | Acquaintance | Limited available evidence of an established connection |
| — | Not enough information | Insufficient or contradictory evidence; do not force a label |

### A. Persistent profile: source of truth

Store a **user-owned friend profile** keyed to `(owner_user_id, friend_id)` where permitted. Fields include estimated tier or `null`, evidence quality, short explanation, `source` (`meta_live|demo_fixture|unavailable`), `model_id` where relevant, input fingerprint/version, `assessed_at`, event baseline, and last validated policy/consent version. Maintain a separately stored manual override, taking precedence in display and recommendation inputs. Profile reads **never** invoke Muse.

A separate **recent activity summary** (e.g. `stable|increasing|decreasing|unknown`) may change independently of closeness. A long period without interaction must not, by itself, downgrade closeness. Where authorized evidence is absent, preserve `Not enough information` rather than inventing relationship history.

### B. Input signals

Use only consent-authorized coarse structured metadata (or synthetic demo equivalents): duration bucket, last meetup recency bucket, frequency trend bucket, reciprocity bucket, past meetup frequency, user-declared closeness and interests, and explicit user-confirmed meetup interactions. Avoid raw conversation/post content, phone numbers, contact lists, nonconsensual friend graphs, and scraped activity.

**Mentions in posts and communication changes:** These are *candidate signal concepts*, not currently available Facebook integrations. For the hackathon, model them only as **synthetic or explicitly supplied aggregate events**. No Messenger/Facebook API access or scanning of message/post contents should be added. Any future production use requires a separately approved, consented and legally appropriate data source.

### C. Event-driven reassessment policy

1. **Initial creation:** With valid analysis opt-in and available signals, user explicitly requests creation, or authorizes a clear initial setup workflow. Invoke Muse once, validate schema, save the profile and event baseline.
2. **Cheap aggregation:** Permitted event updates (e.g. confirmed meetup, user-declared change, sustained interaction-frequency increase) update counters/buckets locally without a model call. De-duplicate events.
3. **Material-change detection:** Compare current summaries with the saved assessment baseline. Schedule reassessment only when several consistent changes or a highly material user-supplied change meet configured thresholds; apply hysteresis so levels do not oscillate. A lone message, profile view, post mention, location detection, or brief activity spike is not sufficient.
4. **Cooldown + budget:** Enforce per-friend cooldown, queue deduplication/idempotency, user quotas and global inference budget. No retry loops that amplify usage.
5. **Reassessment:** Authorized server job rechecks consent and signal validity, then invokes Muse with *aggregates and previous assessment context*; validate and persist a revised estimate only when justified. Do not quietly replace user overrides. Record provenance/time. A reassessment may legitimately keep the same tier.
6. **Revocation:** Stop/cancel queued work immediately, suppress use of the assessment and delete/invalidate relevant derived data per documented retention controls.

**Initial proposed thresholds (configurable design defaults, not validated science):** Require a sustained change across more than one activity observation window or a confirmed significant event (such as multiple user-confirmed meetups), and use a 14-day reassessment cooldown except explicit user-triggered review subject to a separate limit. Thresholds should be calibrated in tests; never treat them as an objective measure of friendship.

**Priority:** User-selected tier > valid stored AI estimate > `Not enough information`.

**Cost guarantee:** An unmodified friendship profile is returned from storage for repeated reads; routine nearby/map traffic and every individual interaction generate **zero Muse assessment requests**.

## 7. Reconnection Opportunity Logic

**Critical split:** Candidate discovery is deterministic and may occur during normal app use. **Meetup AI advice is on demand only.** A friend entering the Near-Circle radius is not permission to invoke Muse or decide whether that person is a good meetup.

### Stage A — Deterministic discovery (no model call)

- Authenticate request and apply existing friendship, block/hidden, location-sharing, discoverability, proximity radius, location freshness and privacy rules before returning a candidate.
- Read any valid persisted closeness profile without triggering reassessment. Recent activity trend may be displayed only if enabled and authorized.
- Respect snooze/dismissals and daily opportunity-display caps. Use verified PostGIS/OSRM output for permitted distance/walking ETA; suppress ETA if OSRM is unready.
- Provide a low-pressure candidate list (e.g. `Nearby friends` or `Potential catch-ups`). Do **not** show `Good opportunity today` or an AI rationale before a user requests model advice.

### Stage B — User explicitly requests Ask Meta AI

- A user clicks **Ask Meta AI — Should We Catch Up Today?** for a specific eligible friend. This is the only normal-flow trigger for *meetup* inference.
- Reauthorize friendship, current discoverability/consent, location freshness and proximity; require the requester's AI-advice consent. A time-specific suggestion using mutual availability requires **both users** to have explicitly shared the corresponding availability. Otherwise omit that fact or return `insufficient_context`; never infer availability from location alone.
- Collect **minimum necessary** sanitized facts: stored closeness/override, coarse activity recency/trend, last confirmed meetup bucket, permitted availability, verified optional approximate walk time, invited/declined/snoozed status, and explicitly declared interests. Do not send exact coordinates or identifiers.
- Apply request-rate limits and an idempotency key. If a result for the **same friend, consent state, time window and facts** is fresh, return the cached result after all authorization checks; do not silently reuse outdated advice.
- Call Muse Spark once for an uncached authorized request. It returns `suggest|later|insufficient_context`, brief explanation, optional activity (`coffee|walk|lunch|catch_up|none`), and optional editable invitation. Advice must not imply that the other person wants to meet, is safe, or owes a response.

### Stage C — Post-inference enforcement

- Strictly validate JSON schema and allowlisted values, limits and factual grounding. Reject unsupported venues, fabricated travel metrics, invented consent or precise schedule, guilt language, and personal quality/safety judgments.
- Recheck permissions and data freshness **again** before returning live or cached results; if consent changed mid-flight, drop result without displaying sensitive material.
- Mark live, cached-live, demo, and unavailable states distinctly; retain `Why this suggestion?`, dismiss/snooze, and invitation composer controls.
- The user may decline the AI recommendation without affecting their underlying friendship profile.

### Invitation generation policy

When an advisor response already includes a valid editable invitation, use it directly. Do **not** make an additional model request merely to open the composer. If the user explicitly requests a *new* draft, that may be a separate on-demand call subject to the same consent and spending rules. No automatic sends.

## 8. P0 UI Specification

### A. Radar / friend detail: persisted Circle Insight

- Keep existing friend map card, consent UI, routing, distance and steps intact.
- Show stored **Circle Closeness Level** 1–5 or `Not enough information` with provenance (`AI estimate` / `Your choice` / `Demo profile`), `Last assessed`, evidence-quality label and a short rationale.
- Provide **Edit my view** to set/clear a private tier override; optionally **Request reassessment** only as an explicit, rate-limited action.
- **Do not launch inference** upon opening a friend card, moving the map, or discovering a nearby friend.

### B. Deterministic Reconnect Today candidate list

- Show eligible, mutually discoverable nearby friends, not automatically AI-ranked or AI-advised meetup recommendations.
- Each card may show authorized name/avatar, persisted tier, approximate verified walk time and neutral candidate explanation such as `Nearby and available for discovery`.
- Offer an **Ask Meta AI** button on each eligible friend; label it as optional advice, not a safety check or matchmaking mandate.
- If no friend is eligible: `No nearby friends to suggest right now. Your Near-Circle-Friend map still works.`
- Provide standard quiet hours, snooze, dismiss and visibility controls.

### C. On-demand Ask Meta AI response panel

- Button copy: **Ask Meta AI — Should We Catch Up Today?** The action must be visibly user-initiated.
- States: `Not requested` → `Checking eligibility` → `Consulting Meta AI` → `Good opportunity today` / `Maybe another day` / `Not enough context` / `AI unavailable`.
- If authorized and permitted, show `Why this suggestion?`, model/source indicator (`Live Meta AI`, `Previously generated live insight`, `Synthetic demo`, or `Unavailable`), and generation time.
- A response should be suggestive, not prescriptive: *“Alex is nearby, and you're both marked available this afternoon. Catching up could be convenient if you both want to.”*
- An AI result must not be presented as a personal safety guarantee. `Not requested` is not an AI assessment.

### D. Invitation composer

- Use the already-generated draft if available. Allow edit/copy/share/cancel, optionally generate a *new* draft by explicit request.
- Example: `Hey Alex! It's been a while. If you're free today, would you be up for coffee? No pressure!`
- Never auto-send, leak availability, or represent clipboard/share as confirmed Messenger delivery.

### E. Disclosure and accessibility

- Always distinguish live inference, cached live inference, demo fixture, persisted profile, user override and disabled/unavailable AI.
- Preserve product identity: **Near-Circle-Friend — Proposed Facebook Messenger Feature · Meta Global AI Hackathon 2026**. Never imply official integration or endorsement.
- The button may be labeled **Ask Meta AI** to represent the proposed future experience, but the prototype's result disclosure/about panel and README must say **“Prototype powered by Muse Spark 1.3 via Meta Model API”** when relevant. Do not label the prototype as an actual connected Messenger-native Meta AI session.
- Mobile-first layout; keyboard focus, readable contrast, screen-reader labels, actionable empty/error/consent states.

## 9. Model and Data Contract

**Model decision (v1.3):** **Muse Spark 1.3 is selected for all required live prototype inference**: initial closeness assessment, justified reassessment, on-demand meetup advice, and explicit redrafting if implemented. Do not spend development time integrating Muse Spark 1.1/1.2, Muse Wonder, Glimmer, provider failover, or model routing. Only a normal typed provider/service boundary for future native Meta deployment is expected.

**Provider configuration:** A server-side Meta Model API adapter uses verified, supported API endpoints and response schemas from official documentation, with credentials in environment variables. Suggested defaults: `MODEL_API_KEY`, `META_MODEL_NAME=muse-spark-1.3`. The model identifier must be verified at implementation; if the model/endpoint is unavailable, report that blocker rather than silently falling back to an unapproved model. Do not hardcode the API shape without verifying it during implementation. Strict structured JSON output, validation, timeout, retry limits, source/provenance and safe logs are required. Prefer non-contributor mode for any real user-derived data, subject to current API terms. Live integration is distinct from Muse Code merely authoring the application.

**Separate the two inference contracts** so the app does not accidentally recompute a relationship level every time it asks for meetup advice.

### A. Persistent friendship assessment — initial or materially triggered only

Example compact input (**synthetic**):

```json
{
  "task": "assess_friendship_profile",
  "friend_alias": "Friend_A",
  "prior_assessment": {"level": 4, "assessed_days_ago": 21},
  "signals": {
    "known_for": "several_years",
    "last_meetup": "about_three_months_ago",
    "contact_frequency": "occasional",
    "activity_trend": "increasing_sustained",
    "reciprocity": "balanced",
    "user_declared_closeness": "close_friend"
  }
}
```

Example output:

```json
{
  "closeness_level": 4,
  "evidence_quality": "moderate",
  "closeness_reason": "An established reciprocal friendship with renewed interaction, despite a gap in meetups.",
  "activity_trend": "increasing",
  "reassessment_note": "Evidence does not justify changing the existing level."
}
```

Contract: `closeness_level` is integer 1–5 or `null`; `evidence_quality` is `limited|moderate|strong`; `activity_trend` is `stable|increasing|decreasing|unknown`; reasons are strictly bounded and grounded. `null` denotes insufficient evidence. Returning the same level is valid. Only the server chooses whether assessment is triggered, and user overrides always win.

### B. On-demand meetup advice — explicit request only

Example sanitized input (**synthetic**):

```json
{
  "task": "advise_meetup_today",
  "friend_alias": "Friend_A",
  "stored_closeness_level": 4,
  "closeness_source": "ai_estimate",
  "relationship": {
    "last_confirmed_meetup": "about_three_months_ago",
    "recent_activity": "occasional",
    "declared_shared_activities": ["coffee"]
  },
  "opportunity": {
    "availability_fact": "both_shared_available_this_afternoon",
    "approx_walk_minutes": 12,
    "recent_invite_declined": false
  }
}
```

Example output:

```json
{
  "opportunity": "suggest",
  "opportunity_reason": "A convenient opportunity to reconnect if both people would like to.",
  "activity": "coffee",
  "invitation_draft": "Hey! It's been a while. Would you like to grab coffee today? No pressure!"
}
```

Contract: `opportunity` is `suggest|later|insufficient_context`; `activity` is `coffee|walk|lunch|catch_up|none`; invitation draft is optional and editable. Explanation and draft have strict length bounds, factuality rules and no unsupported claims. If permission to use availability is missing, omit it, return `insufficient_context` if necessary, and do not claim that the friend is available.

**Security and privacy:** Inputs must be constructed server-side from authorized fields. Treat user-supplied free text as untrusted data, not instructions. Send no raw Messenger messages, post bodies, exact GPS, precise schedules, emails, phone numbers, personal identifiers or secrets. Store minimum derived data; document retention and deletion. Validate schema and known facts both before display and after model completion.

## 10. Integration Points and API Shapes

Follow existing Fastify route prefix/style and reuse equivalent routes after repository inspection. These are illustrative contracts, **not evidence that the repository already contains them**.

| Method/path | Responsibility | AI inference on call? |
|---|---|---|
| `GET /ai-circle/settings` | Read user's consent and preferences | **No** |
| `PUT /ai-circle/settings` | Modify opt-ins, recommendation preferences and quiet hours | **No** |
| `GET /ai-circle/closeness/:friendId` | Return persisted owner-private profile and override; reauthorize | **No** |
| `POST /ai-circle/closeness/:friendId/assess` | Explicitly initialize or request approved reassessment; enforce limits | **Conditional**, only when authorized and not reusable |
| `PUT /ai-circle/closeness/:friendId` | Save/clear manual tier override | **No** |
| `GET /ai-circle/opportunities` | Deterministic, consent-safe nearby candidates with stored context | **No** |
| `POST /ai-circle/opportunities/:friendId/advise` | Explicit Ask Meta AI; check eligibility, reuse valid cache or call Muse | **Conditional**, after user action |
| `POST /ai-circle/feedback` | Dismiss/snooze and other user feedback; never send invitations | **No** |

**Internal event workflow:** Authorize and aggregate structured/synthetic interaction events → compare against assessment baseline → threshold/hysteresis/cooldown → enqueue deduplicated task → consent check → call Muse → validate/save. Build a local lightweight queue/worker consistent with the existing stack; no external message broker is required for the MVP. Idempotent jobs, stale-job cancellation and clear retry budgets are required.

**Response envelope:** `source` (`meta_live|meta_cached|demo_fixture|unavailable|user_override` as applicable), `model_id` when actually model-derived, `generated_at`, `assessed_at` for stored closeness, `data_freshness`, `reason`/`explanation`, optional `request_trace_id`, and `eligible`/reason for advisor authorization outcomes as appropriate. Distinguish `not_requested` from `unavailable`; never show protected information or model prompts.

### Persistence (additive migrations only)

- `ai_circle_preferences`: owner ID, separate analysis/availability/advice consent, suppressions/quiet hours, policy/version metadata, timestamps.
- `ai_circle_signals`: owner ID, friend ID, minimal authorized aggregate signal buckets, event sources labeled `synthetic_demo` or permitted user-provided, version, expiration; no raw message/post bodies.
- `ai_circle_friendship_profiles` (or migrate existing `ai_circle_insights` logically): owner ID + friend ID, persisted level or null, evidence quality/rationale, separate activity trend, source/model/version, last assessed timestamp, signal fingerprint/baseline, policy version, status and retention timestamps.
- `ai_circle_reassessment_jobs` (or equivalent in-process durable job state): owner/friend, reason and relevant signal fingerprint, queued/completed/cancelled timestamps, cooldown, idempotency/deduplication state and bounded attempts.
- `ai_circle_closeness_overrides`: owner/friend, selected tier, timestamp; user choice overrides model level.
- `ai_circle_meetup_advice`: owner/friend, sanitized outcome/reason/activity/draft, generated time, time-window and input fingerprint, source/model metadata, short expiry, policy/visibility version.
- `ai_circle_feedback`: owner/friend, dismiss/snooze/decline confirmation metadata, expiry/suppression controls.
- `ai_circle_usage` or aggregate counters: model requests, tokens/cost estimates (when API reports usage), cache hit/miss and rate-limit counts without sensitive payloads.

**Separation of caching:** Friendship profile is **persistent and slow-moving**, not a generic short-TTL API cache. Meetup advice is **short-lived and context-specific**, never carried across changed consent, visibility, time window, friend availability or location freshness. All reads/writes are authenticated and owner-scoped. Revalidate pre/post model call; revoke/cancel/purge as policy requires. Follow existing DB migrations; never reset production or demo volumes.

## 11. Operational and Privacy Requirements

- **Startup compatibility:** `npm run startall` must start the existing application without an AI key; disabled/unavailable AI cannot block PostGIS proximity or the gated OSRM router. No graph downloads, OSRM preprocessing, data deletion or unrelated services.
- **Feature flags:** `AI_CIRCLE_ENABLED`, `AI_CIRCLE_DEMO_MODE`, `META_MODEL_NAME`, `MODEL_API_KEY`. For this release, default/select `META_MODEL_NAME=muse-spark-1.3`; **no automatic model downgrade**. Optional configurable assessment thresholds, cooldowns, advice request budgets and cache TTLs. Follow actual repo's environment conventions.
- **Strict inference boundaries:** Never call Muse on radar refresh, map panning, GPS update, friend-card render, request to read closeness, or each individual message/mention. Assess profiles initially with opt-in/approval, reassess only from a material event or explicit bounded refresh; advise meetups **only after Ask Meta AI click**.
- **Hysteresis and refresh policy:** Require multiple consistent observations or user-confirmed major events; no downgrades on inactivity alone. Persist event baselines, user overrides, pending/complete states, and a cooldown. Deduplicate queued work.
- **Spend control:** Limit explicit advisor calls per user/day and per friend/time window; batch assessment jobs where safe; cap tokens, timeout, concurrent requests and daily inference spend. Track usage, retries and cache hits without raw data; fail gracefully at budget ceilings. Defaults are configurable and must be documented.
- **Cache correctness:** Persistent closeness profiles and short-lived advisor responses are separate. Cache key must incorporate owner, friend, sanitized context fingerprint, consent/visibility state and relevant time window. Reauthorize all reads and invalidate immediately upon revocation, blocks, major context changes or deletion.
- **Demo/live provenance:** Live requires a real server-to-Meta Model API call using Muse Spark 1.3. Fixture responses are clearly labeled synthetic and must never appear as live. Stored live assessments must visibly distinguish from fresh live advisor output. The text **Ask Meta AI** is a product-experience label, not proof of access to the Messenger consumer assistant.
- **AI outages:** If Meta API fails, show `AI advice unavailable` or `Pending reassessment` while retaining last **authorized**, suitably labeled closeness profile as allowed. Never fabricate a live recommendation.
- **Routing absent:** OSRM remains optional; if unready omit walking ETA, never invent travel time. Only expose already permitted distance data.
- **Privacy:** Analysis signals must be explicit and minimally collected; no unapproved platform scraping/DM/post analysis. Do not share private closeness level with the other friend. Consent revocation halts pending inference and removes derived data per specified retention.
- **Security:** Server-side keys and schema validation, auth checks, HTTPS for deployment, per-user isolation, prompt-injection resilience, audit-friendly consent records, model output factuality checks.
- **Accessibility:** Proper keyboard behavior, readable text/contrast and screen-reader labels for all new actions.

## 12. Acceptance and Regression Test Matrix

| ID | Scenario | Expected result |
|---|---|---|
| A01 | Explicit consent and initial profile assessment for Alex | Real Muse assessment possible; persisted tier/source/rationale visible on later reads without another call |
| A02 | Long-established friend with months of inactivity | Stable high closeness may remain; no automatic downgrade on silence alone |
| A03 | Friend radar opens, refreshes, map pans, GPS changes, selected friend viewed | **Zero Meta inference calls**; existing map/routing flow unchanged |
| A04 | Single isolated interaction or mention-like synthetic event | Activity aggregate may change; **no Muse reassessment** |
| A05 | Sustained material change or multiple confirmed meetups with valid consent | One deduplicated, cooldown-respecting reassessment job; model may keep or adjust level |
| A06 | Rapid fluctuations near level threshold | Hysteresis prevents tier thrashing; no repeated model calls |
| A07 | User overrides closeness and new AI evidence arrives | Override always wins; AI estimate retained only as private separate provenance |
| A08 | GET opportunities / nearby friends with no Ask Meta AI click | Consent-filtered candidates and verified travel info, **zero meetup inference calls** |
| A09 | User clicks Ask Meta AI for eligible, available friend | Authorized live/cached advice `suggest|later|insufficient_context`, grounded reason, optional editable draft |
| A10 | Repeated Ask Meta AI request in same valid context/time window | Fresh authorized cache reused/idempotent, no duplicate charge |
| A11 | Time/availability/location/consent changes or candidate blocks midway | Cached or in-flight suggestion suppressed; pre/post checks enforce privacy; no unauthorized disclosure |
| A12 | Mutual availability unshared/unknown | No inferred availability; omit time-specific assertion or return insufficient context |
| A13 | Sam has limited interaction data | `Not enough information` instead of invented closeness or urgency |
| A14 | Taylor opts out of relevant discovery/sharing | No unauthorized candidate or private recommendation; queued work cancelled and derived data invalidated as required |
| A15 | Missing API key, quota, timeout, malformed JSON, prompt injection | Graceful labeled unavailable; no fake live inference, unsafe claims or crash |
| A16 | OSRM routing graph unavailable | Core app starts; no fabricated walk time or routing dataset modifications |
| A17 | Edit/copy invitation and dismiss/snooze | Never auto-send; suppression honored without affecting friendship data |
| A18 | Existing inbox, radar, proximity, route, steps, and Docker startup | Regression tests green; optional routing profile, volumes and ports preserved |
| A19 | Daily budget/cooldown/retry limit exhausted | No unbounded model calls; explicit rate-limited/unavailable state |
| A20 | Consent revoked with stored profile and queued reassessment | No new AI call; stop/cancel queued work; derived data invalidated/removed appropriately |
| A21 | Live profile assessment / meetup advice in the hackathon prototype | Inference uses verified `muse-spark-1.3` through Meta Model API; never substitutes an unapproved model silently |
| A22 | Judge reviews Ask Meta AI label, README and demo | Clearly explains the UI is a proposal and the live prototype actually calls Muse Spark 1.3, not Messenger's consumer Meta AI |
| A23 | Proposed production architecture is presented | States first-party approval/internal-support assumption explicitly; does not claim real approval or implemented private API access |
| A24 | User product pricing documented | No separate Near-Circle-Friend subscription is *proposed*; no unsupported promise of permanent free use or zero inference costs |

Add unit tests for event aggregation, material-change thresholds, hysteresis, idempotency, cache keys, budget limits, schemas and eligibility. Add Fastify integration tests for consent, owner isolation, stale-result suppression and explicit click-to-infer. Keep an opt-in live API smoke test that skips without credentials; normal CI never consumes paid inference.

## 13. Demo Dataset and Judge Journey

Use **clearly labeled Metro Manila synthetic/demo fixtures**, not Facebook/Messenger private data. Include at least four distinct relationships:

1. **Alex — longstanding close friend, no meetup for months, nearby, mutually available:** persisted Level 4 or 5; show unchanged assessment across repeated nearby views; after explicit Ask Meta AI, a grounded `suggest` result and editable coffee invitation.
2. **Jamie — close friend with frequent recent interactions:** persisted level remains high; recent activity changes need not change closeness. User-triggered meetup advice may reasonably return `later` or a measured suggestion.
3. **Sam — little reliable interaction history:** stored level `null` / `Not enough information`; AI abstains, no negative personal claim.
4. **Taylor — discovery, availability or analysis opt-out:** blocked from any flow that would expose unauthorized information, and no eligible same-day AI recommendation.

**Event-driven example:** Seed Alex's earlier profile and create clearly synthetic interaction events; a single mention-like event triggers no AI. Several sustained authorized changes or confirmed significant events may trigger one queued assessment (subject to threshold/cooldown). Repeated friend-card reads do not add cost. Keep manual override demonstration separate.

**Judge flow:**

1. Launch `npm run startall`, enable demo/opt-in settings, open existing inbox → radar → select Alex and show verified nearby/routing data when available.
2. Show the **persisted** Circle Closeness profile and assessment timestamp. Refresh/view multiple times to show no model invocation.
3. Show a synthetic significant interaction scenario (initially no refresh for trivial event, eventually one authorized material-change reassessment), then review privacy/override controls.
4. Click **Ask Meta AI — Should We Catch Up Today?** *explicitly*. Show a genuine Meta Model API request when credentials are configured; show validated `suggest|later|insufficient_context`, reason, provenance and optional trace ID.
5. Open already-generated invitation, edit and copy; never claim it was sent.
6. Demonstrate opt-out, AI unavailable fallback, no OSRM ETA when unready, and zero background inference on map updates.
7. Capture screenshots showing **Near-Circle-Friend — Proposed Facebook Messenger Feature · Meta Global AI Hackathon 2026**, not an officially integrated Facebook product.

**Proof for judges:** Distinguish synthetic relationship/context data from the **genuine Muse Spark 1.3 model computation**. Provide request-count/usage counters (no secrets) to show that the hybrid approach is cost-controlled. Briefly explain the proposed **native Meta AI** production path as a concept based on assumed first-party Meta support, without claiming the prototype already accesses that private service.

## 14. Implementation Milestones

**Milestone 1 — Additive foundations:** Inspect real repo/conventions, design private persistent profiles and consent fields, seed sanctioned synthetic signal summaries, deterministic candidate eligibility and no-inference friend reads. Use additive migrations and no destructive operations.

**Milestone 2 — Event-driven friendship profiles:** Implement controlled initial assessment, event aggregation, material-change thresholds, hysteresis, cooldown, idempotent reassessment jobs, owner overrides, invalidation/purge and dedicated tests.

**Milestone 3 — On-demand Meta AI advisor:** Implement server-only Muse Spark provider, separate structured schemas for assessment/advice, user-triggered advisor endpoint, pre/post authorization, context-specific short cache, quotas and inference metadata.

**Milestone 4 — UI and judge experience:** Add persisted Circle Insight, optional Ask Meta AI action and response panel, deterministic Reconnect Today candidates, editable invitation, labeled live/demo states, responsive/accessibility treatment, and privacy states.

**Milestone 5 — Validation and documentation:** Cover event/non-event cost behavior, authorization and model failure modes, existing regression suite, real optional API smoke test with `muse-spark-1.3`, Metro Manila fixtures, README, environment template, usage trace, and screenshot/demo walkthrough. Document hypothetical first-party Meta AI integration and proposed no-separate-subscription positioning without asserting actual partnership.

**Order of precedence:** privacy and consent correctness → preserve existing features/startup → correct sparse AI invocation → real Meta inference demonstration → judge-ready UX → optional polish.

## 15. Definition of Done

- [ ] Product name remains **Near-Circle-Friend**; AI Circle Intelligence remains an optional feature, not a new app.
- [ ] Existing `npm run startall`, Docker routing-profile gating, inbox → radar → walking routes and consent-filtered PostGIS operation remain intact without credentials.
- [ ] Friendship closeness is **persisted per user/friend** (1–5 or `Not enough information`), with explanation, evidence quality, last assessed time and source label.
- [ ] **Recent activity trend** is distinct from persistent relationship closeness; no automatic downgrades from silence or trivial interaction.
- [ ] Initial assessment and significant-event reassessment work with consent; threshold, hysteresis, cooldown, job deduplication and override precedence are tested.
- [ ] Friend/map views, proximity updates and reading persisted closeness cause **zero Muse calls**.
- [ ] Deterministic nearby candidates are available without asking Meta AI; no unrequested `Good opportunity today` advice appears.
- [ ] **Ask Meta AI — Should We Catch Up Today?** is an explicit user action that authorizes, fetches or computes one context-grounded `suggest|later|insufficient_context` advisor response.
- [ ] Advisor result is short-lived, correctly keyed and reauthorized; changed consent/availability/location invalidate unsafe reuse.
- [ ] Optional invitation is user-editable and never automatically sent; no fabricated walking ETA, platform privileges or other person's intent.
- [ ] Real Meta Model API call(s) using **Muse Spark 1.3** are proven with visible live/fixture distinction; normal CI and no-key startup require zero paid inference.
- [ ] README and demo distinguish Muse Spark 1.3 prototype inference from **proposed native Meta AI** production integration based on hypothetical first-party approval/support; no private connector or platform endorsement is falsely claimed.
- [ ] A free core Near-Circle-Friend experience without a separate feature subscription is presented as a **proposal**, not an approved Meta pricing policy.
- [ ] Spend limits and usage counters demonstrate sparse, cost-conscious use of Muse Spark 1.3.
- [ ] Security, privacy, schema, caching, API, event logic, UI and core regression tests pass.
- [ ] README explains product mission, hybrid architecture, exact model role, permissions, event thresholds, on-demand advice, setup/feature flags, known limitations and judge demo.

## 16. Developer Execution Constraints

This PRD is a **feature specification**, not authorization for destructive repository actions. First inspect the current Near-Circle-Friend repository, its code, Fastify routes, DB migrations, models, tests, configuration, and existing optional routing behavior. Do not assume this PRD is already present at a specific repo path: the intended deliverable filename is `Near-Circle-Friend_AI_Feature_PRD_v1.3.md`, to be placed wherever the owner chooses (repository root is acceptable). The Windows repository path previously supplied is `E:\hacathon\meta\near-circle-friend`; verify it locally rather than treating it as remotely accessible.

Preserve the existing project and its standalone isolation. Do **not** elevate permissions, push commits, delete Docker volumes, regenerate OSRM graphs, touch Tara/Mapa/Navegar, read private social-platform data, or make unrelated architecture changes. Use small reviewable additive work, local tests, and a transparent summary. If live credentials are unavailable, implement and validate all non-live behavior with clearly labeled fixtures; never claim live inference without an actual API response.

**Developer model vs runtime model:** Muse Spark 1.3 may be used via a coding agent to build the feature; this does **not** replace the requirement for demonstrable Muse Spark 1.3 inference **inside the running app**. The standalone hackathon implementation must not assume access to private Meta AI/Messenger internals or represent an invented connector as a real integration.

## 17. Proposed First-Party Meta Integration and Subscription Positioning

### A. Assumed approved product scenario (future vision only)

For **product design and pitching**, assume Meta has internally approved Near-Circle-Friend as a native Facebook/Messenger feature and will provide authorized first-party support, such as eligible social context, friendship signals, consent infrastructure, and access to the existing **Meta AI** experience.

This is a **hypothetical future operating assumption**. It does **not** assert Meta has actually approved the feature, granted permissions, exposed Messenger consumer Meta AI to third-party developers, or committed engineering resources. Product materials and demonstrations must always mark the distinction between *proposed* and *implemented*.

Under that proposed first-party scenario:

1. Near-Circle-Friend remains part of the familiar Facebook/Messenger user journey, not a separately branded app or assistant.
2. Persistent closeness profiles and material-change detection remain cheap, private, and platform-governed; they never require inference on every view.
3. Deterministic proximity eligibility, authorized context and routing remain owned by platform services, not the language model.
4. A user expressly chooses **Ask Meta AI** to receive a contextual reconnection suggestion from the **existing Meta AI assistant**, through an internally authorized integration.
5. The user edits/sends any invitation manually. Recommendations are optional and can be declined or turned off.
6. The feature is **proposed as part of Facebook/Messenger's free core experience with no separate Near-Circle-Friend subscription**. Actual availability, limits, billing and rollout remain Meta's decisions; free user access does not imply zero serving cost.

### B. Hackathon implementation is intentionally different

| Concern | Hackathon implementation — build now | Proposed first-party Facebook feature — design assumption |
|---|---|---|
| AI engine | Real **`muse-spark-1.3`** inference using Meta Model API | Existing consumer-facing Meta AI through hypothetical approved internal service contracts |
| Consent/social data | Existing standalone authorization + user-approved structured signals / clearly labeled synthetic fixtures | Internal Meta authorization and available, approved friendship signals |
| Proximity/routing | Existing PostgreSQL/PostGIS + optional OSRM | Supported first-party services; retain deterministic and consent-safe behavior |
| App experience | Standalone Near-Circle-Friend with **proposed Facebook Messenger feature** disclosure | Native Messenger entry point (not currently shipped) |
| Model serving expense | Developer API usage subject to credits and limits | Meta-managed compute; reuse existing assistant infrastructure where possible, but still incurs incremental inference cost |
| User pricing | No separate subscription implemented or required for the prototype | Propose no additional Near-Circle-Friend subscription, subject to Meta policy |
| Integration status | Buildable and testable using public developer API | Not accessible/verified as a public Messenger consumer-AI integration |

### C. Technical migration seam (design, not overengineering)

Maintain a **small interface boundary** between the app's consent-safe domain logic and the prototype Meta Model API adapter, e.g. typed methods for `assessFriendship()` and `adviseMeetup()`. Keep the same input minimization, validation and authorization rules independent of how inference is executed. A future approved Meta-first-party integration could replace the adapter without rewriting profile storage, deterministic candidate selection or privacy checks.

**Do not build a fictitious native Meta AI adapter, add unsupported Messenger API calls, or implement extra model backends now.** Implement only the real Muse Spark 1.3 prototype adapter and document the proposed extension point. No separate user-facing AI subscription, usage-credit purchase flow, or third-party inference marketplace is part of this deliverable.

### D. Language for README / demo / pitch

Use phrasing such as:

> Near-Circle-Friend is a **proposed** Facebook Messenger feature. Our hackathon prototype uses **Muse Spark 1.3 via Meta Model API** to demonstrate AI friendship insights and optional meetup recommendations. In a hypothetical Meta-approved first-party deployment, the same experience could leverage **Meta AI already available within Messenger**, subject to Meta's internal permissions, architecture and product policies.

Avoid phrases such as “Meta approved Near-Circle-Friend,” “Messenger AI API integrated,” “Meta AI calls are free to Meta,” or “Facebook will offer this for free” as statements of present fact.

## 18. Meta API References (from v1.2; verify at implementation)

- Meta Model API Quickstart: https://dev.meta.ai/docs/quickstart
- Meta Model API Model Catalog: https://dev.meta.ai/docs/models
- Meta Model API Structured Output: https://dev.meta.ai/docs/structured-output
- Meta Model API Cookbook: https://dev.meta.ai/docs/cookbook

**Final product statement:** **Less scrolling. More living. Closer friendships.**

## 19. Revision Notes — v1.3

- Locked **Muse Spark 1.3** as the required live runtime model for the hackathon prototype; no lower-model fallback or multi-model serving work is planned.
- Defined future **native Meta AI inside Messenger** as the intended first-party production experience under an explicitly hypothetical Meta-approval/support assumption.
- Kept the **Ask Meta AI** product label while requiring clear disclosure that the current working prototype uses Meta Model API / Muse Spark 1.3, **not** the native consumer Messenger assistant.
- Proposed **no separate user subscription** for Near-Circle-Friend while acknowledging Meta's eventual control over rollout/pricing and real incremental inference costs.
- Added model, disclosure, and future-positioning acceptance tests and a minimal adapter boundary without building unsupported private integrations.
- Preserved v1.2's event-driven persistent profiles, opt-in meetup inference, caching, cost controls, consent enforcement, standalone stack and independent repository boundaries.
