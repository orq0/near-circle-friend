import Fastify, { type FastifyInstance } from 'fastify';
import { healthRoutes } from './routes/health.js';
import { demoRoutes } from './routes/demo.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(healthRoutes);
  await app.register(demoRoutes);
  return app;
}
