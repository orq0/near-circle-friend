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

function shellRun(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    timeout: opts.timeoutMs ?? 300000,
    stdio: opts.inherit ? 'inherit' : 'pipe',
    shell: process.platform === 'win32',
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
    const text = res.stdout.trim();
    const list = text.startsWith('[') ? JSON.parse(text) : text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
    return list.some((c) => (c.State ?? c.state ?? '').toLowerCase() === 'running');
  } catch {
    return false;
  }
}

function banner() {
  log('================================================');
  log(' Near-Circle-Friend');
  log(' Meta Global AI Hackathon 2026');
  log(' Judge Installation & Startup');
  log('================================================');
  log('');
}

function dockerGuidance() {
  log('');
  log('Docker is required for the Compose stack (PostgreSQL, API, frontend).');
  log('  1. Install Docker Desktop: https://www.docker.com/products/docker-desktop/');
  log('  2. Start Docker Desktop and wait until it reports "running".');
  log('  3. Re-run: npm run start:judges');
  log('');
  log('Native-development fallback (needs a reachable PostgreSQL instead):');
  log('  npm run dev:api    # Fastify API (uses DATABASE_URL or POSTGRES_* defaults)');
  log('  npm run dev:web    # Vite frontend');
}

async function main() {
  banner();

  // ---- 1. Preflight: Node.js and npm ----
  if (!nodeSatisfies(process.versions.node, 20)) {
    step(false, 'Node.js and npm detected', `node ${process.versions.node} does not satisfy engines >=20`);
    log('Install Node.js 20+ from https://nodejs.org/, then re-run: npm run start:judges');
    process.exitCode = 1;
    return;
  }
  const npmVer = shellRun('npm', ['--version'], { timeoutMs: 30000 });
  if (npmVer.code !== 0) {
    step(false, 'Node.js and npm detected', 'npm is not on PATH');
    process.exitCode = 1;
    return;
  }
  step(true, 'Node.js and npm detected', `node ${process.versions.node}, npm ${npmVer.stdout.trim()}`);

  // ---- 2. Preflight: Docker Engine + Compose v2 ----
  const dockerInfo = run('docker', ['info'], { timeoutMs: 30000 });
  if (dockerInfo.code !== 0) {
    step(false, 'Docker Engine running', 'docker CLI missing or engine unreachable');
    dockerGuidance();
    process.exitCode = 1;
    return;
  }
  step(true, 'Docker Engine running');
  const composeVer = run('docker', ['compose', 'version', '--short'], { timeoutMs: 30000 });
  if (composeVer.code !== 0) {
    step(false, 'Docker Compose available', '"docker compose" v2 is unavailable; update Docker Desktop');
    process.exitCode = 1;
    return;
  }
  step(true, 'Docker Compose available', composeVer.stdout.trim());

  // ---- 3. Tracked files ----
  const missingFiles = REQUIRED_TRACKED_FILES.filter((f) => !existsSync(join(REPO_ROOT, f)));
  if (missingFiles.length > 0) {
    step(false, 'Repository files present', `missing: ${missingFiles.join(', ')}`);
    log('Re-clone the repository, then re-run: npm run start:judges');
    process.exitCode = 1;
    return;
  }
  step(true, 'Repository files present');

  // ---- 4. Environment (.env generated once, never overwritten) ----
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

  // ---- 4b. Mandatory credential gate (fail fast, before any heavy work) ----
  const credential = requireApiKey(env);
  if (!credential.ok) {
    step(false, 'Live AI credentials configured', 'MODEL_API_KEY is missing');
    for (const line of credential.guidance) log(`  ${line}`);
    log('No services were started or modified; no live-AI readiness is claimed.');
    process.exitCode = 1;
    return;
  }
  step(true, 'Live AI credentials configured', 'key present (presence only; see summary)');

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

  // ---- 6. Dependencies (deterministic; skipped when already installed) ----
  const installed = existsSync(join(REPO_ROOT, 'node_modules', '.package-lock.json')) &&
    existsSync(join(REPO_ROOT, 'node_modules', 'tsx')) &&
    existsSync(join(REPO_ROOT, 'node_modules', 'pg'));
  if (!installed) {
    log('Installing dependencies (npm ci; first run only)...');
    const ci = shellRun('npm', ['ci', '--no-audit', '--no-fund'], { inherit: true, timeoutMs: 600000 });
    if (ci.code !== 0) {
      step(false, 'Application dependencies installed', 'npm ci failed; see output above');
      process.exitCode = 1;
      return;
    }
  }
  step(true, 'Application dependencies installed', installed ? 'reused existing node_modules' : 'npm ci complete');

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
  const up = shellRun('docker', buildUpArgs({ composeFile: COMPOSE_FILE, routingReady: graph.ready }).slice(1), {
    inherit: true,
    timeoutMs: 300000,
  });
  if (up.code !== 0) {
    step(false, 'Services started', 'compose up failed; see output above');
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

const invokedAsScript = (() => {
  try {
    return resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (invokedAsScript) {
  main().catch((err) => {
    log(`[FAIL] Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
