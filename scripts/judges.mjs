#!/usr/bin/env node
// Near-Circle-Friend judge bootstrap: `npm run start:judges`.
// Portable Node.js entry point (Windows/macOS/Linux, stdlib only) that performs
// preflight checks, dependency install, .env setup, Docker image preparation,
// service startup, idempotent demo seeding, and readiness verification.
//
// Reuses the established mechanisms instead of duplicating them:
//   - ports/defaults mirror scripts/common.ps1 and docker-compose.yml,
//   - readiness bounds mirror scripts/startall.ps1 (polling, no fixed delays),
//   - `npm run startall` is untouched; this command is additive.
// Exit code is 0 only when database, API, and frontend are all ready.
// Routing (OSRM graph) is optional: its absence never fails the bootstrap.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { get } from 'node:http';
import { get as getHttps } from 'node:https';
import { dirname, join, resolve } from 'node:path';
import { Socket } from 'node:net';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const COMPOSE_FILE = join(REPO_ROOT, 'docker-compose.yml');
export const ENV_EXAMPLE = join(REPO_ROOT, '.env.example');
export const ENV_FILE = join(REPO_ROOT, '.env');

// Defaults mirror scripts/common.ps1 Read-NearCircleEnv.
export const DEFAULT_ENV = {
  WEB_PORT: '5173',
  API_PORT: '3001',
  POSTGRES_PORT: '5433',
  ROUTING_WALK_PORT: '5002',
  POSTGRES_USER: 'near_circle',
  POSTGRES_DB: 'near_circle',
  MAP_TILE_URL: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  META_MODEL_NAME: 'muse-spark-1.3',
  AI_CIRCLE_MAX_TOKENS: '2048',
  AI_CIRCLE_REASONING_EFFORT: 'low',
};

export const REQUIRED_TRACKED_FILES = [
  'docker-compose.yml',
  'apps/api/Dockerfile',
  'apps/web/Dockerfile',
  'apps/api/package.json',
  'apps/web/package.json',
  'db/init/02-schema.sql',
  'db/init/03-ai-circle.sql',
  'db/seed/phase2-demo.sql',
  'db/seed/ai-demo.sql',
  '.env.example',
];

// MLD sentinel files written by the last two OSRM pipeline stages; mirrors
// Test-RoutingGraph in routing/prepare-graph-lib.ps1.
export const ROUTING_SENTINELS = [
  'near-circle.osrm.partition',
  'near-circle.osrm.cells',
  'near-circle.osrm.mldgr',
  'near-circle.osrm.cell_metrics',
];

export const READINESS_TIMEOUTS_MS = { db: 90000, api: 90000, web: 120000 };

// ---- Pure logic (unit-tested by scripts/judges.test.mjs) --------------------

/** Parse dotenv-style text; later lines win. Mirrors Read-NearCircleEnv. */
export function parseEnvText(text) {
  const out = {};
  for (const rawLine of String(text).split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    if (key !== '') out[key] = value;
  }
  return out;
}

/** Merge order: defaults < .env.example < .env (never the reverse). */
export function mergeEnv(defaults, exampleText, envText) {
  return {
    ...defaults,
    ...(exampleText == null ? {} : parseEnvText(exampleText)),
    ...(envText == null ? {} : parseEnvText(envText)),
  };
}

/** True when a node version string satisfies a minimum major version. */
export function nodeSatisfies(version, minMajor) {
  const match = /^v?(\d+)/.exec(String(version).trim());
  return match !== null && Number(match[1]) >= minMajor;
}

/**
 * Classify a required port: free, ours (open but this project's stack is up,
 * so `compose up` safely reuses it), or a genuine conflict.
 */
export function classifyPort({ open, stackRunning }) {
  if (!open) return 'free';
  return stackRunning ? 'ours' : 'conflict';
}

/** Compose `up` argv; the routing profile is enabled only with a graph. */
export function buildUpArgs({ composeFile, routingReady }) {
  const args = ['compose', '-f', composeFile, 'up', '-d'];
  if (routingReady) args.splice(3, 0, '--profile', 'routing');
  return args;
}

/** Graph readiness from a directory file listing (pure mirror of Test-RoutingGraph). */
export function routingReadiness(fileNames) {
  const present = new Set(fileNames);
  const missing = ROUTING_SENTINELS.filter((name) => !present.has(name));
  return { ready: missing.length === 0, missing };
}

/**
 * Validate the AI contract. Never fails the bootstrap: a missing key means
 * keyless demo mode, and a nonstandard token budget is the operator's choice
 * (warned, not overridden).
 */
export function validateAiConfig(env) {
  const problems = [];
  const model = env.META_MODEL_NAME ?? '';
  if (model !== 'muse-spark-1.3') {
    problems.push({
      level: 'warn',
      message: `META_MODEL_NAME is '${model}' (expected 'muse-spark-1.3').`,
    });
  }
  const tokens = env.AI_CIRCLE_MAX_TOKENS ?? '';
  if (tokens !== '2048') {
    problems.push({
      level: 'warn',
      message: `AI_CIRCLE_MAX_TOKENS is '${tokens || '(unset)'}' (intended '2048'; values below 2048 risk truncated Muse Spark replies).`,
    });
  }
  const reasoning = env.AI_CIRCLE_REASONING_EFFORT ?? '';
  if (reasoning !== 'low') {
    problems.push({
      level: 'warn',
      message: `AI_CIRCLE_REASONING_EFFORT is '${reasoning || '(unset)'}' (intended 'low').`,
    });
  }
  const keyConfigured = (env.MODEL_API_KEY ?? '').trim() !== '';
  return { model, keyConfigured, problems };
}

