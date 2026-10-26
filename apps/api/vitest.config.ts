import { defineConfig } from 'vitest/config';

// Default unit suite. Live-database integration tests live in
// test/integration/ and run only via `npm run test:integration`.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'test/integration/**'],
  },
});
