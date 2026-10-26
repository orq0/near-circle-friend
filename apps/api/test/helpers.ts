import type { QueryResultRow } from 'pg';
import type { Queryable } from '../src/db.js';

// Explicit in-memory stand-in for the pg pool. Routes switch on distinctive
// SQL fragments so each test controls exactly the rows its path reads.
export interface FakeRequester {
  enabled: boolean;
  radius_m: number;
  located: boolean;
  lat: number | null;
  lon: number | null;
}

export interface FakeData {
  requester?: FakeRequester;
  nearby?: Array<{ id: string; display_name: string; distance_m: number; bearing_deg: number }>;
  visibilityRow?: Array<{ enabled: boolean; radius_m: number }>;
  visibilitySaved?: { enabled: boolean; radius_m: number };
  locationSaved?: { lat: number; lon: number; updated_at: Date; expires_at: Date };
  friends?: Array<{
    id: string;
    display_name: string;
    near_circle_enabled: boolean;
    location_state: string;
  }>;
  detail?: {
    id: string;
    display_name: string;
    near_circle_enabled: boolean;
    fresh: boolean;
    distance_m: number | null;
    bearing_deg: number | null;
  } | null;
  connectionError?: boolean;
}

const DEFAULT_REQUESTER: FakeRequester = {
  enabled: true,
  radius_m: 1000,
  located: true,
  lat: 14.581,
  lon: 120.975,
};

export function createFakeDb(data: FakeData = {}): Queryable {
  return {
    async query<T extends QueryResultRow>(text: string): Promise<{ rows: T[] }> {
      if (data.connectionError === true) {
        throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5433'), {
          code: 'ECONNREFUSED',
        });
      }
      let rows: QueryResultRow[];
      if (text.includes('FROM (SELECT 1) AS dummy')) {
        rows = [data.requester ?? DEFAULT_REQUESTER];
      } else if (text.includes('ST_DWithin')) {
        rows = data.nearby ?? [];
      } else if (text.startsWith('INSERT INTO visibility')) {
        rows = [data.visibilitySaved ?? { enabled: true, radius_m: 1000 }];
      } else if (text.startsWith('SELECT enabled, radius_m FROM visibility')) {
        rows = data.visibilityRow ?? [];
      } else if (text.startsWith('INSERT INTO locations')) {
        rows = [
          data.locationSaved ?? {
            lat: 14.581,
            lon: 120.975,
            updated_at: new Date('2026-01-01T00:00:00.000Z'),
            expires_at: new Date('2026-01-31T00:00:00.000Z'),
          },
        ];
      } else if (text.includes('location_state')) {
        rows = data.friends ?? [];
      } else if (text.includes('WHERE u.id = $2')) {
        rows = data.detail === undefined || data.detail === null ? [] : [data.detail];
      } else {
        throw new Error(`fake Db: unexpected query: ${text.slice(0, 80)}`);
      }
      return { rows: rows as T[] };
    },
  };
}

export async function catchStatus(fn: () => Promise<unknown>): Promise<number | null> {
  try {
    await fn();
  } catch (err) {
    return (err as { statusCode?: number }).statusCode ?? -1;
  }
  return null;
}
