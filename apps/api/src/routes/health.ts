import type { FastifyInstance } from 'fastify';

export interface HealthResponse {
  status: 'ok';
  service: 'near-circle-api';
  version: string;
  phase: 1;
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (): Promise<HealthResponse> => {
    return {
      status: 'ok',
      service: 'near-circle-api',
      version: '0.1.0',
      phase: 1,
    };
  });
}
