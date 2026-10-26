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
