import type { FastifyInstance } from 'fastify';
import type { Queryable } from '../db.js';
import { ApiError } from '../errors.js';
import { parseRadiusM } from '../geo.js';
import { DEMO_USER_ID, DEFAULT_RADIUS_M } from '../services/proximity.js';
import type { WalkingRoutingProvider } from '../routing/types.js';
import {
  clearOverride,
  getCloseness,
  getSettings,
  getUsage,
  processPendingJobs,
  recordSignalEvent,
  requestAssessment,
  saveOverride,
  updateSettings,
  type SignalEvent,
  type SignalEventType,
  type SettingsPatch,
} from '../ai/aiCircle.js';
import {
  COLEEN_DEMO_FRIEND_ID,
  getOpportunities,
  recordFeedback,
  requestAdvice,
  restoreColeenDemo,
} from '../ai/advisor.js';
import type { CircleModelProvider } from '../ai/metaModelProvider.js';
import type { AiCircleConfig, ClosenessLevel } from '../ai/types.js';

export interface AiCircleRouteDeps {
  routing?: WalkingRoutingProvider;
  provider: CircleModelProvider;
  config: AiCircleConfig;
}

function friendIdParam(req: { params: unknown }): string {
  const params = req.params as { id?: unknown; friendId?: unknown };
  const id = (params.friendId ?? params.id) as unknown;
  if (typeof id !== 'string' || id.trim() === '') {
    throw new ApiError(400, 'friend id is required');
  }
  return id;
}

function bodyRecord(req: { body: unknown }): Record<string, unknown> {
  if (typeof req.body !== 'object' || req.body === null) {
    throw new ApiError(400, 'body must be an object');
  }
  return req.body as Record<string, unknown>;
}

function optionalBool(body: Record<string, unknown>, key: string): boolean | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new ApiError(400, `${key} must be a boolean`);
  return value;
}

function optionalQuietMinute(body: Record<string, unknown>, key: string): number | null | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= 1440) {
    throw new ApiError(400, `${key} must be an integer 0..1439 or null`);
  }
  return value;
}

const SIGNAL_EVENTS: readonly SignalEventType[] = [
  'confirmed_meetup',
  'declared_change',
  'interaction_up',
  'interaction_down',
  'mention_like',
  'message_like',
];

