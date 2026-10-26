import type { FastifyInstance } from 'fastify';
import type { Queryable } from '../db.js';
import { DEMO_NOTICE } from '../demoData.js';
import { parseRadiusM, type LatLon } from '../geo.js';
import {
  DEFAULT_RADIUS_M,
  DEMO_USER_ID,
  findNearbyFriends,
  type NearbyFriend,
} from '../services/proximity.js';

export interface NearbyResponse {
  demo: true;
  notice: string;
  center: LatLon;
  radius_m: number;
  count: number;
  friends: NearbyFriend[];
}

export async function nearbyRoutes(app: FastifyInstance, db: Queryable): Promise<void> {
  app.get('/friends/nearby', async (req): Promise<NearbyResponse> => {
    const query = req.query as { radius_m?: unknown };
    const radiusM = parseRadiusM(query.radius_m, DEFAULT_RADIUS_M);
    const result = await findNearbyFriends(db, DEMO_USER_ID, radiusM);
    return {
      demo: true,
      notice: DEMO_NOTICE,
      center: result.center,
      radius_m: radiusM,
      count: result.friends.length,
      friends: result.friends,
    };
  });
}
