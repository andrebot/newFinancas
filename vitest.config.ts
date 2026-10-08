import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/*/vitest.config.ts', 'packages/*/vitest.config.ts'],
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**', 'packages/*/src/**'],
      // Composition roots only wire things together; the E2E smoke covers them.
      exclude: ['apps/api/src/server.ts', 'apps/web/src/main.tsx'],
    },
  },
});
