import Fastify, { type FastifyInstance } from 'fastify';
import { closePool, getPool, type Queryable } from './db.js';
import { ApiError } from './errors.js';
import { healthRoutes } from './routes/health.js';
import { demoRoutes } from './routes/demo.js';
import { nearbyRoutes } from './routes/nearby.js';
import { visibilityRoutes } from './routes/visibility.js';
import { locationRoutes } from './routes/location.js';
import { friendsRoutes } from './routes/friends.js';

export interface AppOptions {
  // Injected query backend for tests; defaults to the shared pg pool.
  db?: Queryable;
}

function errorStatus(err: unknown): number {
  if (typeof err === 'object' && err !== null && 'statusCode' in err) {
    const status = (err as { statusCode?: unknown }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 600) return status;
  }
  return 500;
}

function errorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message !== '') return message;
  }
  return 'bad request';
}

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const db = opts.db ?? getPool();

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      return reply.status(err.statusCode).send({ error: err.message });
    }
    const status = errorStatus(err);
    const message = status === 500 ? 'internal error' : errorMessage(err);
    return reply.status(status).send({ error: message });
  });

  await app.register(healthRoutes);
  await app.register(demoRoutes);
  await app.register(async (instance) => nearbyRoutes(instance, db));
  await app.register(async (instance) => visibilityRoutes(instance, db));
  await app.register(async (instance) => locationRoutes(instance, db));
  await app.register(async (instance) => friendsRoutes(instance, db));

  if (opts.db === undefined) {
    app.addHook('onClose', async () => {
      await closePool();
    });
  }
  return app;
}