/**
 * Verify the seeded demo state through the real API shape: at the 500 m
 * radius the documented discovery set is exactly Coleen.
 */
export function checkSeedNearby(body) {
  if (body === null || typeof body !== 'object' || !Array.isArray(body.friends)) {
    return { ok: false, reason: 'unexpected /friends/nearby response shape' };
  }
  const ids = body.friends.map((f) => f?.id);
  if (ids.length !== 1 || ids[0] !== 'coleen') {
    return { ok: false, reason: `expected [coleen] at 500 m, got [${ids.join(', ')}]` };
  }
  return { ok: true, reason: '' };
}

/** Core readiness verdict: routing is optional and never blocks success. */
export function coreReady({ db, api, web }) {
  return db === true && api === true && web === true;
}

// ---- Isolated judge-test mode (`--test`) -----------------------------------
// The test run gets its own Compose project, container names, image tags,
// named volume, and host ports. Nothing here may reference development names.

export const TEST_PROJECT = 'near-circle-judges-test';
export const TEST_COMPOSE_FILE = join(REPO_ROOT, 'docker-compose.judges-test.yml');
export const TEST_PORTS = { web: 5273, api: 3101, db: 5533 };
export const TEST_IMAGES = {
  api: 'near-circle-api:judges-test',
  web: 'near-circle-web:judges-test',
};
export const TEST_CONTAINERS = {
  db: 'near-circle-judges-test-db',
  api: 'near-circle-judges-test-api',
  web: 'near-circle-judges-test-web',
};
export const TEST_VOLUME = 'near-circle-judges-test-data';
export const TEST_BUILD_SOURCES = {
  api: ['apps/api/Dockerfile', 'apps/api/package.json', 'apps/api/package-lock.json'],
  web: ['apps/web/Dockerfile', 'apps/web/package.json', 'apps/web/package-lock.json'],
};

/** CLI parsing for the judges entry point. Unknown flags fail closed. */
export function parseJudgesArgs(argv) {
  const args = [...argv];
  let mode = 'run';
  let volumes = false;
  for (const arg of args) {
    if (arg === '--test') {
      if (mode !== 'run') return { mode, volumes, error: 'conflicting mode flags' };
      mode = 'test';
    } else if (arg === '--stop-test') {
      if (mode !== 'run') return { mode, volumes, error: 'conflicting mode flags' };
      mode = 'stop-test';
    } else if (arg === '--volumes') {
      volumes = true;
    } else {
      return { mode, volumes, error: `unknown flag '${arg}' (supported: --test, --stop-test, --volumes)` };
    }
  }
  if (volumes && mode !== 'stop-test') {
    return { mode, volumes, error: '--volumes is only meaningful with --stop-test' };
  }
  return { mode, volumes };
}

/** `-p` + `-f` prefix shared by every test-mode compose invocation. */
export function testComposePrefix() {
  return ['-p', TEST_PROJECT, '-f', COMPOSE_FILE, '-f', TEST_COMPOSE_FILE];
}

export function buildTestUpArgs() {
  return ['docker', 'compose', ...testComposePrefix(), 'up', '-d'];
}

export function buildTestBuildArgs(services) {
  return ['docker', 'compose', ...testComposePrefix(), 'build', ...services];
}

export function buildTestDownArgs({ volumes }) {
  const args = ['docker', 'compose', ...testComposePrefix(), 'down'];
  if (volumes) args.push('--volumes');
  return args;
}

/**
 * Seed-target guard: the seeding connection must point at the isolated test
 * database port, which itself must differ from the development port.
 */
export function seedTargetGuard({ seedPort, devPort, testPort }) {
  if (!Number.isInteger(seedPort)) return { ok: false, reason: 'seed target port is not an integer' };
  if (seedPort !== testPort) {
    return { ok: false, reason: `seed target port ${seedPort} is not the isolated test port ${testPort}; refusing to seed` };
  }
  if (testPort === devPort) {
    return { ok: false, reason: 'test port equals the development port; isolation impossible' };
  }
  return { ok: true, reason: '' };
}

