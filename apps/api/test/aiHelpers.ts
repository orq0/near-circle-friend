// Stateful in-memory fake for AI Circle Intelligence route/service tests.
// Implements the AI tables plus the proximity query shapes the advisor reuses,
// so consent/cache/job/override flows are exercisable without Postgres.
import type { QueryResultRow } from 'pg';
import type { Queryable } from '../src/db.js';
import type { CircleModelProvider } from '../src/ai/metaModelProvider.js';
import type { AssessModelInput, AdviseModelInput } from '../src/ai/contracts.js';
import { ApiError } from '../src/errors.js';

export interface AiFakeSeed {
  relationships?: Record<string, string>;
  prefs?: Record<string, Record<string, unknown>>;
  signals?: Record<string, Record<string, unknown>>;
  profiles?: Record<string, Record<string, unknown>>;
  overrides?: Record<string, Record<string, unknown>>;
  jobs?: Array<Record<string, unknown>>;
  advice?: Array<Record<string, unknown>>;
  feedback?: Array<Record<string, unknown>>;
  usage?: Record<string, Record<string, number>>;
  requester?: Record<string, unknown>;
  nearby?: Array<Record<string, unknown>>;
  detail?: Record<string, unknown> | null;
  routeDetail?: Record<string, unknown> | null;
  nextJobId?: number;
  now?: Date;
}

export const DEFAULT_AI_REQUESTER = {
  enabled: true,
  radius_m: 1000,
  located: true,
  lat: 14.581,
  lon: 120.975,
};

export function pairKey(owner: string, friend: string): string {
  return `${owner}:${friend}`;
}

