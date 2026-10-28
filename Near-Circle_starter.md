# Near-Circle-Friend — Judge-Ready One-Command Installation and Startup

**Project:** `E:\hacathon\meta\near-circle-friend`  
**Hackathon:** Meta Global AI Hackathon 2026  
**Target:** GitHub repository evaluation by hackathon judges

## Objective

Implement a reliable, professional, judge-ready bootstrap and launch workflow for Near-Circle-Friend.

A judge should be able to clone the GitHub repository and execute:

```powershell
npm run start:judges
```

The command should automatically perform all application-level installation, configuration validation, Docker image preparation, database initialization, demo-data seeding, service startup, and readiness checks necessary to run Near-Circle-Friend.

Preserve the existing developer command:

```powershell
npm run startall
```

Do not modify its established behavior.

## 1. Inspect the Existing Architecture

Before implementing anything, inspect:

- Root `package.json` and npm scripts.
- npm lockfiles and workspace configuration.
- Existing `scripts/startall.ps1`, `stopall.ps1`, and `status.ps1`.
- Docker Compose configuration and service dependencies.
- API and web Dockerfiles.
- PostgreSQL/PostGIS initialization and migration procedures.
- Database seeding scripts and demo fixtures.
- Existing environment-variable configuration.
- Optional OSRM pedestrian-routing service.
- Health endpoints and application ports.
- Existing demo-user profile images.
- Meta Model API configuration.

Reuse established mechanisms rather than introducing a parallel architecture.

## 2. Create a Dedicated Judges Startup Command

Add:

```powershell
npm run start:judges
```

Implement it with a dedicated bootstrap script under `scripts/`.

Prefer a portable Node.js entry point if compatible with the existing architecture, so judges using Windows, macOS, or Linux can run the same npm command.

PowerShell may be retained as a Windows convenience wrapper.

Do not unnecessarily rewrite the existing PowerShell developer scripts.

## 3. Automated Preflight Checks

Before installation, verify that the system has the necessary prerequisites.

Check:

- Node.js and npm are installed and satisfy the repository's actual version requirements.
- Docker CLI is installed.
- Docker Engine/Desktop is running and accessible.
- Docker Compose v2 is available.
- Required application ports are available or already occupied by the same project's running services.
- Required environment files and credentials are correctly configured.
- The repository contains all necessary tracked files.

If a system-level prerequisite is missing, provide concise, actionable installation instructions.

Do not silently install Docker Desktop, Node.js, or other system-wide software requiring administrator privileges.

Do not continue after critical prerequisite failures.

## 4. Install Application Dependencies

Automatically install required npm dependencies.

Prefer:

```powershell
npm ci
```

when the repository contains a valid lockfile.

Respect npm workspaces and existing package structure.

Requirements:

- Deterministic dependency installation.
- No unnecessary dependency upgrades.
- No lockfile regeneration during judge startup.
- Clear installation progress.
- Graceful error reporting.
- Safe repeated execution.

If Docker builds already handle a dependency installation step, avoid unnecessary duplicate work while retaining any host dependencies required by subsequent scripts.

## 5. Prepare Docker Images and Services

Automatically download or build the required Docker images.

Use the existing Docker Compose configuration.

This includes the relevant services for:

- PostgreSQL/PostGIS
- Near-Circle API
- Near-Circle frontend
- Any other mandatory dependencies discovered during inspection

Use existing Dockerfiles and image references.

Avoid modifying version-pinned images unnecessarily.

Do not:

- Reset Docker volumes.
- Delete existing databases.
- Run destructive Docker cleanup commands.
- Remove unrelated containers or images.
- Download unnecessary large datasets.
- Rebuild unrelated projects.

Use Docker Compose's normal build, pull, and service-creation mechanisms.

## 6. Environment Configuration

Inspect and validate the existing environment-variable contract.

When appropriate:

- Generate `.env` from a safe `.env.example` if missing.
- Preserve an existing `.env`.
- Never overwrite user-provided credentials.
- Never embed API keys in source code.
- Never commit credentials to Git.
- Do not expose secrets in console output or error logs.

