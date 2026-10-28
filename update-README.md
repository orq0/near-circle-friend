# Muse Spark 1.3 Ultra — Visual GitHub README Redesign for Meta Hackathon Judges

**Project:** Near-Circle-Friend (Ni-Ce-Friend)  
**Repository:** `E:\hacathon\meta\near-circle-friend`  
**Official GitHub:** https://github.com/orq0/near-circle-friend  
**Customer journey images:** `E:\hacathon\meta\img\custmer-journey`  
**Hackathon:** Meta Global AI Hackathon 2026

## 1. Primary Objective

Redesign the existing `README.md` into a visually rich, professionally structured, judge-ready GitHub presentation.

The README should combine:

- A prominent one-command installation guide for judges.
- The latest customer journey screenshots.
- Previously created diagrams and architectural illustrations.
- Additional graphical diagrams explaining the system.
- Clear, concise product storytelling.
- Technical credibility and evidence of genuine Meta AI integration.
- Accessible developer documentation.

**Important: This is a visual enhancement of the existing README, not a complete replacement of useful documentation.**

Preserve existing accurate diagrams, explanations, and technical content while reorganizing them into a more compelling visual narrative.

The README should resemble a polished technology product showcase, with the clarity of a professional software engineering portfolio.

It should help judges quickly understand:

1. How to run the project.
2. What Near-Circle-Friend does.
3. How users experience the feature.
4. How the underlying technology works.
5. Why Meta AI is meaningfully integrated.
6. How privacy and discovery eligibility are maintained.

## 2. Design Direction

Adopt a modern, visually engaging, GitHub-native design.

### Visual personality

- Clean, modern, and professional.
- Inspired by contemporary social applications and technical product presentations.
- Subtle Messenger-inspired blue accents where appropriate.
- Balanced visual hierarchy.
- Strong headings and concise explanatory text.
- Visually organized workflows and diagrams.
- Screenshots with consistent spacing and captions.
- Readable in GitHub light and dark themes.

Avoid:

- Excessive emoji decoration.
- Large walls of uninterrupted text.
- Unnecessary marketing buzzwords.
- Unsupported HTML/CSS styling.
- Fragile layouts that break on mobile.
- External diagram-rendering dependencies.
- Decorative illustrations that provide no information.

### Preferred visual technologies

Use GitHub-supported presentation methods:

1. Markdown for headings and documentation.
2. Mermaid for technical flowcharts, workflows, and architecture diagrams.
3. Repository-hosted PNG/JPEG/WebP/SVG images where appropriate.
4. GitHub-compatible HTML tables or image layouts when necessary.
5. Existing diagrams and screenshots already present in the repository.

Prefer Mermaid for new diagrams because GitHub renders it natively and the diagram source remains maintainable.

Do not introduce external JavaScript, diagram-hosting services, or runtime dependencies.

## 3. Inspect and Preserve Previous Diagrams

Before editing the README, inspect:

- Existing `README.md`.
- Existing architecture diagrams.
- Existing flowcharts.
- Existing Mermaid blocks.
- Previously included system illustrations.
- Current screenshot references.
- Documentation image directories.
- Relevant architecture documents.
- Project's actual frontend, backend, AI, database, and routing implementations.

### Requirements

**Preserve previously created diagrams that remain technically accurate.**

Do not remove useful diagrams simply because the README is being redesigned.

Instead:

- Retain relevant existing diagrams.
- Improve headings and captions around them.
- Relocate diagrams into more appropriate sections.
- Correct outdated labels where verified.
- Improve readability if necessary.
- Consolidate diagrams that explain exactly the same information.
- Keep diagrams consistent with the current architecture.

If a diagram is outdated, verify the actual implementation before updating it.

Do not invent system components or external services to make an architecture diagram appear more sophisticated.

Provide an inventory of retained, modified, added, and removed diagrams.

## 4. Replace Outdated Customer Journey Screenshots

Use the updated screenshots from:

`E:\hacathon\meta\img\custmer-journey`

Treat these images as the authoritative customer journey visual assets.

### Image inspection

Inspect all supplied images and determine:

