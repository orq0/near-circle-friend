import type { FastifyInstance } from 'fastify';
import type { Queryable } from '../db.js';
import { parseLatLon } from '../geo.js';
import {
  DEMO_USER_ID,
  updateLocation,
  type LocationState,
} from '../services/proximity.js';

export async function locationRoutes(app: FastifyInstance, db: Queryable): Promise<void> {
  app.put('/location', async (req): Promise<LocationState> => {
    const point = parseLatLon(req.body);
    return updateLocation(db, DEMO_USER_ID, point);
  });
}
