// Meta Model API adapter — the typed boundary between app logic and live
// inference. ONLY this module talks to the model endpoint; everything else
// uses its assessFriendship()/adviseMeetup() methods. A future approved
// first-party Meta AI integration would replace this adapter, not the
// consent/storage/caching rules built on top of it.
import { ApiError } from '../errors.js';
import { ADVISE_JSON_SCHEMA, ASSESS_JSON_SCHEMA, ADVISE_SYSTEM_PROMPT, ASSESS_SYSTEM_PROMPT, parseAdviseOutput, parseAssessOutput, } from './contracts.js';
import { MODEL_ID } from './types.js';
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function readUsage(value) {
    if (!isRecord(value))
        return { inputTokens: 0, outputTokens: 0 };
    const pick = (key) => {
        const v = value[key];
        return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
    };
    return { inputTokens: pick('prompt_tokens'), outputTokens: pick('completion_tokens') };
}
export function createMetaModelProvider(options) {
    const { config } = options;
    const fetchFn = options.fetchFn ??
        (globalThis.fetch ??
            (() => {
                throw new ApiError(503, 'ai provider unreachable');
            }));
    const url = `${config.baseUrl}/chat/completions`;
    async function callChatCompletions(systemPrompt, userPayload, schemaName, schema) {
        if (config.apiKey === '') {
            throw new ApiError(503, 'ai provider unavailable');
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), config.timeoutMs);
        let payload;
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
                    response_format: { type: 'json_schema', json_schema: { name: schemaName, schema } },
                    temperature: 0,
                    max_tokens: config.maxOutputTokens,
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
                    rate.transient = true;
                    throw rate;
                }
                if (res.status >= 500) {
                    const err = new ApiError(502, 'ai provider returned an error');
                    err.transient = true;
                    throw err;
                }
                throw new ApiError(502, 'ai provider returned an error');
            }
        }
        catch (err) {
            if (err instanceof ApiError)
                throw err;
            if (err instanceof Error && err.name === 'AbortError') {
                const timeout = new ApiError(504, 'ai provider timed out');
                timeout.transient = true;
                throw timeout;
            }
            throw new ApiError(503, 'ai provider unreachable');
        }
        finally {
            clearTimeout(timer);
        }
        const choices = isRecord(payload) ? payload['choices'] : undefined;
        const first = Array.isArray(choices) ? choices[0] : undefined;
        const content = isRecord(first) && isRecord(first['message']) ? first['message']['content'] : undefined;
        if (typeof content !== 'string' || content.trim() === '') {
            throw new ApiError(502, 'ai provider returned an invalid response');
        }
        return { content, usage: readUsage(isRecord(payload) ? payload['usage'] : undefined) };
    }
    return {
        name: 'meta-model-api',
        modelId: config.modelName === '' ? MODEL_ID : config.modelName,
        async assessFriendship(input) {
            const { content, usage } = await callChatCompletions(ASSESS_SYSTEM_PROMPT, input, 'friendship_assessment', ASSESS_JSON_SCHEMA);
            let parsed;
            try {
                parsed = JSON.parse(content);
            }
            catch {
                throw new ApiError(502, 'ai provider returned an invalid response');
            }
            const output = parseAssessOutput(parsed);
            if (output === null) {
                throw new ApiError(502, 'ai provider returned an invalid response');
            }
            return { output, usage, modelId: config.modelName === '' ? MODEL_ID : config.modelName };
        },
        async adviseMeetup(input) {
            const { content, usage } = await callChatCompletions(ADVISE_SYSTEM_PROMPT, input, 'meetup_advice', ADVISE_JSON_SCHEMA);
            let parsed;
            try {
                parsed = JSON.parse(content);
            }
            catch {
                throw new ApiError(502, 'ai provider returned an invalid response');
            }
            const output = parseAdviseOutput(parsed);
            if (output === null) {
                throw new ApiError(502, 'ai provider returned an invalid response');
            }
            return { output, usage, modelId: config.modelName === '' ? MODEL_ID : config.modelName };
        },
    };
}
/** True for failures worth a bounded retry (5xx, 429, timeouts). */
export function isTransientModelError(err) {
    return (err instanceof ApiError &&
        err.transient === true);
}