- Actual filenames.
- Dimensions and formats.
- Customer journey sequence.
- Relevant UI screens.
- Duplicate or outdated images.
- Which user action each screenshot demonstrates.

Do not assume alphabetical filename order necessarily represents the intended customer journey.

### Image replacement

1. Identify the older customer journey screenshots referenced in the current README.
2. Replace them with the new screenshots.
3. Preserve existing architecture diagrams and other useful technical illustrations.
4. Copy the selected new screenshots into the Git repository.

Preferred destination:

`docs/images/customer-journey/`

5. Use repository-relative paths.
6. Preserve aspect ratios and UI readability.
7. Add descriptive alt text.
8. Include short captions explaining each screenshot.
9. Keep the original external image directory untouched.
10. Ensure all referenced images are included in Git.

Do not mix outdated customer journey screenshots with the new screenshots.

Do not delete diagrams or other images that continue to serve a distinct purpose.

## 5. Required README Structure

Organize the README in the following order.

### Header — Project Identity

# Near-Circle-Friend (Ni-Ce-Friend)

**A Proposed Facebook Messenger Feature**

*Discover nearby friends. Reconnect in real life.*

Add a concise product introduction explaining that Near-Circle-Friend helps existing friends rediscover opportunities for real-world connections through proximity-aware discovery and AI-assisted meetup recommendations.

Clearly state that this is an independent Meta Global AI Hackathon 2026 prototype, not an officially released Meta or Facebook feature.

Preserve suitable existing branding.

### Section 1 — Quick Start for Hackathon Judges

**This must remain the first major section.**

Prioritize clear installation instructions over lengthy product explanations.

#### Prerequisites

- Git.
- Node.js 20 or newer.
- npm.
- Docker Desktop or Docker Engine.
- Docker Compose v2.
- Authorized Meta Model API credentials supplied by the judge.

#### Clone

`git clone https://github.com/orq0/near-circle-friend.git`

`cd near-circle-friend`

#### Configure

Create `.env` from `.env.example` using the verified platform-appropriate command.

Judges must provide their own `MODEL_API_KEY`.

Required configuration:

`MODEL_API_KEY=YOUR_OWN_META_API_KEY`

`AI_CIRCLE_MAX_TOKENS=2048`

`AI_CIRCLE_REASONING_EFFORT=low`

#### Start

Prominently feature:

`npm run start:judges`

Explain that this command prepares application dependencies, Docker images, database initialization, demo data, and application services.

Verify all capabilities against the actual bootstrap implementation.

#### Open

Use the verified application address, expected to be:

`http://localhost:5173`

#### Quick Demonstration

Provide a concise walkthrough:

1. Open Near-Circle-Friend.
2. Explore Radar.
3. Switch between 500 m, 1 km, 2 km, and 5 km.
4. Open Reconnect Today.
5. Observe Coleen across all four distances.
6. Explore Rhea at 5 km.
7. Examine user profiles and avatars.
8. Trigger Ask Meta AI to request genuine meetup advice.

Verify actual demo behavior before stating it as guaranteed.

Include short troubleshooting instructions and a link to the detailed developer guide.

### Add Visual Diagram A — Judge Installation Workflow

Immediately after the Quick Start instructions, add a compact Mermaid flowchart illustrating the installation process.

Conceptual sequence:

Clone repository → Configure Meta API key → Run `npm run start:judges` → Install dependencies → Prepare Docker services → Initialize demo database → Verify readiness → Open application.

The diagram must reflect the actual script behavior.

Show failure branches only where they improve comprehension.

Do not create a large or complicated flowchart for this section.

## 6. Section 2 — Customer Journey: From Online Friendship to Real-World Connection

This is the main visual product showcase.

Use the new customer journey screenshots exclusively.

### Visual presentation

Present the experience as a sequence of visually distinct stages.

Suggested stages, to be adapted to the actual images:

**01 — Discover**

See eligible friends nearby.

**02 — Explore**

Adjust discovery distance and inspect the Radar.

**03 — Reconnect**

Find friends through Reconnect Today.

**04 — Understand**

Explore profiles and available social context.

**05 — Ask Meta AI**

