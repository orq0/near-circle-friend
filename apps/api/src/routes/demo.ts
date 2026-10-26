import type { FastifyInstance } from 'fastify';
import { DEMO_FRIENDS, DEMO_NOTICE, type DemoFriend } from '../demoData.js';

export interface DemoFriendsResponse {
  demo: true;
  notice: string;
  friends: DemoFriend[];
}

export async function demoRoutes(app: FastifyInstance): Promise<void> {
  app.get('/demo/friends', async (): Promise<DemoFriendsResponse> => {
    return {
      demo: true,
      notice: DEMO_NOTICE,
      friends: DEMO_FRIENDS,
    };
  });
}