/** Build the seeding connection string for the isolated database. */
export function testSeedDatabaseUrl(env, testPort) {
  const user = env.POSTGRES_USER ?? 'near_circle';
  const password = env.POSTGRES_PASSWORD ?? 'near_circle_dev_password';
  const db = env.POSTGRES_DB ?? 'near_circle';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost:${testPort}/${db}`;
}

/** Reuse a test image only when it exists and is newer than its sources. */
export function planImage({ exists, createdMs, sourceMtimesMs }) {
  if (!exists) return { action: 'build', reason: 'test image tag absent' };
  if (!Number.isFinite(createdMs)) return { action: 'build', reason: 'test image has no parseable creation time' };
  const newestSource = Math.max(...sourceMtimesMs);
  if (Number.isFinite(newestSource) && newestSource > createdMs) {
    return { action: 'build', reason: 'a build source is newer than the test image' };
  }
  return { action: 'reuse', reason: 'test image present and up to date' };
}

/** Parse `docker ps --format {{.Names}}` output into container names. */
export function parseContainerNames(text) {
  return String(text).split('\n').map((l) => l.trim()).filter(Boolean);
}

/** Parse `docker compose ps --format json` (array or line-delimited). */
export function parseComposePs(text) {
  const trimmed = String(text).trim();
  if (trimmed === '') return [];
  return trimmed.startsWith('[') ? JSON.parse(trimmed) : trimmed.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

/**
 * Name-collision check: a wanted test container name already taken on the
 * host must be resolved (ours from a prior run) or fail the bootstrap.
 */
export function findNameCollisions(runningNames, wantedNames) {
  const running = new Set(runningNames);
  return wantedNames.filter((name) => running.has(name));
}

/**
 * Verify rendered `compose config` output actually isolates the test stack:
 * test names present, development container/volume names absent.
 */
export function renderedConfigGuards(configText) {
  const problems = [];
  const text = String(configText);
  for (const name of Object.values(TEST_CONTAINERS)) {
    if (!text.includes(name)) problems.push(`rendered config lacks test container ${name}`);
  }
  if (!text.includes(TEST_VOLUME)) problems.push('rendered config lacks the isolated test volume');
  for (const tag of Object.values(TEST_IMAGES)) {
    if (!text.includes(tag)) problems.push(`rendered config lacks test image tag ${tag}`);
  }
  const forbidden = [
    'container_name: near-circle-db',
    'container_name: near-circle-api',
    'container_name: near-circle-web',
    'near-circle-db-data:/',
  ];
  for (const marker of forbidden) {
    if (text.includes(marker)) problems.push(`rendered config leaks development resource '${marker}'`);
  }
  return { ok: problems.length === 0, problems };
}

/** Extract a port number from a PostgreSQL connection string. */
export function databaseUrlPort(url) {
  const match = /:(\d+)(?:\/|$)/.exec(String(url).split('@').pop() ?? '');
  return match ? Number(match[1]) : NaN;
}

/**
 * Split a complete argv (executable first) into spawn parts. Centralizes the
 * one correct way to invoke Docker: `docker compose ...` — never `docker`
 * with compose flags, which the CLI rejects with a usage error.
 */
export function dockerInvocation(argv) {
  const [cmd, ...args] = [...argv];
  return { cmd, args };
}

/** Development evidence snapshot (injectable runner for tests). */
export function snapshotDevEvidence(runner = run) {
  return {
    dev: collectDevContainerIds(runner),
    images: collectImageIds(runner, TEST_EVIDENCE_IMAGES),
  };
}

/** Compare a snapshot against the current state (injectable runner). */
export function compareDevEvidence(before, runner = run) {
  const devAfter = collectDevContainerIds(runner);
  const imagesAfter = collectImageIds(runner, TEST_EVIDENCE_IMAGES);
  const devUnchanged = before.dev.ok && devAfter.ok &&
    JSON.stringify(before.dev.ids) === JSON.stringify(devAfter.ids);
  const imagesUnchanged = TEST_EVIDENCE_IMAGES.every(
    (t) => (before.images[t] ?? null) === (imagesAfter[t] ?? null),
  );
  return { devUnchanged, imagesUnchanged };
}

/**
 * Mandatory credential gate: live AI recommendations require the operator's
 * own authorized key. Returns actionable setup guidance when absent. Only
 * presence is checked here — never the value, which is never printed.
 */
export function requireApiKey(env) {
  const configured = (env.MODEL_API_KEY ?? '').trim() !== '';
  return {
    ok: configured,
    guidance: configured
      ? []
      : [
          'Live AI recommendations require your own authorized Meta Model API key.',
          'The repository never ships a credential: obtain one through authorized',
          'Meta Model API access, then add this line to your local .env file:',
          '  MODEL_API_KEY=<YOUR_OWN_META_API_KEY>',
          'Never commit your .env file. Then safely re-run: npm run start:judges',
        ],
  };
}

// ---- Impure helpers (thin wrappers; stages below own the policy) -----------

export function run(cmd, args, { cwd = REPO_ROOT, timeoutMs = 120000 } = {}) {
  const res = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: timeoutMs });
  return {
    code: res.status ?? 1,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    error: res.error ? String(res.error) : '',
  };
}

export function tcpOpen(host, port, timeoutMs = 1500) {
  return new Promise((resolveTcp) => {
    const socket = new Socket();
    let done = false;
    const finish = (open) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolveTcp(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

export function httpGetJson(url, timeoutMs = 5000) {
  return new Promise((resolveHttp) => {
    const client = url.startsWith('https') ? getHttps : get;
    const req = client(url, { timeout: timeoutMs }, (res) => {
      const ok = (res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 400;
      if (!ok) {
        res.resume();
        resolveHttp({ ok: false, body: null });
        return;
      }
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        try {
          resolveHttp({ ok: true, body: JSON.parse(raw) });
        } catch {
          resolveHttp({ ok: true, body: raw });
        }
      });
    });
    req.once('timeout', () => req.destroy(new Error('timeout')));
    req.once('error', () => resolveHttp({ ok: false, body: null }));
  });
}

export async function waitFor(check, { timeoutMs, intervalMs = 2000, label = '' } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, Math.min(intervalMs, Math.max(0, deadline - Date.now()))));
    void label;
  }
}

export function log(line = '') {
  process.stdout.write(`${line}\n`);
}

export function step(ok, label, detail = '') {
  const tag = ok ? '[OK]' : '[FAIL]';
  log(`${tag} ${label}${detail === '' ? '' : ` — ${detail}`}`);
}

export function warn(label, detail = '') {
  log(`[WARN] ${label}${detail === '' ? '' : ` — ${detail}`}`);
}

export function openBrowser(url) {
  try {
    const opener =
      process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] :
      process.platform === 'darwin' ? ['open', [url]] :
      ['xdg-open', [url]];
    const res = spawnSync(opener[0], opener[1], { stdio: 'ignore', timeout: 10000 });
    return (res.status ?? 1) === 0;
  } catch {
    return false;
  }
}

function shellDocker(argv, opts = {}) {
  const { cmd, args } = dockerInvocation(argv);
  return shellRun(cmd, args, opts);
}

function shellRun(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    timeout: opts.timeoutMs ?? 300000,
    stdio: opts.inherit ? 'inherit' : 'pipe',
    shell: process.platform === 'win32',
    env: opts.env ?? process.env,
  });
  return {
    code: res.status ?? 1,
    stdout: typeof res.stdout === 'string' ? res.stdout : '',
    stderr: typeof res.stderr === 'string' ? res.stderr : '',
  };
}

function composePsRunning() {
  const res = run('docker', ['compose', '-f', COMPOSE_FILE, 'ps', '--format', 'json'], { timeoutMs: 30000 });
  if (res.code !== 0) return false;
  try {
    return parseComposePs(res.stdout).some((c) => (c.State ?? c.state ?? '').toLowerCase() === 'running');
  } catch {
    return false;
  }
}

/**
 * Snapshot development container IDs (default runner is the real one; tests
 * inject a mock). Used as before/after evidence that test mode left them
 * untouched.
 */
export function collectDevContainerIds(runner = run) {
  const res = runner('docker', ['compose', '-f', COMPOSE_FILE, 'ps', '-q'], { timeoutMs: 30000 });
  if (res.code !== 0) return { ok: false, ids: [] };
  return { ok: true, ids: parseContainerNames(res.stdout).sort() };
}

/** Snapshot image IDs for the given tags (absent tags record as null). */
export function collectImageIds(runner, tags) {
  const ids = {};
  for (const tag of tags) {
    const res = runner('docker', ['image', 'inspect', '--format', '{{.Id}}', tag], { timeoutMs: 30000 });
    ids[tag] = res.code === 0 ? res.stdout.trim() : null;
  }
  return ids;
}

/** Creation timestamp (ms) of an image tag, or NaN when unavailable. */
export function imageCreatedMs(runner, tag) {
  const res = runner('docker', ['image', 'inspect', '--format', '{{.Created}}', tag], { timeoutMs: 30000 });
  if (res.code !== 0) return NaN;
  return Date.parse(res.stdout.trim());
}

/** mtime (ms) of repo-relative source files; missing files count as epoch 0. */
export function sourceMtimesMs(files) {
  return files.map((f) => {
    try {
      return statSync(join(REPO_ROOT, f)).mtimeMs;
    } catch {
      return 0;
    }
  });
}

function banner() {
  log('================================================');
  log(' Near-Circle-Friend');
  log(' Meta Global AI Hackathon 2026');
  log(' Judge Installation & Startup');
  log('================================================');
  log('');
}

function dockerGuidance(rerunCmd = 'npm run start:judges') {
  log('');
  log('Docker is required for the Compose stack (PostgreSQL, API, frontend).');
  log('  1. Install Docker Desktop: https://www.docker.com/products/docker-desktop/');
  log('  2. Start Docker Desktop and wait until it reports "running".');
  log(`  3. Re-run: ${rerunCmd}`);
  log('');
  log('Native-development fallback (needs a reachable PostgreSQL instead):');
  log('  npm run dev:api    # Fastify API (uses DATABASE_URL or POSTGRES_* defaults)');
  log('  npm run dev:web    # Vite frontend');
}

function testBanner() {
  log('================================================');
  log(' Near-Circle-Friend — Isolated Judge Test');
  log(' (development Docker resources will not be touched)');
  log('================================================');
  log('');
}

// Shared preflight: identical for normal and test modes.
async function preflightBasics(rerunCmd) {
  if (!nodeSatisfies(process.versions.node, 20)) {
    step(false, 'Node.js and npm detected', `node ${process.versions.node} does not satisfy engines >=20`);
    log(`Install Node.js 20+ from https://nodejs.org/, then re-run: ${rerunCmd}`);
    process.exitCode = 1;
    return false;
  }
  const npmVer = shellRun('npm', ['--version'], { timeoutMs: 30000 });
  if (npmVer.code !== 0) {
    step(false, 'Node.js and npm detected', 'npm is not on PATH');
    process.exitCode = 1;
    return false;
  }
  step(true, 'Node.js and npm detected', `node ${process.versions.node}, npm ${npmVer.stdout.trim()}`);

  const dockerInfo = run('docker', ['info'], { timeoutMs: 30000 });
  if (dockerInfo.code !== 0) {
    step(false, 'Docker Engine running', 'docker CLI missing or engine unreachable');
    dockerGuidance(rerunCmd);
    process.exitCode = 1;
    return false;
  }
  step(true, 'Docker Engine running');
  const composeVer = run('docker', ['compose', 'version', '--short'], { timeoutMs: 30000 });
  if (composeVer.code !== 0) {
    step(false, 'Docker Compose available', '"docker compose" v2 is unavailable; update Docker Desktop');
    process.exitCode = 1;
    return false;
  }
  step(true, 'Docker Compose available', composeVer.stdout.trim());
  return true;
}

