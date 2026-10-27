import { describe, expect, it } from 'vitest';
import {
  createMetaModelProvider,
  isTransientModelError,
  type ModelFetchFn,
} from '../src/ai/metaModelProvider.js';
import { DEFAULT_AI_CIRCLE_CONFIG } from '../src/ai/types.js';
import type { AssessModelInput, AdviseModelInput } from '../src/ai/contracts.js';
import { catchStatus } from './helpers.js';

const ASSESS_INPUT: AssessModelInput = {
  task: 'assess_friendship_profile',
  friend_alias: 'Friend_ab12cd34',
  prior_assessment: { level: 4, assessed_days_ago: 21 },
  signals: {
    known_for: 'several_years',
    last_meetup: 'about_three_months_ago',
    contact_frequency: 'occasional',
    activity_trend: 'increasing_sustained',
    reciprocity: 'balanced',
    confirmed_meetups: 5,
    user_declared_closeness: 'close_friend',
    declared_activities: ['coffee'],
  },
};

const ADVISE_INPUT: AdviseModelInput = {
  task: 'advise_meetup_today',
  friend_alias: 'Friend_ab12cd34',
  stored_closeness_level: 4,
  closeness_source: 'ai_estimate',
  relationship: {
    last_confirmed_meetup: 'about_three_months_ago',
    recent_activity: 'occasional',
    declared_shared_activities: ['coffee'],
  },
  opportunity: { availability_fact: 'both_shared_available', approx_walk_minutes: 12, recent_invite_declined: false },
};

function chatResponse(content: string, usage = { prompt_tokens: 120, completion_tokens: 40 }): unknown {
  return {
    choices: [{ message: { role: 'assistant', content } }],
    usage,
  };
}

function jsonFetch(payload: unknown, status = 200): ModelFetchFn {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => payload });
}

const CONFIG = { ...DEFAULT_AI_CIRCLE_CONFIG, apiKey: 'test-key' };