export async function aiCircleRoutes(
  app: FastifyInstance,
  db: Queryable,
  deps: AiCircleRouteDeps,
): Promise<void> {
  const { provider, config } = deps;

  app.get('/ai-circle/settings', async () => {
    return { ai_enabled: config.enabled, settings: await getSettings(db, DEMO_USER_ID) };
  });

  app.put('/ai-circle/settings', async (req) => {
    const body = bodyRecord(req);
    const patch: SettingsPatch = {
      analysis_consent: optionalBool(body, 'analysis_consent'),
      advice_consent: optionalBool(body, 'advice_consent'),
      availability_shared: optionalBool(body, 'availability_shared'),
      quiet_start_min: optionalQuietMinute(body, 'quiet_start_min'),
      quiet_end_min: optionalQuietMinute(body, 'quiet_end_min'),
    };
    return { ai_enabled: config.enabled, settings: await updateSettings(db, DEMO_USER_ID, patch) };
  });

  app.get('/ai-circle/closeness/:friendId', async (req) => {
    const friendId = friendIdParam(req);
    return getCloseness(db, DEMO_USER_ID, friendId, config.enabled);
  });

  app.post('/ai-circle/closeness/:friendId/assess', async (req, reply) => {
    if (!config.enabled) throw new ApiError(503, 'ai unavailable');
    const friendId = friendIdParam(req);
    const result = await requestAssessment(db, DEMO_USER_ID, friendId, config);
    // The in-process runner picks the job up; reads stay inference-free.
    void processPendingJobs(db, provider, config).catch(() => undefined);
    return reply.status(202).send(result);
  });

  app.put('/ai-circle/closeness/:friendId', async (req) => {
    const friendId = friendIdParam(req);
    const body = bodyRecord(req);
    const level = body['level'];
    if (level === null) {
      await clearOverride(db, DEMO_USER_ID, friendId);
      return getCloseness(db, DEMO_USER_ID, friendId, config.enabled);
    }
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 5) {
      throw new ApiError(400, 'level must be an integer 1..5 or null');
    }
    await saveOverride(db, DEMO_USER_ID, friendId, level as ClosenessLevel);
    return getCloseness(db, DEMO_USER_ID, friendId, config.enabled);
  });

  app.get('/ai-circle/opportunities', async (req) => {
    const query = req.query as { radius_m?: unknown };
    const radiusM = parseRadiusM(query.radius_m, DEFAULT_RADIUS_M);
    const candidates = await getOpportunities(db, DEMO_USER_ID, radiusM, { routing: deps.routing });
    return { ai_enabled: config.enabled, radius_m: radiusM, candidates };
  });

  app.post('/ai-circle/opportunities/:friendId/advise', async (req) => {
    const friendId = friendIdParam(req);
    const body = req.body === undefined || req.body === null ? {} : bodyRecord(req);
    const radiusM =
      body['radius_m'] === undefined
        ? DEFAULT_RADIUS_M
        : parseRadiusM(body['radius_m'], DEFAULT_RADIUS_M);
    const displayName = typeof body['display_name'] === 'string' ? body['display_name'] : friendId;
    return requestAdvice(db, provider, deps.routing, DEMO_USER_ID, friendId, radiusM, displayName, config);
  });

  app.post('/ai-circle/feedback', async (req) => {
    const body = bodyRecord(req);
    const friendId = body['friend_id'];
    if (typeof friendId !== 'string' || friendId.trim() === '') {
      throw new ApiError(400, 'friend_id is required');
    }
    const kind = body['kind'];
    if (kind !== 'dismiss' && kind !== 'snooze' && kind !== 'declined') {
      throw new ApiError(400, 'kind must be dismiss, snooze, or declined');
    }
    const minutes = body['snooze_minutes'];
    if (minutes !== undefined && (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < 1 || minutes > 10080)) {
      throw new ApiError(400, 'snooze_minutes must be an integer 1..10080');
    }
    return recordFeedback(db, DEMO_USER_ID, friendId, kind, minutes ?? null);
  });

  app.get('/ai-circle/usage', async () => {
    return { ai_enabled: config.enabled, usage: await getUsage(db, DEMO_USER_ID) };
  });

  // Demo-scoped synthetic event injection. Only exists in demo mode; returns
  // 404 otherwise so production-like deployments have no such surface.
  app.post('/ai-circle/demo/signal-event', async (req) => {
    if (!config.demoMode || !config.enabled) {
      throw new ApiError(404, 'not found');
    }
    const body = bodyRecord(req);
    const friendId = body['friend_id'];
    if (typeof friendId !== 'string' || friendId.trim() === '') {
      throw new ApiError(400, 'friend_id is required');
    }
    const type = body['type'];
    if (typeof type !== 'string' || !SIGNAL_EVENTS.includes(type as SignalEventType)) {
      throw new ApiError(400, `type must be one of ${SIGNAL_EVENTS.join(', ')}`);
    }
    const event: SignalEvent = {
      type: type as SignalEventType,
      declared_closeness: body['declared_closeness'],
      declared_activities: body['declared_activities'],
    };
    const result = await recordSignalEvent(db, DEMO_USER_ID, friendId, event, config.cooldownDays);
    if (result.queued) {
      void processPendingJobs(db, provider, config).catch(() => undefined);
    }
    return result;
  });

  // Demo-prep restore for the Coleen judge scenario: clears Coleen's snooze /
  // dismiss suppression plus her pair-window advice rows so Reconnect Today
  // and fresh recommendations work again for repeated demo takes. Gated on
  // the Coleen synthetic-context flag (not demoMode); 404 otherwise so
  // production-like deployments have no such surface. Coleen-only by
  // construction: the friend id is hardcoded, usage counters are untouched.
  app.post('/ai-circle/demo/coleen-restore', async () => {
    if (!config.demoAvailability || !config.enabled) {
      throw new ApiError(404, 'not found');
    }
    const cleared = await restoreColeenDemo(db, DEMO_USER_ID);
    return { restored: true, friend_id: COLEEN_DEMO_FRIEND_ID, ...cleared };
  });
}
