import {
  mkdir, mkdtemp, rm, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  afterAll, beforeAll, describe, expect, it, vi,
} from 'vitest';
import { mutableLists } from '../../src/http/securityHeaders';
import { appWithMocks } from '../support/app';

// Security headers (N10 S1, OQ-250) through the real app: every response, the
// web app's and the API's, successes and errors alike, carries them.

const CSP = "default-src 'self'; img-src 'self' data:; font-src 'self' data:; object-src 'none'; "
  + "base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const EXPECTED = {
  'content-security-policy': CSP,
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'cross-origin-opener-policy': 'same-origin',
};
let distDir = '';

beforeAll(async () => {
  distDir = await mkdtemp(path.join(tmpdir(), 'financas-headers-'));
  await mkdir(path.join(distDir, 'assets'));
  await writeFile(path.join(distDir, 'index.html'), '<!doctype html>');
  await writeFile(path.join(distDir, 'assets', 'app-1.js'), '');
});

afterAll(async () => {
  await rm(distDir, { recursive: true, force: true });
});

/**
 * Reads the security headers a response carries.
 *
 * @param response - Any response.
 * @returns Header name → value, for the headers under test.
 */
const headersOf = (response: Response): Record<string, string | null> => Object.fromEntries(
  Object.keys(EXPECTED).map((name) => [name, response.headers.get(name)]),
);

describe('security headers on every response (OQ-250)', () => {
  it.each([
    ['a page of the web app', '/transactions', undefined, 200],
    ['a hashed asset', '/assets/app-1.js', undefined, 200],
    ['/health', '/health', undefined, 200],
    ['an API success', '/api/v1/users/me/sessions', 'good-token', 200],
    ['an API refusal (401)', '/api/v1/users/me', undefined, 401],
    ['an unknown API path (404)', '/api/v1/nothing-here', undefined, 404],
  ])('%s', async (_case, route, token, status) => {
    const verify = vi.fn(async (presented: string) => (presented === 'good-token'
      ? { userId: 'u', sessionId: 's', systemRole: 'USER' as const }
      : undefined));
    const { app, identity } = appWithMocks(verify, distDir);
    identity.listSessions.mockResolvedValue([]);

    const auth = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    const response = await app.request(route, auth);

    expect(response.status).toBe(status);
    expect(headersOf(response)).toEqual(EXPECTED);
    expect(response.headers.get('x-powered-by')).toBeNull();
  });

  it('sends no CSP-weakening source: no inline script or style, no eval', async () => {
    const response = await appWithMocks(undefined, distDir).app.request('/');

    expect(response.headers.get('content-security-policy')).not.toMatch(/unsafe-|\*/);
  });
});

describe('mutableLists', () => {
  it('copies each read-only list into a new array', () => {
    const lists = { defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:'] } as const;

    const copied = mutableLists(lists);

    expect(copied).toEqual({ defaultSrc: ["'self'"], imgSrc: ["'self'", 'data:'] });
    expect(copied.defaultSrc).not.toBe(lists.defaultSrc);
  });
});