Check the Meta Model API configuration required for genuine inference using `muse-spark-1.3`.

Ensure:

- The completion-token configuration does not regress to the previous problematic 512-token setting.
- The intended 2,048-token configuration remains available.
- The existing low reasoning-effort configuration remains intact.
- Structured-output validation and `strict: true` are preserved.

If Meta API credentials are missing, explain precisely how to configure them.

The application may launch without AI only if its existing architecture supports that safely. Clearly communicate that live AI recommendations will be unavailable.

Never generate simulated AI responses or misrepresent demo output as `meta_live`.

## 7. Initialize Database and Demo Data

On a fresh installation:

1. Start PostgreSQL/PostGIS.
2. Wait until the database is healthy.
3. Apply the existing schema initialization or migration process.
4. Run the existing idempotent demo-seeding workflow.
5. Verify essential demo users and their required relationships.
6. Verify that required location and visibility records exist.

Ensure the resulting demo dataset reflects our latest commits.

Specific requirements:

- Coleen is approximately 280 meters from the existing demo reference user.
- Coleen remains eligible for Reconnect Today at 500 m, 1 km, 2 km, and 5 km.
- Rhea remains discoverable at her intended radius.
- Nicole must not be recreated.
- Existing synthetic availability for the selected demo users is preserved.
- Existing profile pictures continue loading.

The bootstrap process must not clear real user data, reset volumes, or globally remove suppression records.

For a fresh judge installation, seed only the intended clean demo state.

For an existing installation, perform migrations and safe idempotent initialization without unnecessarily overwriting persistent state.

If a specific migration or cleanup is necessary, report it explicitly rather than running arbitrary destructive cleanup.

## 8. Optional OSRM Routing

Inspect the current optional OSRM routing profile and existing Metro Manila pedestrian-routing configuration.

If a valid local routing graph exists, initialize the routing service using the established mechanism.

If the graph is absent:

- Do not fail the entire application installation solely because optional routing data is missing.
- Clearly report that routing is unavailable.
- Preserve existing routing feature behavior.
- Document the steps required to enable routing.
- Do not silently download or preprocess a large geographic dataset.

If routing is essential to a promised judge demonstration, recommend a separate documented setup procedure and identify its actual dependencies.

Do not invent routes or substitute fake routing responses.

## 9. Start the Application

Start the required services in the correct dependency order.

Wait for actual readiness, not arbitrary fixed delays.

Use:

- Docker health checks where available.
- Existing API health endpoints.
- Frontend HTTP readiness checks.
- Appropriate bounded retries and timeouts.

A running container must not automatically be considered a healthy application.

Handle:

- Docker daemon unavailable.
- Port conflicts.
- Missing environment settings.
- Database startup failures.
- Migration or seed failures.
- Image build failures.
- API startup errors.
- Web server failures.

Display helpful errors without leaking credentials.

## 10. Judge-Friendly Terminal Output

Provide clean, understandable terminal output.

Example target experience:

```text
================================================
 Near-Circle-Friend
 Meta Global AI Hackathon 2026
 Judge Installation & Startup
================================================

[OK] Node.js and npm detected
[OK] Docker Engine running
[OK] Docker Compose available
[OK] Environment configuration validated
[OK] Application dependencies installed
[OK] Docker images ready
[OK] PostgreSQL/PostGIS healthy
[OK] Database initialized
[OK] Demo users seeded
[OK] Near-Circle API healthy
[OK] Near-Circle frontend ready

AI Provider: Meta Muse Spark 1.3
AI Status: Configured / Not configured
Routing: Available / Not configured

Near-Circle-Friend is ready!

Application: http://localhost:<actual-port>
API Health: http://localhost:<actual-port>/health

Demo: Open Radar → Select 500 m → Reconnect Today
================================================
```

Use actual detected URLs, ports, and verified statuses. The example above is illustrative.

Print success only after the required readiness checks pass.

