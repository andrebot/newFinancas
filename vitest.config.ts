import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/*/vitest.config.ts', 'packages/*/vitest.config.ts'],
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**', 'packages/*/src/**'],
      // Composition roots only wire things together; the E2E smoke covers them.
      exclude: [
        'apps/api/src/server.ts',
        'apps/web/src/main.tsx',
        // Generated from openapi.yaml (N7): no hand-written logic to cover.
        'packages/api-types/src/**',
      ],
      // BDT coverage gate: 100% on every tier Vitest runs (unit + integration).
      thresholds: {
        statements: 100, branches: 100, functions: 100, lines: 100,
      },
    },
  },
});
