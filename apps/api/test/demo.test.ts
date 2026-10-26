import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('GET /demo/friends', () => {
  it('returns clearly labeled mock friends', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({ method: 'GET', url: '/demo/friends' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as {
        demo: boolean;
        notice: string;
        friends: Array<{ id: string; display_name: string; status: string }>;
      };
      expect(body.demo).toBe(true);
      expect(body.notice).toMatch(/simulated/i);
      expect(body.friends.map((f) => f.id)).toEqual(['coleen', 'alex', 'sam']);
      expect(body.friends[0]?.display_name).toBe('Coleen');
    } finally {
      await app.close();
    }
  });
});
