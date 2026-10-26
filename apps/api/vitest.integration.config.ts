import { defineConfig } from 'vitest/config';

// Live-database suite: requires a seeded stack plus RUN_INTEGRATION_TESTS=1.
// Never runs as part of the default `npm test`.
export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 30000,
  },
});