Receive a grounded recommendation generated by Muse Spark 1.3.

**06 — Connect**

Use the experience to help initiate a real-world meetup.

For each stage:

- Add a short heading.
- Display the relevant screenshot.
- Add a concise explanatory caption.
- Describe the product value in one or two sentences.

If the supplied images contain fewer or more stages, adapt the presentation accordingly.

Do not invent a screen or interaction simply to fill the sequence.

### Add Visual Diagram B — User Journey Overview

Include a polished Mermaid diagram showing the complete conceptual experience.

Suggested flow:

Open Near-Circle → Select discovery radius → Discover eligible friends → Select Reconnect Today → Review friend context → Request Meta AI advice → Decide whether to reconnect.

Show that the user remains in control of whether to initiate a meetup.

Make it easy to understand at a glance.

Place this diagram near the screenshots as an overview or conclusion to the section.

## 7. Section 3 — What Is Near-Circle-Friend?

Explain:

- The problem of online friendships becoming inactive.
- The opportunity created by geographical proximity.
- Why reconnecting with existing friends is different from discovering strangers.
- How contextual social signals can support reconnection.
- How AI can assist with suggesting suitable activities.
- Why privacy and consent matter.

Use concise paragraphs and a clear product narrative.

Consider a compact comparison table contrasting traditional passive social connections with the proposed Near-Circle experience.

Do not include invented statistics, unverified impact claims, or unsupported Facebook integration claims.

## 8. Section 4 — Core Features

Organize the existing capabilities into clearly separated subsections.

Include verified functionality such as:

- Nearby Friends Radar.
- Adjustable discovery distances.
- Reconnect Today.
- Social context and reconnection signals.
- AI-generated meetup advice.
- Privacy and eligibility controls.
- Demo profiles and synthetic availability.
- Realistic profile pictures.
- Optional pedestrian routing.

Where practical, accompany selected features with relevant existing screenshots or diagrams.

Avoid repeating the entire customer journey gallery.

## 9. Section 5 — System Architecture

This should be one of the strongest technical sections of the README.

### Preserve existing architecture diagrams

Retain useful diagrams describing:

- Frontend and backend architecture.
- Database and geospatial processing.
- AI provider integration.
- Routing infrastructure.
- Docker orchestration.

Reposition and improve them where necessary.

### Add Visual Diagram C — High-Level Architecture

Create a GitHub-native Mermaid diagram showing the actual implementation.

At minimum, represent verified components such as:

**User interface**
- React/Vite frontend, if confirmed.

**Application services**
- Near-Circle backend API.
- Discovery and reconnect services.
- AI advisor service.

**Data layer**
- PostgreSQL/PostGIS.

**AI integration**
- Meta Model API.
- `muse-spark-1.3`.

**Routing**
- Optional OSRM service, if present.

Show actual communication and dependencies.

Use separate, clearly labeled subgraphs for frontend, backend, data, AI, and optional infrastructure where appropriate.

Keep the diagram readable without horizontal scrolling on typical desktop screens.

Do not falsely imply direct integration with production Facebook or Messenger infrastructure.

## 10. Section 6 — How Meta AI Works

Dedicate a visually clear section to the genuine Meta AI integration.

Explain that Near-Circle-Friend does not hardcode AI recommendations.

The backend constructs factual context from eligible user information and invokes the actual Meta Model API.

### Add Visual Diagram D — Meta AI Recommendation Pipeline

Represent the real flow:

User requests meetup advice → Backend verifies eligibility and relevant context → Structured request to Muse Spark 1.3 → Meta API inference → Structured response validation → Recommendation displayed in UI.

Include appropriate failure paths for insufficient context, unavailable AI, or invalid responses if they materially improve understanding.

Distinguish deterministic application checks from generative AI behavior.

Describe:

- Model: `muse-spark-1.3`.
- Completion budget: 2048 by default.
- Reasoning effort: low by default.
- Strict structured outputs.
- Validation of model responses.
- Genuine live inference.
- Synthetic demo data used as input context only.

Do not display credentials or internal reasoning content.

Do not claim every request necessarily yields a positive recommendation.

