# Muse Spark 1.3 Ultra — Implement Isolated Judge Bootstrap Test Mode

**Project:** `E:\hacathon\meta\near-circle-friend`

## Objective

Implement a safe, isolated testing mode for the existing `npm run start:judges` command.

The purpose is to simulate a judge's first-run installation and startup on my Windows 11 development machine **without modifying, replacing, deleting, or interrupting existing Docker resources**.

## 1. New Command

Support:

```powershell
npm run start:judges -- --test
```

Preserve the existing commands and behavior:

- `npm run start:judges`
- `npm run startall`
- `npm run stopall`
- `npm run status`

The `--test` flag must activate a genuinely isolated execution environment.

## 2. Docker Isolation

Implement the following safeguards:

1. Use a unique Docker Compose project name, such as `near-circle-judges-test`.
2. Use separate containers, networks, and named volumes.
3. Do not mount or modify existing development database volumes.
4. Use separate host ports to avoid conflicts with existing services.
5. Do not stop, recreate, or restart existing development containers.
6. Never execute global Docker pruning or cleanup commands.
7. Never use `docker compose down -v` against the development project.
8. Check for explicit container names, image tags, bind mounts, and other configurations that could defeat Compose project isolation.

If complete isolation cannot be guaranteed, fail safely before modifying Docker resources.

## 3. Reuse Existing Docker Images

**Preserving existing Docker images is mandatory.**

Before building:

- Inspect the required images.
- Reuse existing compatible images whenever possible.
- Build only missing images.
- Give newly built test images separate, test-specific names or tags.
- Never overwrite an existing development image tag.
- Never remove existing images.

Do not assume a separate Compose project name alone guarantees image isolation.

Use image inspection to confirm which images can safely be reused.

If compatibility cannot be established, build an isolated test image rather than replacing an existing image.

## 4. Isolated Database

The test mode must create its own PostgreSQL/PostGIS environment.

- Use separate named volumes.
- Apply the existing database schema.
- Seed the latest fictional demo users.
- Preserve Coleen's eligibility at all four Radar distances.
- Preserve Rhea's existing demo behavior.
- Do not recreate Nicole.
- Never connect the seed script to the existing development database.

Verify the database connection target before running any migration or seeding command.

## 5. Meta API Credentials

Preserve the existing mandatory user-provided API key requirement.

- Read the user's existing `.env` without modifying it.
- Never display or log `MODEL_API_KEY`.
- Use `muse-spark-1.3`.
- Preserve 2048 completion tokens and low reasoning effort.
- Preserve strict structured-output validation.
- Do not simulate AI responses.

The test environment may use the configured API key for an explicitly requested live inference verification, but avoid unnecessary billable requests during routine startup.

## 6. Test Execution

The isolated bootstrap must perform the actual judge startup sequence:

1. Check prerequisites.
2. Validate environment configuration.
3. Prepare or reuse Docker images.
4. Create isolated containers and volumes.
5. Initialize the test database.
6. Load demo data.
7. Start the API and frontend.
8. Wait for actual service readiness.
9. Verify essential demo functionality.
10. Report test results and isolated application URLs.

Example output:

```text
Near-Circle-Friend — Isolated Judge Test

[OK] Docker environment isolated
[OK] Existing development containers untouched
[OK] Existing Docker images preserved
[OK] Database created in isolated volume
[OK] Demo users seeded
[OK] API healthy
[OK] Frontend ready
[OK] Coleen discoverable at 500 m
[OK] Judge bootstrap verified

Test environment ready.
```

Report actual verified results, not assumed success.

## 7. Cleanup and Repeated Runs

Provide a separate, explicit command to stop only the isolated test environment.

Cleanup must never affect the regular Near-Circle development environment.

Preserve test volumes by default unless the user explicitly requests their removal.

Repeated test runs must remain safe and idempotent.

## 8. Regression Testing

Test that:

- Development container IDs remain unchanged.
- Existing Docker image IDs and tags remain unchanged.
- Existing database volumes remain untouched.
- Test ports do not conflict with development ports.
- Test seeding targets only the isolated database.
- Existing `.env` remains unchanged.
- Missing images trigger isolated builds only.
- Existing compatible images are reused.
- An isolation conflict causes a safe failure.

Use mocked Docker command execution for destructive-operation safety tests, then perform an actual host-side isolated run where Docker is available.

## 9. Deliverables

Provide:

1. Files changed.
2. Implementation summary.
3. Exact isolated testing command.
4. Exact test-only shutdown command.
5. Docker image reuse and build strategy.
6. Evidence that existing resources remain unchanged.
7. Automated test results.
8. Host-side verification results.
9. Git commit hash.

Commit locally. Do not push.

**Acceptance criteria:** Running `npm run start:judges -- --test` must exercise the judge installation workflow in an isolated environment without modifying the existing Near-Circle development containers, images, database, volumes, or configuration.

**Priority: Absolute protection of the existing Docker environment over convenience or speed.**