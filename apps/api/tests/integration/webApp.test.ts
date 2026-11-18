import {
  mkdir, mkdtemp, rm, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  afterAll, beforeAll, describe, expect, it,
} from 'vitest';
import { isWebAppRequest, requireWebBuild } from '../../src/http/webApp';
import { appWithMocks, errorOf } from '../support/app';

// The API serving the built web app (N10 S1, OQ-250), through the real app:
// files as they are, app routes as index.html, the API and /health untouched.

const INDEX_HTML = '<!doctype html><div id="root"></div>';
const SCRIPT = 'console.log("app")';
const IMMUTABLE = 'public, max-age=31536000, immutable';
let distDir = '';

beforeAll(async () => {
  distDir = await mkdtemp(path.join(tmpdir(), 'financas-web-'));
  await mkdir(path.join(distDir, 'assets'));
  await writeFile(path.join(distDir, 'index.html'), INDEX_HTML);
  await writeFile(path.join(distDir, 'assets', 'index-abc123.js'), SCRIPT);
  await writeFile(path.join(distDir, 'robots.txt'), 'User-agent: *');
});

afterAll(async () => {
  await rm(distDir, { recursive: true, force: true });
});

/**
 * Builds the app serving the temporary web build.
 *
 * @returns The app.
 */
const webApp = () => appWithMocks(undefined, distDir).app;

describe('isWebAppRequest', () => {
  it.each([
    ['GET', '/', true],
    ['HEAD', '/transactions', true],
    ['POST', '/transactions', false],
    ['GET', '/api/v1/users/me', false],
    ['GET', '/health', false],
  ])('%s %s → %s', (method, requestPath, expected) => {
    expect(isWebAppRequest(method, requestPath)).toBe(expected);
  });
});

describe('requireWebBuild', () => {
  it('resolves for a folder holding index.html', async () => {
    await expect(requireWebBuild(distDir)).resolves.toBeUndefined();
  });

  it('rejects a folder without one, naming the missing file', async () => {
    const missing = path.join(distDir, 'assets', 'index.html');

    await expect(requireWebBuild(path.join(distDir, 'assets')))
      .rejects.toThrow(`WEB_DIST_DIR holds no built web app: ${missing} is missing`);
  });
});

describe('the web app on the API origin (OQ-250)', () => {
  it('serves a hashed asset as immutable, with its content type', async () => {
    const response = await webApp().request('/assets/index-abc123.js');

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(SCRIPT);
    expect(response.headers.get('Content-Type')).toMatch(/javascript/);
    expect(response.headers.get('Cache-Control')).toBe(IMMUTABLE);
  });

  it.each(['/', '/reset-password', '/households/abc/transactions'])(
    'answers the app route %s with index.html, never cached',
    async (route) => {
      const response = await webApp().request(route);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe(INDEX_HTML);
      expect(response.headers.get('Content-Type')).toMatch(/text\/html/);
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
    },
  );

  it('serves another file at the root as is, never cached', async () => {
    const response = await webApp().request('/robots.txt');

    expect(await response.text()).toBe('User-agent: *');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
  });

  it('answers a missing asset with the JSON 404, not index.html', async () => {
    const response = await webApp().request('/assets/gone-999.js');

    expect(response.status).toBe(404);
    expect((await errorOf(response)).code).toBe('route.not_found');
  });

  it('never serves a file outside the build', async () => {
    const response = await webApp().request('/../../../etc/passwd');

    expect(await response.text()).not.toMatch(/root:/);
  });

  it('leaves the API alone: an unknown API path is still the JSON 404', async () => {
    const response = await webApp().request('/api/v1/nothing-here');

    expect(response.status).toBe(404);
    expect((await errorOf(response)).code).toBe('route.not_found');
  });

  it('leaves /health and non-GET requests alone', async () => {
    const health = await webApp().request('/health');
    const posted = await webApp().request('/transactions', { method: 'POST' });

    expect(await health.json()).toEqual({ status: 'ok' });
    expect(posted.status).toBe(404);
    expect((await errorOf(posted)).code).toBe('route.not_found');
  });

  it('serves nothing when no build is configured (development)', async () => {
    const response = await appWithMocks().app.request('/');

    expect(response.status).toBe(404);
    expect((await errorOf(response)).code).toBe('route.not_found');
  });
});
