import { defineConfig, devices } from '@playwright/test';

const API_URL = 'http://localhost:3000';
const WEB_URL = 'http://localhost:5173';

// Opt-in: run against a locally installed Chromium (e.g. /usr/bin/chromium)
// when Playwright's own browser download is unavailable.
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: WEB_URL,
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @financas/api start',
      url: `${API_URL}/health`,
      reuseExistingServer: true,
    },
    { command: 'pnpm --filter @financas/web dev', url: WEB_URL, reuseExistingServer: true },
  ],
});
