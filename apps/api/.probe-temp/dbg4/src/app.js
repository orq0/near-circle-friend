import Fastify from 'fastify';
import { closePool, getPool } from './db.js';
import { ApiError } from './errors.js';
import { healthRoutes } from './routes/health.js';
import { demoRoutes } from './routes/demo.js';
import { nearbyRoutes } from './routes/nearby.js';
import { visibilityRoutes } from './routes/visibility.js';
import { locationRoutes } from './routes/location.js';
import { friendsRoutes } from './routes/friends.js';
import { routeRoutes } from './routes/route.js';
import { createOsrmProvider } from './routing/osrmProvider.js';
import { aiCircleRoutes } from './routes/aiCircle.js';
import { createMetaModelProvider } from './ai/metaModelProvider.js';
import { readAiCircleConfig } from './ai/types.js';
function errorStatus(err) {
    if (typeof err === 'object' && err !== null && 'statusCode' in err) {
        const status = err.statusCode;
        if (typeof status === 'number' && status >= 400 && status < 600)
            return status;
    }
    return 500;
}
function errorMessage(err) {
    if (typeof err === 'object' && err !== null && 'message' in err) {
        const message = err.message;
        if (typeof message === 'string' && message !== '')
            return message;
    }
    return 'bad request';
}
export async function buildApp(opts = {}) {
    const app = Fastify({ logger: false });
    const db = opts.db ?? getPool();
    const routing = opts.routing ??
        createOsrmProvider({
            baseUrl: process.env['ROUTING_WALK_URL'] ?? 'http://near-circle-routing-walk:5000',
        });
    const aiConfig = opts.ai?.config ?? readAiCircleConfig();
    const aiProvider = opts.ai?.provider ?? createMetaModelProvider({ config: aiConfig });
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
    await app.register(async (instance) => routeRoutes(instance, db, routing));
    await app.register(async (instance) => aiCircleRoutes(instance, db, { routing, provider: aiProvider, config: aiConfig }));
    if (opts.db === undefined) {
        app.addHook('onClose', async () => {
            await closePool();
        });
    }
    return app;
}
