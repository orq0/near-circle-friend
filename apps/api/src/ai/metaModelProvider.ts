// Meta Model API adapter — the typed boundary between app logic and live
// inference. ONLY this module talks to the model endpoint; everything else
// uses its assessFriendship()/adviseMeetup() methods. A future approved
// first-party Meta AI integration would replace this adapter, not the
// consent/storage/caching rules built on top of it.
import { ApiError } from '../errors.js';
import {
  ADVISE_JSON_SCHEMA,
  ASSESS_JSON_SCHEMA,
  ADVISE_SYSTEM_PROMPT,
  ASSESS_SYSTEM_PROMPT,
  parseAdviseOutput,
  parseAssessOutput,
  type AdviseModelInput,
  type AssessModelInput,
  type AdviseModelOutput,
  type AssessModelOutput,
} from './contracts.js';
import { MODEL_ID, type AiCircleConfig } from './types.js';

// POST-capable fetch shape so tests inject fakes without sockets.
// Deliberately separate from the GET-only osrm FetchFn.
export interface ModelFetchFn {
  (
    url: string,
    init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
  ): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
}

export interface AssessCallResult {
  output: AssessModelOutput;
  usage: ModelUsage;
  modelId: string;
}

export interface AdviseCallResult {
  output: AdviseModelOutput;
  usage: ModelUsage;
  modelId: string;
}

export interface CircleModelProvider {
  readonly name: 'meta-model-api';
  readonly modelId: string;
  assessFriendship(input: AssessModelInput): Promise<AssessCallResult>;
  adviseMeetup(input: AdviseModelInput): Promise<AdviseCallResult>;
}

export interface MetaModelProviderOptions {
  config: AiCircleConfig;
  fetchFn?: ModelFetchFn;
}

/** Privacy-safe diagnostics only: stage + sizes, never payloads or model text. */
function logInvalidResponse(stage: string, detail: Record<string, unknown>): void {
  console.warn(JSON.stringify({ event: 'ai_response_invalid', stage, ...detail }));
}

/** Shared parse + strict-validate step for both structured contracts. */
function parseOutput<T>(content: string, parse: (value: unknown) => T | null): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    logInvalidResponse('parse', { content_chars: content.length });
    throw new ApiError(502, 'ai provider returned an invalid response');
  }
  const output = parse(parsed);
  if (output === null) {
    logInvalidResponse('validate', {
      content_chars: content.length,
      keys: isRecord(parsed) ? Object.keys(parsed).sort().join(',') : typeof parsed,
    });
    throw new ApiError(502, 'ai provider returned an invalid response');
  }
  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readUsage(value: unknown): ModelUsage {
  if (!isRecord(value)) return { inputTokens: 0, outputTokens: 0, reasoningTokens: 0 };
  const pick = (key: string): number => {
    const v = value[key];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  };
  const details = value['completion_tokens_details'];
  return {
    inputTokens: pick('prompt_tokens'),
    outputTokens: pick('completion_tokens'),
    reasoningTokens: isRecord(details) ? pickIn(details, 'reasoning_tokens') : 0,
  };

  function pickIn(record: Record<string, unknown>, key: string): number {
    const v = record[key];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }
}

