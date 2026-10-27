# NEAR-CIRCLE-FRIEND — CIRCLE INSIGHT UI/UX REFINEMENT & DEMO DATA COMPLETION

**Repository:** `E:\hacathon\meta\near-circle-friend`  
**Task:** Improve the emotional appeal of Circle Insight and populate missing friendship insights across eligible demo users.

## 1. Objective

Near-Circle-Friend helps people strengthen existing friendships and reconnect in real life.

The current Circle Insight interface is functional but feels too analytical and mechanical. Terms such as "Request reassessment," "Evidence: moderate," and exposed numerical friendship levels make the interface resemble a data-management dashboard.

Additionally, only one observed demo friend, Alex, currently has a populated Circle Insight profile. Other friends, including Coleen, display:

- "Not enough information"
- "No estimate"
- "Recent activity: Unknown"

We need to address both problems.

**Design direction:** Warm, personal, welcoming, conversational, subtly playful, and emotionally engaging.

## 2. Redesign Circle Insight

Rename the user-facing section to:

**"Your Circle with [Friend Name]"**

Use the friend's approved display name.

Replace mechanical descriptions with natural, friendship-oriented language grounded in actual authorized or synthetic profile data.

Example:

**"Close friends 💛"**

"You and Alex have a long-standing connection. Even when communication is occasional, your history of catching up suggests an established friendship."

Design requirements:

- Tasteful friendship-themed icons and emojis
- Warm, restrained color accents
- Soft backgrounds and rounded cards
- Friendly typography
- Comfortable spacing
- Subtle transitions
- Mobile-first responsiveness
- Consistency with the existing Messenger-inspired interface

Avoid excessive decoration or sentimental language that feels artificial.

## 3. Improve the Assessment Experience

Replace existing terminology:

| Current UI | Updated UI |
|---|---|
| Circle Insight | Your Circle with [Name] |
| Request reassessment | ✨ Refresh insight |
| Set my tier | 💛 My view of our friendship |
| Recent activity | Your connection lately |
| Not enough information | Not enough friendship context yet |
| Evidence: moderate | Available under "How was this determined?" |

Keep provenance, assessment date, and evidence quality accessible through a secondary disclosure.

Always distinguish live Meta AI results, synthetic demo profiles, user-selected levels, and unavailable assessments.

## 4. Replace Numerical Friendship Controls

Remove the permanently visible `5 4 3 2 1` controls.

Instead, provide an expandable section:

**"How would you describe your friendship?"**

Choices:

- 💖 Inner Circle
- 💛 Close Friend
- 😊 Regular Friend
- 👋 Casual Friend
- 🤝 Acquaintance

Internally retain the original numerical levels 1–5.

Preserve existing manual override behavior, permissions, and persistence.

## 5. Complete Missing Demo Friendship Data — Important

**Observed issue:** Alex currently has a populated Circle Insight profile, but the other visible demo friends do not consistently have sufficient profile data or synthetic interaction histories.

This makes the demonstration feel incomplete.

### Required implementation

1. Inspect the existing demo friendship dataset, database schema, `db/seed/ai-demo.sql`, seed runner, and Circle Insight services.

2. Identify all demo accounts and their authorized friendships. Determine which eligible friend relationships currently lack Circle Insight profiles or usable structured interaction signals.

3. Populate realistic synthetic friendship histories for **every eligible, visible demo friend relationship**, including Coleen and the other existing demo friends.

4. Include meaningful variation in friendship levels, recent interaction activity, and relationship histories.

5. Provide enough structured signals to support genuine Muse Spark 1.3 assessments, including:
   - Friendship duration
   - Contact frequency
   - Interaction recency
   - Reciprocity
   - Confirmed meetup history
   - Shared interests
   - Long-term friendship context
   - Recent activity trends

6. Seed representative friendship levels across the five supported categories, without assigning artificial levels solely to make every category appear.

7. Where appropriate, prepopulate persistent friendship profiles with explanatory rationale, evidence quality, assessment date, and activity summaries.

8. Ensure seeded profiles are explicitly labeled as **Demo profile** or **Sample insight**, never as live Meta AI assessments.

9. Ensure every eligible demo friend has a meaningful Circle Insight display rather than defaulting to "Unknown" merely because seed records are missing.

10. Preserve user-private ownership: if multiple demo accounts can sign in, populate authorized owner–friend relationships appropriately without leaking one user's private closeness assessment to another.

### Important exceptions

Do not violate privacy or fabricate certainty.

- Taylor and other opted-out, blocked, or hidden users must retain their existing access restrictions.
- Preserve the system's genuine insufficient-information behavior.
- Maintain at least one dedicated, clearly labeled insufficient-evidence test scenario, if needed.
- Do not force an estimate when meaningful evidence is genuinely absent.

### Data integrity

- Extend existing demo seeds rather than creating disconnected datasets.
- Keep seeding idempotent.
- Do not overwrite real user data, consent settings, live AI assessments, or manual overrides.
- Use existing demo identities and relationships.
- Keep synthetic data clearly distinguished from real user information.
- Do not reset databases or delete Docker volumes.

**Goal:** All eligible demo friendships should have believable and varied histories that make Circle Insight useful, while preserving honest abstention and consent enforcement.

## 6. Improve the Missing-Context Experience

For genuinely insufficient information, replace the technical empty state with:

**"Every friendship has its own story."**

"We don't have enough information yet to offer a meaningful insight into your connection with [Name]."

Where supported, offer:

**"Add friendship context"**

Allow optional, consent-based structured information.

Do not create a nonfunctional button or invent relationship facts. If supporting this action would require a substantial new backend capability, report the gap and preserve a truthful, helpful empty state.

## 7. Preserve AI Architecture

Do not modify or compromise:

- Persistent friendship profiles
- Event-driven AI reassessment
- Muse Spark 1.3 integration
- Deterministic nearby-friend discovery
- User-triggered Ask Meta AI recommendations
- Consent and authorization
- Inference budgets and cooldowns
- PostGIS proximity logic
- OSRM routing
- Existing startup scripts

Opening a friendship profile must not automatically trigger an AI request.

Synthetic profile data may be used as input for real Muse inference, but synthetic inputs and live AI outputs must retain distinct provenance.

## 8. Testing and Verification

Verify:

1. Alex displays a warm, populated friendship insight.
2. Coleen receives realistic synthetic friendship history and an appropriate Circle Insight profile.
3. Other eligible demo friends also have meaningful profile data.
4. Friendship levels and recent-activity summaries vary realistically.
5. User-private insights remain properly scoped.
6. Privacy opt-outs remain effective.
7. Manual overrides continue working.
8. Refresh insight respects permissions, cooldowns, and live/demo labeling.
9. Missing-information scenarios remain honest.
10. Re-running seeds does not overwrite user-generated data.
11. Existing radar, routing, Ask Meta AI, and invitation flows remain functional.
12. API, web, and relevant integration tests pass.

Run actual project tests where available. If tooling is blocked, report the limitation and distinguish simulated verification from native test results.

## 9. Delivery Requirements

Implement both the UI refinement and the demo data improvements.

Report:

- UI components updated
- Seed files modified
- Demo friendships covered
- Missing-context scenarios retained
- Tests executed and results
- Database seeding command
- Whether Docker application images require rebuilding
- Any limitations

Keep all work within Near-Circle-Friend.

Do not modify other repositories, delete database volumes, or push to GitHub without authorization.

**Product principle:**

Near-Circle-Friend should feel like an invitation to reconnect with someone you care about—not a dashboard evaluating relationships.

**Less scrolling. More living. Closer friendships.**