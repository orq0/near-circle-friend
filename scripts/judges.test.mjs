// Bootstrap-logic tests for scripts/judges.mjs. Runs dependency-free via
// `npm run test:judges` (node:test + node:assert, no vitest needed) so the
// judge entry point is verifiable on any host with Node.js 20+.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildTestBuildArgs,
  buildTestDownArgs,
  buildTestUpArgs,
  buildUpArgs,
  checkSeedNearby,
  classifyPort,
  collectDevContainerIds,
  collectImageIds,
  coreReady,
  databaseUrlPort,
  findNameCollisions,
  mergeEnv,
  nodeSatisfies,
  parseComposePs,
  parseContainerNames,
  parseEnvText,
  parseJudgesArgs,
  planImage,
  renderedConfigGuards,
  requireApiKey,
  routingReadiness,
  seedTargetGuard,
  testComposePrefix,
  testSeedDatabaseUrl,
  validateAiConfig,
  TEST_CONTAINERS,
  TEST_IMAGES,
  TEST_PORTS,
  TEST_PROJECT,
  TEST_VOLUME,
} from './judges.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JUDGES_SRC = readFileSync(join(REPO_ROOT, 'scripts', 'judges.mjs'), 'utf8');

describe('judge bootstrap logic', () => {
  it('parses dotenv text like the PowerShell env reader', () => {
    const parsed = parseEnvText('# comment\n\nWEB_PORT=8080\nQUOTED="a=b"\nSINGLE=\'x\'\nEMPTY=\nNOEQUALS\n');
    assert.equal(parsed.WEB_PORT, '8080');
    assert.equal(parsed.QUOTED, 'a=b');
    assert.equal(parsed.SINGLE, 'x');
    assert.equal(parsed.EMPTY, '');
    assert.ok(!('NOEQUALS' in parsed));
  });

  it('merges defaults < example < .env without reversing precedence', () => {
    const merged = mergeEnv(
      { A: 'default', B: 'default', C: 'default' },
      'A=example\nB=example',
      'B=env',
    );
    assert.equal(merged.A, 'example');
    assert.equal(merged.B, 'env');
    assert.equal(merged.C, 'default');
  });

  it('enforces the Node.js major version floor', () => {
    assert.equal(nodeSatisfies('v20.1.0', 20), true);
    assert.equal(nodeSatisfies('v26.2.0', 20), true);
    assert.equal(nodeSatisfies('v18.19.0', 20), false);
    assert.equal(nodeSatisfies('bogus', 20), false);
  });

  it('classifies ports: free, ours, or conflicting', () => {
    assert.equal(classifyPort({ open: false, stackRunning: false }), 'free');
    assert.equal(classifyPort({ open: false, stackRunning: true }), 'free');
    assert.equal(classifyPort({ open: true, stackRunning: true }), 'ours');
    assert.equal(classifyPort({ open: true, stackRunning: false }), 'conflict');
  });

  it('enables the routing profile only with a complete graph', () => {
    const ready = routingReadiness([
      'near-circle.osrm.partition',
      'near-circle.osrm.cells',
      'near-circle.osrm.mldgr',
      'near-circle.osrm.cell_metrics',
      'manila.pbf',
    ]);
    assert.equal(ready.ready, true);
    assert.deepEqual(ready.missing, []);
    const partial = routingReadiness(['near-circle.osrm.partition', 'manila.pbf']);
    assert.equal(partial.ready, false);
    assert.deepEqual(partial.missing, [
      'near-circle.osrm.cells',
      'near-circle.osrm.mldgr',
      'near-circle.osrm.cell_metrics',
    ]);
    const upReady = buildUpArgs({ composeFile: 'docker-compose.yml', routingReady: true });
    assert.ok(upReady.includes('--profile') && upReady.includes('routing'));
    assert.ok(!upReady.includes('-v') && !upReady.includes('--volumes'));
    const upPlain = buildUpArgs({ composeFile: 'docker-compose.yml', routingReady: false });
    assert.ok(!upPlain.includes('--profile'));
    assert.ok(!upPlain.includes('-v') && !upPlain.includes('--volumes'));
  });

  it('validates the AI contract without failing on a missing key', () => {
    const good = validateAiConfig({
      META_MODEL_NAME: 'muse-spark-1.3',
      AI_CIRCLE_MAX_TOKENS: '2048',
      AI_CIRCLE_REASONING_EFFORT: 'low',
      MODEL_API_KEY: 'sekret',
    });
    assert.equal(good.keyConfigured, true);
    assert.deepEqual(good.problems, []);
    const keyless = validateAiConfig({
      META_MODEL_NAME: 'muse-spark-1.3',
      AI_CIRCLE_MAX_TOKENS: '2048',
      AI_CIRCLE_REASONING_EFFORT: 'low',
      MODEL_API_KEY: '',
    });
    assert.equal(keyless.keyConfigured, false);
    assert.deepEqual(keyless.problems, []);
    const regressed = validateAiConfig({
      META_MODEL_NAME: 'other-model',
      AI_CIRCLE_MAX_TOKENS: '512',
      AI_CIRCLE_REASONING_EFFORT: '',
    });
    assert.equal(regressed.problems.length, 3);
  });

  it('accepts only the documented 500 m discovery set as seeded proof', () => {
    assert.deepEqual(checkSeedNearby({ friends: [{ id: 'coleen' }] }), { ok: true, reason: '' });
    assert.equal(checkSeedNearby({ friends: [] }).ok, false);
    assert.equal(checkSeedNearby({ friends: [{ id: 'coleen' }, { id: 'alex' }] }).ok, false);
    assert.equal(checkSeedNearby({ friends: [{ id: 'nicole' }] }).ok, false);
    assert.equal(checkSeedNearby(null).ok, false);
    assert.equal(checkSeedNearby({}).ok, false);
  });

  it('treats routing as optional in the core readiness verdict', () => {
    assert.equal(coreReady({ db: true, api: true, web: true }), true);
    assert.equal(coreReady({ db: true, api: true, web: false }), false);
    assert.equal(coreReady({ db: true, api: false, web: true }), false);
    assert.equal(coreReady({ db: false, api: true, web: true }), false);
  });

  it('fails the credential gate with actionable guidance when the key is absent', () => {
    const missing = requireApiKey({ MODEL_API_KEY: '' });
    assert.equal(missing.ok, false);
    const guidance = missing.guidance.join('\n');
    assert.match(guidance, /MODEL_API_KEY/);
    assert.match(guidance, /\.env/);
    assert.match(guidance, /re-run: npm run start:judges/);
    const whitespace = requireApiKey({ MODEL_API_KEY: '   ' });
    assert.equal(whitespace.ok, false);
    const present = requireApiKey({ MODEL_API_KEY: 'operator-supplied-key' });
    assert.equal(present.ok, true);
    assert.deepEqual(present.guidance, []);
    // Guidance must never echo a credential value back.
    assert.ok(!guidance.includes('operator-supplied-key'));
  });

  it('defaults Compose to the 2048-token budget with no silent 512 fallback', () => {
    const compose = readFileSync(join(REPO_ROOT, 'docker-compose.yml'), 'utf8');
    assert.match(compose, /AI_CIRCLE_MAX_TOKENS: "\$\{AI_CIRCLE_MAX_TOKENS:-2048\}"/);
    assert.match(compose, /META_MODEL_NAME: "\$\{META_MODEL_NAME:-muse-spark-1\.3\}"/);
    assert.ok(!compose.includes(':-512'), 'no 512 fallback may remain in Compose');
  });

  it('never prints credential values and never touches an existing .env', () => {
    for (const line of JUDGES_SRC.split('\n')) {
      if (line.includes('MODEL_API_KEY') && /log\(|step\(|stdout/.test(line)) {
        assert.ok(!line.includes('env.'), `output line must not interpolate the key: ${line.trim()}`);
      }
    }
    assert.match(JUDGES_SRC, /if\s*\(\s*!existsSync\(ENV_FILE\)\s*\)/);
  });

  it('contains no destructive operations (safe repeated execution)', () => {
    assert.ok(!JUDGES_SRC.includes('down -v'));
    assert.ok(!JUDGES_SRC.includes('TRUNCATE'));
    assert.ok(!JUDGES_SRC.includes('system prune'));
    assert.ok(!JUDGES_SRC.includes('rm -rf'));
    // '--volumes' exists only as explicit stop-test flag plumbing, never bare.
    for (const line of JUDGES_SRC.split('\n')) {
      if (line.includes('--volumes')) {
        assert.ok(line.includes('volumes'), `unconditional --volumes use: ${line.trim()}`);
      }
    }
  });

  it('points judge instructions at the official repository only', () => {
    const readme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');
    assert.ok(readme.includes('https://github.com/orq0/near-circle-friend'));
    assert.ok(!readme.includes('siamlabs'), 'no stale repository references in setup docs');
  });

  it('parses judge CLI flags with fail-closed defaults', () => {
    assert.deepEqual(parseJudgesArgs([]), { mode: 'run', volumes: false });
    assert.deepEqual(parseJudgesArgs(['--test']), { mode: 'test', volumes: false });
    assert.deepEqual(parseJudgesArgs(['--stop-test']), { mode: 'stop-test', volumes: false });
    assert.deepEqual(parseJudgesArgs(['--stop-test', '--volumes']), { mode: 'stop-test', volumes: true });
    assert.match(parseJudgesArgs(['--bogus']).error ?? '', /unknown flag/);
    assert.match(parseJudgesArgs(['--test', '--stop-test']).error ?? '', /conflicting/);
    assert.match(parseJudgesArgs(['--test', '--volumes']).error ?? '', /only meaningful with --stop-test/);
  });

  it('scopes every test compose command to the isolated project', () => {
    assert.equal(TEST_PROJECT, 'near-circle-judges-test');
    for (const args of [buildTestUpArgs(), buildTestBuildArgs(['api']), buildTestDownArgs({ volumes: false })]) {
      assert.equal(args[0], 'docker');
      assert.equal(args[1], 'compose');
      assert.ok(args.includes('-p') && args.includes(TEST_PROJECT));
      assert.ok(args.some((a) => String(a).endsWith('docker-compose.judges-test.yml')));
    }
    const downVolumes = buildTestDownArgs({ volumes: true });
    assert.ok(downVolumes.includes('--volumes'));
    const downKeep = buildTestDownArgs({ volumes: false });
    assert.ok(!downKeep.includes('--volumes') && !downKeep.includes('-v'));
    // Test ports never equal the development defaults.
    assert.deepEqual(TEST_PORTS, { web: 5273, api: 3101, db: 5533 });
    assert.ok(![5173, 3001, 5433].includes(TEST_PORTS.web));
    assert.ok(![5173, 3001, 5433].includes(TEST_PORTS.api));
    assert.ok(![5173, 3001, 5433].includes(TEST_PORTS.db));
  });

  it('guards the seed target against the development database', () => {
    assert.deepEqual(seedTargetGuard({ seedPort: 5533, devPort: 5433, testPort: 5533 }), { ok: true, reason: '' });
    assert.equal(seedTargetGuard({ seedPort: 5433, devPort: 5433, testPort: 5533 }).ok, false);
    assert.equal(seedTargetGuard({ seedPort: 5533, devPort: 5533, testPort: 5533 }).ok, false);
    assert.equal(seedTargetGuard({ seedPort: NaN, devPort: 5433, testPort: 5533 }).ok, false);
    const url = testSeedDatabaseUrl({ POSTGRES_USER: 'u', POSTGRES_PASSWORD: 'p', POSTGRES_DB: 'd' }, 5533);
    assert.equal(databaseUrlPort(url), 5533);
    assert.ok(url.includes('@localhost:5533/'));
  });

  it('reuses test images only when present and up to date', () => {
    assert.equal(planImage({ exists: false, createdMs: NaN, sourceMtimesMs: [1] }).action, 'build');
    assert.equal(planImage({ exists: true, createdMs: NaN, sourceMtimesMs: [1] }).action, 'build');
    assert.equal(planImage({ exists: true, createdMs: 200, sourceMtimesMs: [100] }).action, 'reuse');
    assert.equal(planImage({ exists: true, createdMs: 100, sourceMtimesMs: [200] }).action, 'build');
  });

  it('detects container-name and config isolation conflicts', () => {
    assert.deepEqual(parseContainerNames('a\nb\n\n'), ['a', 'b']);
    assert.deepEqual(findNameCollisions(['x', 'y'], ['y', 'z']), ['y']);
    assert.deepEqual(findNameCollisions([], Object.values(TEST_CONTAINERS)), []);
    assert.deepEqual(parseComposePs(''), []);
    const good = [
      `container_name: ${TEST_CONTAINERS.db}`,
      `container_name: ${TEST_CONTAINERS.api}`,
      `container_name: ${TEST_CONTAINERS.web}`,
      `image: ${TEST_IMAGES.api}`,
      `image: ${TEST_IMAGES.web}`,
      `${TEST_VOLUME}:`,
    ].join('\n');
    assert.equal(renderedConfigGuards(good).ok, true);
    const bad = `${good}\ncontainer_name: near-circle-db\nnear-circle-db-data:/`;
    const verdict = renderedConfigGuards(bad);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.problems.length >= 2);
  });

  it('collects evidence snapshots through an injectable runner (mocked docker)', () => {
    const mock = (cmd, args) => {
      const joined = [cmd, ...args].join(' ');
      if (joined.includes('ps -q')) return { code: 0, stdout: 'aaa\nbbb\n', stderr: '' };
      if (joined.includes('image inspect')) {
        return joined.includes('missing:tag')
          ? { code: 1, stdout: '', stderr: 'No such image' }
          : { code: 0, stdout: 'sha256:abc\n', stderr: '' };
      }
      throw new Error(`unexpected docker call: ${joined}`);
    };
    const dev = collectDevContainerIds(mock);
    assert.equal(dev.ok, true);
    assert.deepEqual(dev.ids, ['aaa', 'bbb']);
    const failing = collectDevContainerIds(() => ({ code: 1, stdout: '', stderr: 'boom' }));
    assert.equal(failing.ok, false);
    const images = collectImageIds(mock, ['present:tag', 'missing:tag']);
    assert.deepEqual(images, { 'present:tag': 'sha256:abc', 'missing:tag': null });
  });

  it('keeps destructive operations out of every mode', () => {
    assert.ok(!JUDGES_SRC.includes('system prune'));
    assert.ok(!JUDGES_SRC.includes('docker rmi'));
    assert.ok(!JUDGES_SRC.includes('down -v'));
    assert.ok(!JUDGES_SRC.includes('image rm'));
    // The overlay renames every hazard: container names, image tags, volume.
    const overlay = readFileSync(join(REPO_ROOT, 'docker-compose.judges-test.yml'), 'utf8');
    for (const name of Object.values(TEST_CONTAINERS)) assert.ok(overlay.includes(name));
    for (const tag of Object.values(TEST_IMAGES)) assert.ok(overlay.includes(tag));
    assert.ok(overlay.includes(TEST_VOLUME));
    assert.ok(!overlay.includes('container_name: near-circle-db'));
    assert.ok(!overlay.includes('near-circle-db-data:/'));
  });
});