export function createAiFakeDb(seed: AiFakeSeed = {}): Queryable & { state: Required<AiFakeSeed> } {
  const state: Required<AiFakeSeed> = {
    relationships: seed.relationships ?? { 'you:alex': 'approved', 'you:jamie': 'approved' },
    prefs: seed.prefs ?? {},
    signals: seed.signals ?? {},
    profiles: seed.profiles ?? {},
    overrides: seed.overrides ?? {},
    jobs: seed.jobs ?? [],
    advice: seed.advice ?? [],
    feedback: seed.feedback ?? [],
    usage: seed.usage ?? {},
    requester: seed.requester ?? { ...DEFAULT_AI_REQUESTER },
    nearby: seed.nearby ?? [],
    detail: seed.detail ?? null,
    routeDetail: seed.routeDetail ?? null,
    nextJobId: seed.nextJobId ?? 1,
    now: seed.now ?? new Date('2026-06-01T12:00:00.000Z'),
  };

  function dayKey(owner: string): string {
    return `${owner}:${state.now.toISOString().slice(0, 10)}`;
  }

  return {
    state,
    async query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<{ rows: T[] }> {
      const p = (i: number): string => String(params[i]);
      // --- relationships ---------------------------------------------------
      if (text.includes('SELECT status FROM relationships')) {
        const status = state.relationships[pairKey(p(0), p(1))];
        return { rows: (status === undefined ? [] : [{ status }]) as unknown as T[] };
      }
      // --- preferences ------------------------------------------------------
      if (text.startsWith('INSERT INTO ai_circle_preferences')) {
        state.prefs[p(0)] = {
          analysis_consent: params[1],
          advice_consent: params[2],
          availability_shared: params[3],
          quiet_start_min: params[4],
          quiet_end_min: params[5],
          policy_version: params[6],
          updated_at: state.now,
        };
        return { rows: [{ ...state.prefs[p(0)] }] as unknown as T[] };
      }
      if (text.includes('FROM ai_circle_preferences WHERE owner_id')) {
        const row = state.prefs[p(0)];
        return { rows: (row === undefined ? [] : [{ ...row }]) as unknown as T[] };
      }
      // --- revocation --------------------------------------------------------
      if (text.includes("ai_circle_reassessment_jobs SET status = 'cancelled'")) {
        for (const job of state.jobs) {
          if (job['owner_id'] === p(0) && (job['status'] === 'pending' || job['status'] === 'running')) {
            job['status'] = 'cancelled';
            job['finished_at'] = state.now;
          }
        }
        return { rows: [] as unknown as T[] };
      }
      if (text.includes('ai_circle_friendship_profiles SET status =')) {
        for (const key of Object.keys(state.profiles)) {
          if (key.startsWith(`${p(0)}:`)) (state.profiles[key] as Record<string, unknown>)['status'] = 'revoked';
        }
        return { rows: [] as unknown as T[] };
      }
      if (text.startsWith('DELETE FROM ai_circle_signals')) {
        for (const key of Object.keys(state.signals)) {
          if (key.startsWith(`${p(0)}:`)) delete state.signals[key];
        }
        return { rows: [] as unknown as T[] };
      }
      if (text.startsWith('DELETE FROM ai_circle_meetup_advice')) {
        state.advice = state.advice.filter((a) => a['owner_id'] !== p(0));
        return { rows: [] as unknown as T[] };
      }
      if (text.startsWith('DELETE FROM ai_circle_closeness_overrides')) {
        delete state.overrides[pairKey(p(0), p(1))];
        return { rows: [] as unknown as T[] };
      }
      // --- signals -----------------------------------------------------------
      if (text.startsWith('INSERT INTO ai_circle_signals')) {
        const key = pairKey(p(0), p(1));
        const prev = state.signals[key] as Record<string, unknown> | undefined;
        const bump = text.includes('signals_version + 1');
        state.signals[key] = {
          known_for_bucket: params[2],
          last_meetup_bucket: params[3],
          contact_frequency: params[4],
          activity_trend: params[5],
          reciprocity_bucket: params[6],
          confirmed_meetups: params[7],
          declared_closeness: params[8],
          declared_activities: params[9],
          sustained_windows: params[10],
          source: params[11],
          signals_version: (prev?.['signals_version'] as number | undefined) ?? 1,
          updated_at: state.now,
        };
        if (prev !== undefined && bump) {
          (state.signals[key] as Record<string, unknown>)['signals_version'] =
            ((prev['signals_version'] as number) ?? 1) + 1;
        }
        return { rows: [] as unknown as T[] };
      }
      if (text.includes('FROM ai_circle_signals WHERE owner_id')) {
        const row = state.signals[pairKey(p(0), p(1))];
        return { rows: (row === undefined ? [] : [{ ...(row as object) }]) as unknown as T[] };
      }
      // --- profiles ----------------------------------------------------------
      if (text.startsWith('INSERT INTO ai_circle_friendship_profiles')) {
        const key = pairKey(p(0), p(1));
        state.profiles[key] = {
          level: params[2],
          evidence_quality: params[3],
          rationale: params[4],
          activity_trend: params[5],
          source: 'meta_live',
          model_id: params[6],
          signals_version: params[7],
          fingerprint: params[8],
          baseline: JSON.parse(String(params[9])) as Record<string, unknown>,
          policy_version: params[10],
          status: 'active',
          assessed_at: state.now,
          updated_at: state.now,
        };
        return { rows: [] as unknown as T[] };
      }
      if (text.includes('FROM ai_circle_friendship_profiles WHERE owner_id')) {
        const row = state.profiles[pairKey(p(0), p(1))];
        return { rows: (row === undefined ? [] : [{ ...(row as object) }]) as unknown as T[] };
      }
      // --- overrides ----------------------------------------------------------
      if (text.startsWith('INSERT INTO ai_circle_closeness_overrides')) {
        const key = pairKey(p(0), p(1));
        state.overrides[key] = { level: Number(params[2]), updated_at: state.now };
        return { rows: [{ ...(state.overrides[key] as object) }] as unknown as T[] };
      }
      if (text.includes('FROM ai_circle_closeness_overrides WHERE owner_id')) {
        const row = state.overrides[pairKey(p(0), p(1))];
        return { rows: (row === undefined ? [] : [{ ...(row as object) }]) as unknown as T[] };
      }
      // --- jobs ----------------------------------------------------------------
      if (text.startsWith('INSERT INTO ai_circle_reassessment_jobs')) {
        const live = state.jobs.find(
          (j) => j['owner_id'] === p(0) && j['friend_id'] === p(1) && (j['status'] === 'pending' || j['status'] === 'running'),
        );
        if (live !== undefined) return { rows: [] as unknown as T[] }; // ON CONFLICT DO NOTHING
        const job: Record<string, unknown> = {
          id: state.nextJobId++,
          owner_id: p(0),
          friend_id: p(1),
          status: 'pending',
          reason: params[2],
          fingerprint: params[3],
          attempts: 0,
          trace_id: params[4],
          error: null,
          created_at: state.now,
          started_at: null,
          finished_at: null,
        };
        state.jobs.push(job);
        return { rows: [{ ...job }] as unknown as T[] };
      }
      if (text.includes("status IN ('pending', 'running')")) {
        const live = state.jobs
          .filter((j) => j['owner_id'] === p(0) && j['friend_id'] === p(1) && (j['status'] === 'pending' || j['status'] === 'running'))
          .sort((a, b) => (b['created_at'] as Date).getTime() - (a['created_at'] as Date).getTime());
        return { rows: (live[0] === undefined ? [] : [{ ...live[0] }]) as unknown as T[] };
      }
      if (text.includes("status IN ('completed', 'failed', 'unavailable')")) {
        const done = state.jobs
          .filter(
            (j) => j['owner_id'] === p(0) && j['friend_id'] === p(1) && ['completed', 'failed', 'unavailable'].includes(String(j['status'])),
          )
          .sort((a, b) => {
            const ta = a['finished_at'] === null ? -1 : (a['finished_at'] as Date).getTime();
            const tb = b['finished_at'] === null ? -1 : (b['finished_at'] as Date).getTime();
            return tb - ta;
          });
        const first = done[0];
        return { rows: (first === undefined ? [] : [{ finished_at: first['finished_at'] }]) as unknown as T[] };
      }
      if (text.includes("reason = 'explicit'")) {
        const day = state.now.toISOString().slice(0, 10);
        const count = state.jobs.filter(
          (j) => j['owner_id'] === p(0) && j['friend_id'] === p(1) && j['reason'] === 'explicit' && (j['created_at'] as Date).toISOString().slice(0, 10) === day,
        ).length;
        return { rows: [{ count: String(count) }] as unknown as T[] };
      }
      if (text.includes("SET status = 'running'")) {
        const pending = state.jobs
          .filter((j) => j['status'] === 'pending')
          .sort((a, b) => (a['created_at'] as Date).getTime() - (b['created_at'] as Date).getTime())[0];
        if (pending === undefined) return { rows: [] as unknown as T[] };
        pending['status'] = 'running';
        pending['started_at'] = state.now;
        pending['attempts'] = (pending['attempts'] as number) + 1;
        return { rows: [{ ...pending }] as unknown as T[] };
      }
      if (text.includes('FROM ai_circle_reassessment_jobs WHERE id = $1')) {
        const job = state.jobs.find((j) => Number(j['id']) === Number(params[0]));
        return { rows: (job === undefined ? [] : [{ ...job }]) as unknown as T[] };
      }
      if (text.includes('SET status = $2, finished_at')) {
        const job = state.jobs.find((j) => Number(j['id']) === Number(params[0]));
        if (job !== undefined) {
          job['status'] = params[1];
          job['finished_at'] = state.now;
          job['error'] = params[2];
        }
        return { rows: [] as unknown as T[] };
      }
      if (text.includes("SET status = 'pending', error = $2")) {
        const job = state.jobs.find((j) => Number(j['id']) === Number(params[0]));
        if (job !== undefined) {
          job['status'] = 'pending';
          job['error'] = params[1];
        }
        return { rows: [] as unknown as T[] };
      }
      // --- advice cache ---------------------------------------------------------
      if (text.startsWith('INSERT INTO ai_circle_meetup_advice')) {
        const idx = state.advice.findIndex(
          (a) => a['owner_id'] === p(0) && a['friend_id'] === p(1) && a['advice_key'] === params[2],
        );
        const row: Record<string, unknown> = {
          owner_id: p(0),
          friend_id: p(1),
          advice_key: params[2],
          outcome: params[3],
          reason: params[4],
          activity: params[5],
          invitation_draft: params[6],
          source: params[7],
          model_id: params[8],
          policy_version: params[9],
          trace_id: params[10],
          generated_at: state.now,
          expires_at: new Date(state.now.getTime() + Number(params[11]) * 60000),
        };
        if (idx === -1) state.advice.push(row);
        else state.advice[idx] = row;
        return { rows: [] as unknown as T[] };
      }
      if (text.includes('FROM ai_circle_meetup_advice') && text.includes('advice_key')) {
        const row = state.advice.find(
          (a) => a['owner_id'] === p(0) && a['friend_id'] === p(1) && a['advice_key'] === params[2] && (a['expires_at'] as Date).getTime() > state.now.getTime(),
        );
        return { rows: (row === undefined ? [] : [{ ...row }]) as unknown as T[] };
      }
      if (text.includes('generated_at > NOW() - make_interval(hours')) {
        const hours = Number(params[2]);
        const count = state.advice.filter(
          (a) => a['owner_id'] === p(0) && a['friend_id'] === p(1) && (a['generated_at'] as Date).getTime() > state.now.getTime() - hours * 3600000,
        ).length;
        return { rows: [{ count: String(count) }] as unknown as T[] };
      }
      // --- feedback --------------------------------------------------------------
      if (text.startsWith('INSERT INTO ai_circle_feedback')) {
        const expires = params[3] === null ? null : new Date(state.now.getTime() + Number(params[3]) * 60000);
        state.feedback.push({ owner_id: p(0), friend_id: p(1), kind: params[2], created_at: state.now, expires_at: expires });
        return { rows: [{ expires_at: expires }] as unknown as T[] };
      }
      if (text.includes("kind = 'declined'")) {
        const hit = state.feedback.some(
          (f) => f['owner_id'] === p(0) && f['friend_id'] === p(1) && f['kind'] === 'declined' && (f['created_at'] as Date).getTime() > state.now.getTime() - 7 * 86400000,
        );
        return { rows: (hit ? [{ one: 1 }] : []) as unknown as T[] };
      }
      if (text.includes("kind IN ('dismiss', 'snooze')")) {
        const hit = state.feedback.some(
          (f) =>
            f['owner_id'] === p(0) &&
            f['friend_id'] === p(1) &&
            (f['kind'] === 'dismiss' || f['kind'] === 'snooze') &&
            (f['expires_at'] === null || (f['expires_at'] as Date).getTime() > state.now.getTime()),
        );
        return { rows: (hit ? [{ one: 1 }] : []) as unknown as T[] };
      }
      // --- usage ------------------------------------------------------------------
      if (text.startsWith('INSERT INTO ai_circle_usage')) {
        const key = dayKey(p(0));
        const row = state.usage[key] ?? {
          model_requests: 0,
          cache_hits: 0,
          cache_misses: 0,
          input_tokens: 0,
          output_tokens: 0,
          rate_limited: 0,
        };
        if (text.includes('model_requests')) {
          row['model_requests'] += 1;
          row['input_tokens'] += Number(params[1]);
          row['output_tokens'] += Number(params[2]);
        }
        for (const col of ['cache_hits', 'cache_misses', 'rate_limited']) {
          if (text.includes(`(${col})`) || text.includes(`${col} = ai_circle_usage.${col} + 1`)) {
            row[col] += 1;
          }
        }
        state.usage[key] = row as Record<string, number>;
        return { rows: [] as unknown as T[] };
      }
      if (text.includes('FROM ai_circle_usage WHERE owner_id = $1 AND day')) {
        const row = state.usage[dayKey(p(0))];
        return { rows: [{ model_requests: row?.['model_requests'] ?? 0 }] as unknown as T[] };
      }
      if (text.includes('FROM ai_circle_usage WHERE owner_id = $1')) {
        const totals = { model_requests: 0, cache_hits: 0, cache_misses: 0, input_tokens: 0, output_tokens: 0, rate_limited: 0 };
        for (const [key, row] of Object.entries(state.usage)) {
          if (key.startsWith(`${p(0)}:`)) {
            for (const col of Object.keys(totals) as Array<keyof typeof totals>) {
              totals[col] += (row as Record<string, number>)[col] ?? 0;
            }
          }
        }
        return { rows: [totals] as unknown as T[] };
      }
      // --- proximity shapes (reused by opportunities/advise) -----------------------
      if (text.includes('FROM (SELECT 1) AS dummy')) {
        return { rows: [{ ...state.requester }] as unknown as T[] };
      }
      if (text.includes('ST_DWithin')) {
        return { rows: state.nearby.map((r) => ({ ...r })) as unknown as T[] };
      }
      if (text.includes('WHERE u.id = $2')) {
        if (state.detail === null) return { rows: [] as unknown as T[] };
        return { rows: [{ ...state.detail }] as unknown as T[] };
      }
      if (text.includes('straight_line_m')) {
        if (state.routeDetail === null) return { rows: [] as unknown as T[] };
        return { rows: [{ ...state.routeDetail }] as unknown as T[] };
      }
      throw new Error(`ai fake db: unexpected query: ${text.slice(0, 100)}`);
    },
  };
}