If reasonable, automatically open the application's URL in the default browser after successful startup. Browser launching should be nonessential and must not cause the process to fail.

## 11. Repeated Execution and Idempotency

Judges may execute the command several times.

Ensure:

- Existing healthy services are reused where appropriate.
- Dependencies are not unnecessarily reinstalled.
- Database records are not duplicated.
- Existing volumes remain intact.
- Seed operations are repeatable.
- No port conflicts are introduced by duplicate containers.
- Failures produce actionable messages.
- A subsequent invocation can recover from an interrupted setup.

Do not run `docker compose down -v`, destructive database resets, or broad image-pruning commands.

## 12. GitHub README — Judges Quick Start

Update `README.md` with a prominent section:

### Quick Start for Hackathon Judges

Document:

1. Git clone command using the repository's actual URL if available.
2. Node.js and Docker prerequisites.
3. How to start Docker Desktop or Docker Engine.
4. Required environment variables and obtaining authorized Meta API access.
5. The one-command startup:
   ```powershell
   npm run start:judges
   ```
6. The actual local application URL.
7. Demo instructions.
8. How to stop services using the existing supported command.
9. Basic troubleshooting for common setup failures.

Clearly distinguish:

- What the script installs automatically.
- What requires a previously installed system dependency.
- What requires user-provided Meta API credentials.
- Which optional features need additional routing data.

Make the documentation accessible to judges unfamiliar with the repository.

Avoid claiming that the startup command automatically installs Docker Desktop or provisions Meta API credentials.

## 13. Verification

Test the judge bootstrap workflow under these scenarios:

**Scenario A — Fresh clone**

A clean repository checkout with no installed npm dependencies and no existing project containers.

Expected: dependencies install, required Docker images become available, database initializes, dummy users load, services start, and the UI becomes reachable.

**Scenario B — Existing installation**

Run the command again on an already initialized environment.

Expected: successful startup without duplicate records or unnecessary database changes.

**Scenario C — Docker unavailable**

Expected: clear instructions and graceful termination.

**Scenario D — Missing Meta API credentials**

Expected: explicit configuration guidance; no fake AI inference.

**Scenario E — Optional routing data absent**

Expected: core application starts if routing is genuinely optional.

**Scenario F — Application startup failure**

Expected: nonzero exit code and a useful explanation.

Add targeted automated tests for the bootstrap logic where feasible.

Run the existing API/web test suites, TypeScript checks, and frontend build.

Do not claim fresh-clone or Docker verification unless actually executed in a suitable host environment.

## 14. Preserve Existing Functionality

Do not modify unrelated application behavior.

Specifically preserve:

- `npm run startall` developer workflow.
- Existing Docker Compose service architecture.
- PostgreSQL/PostGIS proximity.
- Reconnect Today eligibility and suppression logic.
- Coleen's four-radius eligibility.
- Rhea's existing discovery behavior.
- Synthetic availability and demo isolation.
- User avatars.
- Meta Muse Spark 1.3 integration.
- Strict AI schemas and validation.
- OSRM routing architecture.
- Existing privacy and consent safeguards.

Do not expose credentials or reset persistent volumes.

## 15. Deliverables

Provide:

1. New judge startup command and associated scripts.
2. Summary of automatically installed and prepared dependencies.
3. Changes to `package.json` and related files.
4. Updated GitHub README quick-start instructions.
5. Fresh-install and repeated-run behavior.
6. Test results and build verification.
7. Known limitations and external prerequisites.
8. Exact command to validate the workflow on my Windows host.
9. Git commit hash.

**Acceptance criteria:**

A hackathon judge can clone the repository, install required system prerequisites, provide authorized Meta API credentials where necessary, and start Near-Circle-Friend with:

```powershell
npm run start:judges
```

The command must prepare application dependencies, Docker images, database schema, demo users, API, and frontend without manual application-setup steps, destructive resets, or simulated AI responses.

**Priority:** Reliability, reproducibility, minimal host prerequisites, clean documentation, and preservation of the existing development environment.