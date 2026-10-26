import type { FastifyInstance } from 'fastify';
import type { Queryable } from '../db.js';
import { DEMO_NOTICE } from '../demoData.js';
import { ApiError } from '../errors.js';
import { parseRadiusM } from '../geo.js';
import {
  DEFAULT_RADIUS_M,
  DEMO_USER_ID,
  getFriendDetail,
  listFriends,
  type FriendDetail,
  type FriendSummary,
} from '../services/proximity.js';

export interface FriendsResponse {
  demo: true;
  notice: string;
  friends: FriendSummary[];
}

export interface FriendDetailResponse extends FriendDetail {
  demo: true;
  radius_m: number;
}

export async function friendsRoutes(app: FastifyInstance, db: Queryable): Promise<void> {
  app.get('/friends', async (): Promise<FriendsResponse> => {
    return { demo: true, notice: DEMO_NOTICE, friends: await listFriends(db, DEMO_USER_ID) };
  });

  app.get('/friends/:id', async (req): Promise<FriendDetailResponse> => {
    const params = req.params as { id?: unknown };
    const query = req.query as { radius_m?: unknown };
    if (typeof params.id !== 'string' || params.id.trim() === '') {
      throw new ApiError(400, 'friend id is required');
    }
    const radiusM = parseRadiusM(query.radius_m, DEFAULT_RADIUS_M);
    const detail = await getFriendDetail(db, DEMO_USER_ID, params.id, radiusM);
    return { demo: true, radius_m: radiusM, ...detail };
  });
}
