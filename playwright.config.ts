import { defineConfig, devices } from '@playwright/test';

// E2E reads the same root .env as the apps (CI creates it from .env.example).
try {
  process.loadEnvFile('.env');
} catch {
  // No .env: rely on the real environment.
}

const API_URL = 'http://localhost:3000';
const WEB_URL = 'http://localhost:5173';

// Opt-in: run against a locally installed Chromium (e.g. /usr/bin/chromium)
// when Playwright's own browser download is unavailable.
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: WEB_URL,
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @financas/api start',
      url: `${API_URL}/health`,
      // The API under test uses the test database, never the dev one.
      env: { DATABASE_URL: process.env.DATABASE_TEST_URL ?? '' },
      reuseExistingServer: true,
    },
    { command: 'pnpm --filter @financas/web dev', url: WEB_URL, reuseExistingServer: true },
  ],
});