## 11. Section 7 — Privacy, Consent, and Discovery Eligibility

Explain how the application protects user control.

Describe verified mechanisms such as:

- Approved friendship requirements.
- Discovery visibility settings.
- Location freshness.
- Proximity eligibility.
- Reconnect suppression.
- Snooze and dismissal behavior.
- Quiet hours.
- Consent and preference checks where implemented.

### Add Visual Diagram E — Discovery Eligibility Flow

Use a compact Mermaid flowchart to explain how the application determines whether a friend may appear.

Example conceptual flow:

Existing friendship? → Discovery permitted? → Location current? → Within selected radius? → Eligible for display.

For Reconnect Today, show the additional candidate criteria and suppression behavior where applicable.

Do not imply that these gates are all implemented in exactly this order without verifying the source code.

Distinguish actual backend enforcement from frontend display logic.

This diagram should communicate privacy-aware architecture rather than bypassing existing safeguards.

## 12. Section 8 — Technology Stack

Include an organized table summarizing the actual technologies.

Suggested columns:

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Verified framework | User interaction |
| Backend | Verified API stack | Application logic |
| Geospatial | PostgreSQL/PostGIS | Proximity operations |
| AI | Meta Model API | Meetup recommendations |
| Routing | Optional OSRM | Pedestrian route calculations |
| Infrastructure | Docker Compose | Local orchestration |

Confirm actual technologies and descriptions against the repository.

Avoid adding unsupported services simply because they are commonly used in modern applications.

## 13. Section 9 — Developer Guide

Move developer-oriented documentation below the judge experience, product explanation, and technical visualizations.

Preserve:

`npm run startall`

Clearly distinguish it from:

`npm run start:judges`

Document verified developer commands for:

- Starting services.
- Checking status.
- Stopping services.
- Running tests.
- Running integration tests.
- Building the frontend.
- Managing database fixtures.
- Working with optional routing infrastructure.

Preserve useful existing developer instructions and references.

Avoid duplicating the judge installation guide.

## 14. Section 10 — Additional Technical Documentation

Preserve or link to existing documentation about:

- API contracts.
- Environment variables.
- Database schema.
- Geospatial queries.
- AI validation.
- Demo data.
- Routing setup.
- Testing.
- Troubleshooting.

Do not remove useful information simply to shorten the README.

Use concise summaries and relative links to detailed documentation where appropriate.

## 15. Diagram Design Standards

The README must be visually informative without becoming overcrowded.

### Mermaid guidelines

- Prefer flowchart diagrams for user journeys and decision flows.
- Use grouped subgraphs for architecture.
- Use sequence diagrams only when timing or request-response interactions are important.
- Keep labels short and readable.
- Use consistent node naming.
- Prefer vertical layouts when they improve mobile readability.
- Avoid excessively wide diagrams.
- Avoid dozens of nodes in a single diagram.
- Use a consistent visual vocabulary across diagrams.
- Ensure compatibility with GitHub's Mermaid renderer.

Use theme-aware Mermaid styling that remains readable in light and dark modes.

Do not rely on unsupported advanced styling or externally loaded assets.

### Diagram selection

The five proposed diagrams are:

1. Judge installation workflow.
2. Customer journey.
3. System architecture.
4. Meta AI recommendation pipeline.
5. Discovery/privacy eligibility.

**These are candidate diagrams, not a quota.**

Inspect the existing README first. If accurate equivalent diagrams already exist, preserve and enhance them rather than creating duplicates.

The goal is useful visual explanation, not diagram quantity.

## 16. Visual Storytelling and Layout

Design the README so the reader alternates naturally between:

- Short explanations.
- Screenshots.
- Technical diagrams.
- Tables.
- Clear command examples.

Avoid stacking several large Mermaid diagrams without context.

Each diagram should answer one meaningful question.

Examples:

**Installation workflow:** How do I run this?

**Customer journey:** What does the user experience?

**System architecture:** How is the application built?

**AI pipeline:** Where does Meta AI add value?

**Eligibility flow:** How does the system protect user choice?

Use short explanatory paragraphs before and after important visualizations.

Keep the judges' attention on the product and its working implementation.

