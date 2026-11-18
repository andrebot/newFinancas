import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// E2E reads the same root .env as the apps (CI creates it from .env.example).
try {
  process.loadEnvFile('.env');
} catch {
  // No .env: rely on the real environment.
}

// The API's calendar (apps/api config `calendar.timeZone`): the runner and the
// browser take "today" and each month from it, as the API does — on a UTC
// runner, a journey run near midnight would otherwise land a day apart.
const TIME_ZONE = 'America/Sao_Paulo';
process.env.TZ = TIME_ZONE;

// The API under test, and the `pnpm investments:run` a journey starts, log to
// a folder of their own: on start the API restores into its database the
// audit entries its log files hold (OQ-110), so sharing the dev API's files
// would send the test database's entries to the dev one, which refuses them.
process.env.LOG_DIR = path.resolve('.e2e-logs');

const API_URL = 'http://localhost:3000';
const WEB_URL = 'http://localhost:5173';

// `E2E_TARGET=production` (N10 S1, OQ-250) runs the suite against the deployed
// shape: the built web app served by the API on one origin, with the security
// headers and CSP on (tests/e2e/support/test.ts fails a journey on any CSP
// violation). It always starts its own server, so it can never quietly test a
// dev API that serves no build.
const PRODUCTION = process.env.E2E_TARGET === 'production';
const WEB_DIST_DIR = path.resolve('apps/web/dist');

// The API under test uses the test database, never the dev one. Its daily
// timer is off: only a journey runs investmentsDaily, as of the day it picks
// (OQ-237) — the timer would run it on the real date mid-suite.
const API_ENV = {
  DATABASE_URL: process.env.DATABASE_TEST_URL ?? '',
  INVESTMENTS_DAILY_TIMER: 'off',
};

// Opt-in: run against a locally installed Chromium (e.g. /usr/bin/chromium)
// when Playwright's own browser download is unavailable.
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  // A stray test.only must fail CI, not quietly shrink it to one test.
  forbidOnly: Boolean(process.env.CI),
  // No retries: a flaky journey should show, not be retried away (it found a real bug once).
  retries: 0,
  // Authenticator codes work once (OQ-163): a journey that signs the same user
  // in again may wait up to one 30-second step for a fresh code.
  timeout: 60_000,
  use: {
    baseURL: PRODUCTION ? API_URL : WEB_URL,
    // Something to replay when a journey fails (uploaded by CI with the report).
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Journeys find elements by their en-US catalog text (tests/e2e/support/text.ts).
    locale: 'en-US',
    timezoneId: TIME_ZONE,
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: PRODUCTION
    ? [{
      command: 'pnpm --filter @financas/web build && pnpm --filter @financas/api start',
      url: `${API_URL}/health`,
      env: { ...API_ENV, WEB_DIST_DIR },
      reuseExistingServer: false,
      timeout: 180_000,
    }]
    : [
      {
        command: 'pnpm --filter @financas/api start',
        url: `${API_URL}/health`,
        env: API_ENV,
        reuseExistingServer: true,
      },
      { command: 'pnpm --filter @financas/web dev', url: WEB_URL, reuseExistingServer: true },
    ],
});
