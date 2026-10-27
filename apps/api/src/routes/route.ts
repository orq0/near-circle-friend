import type { FastifyInstance } from 'fastify';
import type { Queryable } from '../db.js';
import { DEMO_NOTICE } from '../demoData.js';
import { ApiError } from '../errors.js';
import { parseRadiusM } from '../geo.js';
import { defaultStrideM, parseStrideM } from '../routing/steps.js';
import { type WalkingRoutingProvider } from '../routing/types.js';
import {
  DEFAULT_RADIUS_M,
  DEMO_USER_ID,
  getFriendRoute,
  type FriendRoute,
} from '../services/proximity.js';

export interface FriendRouteResponse {
  demo: true;
  notice: string;
  radius_m: number;
  route: FriendRoute;
}

export async function routeRoutes(
  app: FastifyInstance,
  db: Queryable,
  provider: WalkingRoutingProvider,
): Promise<void> {
  app.get('/friends/:id/route', async (req): Promise<FriendRouteResponse> => {
    const params = req.params as { id?: unknown };
    const query = req.query as { radius_m?: unknown; stride_m?: unknown };
    if (typeof params.id !== 'string' || params.id.trim() === '') {
      throw new ApiError(400, 'friend id is required');
    }
    const radiusM = parseRadiusM(query.radius_m, DEFAULT_RADIUS_M);
    const strideM = parseStrideM(query.stride_m, defaultStrideM());
    const route = await getFriendRoute(db, provider, DEMO_USER_ID, params.id, radiusM, strideM);
    return { demo: true, notice: DEMO_NOTICE, radius_m: radiusM, route };
  });
}