// Shared environment stage: .env generated once, never overwritten.
function loadEnv() {
  let envCreated = false;
  if (!existsSync(ENV_FILE)) {
    copyFileSync(ENV_EXAMPLE, ENV_FILE);
    envCreated = true;
  }
  const env = mergeEnv(
    DEFAULT_ENV,
    readFileSync(ENV_EXAMPLE, 'utf8'),
    existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : null,
  );
  step(true, 'Environment configuration validated', envCreated ? '.env created from .env.example' : 'existing .env preserved');
  const ai = validateAiConfig(env);
  for (const problem of ai.problems) warn('AI configuration', problem.message);
  return { env, envCreated, ai };
}

// Shared deterministic install (skipped when already installed).
function ensureDeps() {
  const installed = existsSync(join(REPO_ROOT, 'node_modules', '.package-lock.json')) &&
    existsSync(join(REPO_ROOT, 'node_modules', 'tsx')) &&
    existsSync(join(REPO_ROOT, 'node_modules', 'pg'));
  if (!installed) {
    log('Installing dependencies (npm ci; first run only)...');
    const ci = shellRun('npm', ['ci', '--no-audit', '--no-fund'], { inherit: true, timeoutMs: 600000 });
    if (ci.code !== 0) {
      step(false, 'Application dependencies installed', 'npm ci failed; see output above');
      process.exitCode = 1;
      return false;
    }
  }
  step(true, 'Application dependencies installed', installed ? 'reused existing node_modules' : 'npm ci complete');
  return true;
}