export function createMetaModelProvider(options: MetaModelProviderOptions): CircleModelProvider {
  const { config } = options;
  const fetchFn: ModelFetchFn =
    options.fetchFn ??
    ((globalThis.fetch as unknown as ModelFetchFn | undefined) ??
      (() => {
        throw new ApiError(503, 'ai provider unreachable');
      }));
  const url = `${config.baseUrl}/chat/completions`;

  async function callChatCompletions(
    systemPrompt: string,
    userPayload: unknown,
    schemaName: string,
    schema: unknown,
  ): Promise<{ content: string; usage: ModelUsage }> {
    if (config.apiKey === '') {
      throw new ApiError(503, 'ai provider unavailable');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    let payload: unknown;
    try {
      const res = await fetchFn(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(userPayload) },
          ],
          // Strict-subset-conforming schemas (required lists every key,
          // optionals are nullable) so the server enforces the contract
          // instead of silently normalizing it.
          response_format: {
            type: 'json_schema',
            json_schema: { name: schemaName, schema, strict: true },
          },
          temperature: 0,
          // Muse Spark reasons before writing; hidden reasoning shares this
          // budget. Low effort + an adequate cap prevents finish_reason
          // "length" truncating the (short) structured replies.
          max_completion_tokens: config.maxOutputTokens,
          reasoning_effort: config.reasoningEffort,
        }),
        signal: controller.signal,
      });
      payload = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new ApiError(503, 'ai provider unavailable');
        }
        if (res.status === 429) {
          const rate = new ApiError(429, 'ai rate limited');
          (rate as { transient?: boolean }).transient = true;
          throw rate;
        }
        if (res.status >= 500) {
          const err = new ApiError(502, 'ai provider returned an error');
          (err as { transient?: boolean }).transient = true;
          throw err;
        }
        throw new ApiError(502, 'ai provider returned an error');
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        const timeout = new ApiError(504, 'ai provider timed out');
        (timeout as { transient?: boolean }).transient = true;
        throw timeout;
      }
      throw new ApiError(503, 'ai provider unreachable');
    } finally {
      clearTimeout(timer);
    }
    const usage = readUsage(isRecord(payload) ? payload['usage'] : undefined);
    const choices = isRecord(payload) ? payload['choices'] : undefined;
    const first = Array.isArray(choices) ? choices[0] : undefined;
    const finishReason =
      isRecord(first) && typeof first['finish_reason'] === 'string' ? first['finish_reason'] : null;
    const content = isRecord(first) && isRecord(first['message']) ? first['message']['content'] : undefined;
    // Truncation is its own failure class (budget exhausted by reasoning),
    // never malformed JSON: name it, log token attribution, fail fast.
    if (finishReason === 'length') {
      logInvalidResponse('envelope', {
        finish_reason: finishReason,
        content_type: typeof content,
        content_chars: typeof content === 'string' ? content.length : 0,
        completion_tokens: usage.outputTokens,
        reasoning_tokens: usage.reasoningTokens,
      });
      throw new ApiError(502, 'ai provider response truncated');
    }
    if (typeof content !== 'string' || content.trim() === '') {
      logInvalidResponse('envelope', {
        finish_reason: finishReason,
        content_type: typeof content,
        content_chars: typeof content === 'string' ? content.length : 0,
        completion_tokens: usage.outputTokens,
        reasoning_tokens: usage.reasoningTokens,
      });
      throw new ApiError(502, 'ai provider returned an invalid response');
    }
    return { content, usage };
  }

  return {
    name: 'meta-model-api',
    modelId: config.modelName === '' ? MODEL_ID : config.modelName,
    async assessFriendship(input: AssessModelInput): Promise<AssessCallResult> {
      const { content, usage } = await callChatCompletions(
        ASSESS_SYSTEM_PROMPT,
        input,
        'friendship_assessment',
        ASSESS_JSON_SCHEMA,
      );
      const output = parseOutput(content, parseAssessOutput);
      return { output, usage, modelId: config.modelName === '' ? MODEL_ID : config.modelName };
    },
    async adviseMeetup(input: AdviseModelInput): Promise<AdviseCallResult> {
      const { content, usage } = await callChatCompletions(
        ADVISE_SYSTEM_PROMPT,
        input,
        'meetup_advice',
        ADVISE_JSON_SCHEMA,
      );
      const output = parseOutput(content, parseAdviseOutput);
      return { output, usage, modelId: config.modelName === '' ? MODEL_ID : config.modelName };
    },
  };
}

/** True for failures worth a bounded retry (5xx, 429, timeouts). */
export function isTransientModelError(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err as { transient?: boolean }).transient === true
  );
}