describe('Meta Model API adapter', () => {
  it('posts chat completions with json_schema and parses assessment output', async () => {
    const seen: Array<{ url: string; init: { method: string; headers: Record<string, string>; body: string } }> = [];
    const provider = createMetaModelProvider({
      config: CONFIG,
      fetchFn: (async (url: string, init) => {
        seen.push({ url, init });
        return jsonFetch(
          chatResponse(
            JSON.stringify({
              closeness_level: 4,
              evidence_quality: 'moderate',
              closeness_reason: 'Established reciprocal friendship.',
              activity_trend: 'increasing',
            }),
          ),
        )(url, init);
      }) as ModelFetchFn,
    });
    const result = await provider.assessFriendship(ASSESS_INPUT);
    expect(result.output.closeness_level).toBe(4);
    expect(result.usage).toEqual({ inputTokens: 120, outputTokens: 40, reasoningTokens: 0 });
    expect(result.modelId).toBe('muse-spark-1.3');
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe('https://api.meta.ai/v1/chat/completions');
    const body = JSON.parse(seen[0]?.init.body ?? '{}') as Record<string, unknown>;
    expect(body['model']).toBe('muse-spark-1.3');
    expect(body['temperature']).toBe(0);
    expect((body['response_format'] as Record<string, unknown>)['type']).toBe('json_schema');
    const jsonSchema = (body['response_format'] as Record<string, unknown>)['json_schema'] as Record<
      string,
      unknown
    >;
    expect(jsonSchema['strict']).toBe(true);
    const assessSchema = jsonSchema['schema'] as { required: string[]; properties: Record<string, unknown> };
    expect(assessSchema.required).toContain('reassessment_note');
    expect(body['max_completion_tokens']).toBe(2048);
    expect(body['max_tokens']).toBeUndefined();
    expect(body['reasoning_effort']).toBe('low');
    expect(seen[0]?.init.headers['authorization']).toBe('Bearer test-key');
    expect(JSON.stringify(body)).not.toContain('test-key');
  });

  it('parses advice output with a draft', async () => {
    const provider = createMetaModelProvider({
      config: CONFIG,
      fetchFn: jsonFetch(
        chatResponse(
          JSON.stringify({
            opportunity: 'suggest',
            opportunity_reason: 'Nearby and available.',
            activity: 'coffee',
            invitation_draft: 'Coffee today?',
          }),
        ),
      ),
    });
    const result = await provider.adviseMeetup(ADVISE_INPUT);
    expect(result.output.opportunity).toBe('suggest');
    expect(result.output.invitation_draft).toBe('Coffee today?');
  });

  // Meta's schema-constrained output always includes optional keys; with an
  // incomplete `required` array the server normalizes optionals to nullable,
  // so a real Muse Spark reply carries "invitation_draft": null rather than
  // omitting the key. The validator must accept explicit null (live 502 bug).
  it('accepts the normalized wire shape: optional fields present as null', async () => {
    const advise = createMetaModelProvider({
      config: CONFIG,
      fetchFn: jsonFetch(
        chatResponse(
          JSON.stringify({
            opportunity: 'later',
            opportunity_reason: 'No shared availability today.',
            activity: 'none',
            invitation_draft: null,
          }),
        ),
      ),
    });
    const advice = await advise.adviseMeetup(ADVISE_INPUT);
    expect(advice.output.opportunity).toBe('later');
    expect(advice.output.invitation_draft).toBeNull();

    const assess = createMetaModelProvider({
      config: CONFIG,
      fetchFn: jsonFetch(
        chatResponse(
          JSON.stringify({
            closeness_level: 4,
            evidence_quality: 'moderate',
            closeness_reason: 'Established reciprocal friendship.',
            activity_trend: 'increasing',
            reassessment_note: null,
          }),
        ),
      ),
    });
    const assessed = await assess.assessFriendship(ASSESS_INPUT);
    expect(assessed.output.closeness_level).toBe(4);
    expect(assessed.output.reassessment_note).toBeNull();
  });

  // Null-as-absent is the only relaxation: wrong types still reject.
  it('rejects non-string optional fields with 502', async () => {
    const badDraft = createMetaModelProvider({
      config: CONFIG,
      fetchFn: jsonFetch(
        chatResponse(
          JSON.stringify({
            opportunity: 'suggest',
            opportunity_reason: 'Nearby and available.',
            activity: 'coffee',
            invitation_draft: 42,
          }),
        ),
      ),
    });
    expect(await catchStatus(async () => badDraft.adviseMeetup(ADVISE_INPUT))).toBe(502);

    const badNote = createMetaModelProvider({
      config: CONFIG,
      fetchFn: jsonFetch(
        chatResponse(
          JSON.stringify({
            closeness_level: 4,
            evidence_quality: 'moderate',
            closeness_reason: 'Established reciprocal friendship.',
            activity_trend: 'increasing',
            reassessment_note: true,
          }),
        ),
      ),
    });
    expect(await catchStatus(async () => badNote.assessFriendship(ASSESS_INPUT))).toBe(502);
  });

  it('refuses to call without an API key and never touches fetch', async () => {
    let calls = 0;
    const provider = createMetaModelProvider({
      config: { ...CONFIG, apiKey: '' },
      fetchFn: (async () => {
        calls += 1;
        return { ok: true, status: 200, json: async () => ({}) };
      }) as ModelFetchFn,
    });
    expect(await catchStatus(async () => provider.assessFriendship(ASSESS_INPUT))).toBe(503);
    expect(await catchStatus(async () => provider.adviseMeetup(ADVISE_INPUT))).toBe(503);
    expect(calls).toBe(0);
  });

  it('maps auth failures to 503, rate limits to transient 429, server errors to transient 502', async () => {
    for (const status of [401, 403]) {
      const provider = createMetaModelProvider({ config: CONFIG, fetchFn: jsonFetch({}, status) });
      expect(await catchStatus(async () => provider.assessFriendship(ASSESS_INPUT))).toBe(503);
    }
    const limited = createMetaModelProvider({ config: CONFIG, fetchFn: jsonFetch({}, 429) });
    expect(await catchStatus(async () => limited.adviseMeetup(ADVISE_INPUT))).toBe(429);
    const broken = createMetaModelProvider({ config: CONFIG, fetchFn: jsonFetch({}, 500) });
    expect(await catchStatus(async () => broken.adviseMeetup(ADVISE_INPUT))).toBe(502);
  });

  it('marks 429/5xx/timeout as transient for bounded retries', async () => {
    const slow: ModelFetchFn = (async () => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    }) as ModelFetchFn;
    const provider = createMetaModelProvider({ config: { ...CONFIG, timeoutMs: 5 }, fetchFn: slow });
    try {
      await provider.assessFriendship(ASSESS_INPUT);
      expect.unreachable('expected timeout');
    } catch (err) {
      expect((err as { statusCode?: number }).statusCode).toBe(504);
      expect(isTransientModelError(err)).toBe(true);
    }
    const limited = createMetaModelProvider({ config: CONFIG, fetchFn: jsonFetch({}, 429) });
    try {
      await limited.assessFriendship(ASSESS_INPUT);
      expect.unreachable('expected 429');
    } catch (err) {
      expect(isTransientModelError(err)).toBe(true);
    }
    const authed = createMetaModelProvider({ config: CONFIG, fetchFn: jsonFetch({}, 401) });
    try {
      await authed.assessFriendship(ASSESS_INPUT);
      expect.unreachable('expected 503');
    } catch (err) {
      expect(isTransientModelError(err)).toBe(false);
    }
  });

  // Live failure (debug-8): the model spent the whole completion budget on
  // hidden reasoning and stopped with finish_reason "length"; content came
  // back null. That must surface as an explicit truncation, never as an
  // ordinary "invalid response", and must not be retried as transient.
  it('reports finish_reason length as an explicit truncation', async () => {
    const truncated = {
      choices: [{ message: { role: 'assistant', content: null }, finish_reason: 'length' }],
      usage: {
        prompt_tokens: 140,
        completion_tokens: 512,
        completion_tokens_details: { reasoning_tokens: 509 },
      },
    };
    for (const payload of [
      truncated,
      {
        choices: [
          {
            message: { role: 'assistant', content: '{"opportunity":"suggest",' },
            finish_reason: 'length',
          },
        ],
        usage: truncated.usage,
      },
    ]) {
      const provider = createMetaModelProvider({ config: CONFIG, fetchFn: jsonFetch(payload) });
      try {
        await provider.adviseMeetup(ADVISE_INPUT);
        expect.unreachable('expected truncation');
      } catch (err) {
        expect((err as { statusCode?: number }).statusCode).toBe(502);
        expect((err as Error).message).toBe('ai provider response truncated');
        expect(isTransientModelError(err)).toBe(false);
      }
    }

    // Reasoning-token attribution is parsed for budgets/logging.
    const ok = createMetaModelProvider({
      config: CONFIG,
      fetchFn: jsonFetch({
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                opportunity: 'suggest',
                opportunity_reason: 'Nearby and available.',
                activity: 'coffee',
                invitation_draft: 'Coffee today?',
              }),
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 140,
          completion_tokens: 320,
          completion_tokens_details: { reasoning_tokens: 260 },
        },
      }),
    });
    const result = await ok.adviseMeetup(ADVISE_INPUT);
    expect(result.output.opportunity).toBe('suggest');
    expect(result.usage).toEqual({ inputTokens: 140, outputTokens: 320, reasoningTokens: 260 });
  });

  it('rejects malformed envelopes and invalid model JSON with 502', async () => {
    for (const payload of [
      {},
      { choices: [] },
      { choices: [{ message: { content: '' } }] },
      chatResponse('not json{{'),
      chatResponse(JSON.stringify({ closeness_level: 99 })),
    ]) {
      const provider = createMetaModelProvider({ config: CONFIG, fetchFn: jsonFetch(payload) });
      expect(await catchStatus(async () => provider.assessFriendship(ASSESS_INPUT))).toBe(502);
    }
  });

  it('maps transport failures to 503', async () => {
    const provider = createMetaModelProvider({
      config: CONFIG,
      fetchFn: (async () => {
        throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      }) as ModelFetchFn,
    });
    expect(await catchStatus(async () => provider.adviseMeetup(ADVISE_INPUT))).toBe(503);
  });
});