// Shared mandatory credential gate (fail fast, before any heavy work).
function gateApiKey(env) {
  const credential = requireApiKey(env);
  if (!credential.ok) {
    step(false, 'Live AI credentials configured', 'MODEL_API_KEY is missing');
    for (const line of credential.guidance) log(`  ${line}`);
    log('No services were started or modified; no live-AI readiness is claimed.');
    process.exitCode = 1;
    return false;
  }
  step(true, 'Live AI credentials configured', 'key present (presence only; see summary)');
  return true;
}

async function main() {
  banner();

  // ---- 1+2. Shared preflight ----
  if (!(await preflightBasics('npm run start:judges'))) return;

  // ---- 3. Tracked files ----
  const missingFiles = REQUIRED_TRACKED_FILES.filter((f) => !existsSync(join(REPO_ROOT, f)));
  if (missingFiles.length > 0) {
    step(false, 'Repository files present', `missing: ${missingFiles.join(', ')}`);
    log('Re-clone the repository, then re-run: npm run start:judges');
    process.exitCode = 1;
    return;
  }
  step(true, 'Repository files present');

  // ---- 4+4b. Shared environment + credential gate ----
  const { env, ai } = loadEnv();
  if (!gateApiKey(env)) return;

  // ---- 5. Ports ----
  const ports = [
    ['Web', Number(env.WEB_PORT) || 5173],
    ['API', Number(env.API_PORT) || 3001],
    ['PostgreSQL', Number(env.POSTGRES_PORT) || 5433],
  ];
  const stackRunning = composePsRunning();
  for (const [label, port] of ports) {
    const open = await tcpOpen('localhost', port);
    const verdict = classifyPort({ open, stackRunning });
    if (verdict === 'conflict') {
      step(false, `${label} port ${port} available`, 'occupied by an unrelated process');
      log(`Stop that process or set ${label === 'Web' ? 'WEB_PORT' : label === 'API' ? 'API_PORT' : 'POSTGRES_PORT'} in .env, then re-run.`);
      process.exitCode = 1;
      return;
    }
  }
  step(true, 'Required ports available');

  // ---- 6. Shared deterministic install ----
  if (!ensureDeps()) return;

  // ---- 7. Docker images (existing Dockerfiles; pulls bases as needed) ----
  log('Preparing Docker images (docker compose build)...');
  const build = shellRun('docker', ['compose', '-f', COMPOSE_FILE, 'build'], { inherit: true, timeoutMs: 600000 });
  if (build.code !== 0) {
    step(false, 'Docker images ready', 'compose build failed; see output above');
    process.exitCode = 1;
    return;
  }
  step(true, 'Docker images ready');

  // ---- 8. Optional routing graph (never blocks the core app) ----
  let graphFiles = [];
  try {
    const { readdirSync } = await import('node:fs');
    graphFiles = readdirSync(join(REPO_ROOT, 'routing', 'data'));
  } catch {
    graphFiles = [];
  }
  const graph = routingReadiness(graphFiles);
  if (!graph.ready) {
    warn('Pedestrian routing graph', 'absent; routing reports not-ready (see routing/README.md)');
  }

  // ---- 9. Start services (existing Compose architecture; no volume flags) ----
  log('Starting services (docker compose up -d)...');
  const upArgv = ['docker', ...buildUpArgs({ composeFile: COMPOSE_FILE, routingReady: graph.ready })];
  const up = shellDocker(upArgv, { inherit: true, timeoutMs: 300000 });
  if (up.code !== 0) {
    step(false, 'Services started', 'compose up failed; see output above');
    log(`  command: ${upArgv.join(' ')} (exit ${up.code})`);
    process.exitCode = 1;
    return;
  }

  // ---- 10. Database readiness (poll pg_isready, no fixed delays) ----
  const pgUser = env.POSTGRES_USER ?? 'near_circle';
  const pgDb = env.POSTGRES_DB ?? 'near_circle';
  const dbReady = await waitFor(async () => {
    const probe = run('docker', [
      'compose', '-f', COMPOSE_FILE, 'exec', '-T', 'near-circle-db',
      'pg_isready', '-U', pgUser, '-d', pgDb,
    ], { timeoutMs: 15000 });
    return probe.code === 0;
  }, { timeoutMs: READINESS_TIMEOUTS_MS.db });
  if (!dbReady) {
    step(false, 'PostgreSQL/PostGIS healthy', 'pg_isready never succeeded (90s)');
    process.exitCode = 1;
    return;
  }
  step(true, 'PostgreSQL/PostGIS healthy');

  // ---- 11. Idempotent demo seeding ----
  log('Seeding demo data (idempotent; safe to re-run)...');
  const seed = shellRun('npm', ['run', 'db:seed'], { inherit: true, timeoutMs: 300000 });
  if (seed.code !== 0) {
    step(false, 'Database initialized', 'npm run db:seed failed; see output above');
    process.exitCode = 1;
    return;
  }
  step(true, 'Database initialized');

  // ---- 12. API readiness + seed verification through the real endpoint ----
  const apiPort = Number(env.API_PORT) || 3001;
  const apiHealth = `http://localhost:${apiPort}/health`;
  const apiReady = await waitFor(async () => (await httpGetJson(apiHealth, 3000)).ok, {
    timeoutMs: READINESS_TIMEOUTS_MS.api,
  });
  if (!apiReady) {
    step(false, 'Near-Circle API healthy', `no response at ${apiHealth} (90s)`);
    process.exitCode = 1;
    return;
  }
  step(true, 'Near-Circle API healthy', apiHealth);
  const seedProbe = await httpGetJson(`http://localhost:${apiPort}/friends/nearby?radius_m=500`, 8000);
  const seedCheck = seedProbe.ok ? checkSeedNearby(seedProbe.body) : { ok: false, reason: 'seed probe unreachable' };
  if (!seedCheck.ok) {
    step(false, 'Demo users seeded', seedCheck.reason);
    process.exitCode = 1;
    return;
  }
  step(true, 'Demo users seeded', 'Coleen discoverable at 500 m');

  // ---- 13. Frontend readiness ----
  const webPort = Number(env.WEB_PORT) || 5173;
  const webUrl = `http://localhost:${webPort}/`;
  const webReady = await waitFor(async () => (await httpGetJson(webUrl, 3000)).ok, {
    timeoutMs: READINESS_TIMEOUTS_MS.web,
  });
  if (!webReady) {
    step(false, 'Near-Circle frontend ready', `no response at ${webUrl} (120s)`);
    process.exitCode = 1;
    return;
  }
  step(true, 'Near-Circle frontend ready', webUrl);

  // ---- 14. Summary (actual detected values only) ----
  log('');
  log('================================================');
  log(' Near-Circle-Friend is ready!');
  log('================================================');
  log(`AI Provider: Meta Muse Spark 1.3 (${ai.model || 'muse-spark-1.3'})`);
  log('AI Status: Configured (key present; authentication is proven only by a');
  log('  real inference call, e.g. Ask Meta AI in the app — never by this check)');
  log(`Routing: ${graph.ready ? 'Available (pedestrian graph detected)' : 'Not configured (no graph; see routing/README.md)'}`);
  log('');
  log(`Application: ${webUrl}`);
  log(`API Health: ${apiHealth}`);
  log('');
  log('Demo: Open Radar → Select 500 m → Reconnect Today');
  log('Stop: npm run stopall');
  log('================================================');
  openBrowser(webUrl);
}

