import { describe, expect, it } from 'vitest';
import loadEnv from '../../../src/config/env';

const DATABASE_URL = 'postgres://financas_app:secret@localhost:5432/financas';
const JWT_SECRET = 'j'.repeat(32);
const MFA_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
const SECRETS = { JWT_SECRET, MFA_ENCRYPTION_KEY };
const SHORT_KEY = Buffer.alloc(31).toString('base64');

describe('loadEnv', () => {
  it('maps a complete environment to the typed config', () => {
    const config = loadEnv({
      PORT: '4000',
      DATABASE_URL,
      EMAIL_PROVIDER: 'console',
      WEB_APP_URL: 'https://financas.example.com/',
      INVESTMENTS_DAILY_TIMER: 'off',
      ...SECRETS,
    });

    expect(config).toEqual({
      port: 4000,
      databaseUrl: DATABASE_URL,
      email: { provider: 'console' },
      webAppUrl: 'https://financas.example.com',
      investmentsDailyTimer: false,
      jwtSecret: JWT_SECRET,
      mfaEncryptionKey: MFA_ENCRYPTION_KEY,
      webDistDir: undefined,
    });
  });

  it('takes an absolute WEB_DIST_DIR, and rejects a relative one (OQ-250)', () => {
    expect(loadEnv({ DATABASE_URL, WEB_DIST_DIR: '/srv/web', ...SECRETS }).webDistDir)
      .toBe('/srv/web');
    expect(() => loadEnv({ DATABASE_URL, WEB_DIST_DIR: 'apps/web/dist', ...SECRETS }))
      .toThrow(/absolute path[\s\S]*WEB_DIST_DIR/);
  });

  it('defaults PORT, EMAIL_PROVIDER, WEB_APP_URL and turns the daily timer on', () => {
    const config = loadEnv({ DATABASE_URL, ...SECRETS });

    expect(config.investmentsDailyTimer).toBe(true);
    expect(config.port).toBe(3000);
    expect(config.email).toEqual({ provider: 'console' });
    expect(config.webAppUrl).toBe('http://localhost:5173');
  });

  it('accepts the postgresql:// scheme', () => {
    const url = 'postgresql://u:p@localhost/financas';

    expect(loadEnv({ DATABASE_URL: url, ...SECRETS }).databaseUrl).toBe(url);
  });

  it('does not expose variables the API must not use', () => {
    const config = loadEnv({
      DATABASE_URL, DATABASE_MIGRATION_URL: 'postgres://owner@x/db', ...SECRETS,
    });

    expect(Object.keys(config).sort())
      .toEqual([
        'databaseUrl', 'email', 'investmentsDailyTimer', 'jwtSecret', 'mfaEncryptionKey',
        'port', 'webAppUrl', 'webDistDir',
      ]);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it.each([
    ['a non-postgres URL', 'mysql://u:p@localhost/db'],
    ['a scheme ending in postgres', 'xpostgres://u:p@localhost/db'],
    ['a scheme starting with postgres', 'postgresx://u:p@localhost/db'],
    ['a non-URL value', 'not a url'],
  ])('rejects %s as DATABASE_URL', (_case, value) => {
    expect(() => loadEnv({ DATABASE_URL: value, ...SECRETS })).toThrow(/DATABASE_URL/);
  });

  it.each(['0', '65536', '3.5', 'abc'])('rejects PORT=%s', (port) => {
    expect(() => loadEnv({ PORT: port, DATABASE_URL, ...SECRETS })).toThrow(/PORT/);
  });

  it.each([
    ['plain http', 'http://web.local:8080', 'http://web.local:8080'],
    ['trailing slashes, all removed', 'https://example.com///', 'https://example.com'],
  ])('accepts WEB_APP_URL with %s', (_case, url, expected) => {
    expect(loadEnv({ DATABASE_URL, WEB_APP_URL: url, ...SECRETS }).webAppUrl).toBe(expected);
  });

  it.each([
    'not a url', 'ftp://example.com', 'xhttps://example.com', 'httpsx://example.com',
  ])('rejects WEB_APP_URL=%s', (url) => {
    expect(() => loadEnv({ DATABASE_URL, WEB_APP_URL: url, ...SECRETS })).toThrow(/WEB_APP_URL/);
  });

  it('rejects an unknown EMAIL_PROVIDER', () => {
    expect(() => loadEnv({ DATABASE_URL, EMAIL_PROVIDER: 'smtp', ...SECRETS }))
      .toThrow(/EMAIL_PROVIDER/);
  });

  it('takes the outbox provider with its absolute folder (OQ-260)', () => {
    const config = loadEnv({
      DATABASE_URL, EMAIL_PROVIDER: 'outbox', EMAIL_OUTBOX_DIR: '/tmp/outbox', ...SECRETS,
    });

    expect(config.email).toEqual({ provider: 'outbox', outboxDir: '/tmp/outbox' });
  });

  it.each([
    ['without a folder', {}, /EMAIL_OUTBOX_DIR/],
    ['with a relative folder', { EMAIL_OUTBOX_DIR: '.e2e-mail' },
      /absolute path[\s\S]*EMAIL_OUTBOX_DIR/],
    ['in production', { EMAIL_OUTBOX_DIR: '/tmp/outbox', NODE_ENV: 'production' },
      /never production[\s\S]*EMAIL_PROVIDER/],
  ])('rejects the outbox provider %s', (_case, override, message) => {
    expect(() => loadEnv({
      DATABASE_URL, EMAIL_PROVIDER: 'outbox', ...SECRETS, ...override,
    })).toThrow(message);
  });

  it('keeps the console provider in production', () => {
    expect(loadEnv({ DATABASE_URL, NODE_ENV: 'production', ...SECRETS }).email)
      .toEqual({ provider: 'console' });
  });

  it('takes INVESTMENTS_DAILY_TIMER=on as on', () => {
    const config = loadEnv({ DATABASE_URL, INVESTMENTS_DAILY_TIMER: 'on', ...SECRETS });

    expect(config.investmentsDailyTimer).toBe(true);
  });

  it.each([
    ['an INVESTMENTS_DAILY_TIMER other than on/off', { INVESTMENTS_DAILY_TIMER: 'false' },
      /INVESTMENTS_DAILY_TIMER/],
    ['a short JWT_SECRET', { JWT_SECRET: 'short' }, /JWT_SECRET/],
    ['a 31-byte key', { MFA_ENCRYPTION_KEY: SHORT_KEY }, /MFA_ENCRYPTION_KEY/],
    ['a non-base64 key', { MFA_ENCRYPTION_KEY: 'not base64!' }, /MFA_ENCRYPTION_KEY/],
  ])('rejects %s', (_case, override, message) => {
    expect(() => loadEnv({ DATABASE_URL, ...SECRETS, ...override })).toThrow(message);
  });

  it('reports every invalid variable at once', () => {
    expect(() => loadEnv({ PORT: 'abc', EMAIL_PROVIDER: 'smtp' }))
      .toThrow(/PORT[\s\S]*DATABASE_URL[\s\S]*EMAIL_PROVIDER/);
  });
});