/** Counting fake provider: proves zero/multi inference call expectations. */
export function createCountingProvider(overrides: {
  assess?: (input: AssessModelInput) => unknown;
  advise?: (input: AdviseModelInput) => unknown;
  failAssess?: unknown;
  failAdvise?: unknown;
} = {}): CircleModelProvider & { calls: { assess: AssessModelInput[]; advise: AdviseModelInput[] } } {
  const calls = { assess: [] as AssessModelInput[], advise: [] as AdviseModelInput[] };
  return {
    name: 'meta-model-api',
    modelId: 'muse-spark-1.3',
    calls,
    async assessFriendship(input: AssessModelInput) {
      calls.assess.push(input);
      if (overrides.failAssess !== undefined) throw overrides.failAssess;
      const output =
        overrides.assess?.(input) ??
        ({
          closeness_level: 4,
          evidence_quality: 'moderate',
          closeness_reason: 'Established reciprocal friendship.',
          activity_trend: 'stable',
          reassessment_note: null,
        });
      return { output: output as never, usage: { inputTokens: 120, outputTokens: 40 }, modelId: 'muse-spark-1.3' };
    },
    async adviseMeetup(input: AdviseModelInput) {
      calls.advise.push(input);
      if (overrides.failAdvise !== undefined) throw overrides.failAdvise;
      const output =
        overrides.advise?.(input) ??
        ({
          opportunity: 'suggest',
          opportunity_reason: 'Nearby and mutually available.',
          activity: 'coffee',
          invitation_draft: 'Hey! Coffee today? No pressure!',
        });
      return { output: output as never, usage: { inputTokens: 150, outputTokens: 60 }, modelId: 'muse-spark-1.3' };
    },
  };
}

export function apiError(status: number, message: string): ApiError {
  return new ApiError(status, message);
}