## 17. Accuracy and Safety Requirements

Before writing technical claims, inspect the actual implementation.

Preserve:

- `muse-spark-1.3`.
- Strict structured-output validation.
- The 2048-token default.
- Low reasoning effort.
- Existing privacy and consent checks.
- Existing database and routing architecture.
- Synthetic demo availability.
- Coleen's eligibility across four radii.
- Rhea's existing discovery behavior.
- Nicole's removal from the demo roster.
- Existing user profile pictures.
- Current startup and bootstrap workflows.

Do not portray Near-Circle-Friend as an officially deployed Messenger feature.

Do not claim access to real Facebook friendships or live Facebook user locations.

Do not fabricate performance metrics, product adoption, security certifications, or endorsements.

Never expose API keys.

Do not simulate AI-generated recommendations.

## 18. Scope Restrictions

Authorized modifications:

- `README.md`.
- Customer journey image assets copied into the repository.
- Documentation-only diagram assets, if genuinely necessary.

Not authorized:

- Application source changes.
- API modifications.
- Database changes.
- Demo fixture modifications.
- Docker Compose modifications.
- Startup-script changes.
- AI model changes.
- Privacy-rule modifications.
- Routing modifications.

Do not reset Docker volumes or remove unrelated assets.

Preserve any unrelated uncommitted work.

## 19. Verification

After updating the README:

1. Confirm Quick Start for Hackathon Judges is the first major section.
2. Confirm the updated screenshots replaced older customer journey screenshots.
3. Confirm existing accurate diagrams were preserved.
4. Confirm any new Mermaid diagrams accurately represent the implementation.
5. Confirm Mermaid syntax is valid and compatible with GitHub.
6. Verify all image paths resolve to files inside the repository.
7. Verify every newly referenced image is Git-tracked.
8. Verify the official repository URL is correct throughout.
9. Confirm installation commands match the current scripts.
10. Confirm all Meta AI configuration values are accurate.
11. Confirm no credentials appear in documentation.
12. Check for redundant diagrams and duplicated documentation.
13. Check README readability in light and dark GitHub themes where feasible.
14. Check desktop and mobile readability where feasible.
15. Confirm no application runtime files were modified.

If rendering verification is unavailable, clearly report what was verified statically and what still requires GitHub-side review.

## 20. Deliverables

Provide:

1. Summary of the redesigned README.
2. Final README section structure.
3. Inventory of existing diagrams retained or improved.
4. Inventory of new diagrams added.
5. List of replaced screenshots.
6. List of new customer journey images and their repository paths.
7. Image and Mermaid validation results.
8. Confirmation that the judges' Quick Start appears first.
9. Confirmation that all published image assets are repository-relative and tracked.
10. List of modified files.
11. Git commit hash.

Commit the changes locally with a descriptive message.

Suggested commit message:

`docs: redesign judge README with visual workflows and customer journey`

Do not push to GitHub without explicit permission.

## 21. Final Acceptance Criteria

The final README must meet the following standards:

**Judge-first:** Installation instructions are immediately accessible and use `npm run start:judges`.

**Visually rich:** Updated customer journey screenshots, preserved historical diagrams, and useful additional diagrams provide a coherent visual explanation.

**Technically credible:** Diagrams accurately represent the real architecture, Meta AI integration, geospatial discovery, and eligibility safeguards.

**Professional:** The README feels like a polished product and engineering presentation suitable for an international Meta AI hackathon.

**Portable:** Images and documentation work from a fresh GitHub clone without local filesystem dependencies.

**Accurate:** No fabricated capabilities, unsupported integrations, or simulated AI responses.

**Non-invasive:** No unrelated source, database, Docker, or application behavior changes.

### Final direction

Treat the README as both:

1. **A product showcase** demonstrating why Near-Circle-Friend matters.
2. **An engineering showcase** demonstrating how it works.

The judges should be able to understand the complete project by scrolling through the README, even before running the application.

**Priority order: Judge Quick Start → Updated Visual Customer Journey → Product Value → Features → System Architecture → Meta AI Pipeline → Privacy → Technology Stack → Developer Documentation.**