// Development image tags watched as before/after evidence (test tags excluded:
// building them during the run is the expected, isolated change).
export const TEST_EVIDENCE_IMAGES = [
  'postgis/postgis:16-3.4',
  'ghcr.io/project-osrm/osrm-backend:v5.27.1',
  'near-circle-near-circle-api:latest',
  'near-circle-near-circle-web:latest',
];

function testExecArgs(...rest) {
  return ['compose', ...testComposePrefix(), ...rest];
}

async function mainTest() {
  testBanner();
  if (!(await preflightBasics('npm run start:judges -- --test'))) return;

  const missingFiles = [...REQUIRED_TRACKED_FILES, 'docker-compose.judges-test.yml'].filter(
    (f) => !existsSync(join(REPO_ROOT, f)),
  );
  if (missingFiles.length > 0) {
    step(false, 'Repository files present', `missing: ${missingFiles.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  step(true, 'Repository files present');

  const { env, ai } = loadEnv();
  if (!gateApiKey(env)) return;

  const devPorts = {
    web: Number(env.WEB_PORT) || 5173,
    api: Number(env.API_PORT) || 3001,
    db: Number(env.POSTGRES_PORT) || 5433,
  };
  for (const key of ['web', 'api', 'db']) {
    if (TEST_PORTS[key] === devPorts[key]) {
      step(false, 'Docker environment isolated', `test ${key} port ${TEST_PORTS[key]} equals the development port; refusing to proceed`);
      process.exitCode = 1;
      return;
    }
  }

  // Evidence snapshots BEFORE touching Docker resources.
  const evidenceBefore = snapshotDevEvidence();
  step(true, 'Docker environment isolated', `project ${TEST_PROJECT}; development state snapshotted`);

  // Container-name collisions: only ours (prior test run) may be reused.
  const namesRes = run('docker', ['ps', '-a', '--format', '{{.Names}}'], { timeoutMs: 30000 });
  if (namesRes.code !== 0) {
    step(false, 'Docker environment isolated', 'could not list containers; refusing to proceed');
    process.exitCode = 1;
    return;
  }
  const collisions = findNameCollisions(parseContainerNames(namesRes.stdout), Object.values(TEST_CONTAINERS));
  for (const name of collisions) {
    const insp = run('docker', ['inspect', '--format', '{{index .Config.Labels "com.docker.compose.project"}}', name], { timeoutMs: 30000 });
    if (insp.code !== 0 || insp.stdout.trim() !== TEST_PROJECT) {
      step(false, 'Docker environment isolated', `container name '${name}' belongs to another project; refusing to proceed`);
      process.exitCode = 1;
      return;
    }
  }
  if (collisions.length > 0) log(`Reusing ${collisions.length} container(s) from a previous isolated run.`);

  // Test ports must be free (never steal them).
  for (const [label, port] of [['Web', TEST_PORTS.web], ['API', TEST_PORTS.api], ['PostgreSQL', TEST_PORTS.db]]) {
    if (await tcpOpen('localhost', port)) {
      step(false, `${label} test port ${port} available`, 'occupied; stop that process and re-run');
      process.exitCode = 1;
      return;
    }
  }
  step(true, 'Required test ports available', '5273/3101/5533 free and distinct from development');

  // Rendered-config guard: prove the overlay isolates before creating anything.
  const cfg = run('docker', testExecArgs('config'), { timeoutMs: 60000 });
  if (cfg.code !== 0) {
    step(false, 'Docker environment isolated', 'compose config failed; see output above');
    log(cfg.stderr);
    process.exitCode = 1;
    return;
  }
  const guards = renderedConfigGuards(cfg.stdout);
  if (!guards.ok) {
    step(false, 'Docker environment isolated', 'rendered test config is not isolated');
    for (const problem of guards.problems) log(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }
  step(true, 'Existing development containers untouched', 'rendered config verified; nothing created yet');

  if (!ensureDeps()) return;

  // Images: reuse compatible test tags, build only what is missing or stale.
  // Development tags are never built, retagged, or removed here.
  const toBuild = [];
  for (const svc of ['api', 'web']) {
    const tag = TEST_IMAGES[svc];
    const probe = run('docker', ['image', 'inspect', '--format', '{{.Id}}', tag], { timeoutMs: 30000 });
    const plan = planImage({
      exists: probe.code === 0,
      createdMs: probe.code === 0 ? imageCreatedMs(run, tag) : NaN,
      sourceMtimesMs: sourceMtimesMs(TEST_BUILD_SOURCES[svc]),
    });
    log(`${plan.action === 'reuse' ? '[OK]' : '[..]'} Test image ${tag} — ${plan.reason}`);
    if (plan.action === 'build') toBuild.push(svc);
  }
  if (toBuild.length > 0) {
    log(`Building isolated test images for: ${toBuild.join(', ')}...`);
    const buildArgv = ['docker', ...testExecArgs('build', ...toBuild)];
    const build = shellDocker(buildArgv, { inherit: true, timeoutMs: 600000 });
    if (build.code !== 0) {
      const after = compareDevEvidence(evidenceBefore);
      step(false, 'Existing Docker images preserved', 'isolated test build failed');
      log(`  command: ${buildArgv.join(' ')} (exit ${build.code})`);
      log(`  development containers unchanged: ${after.devUnchanged}; development images unchanged: ${after.imagesUnchanged}`);
      process.exitCode = 1;
      return;
    }
  }
  step(true, 'Existing Docker images preserved', 'only test-specific tags built; nothing removed or retagged');

  // Start the isolated stack (routing profile is never enabled in test mode).
  log('Starting isolated services (test project only)...');
  const testUpArgv = ['docker', ...testExecArgs('up', '-d')];
  const up = shellDocker(testUpArgv, { inherit: true, timeoutMs: 300000 });
  if (up.code !== 0) {
    const after = compareDevEvidence(evidenceBefore);
    step(false, 'Isolated services started', 'compose up failed; see output above');
    log(`  command: ${testUpArgv.join(' ')} (exit ${up.code})`);
    log(`  development containers unchanged: ${after.devUnchanged}; development images unchanged: ${after.imagesUnchanged}`);
    process.exitCode = 1;
    return;
  }

  // Database readiness inside the isolated network.
  const pgUser = env.POSTGRES_USER ?? 'near_circle';
  const pgDb = env.POSTGRES_DB ?? 'near_circle';
  const dbReady = await waitFor(async () => {
    const probe = run('docker', testExecArgs('exec', '-T', 'near-circle-db', 'pg_isready', '-U', pgUser, '-d', pgDb), { timeoutMs: 15000 });
    return probe.code === 0;
  }, { timeoutMs: READINESS_TIMEOUTS_MS.db });
  if (!dbReady) {
    step(false, 'Database created in isolated volume', 'pg_isready never succeeded (90s)');
    process.exitCode = 1;
    return;
  }
  step(true, 'Database created in isolated volume', `named volume ${TEST_VOLUME}`);

  // Seeding with a verified isolated target (never the development database).
  const seedUrl = testSeedDatabaseUrl(env, TEST_PORTS.db);
  const guard = seedTargetGuard({ seedPort: databaseUrlPort(seedUrl), devPort: devPorts.db, testPort: TEST_PORTS.db });
  if (!guard.ok) {
    step(false, 'Demo users seeded', guard.reason);
    process.exitCode = 1;
    return;
  }
  log('Seeding isolated demo data (idempotent; safe to re-run)...');
  const seed = shellRun('npm', ['run', 'db:seed'], {
    inherit: true,
    timeoutMs: 300000,
    env: { ...process.env, DATABASE_URL: seedUrl },
  });
  if (seed.code !== 0) {
    step(false, 'Demo users seeded', 'npm run db:seed failed; see output above');
    process.exitCode = 1;
    return;
  }
  step(true, 'Demo users seeded', `isolated database on port ${TEST_PORTS.db}`);

  // API readiness + Coleen probe through the isolated API.
  const apiHealth = `http://localhost:${TEST_PORTS.api}/health`;
  const apiReady = await waitFor(async () => (await httpGetJson(apiHealth, 3000)).ok, {
    timeoutMs: READINESS_TIMEOUTS_MS.api,
  });
  if (!apiReady) {
    step(false, 'API healthy', `no response at ${apiHealth} (90s)`);
    process.exitCode = 1;
    return;
  }
  step(true, 'API healthy', apiHealth);
  const seedProbe = await httpGetJson(`http://localhost:${TEST_PORTS.api}/friends/nearby?radius_m=500`, 8000);
  const seedCheck = seedProbe.ok ? checkSeedNearby(seedProbe.body) : { ok: false, reason: 'seed probe unreachable' };
  if (!seedCheck.ok) {
    step(false, 'Coleen discoverable at 500 m', seedCheck.reason);
    process.exitCode = 1;
    return;
  }
  step(true, 'Coleen discoverable at 500 m');

  // Frontend readiness.
  const webUrl = `http://localhost:${TEST_PORTS.web}/`;
  const webReady = await waitFor(async () => (await httpGetJson(webUrl, 3000)).ok, {
    timeoutMs: READINESS_TIMEOUTS_MS.web,
  });
  if (!webReady) {
    step(false, 'Frontend ready', `no response at ${webUrl} (120s)`);
    process.exitCode = 1;
    return;
  }
  step(true, 'Frontend ready', webUrl);

  // Before/after evidence: development must be byte-identical.
  const { devUnchanged, imagesUnchanged } = compareDevEvidence(evidenceBefore);
  step(devUnchanged, 'Existing development containers untouched', devUnchanged ? 'container IDs identical' : 'container set changed!');
  step(imagesUnchanged, 'Existing Docker images preserved', imagesUnchanged ? 'watched image IDs identical' : 'a watched image changed!');
  if (!coreReady({ db: dbReady, api: apiReady, web: webReady }) || !devUnchanged || !imagesUnchanged) {
    process.exitCode = 1;
    return;
  }
  step(true, 'Judge bootstrap verified');

  log('');
  log('================================================');
  log(' Near-Circle-Friend — Isolated Judge Test ready!');
  log('================================================');
  log(`AI Provider: Meta Muse Spark 1.3 (${ai.model || 'muse-spark-1.3'})`);
  log('AI Status: Configured (key present; authentication is proven only by a');
  log('  real inference call, e.g. Ask Meta AI in the app — never by this check)');
  log('Routing: Not enabled in test mode (core app only)');
  log('');
  log(`Test application: ${webUrl}`);
  log(`Test API health: ${apiHealth}`);
  log('');
  log('Demo: Open Radar → Select 500 m → Reconnect Today');
  log('Stop only this test environment: npm run stop:judges-test');
  log('================================================');
  log('');
  log('Test environment ready.');
  openBrowser(webUrl);
}

async function mainStopTest({ volumes }) {
  const dockerInfo = run('docker', ['info'], { timeoutMs: 30000 });
  if (dockerInfo.code !== 0) {
    log('Docker is not available, so no isolated test containers can be running. Nothing to stop.');
    process.exitCode = 0;
    return;
  }
  log('Stopping the isolated judge test environment...');
  log(`(development project is never addressed; volumes ${volumes ? 'explicitly removed' : 'preserved'})`);
  const downArgv = buildTestDownArgs({ volumes });
  const down = shellDocker(downArgv, { inherit: true, timeoutMs: 120000 });
  if (down.code !== 0) {
    const empty = /no such|not found|no containers/i.test(`${down.stdout}\n${down.stderr}`);
    if (empty) {
      log('No isolated test containers exist; nothing to stop.');
      process.exitCode = 0;
      return;
    }
    step(false, 'Isolated test environment stopped', 'compose down failed; see output above');
    log(`  command: ${downArgv.join(' ')} (exit ${down.code})`);
    process.exitCode = 1;
    return;
  }
  step(true, 'Isolated test environment stopped', volumes ? 'test volumes removed on request' : 'test volumes preserved');
}

const invokedAsScript = (() => {
  try {
    return resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (invokedAsScript) {
  const cli = parseJudgesArgs(process.argv.slice(2));
  const onError = (err) => {
    log(`[FAIL] Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  };
  if (cli.error) {
    log(`[FAIL] ${cli.error}`);
    log('Usage: node ./scripts/judges.mjs [--test] [--stop-test [--volumes]]');
    log('  (no flags)            normal judge bootstrap (development project)');
    log('  --test                isolated run (project near-circle-judges-test)');
    log('  --stop-test           stop only the isolated run (volumes preserved)');
    log('  --stop-test --volumes also remove the isolated test volumes');
    process.exitCode = 1;
  } else if (cli.mode === 'test') {
    mainTest().catch(onError);
  } else if (cli.mode === 'stop-test') {
    mainStopTest(cli).catch(onError);
  } else {
    main().catch(onError);
  }
}
