import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Phase 1: /api proxies to the Fastify API so the web app needs no CORS setup.
// Native `npm run dev:web` hits the host API at localhost:3001. Inside the
// Compose network, `localhost` is the web container itself, so the Compose
// web service overrides VITE_API_PROXY_TARGET with the in-network address
// (http://near-circle-api:3001).
const apiProxyTarget = process.env['VITE_API_PROXY_TARGET'] ?? 'http://localhost:3001';
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
