import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Phase 1 Docker boundary: the OSRM image reference must resolve, and the
// unprepared router must stay behind the `routing` profile so a core
// `docker compose up` never pulls or requires OSRM.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const COMPOSE = readFileSync(join(ROOT, 'docker-compose.yml'), 'utf8');

function routingServiceBlock(): string {
  const start = COMPOSE.indexOf('near-circle-routing-walk:');
  expect(start).toBeGreaterThan(-1);
  const end = COMPOSE.indexOf('\nvolumes:', start);
  return COMPOSE.slice(start, end === -1 ? undefined : end);
}

describe('docker-compose routing boundary', () => {
  it('references the OSRM image from its real registry', () => {
    expect(routingServiceBlock()).toContain('image: ghcr.io/project-osrm/osrm-backend:');
    expect(COMPOSE).not.toContain('image: osrm/osrm-backend');
  });

  it('gates the unprepared router behind the routing profile', () => {
    expect(routingServiceBlock()).toMatch(/profiles:\s*\["routing"\]/);
  });

  it('keeps enabled services independent of the inactive router', () => {
    const blocks = [...COMPOSE.matchAll(/depends_on:\s*\n((?:[ ]{6}\S[^\n]*\n?)+)/g)];
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block[1]).not.toContain('near-circle-routing-walk');
    }
  });
});

describe('docker-compose web proxy', () => {
  const VITE_CONFIG = readFileSync(join(ROOT, 'apps/web/vite.config.ts'), 'utf8');

  function webServiceBlock(): string {
    const start = COMPOSE.indexOf('near-circle-web:');
    expect(start).toBeGreaterThan(-1);
    const end = COMPOSE.indexOf('\n  near-circle-api:', start);
    return COMPOSE.slice(start, end === -1 ? undefined : end);
  }

  it('points the web /api proxy at the in-network API, not container localhost', () => {
    // Inside the web container, `localhost` is the web container itself, so a
    // localhost proxy target breaks every /api call (stuck inbox loading state).
    expect(webServiceBlock()).toContain('VITE_API_PROXY_TARGET: "http://near-circle-api:3001"');
    expect(webServiceBlock()).not.toContain('localhost:3001');
  });

  it('keeps localhost:3001 as the native-dev proxy default', () => {
    expect(VITE_CONFIG).toContain("process.env['VITE_API_PROXY_TARGET']");
    expect(VITE_CONFIG).toContain('http://localhost:3001');
  });
});
