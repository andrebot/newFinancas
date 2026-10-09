import { describe, expect, it } from 'vitest';
import loadConfig from '../../../src/config/loadConfig';

const DATABASE_URL = 'postgres://financas_app:secret@localhost:5432/financas';
const JWT_SECRET = 'j'.repeat(32);
const MFA_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
const SECRETS = { JWT_SECRET, MFA_ENCRYPTION_KEY };
const SHORT_KEY = Buffer.alloc(31).toString('base64');

describe('loadConfig', () => {
  it('maps a complete environment to the typed config', () => {
    const config = loadConfig({
      PORT: '4000', DATABASE_URL, EMAIL_PROVIDER: 'console', ...SECRETS,
    });

    expect(config).toEqual({
      port: 4000,
      databaseUrl: DATABASE_URL,
      emailProvider: 'console',
      jwtSecret: JWT_SECRET,
      mfaEncryptionKey: MFA_ENCRYPTION_KEY,
    });
  });

  it('defaults PORT to 3000 and EMAIL_PROVIDER to console', () => {
    const config = loadConfig({ DATABASE_URL, ...SECRETS });

    expect(config.port).toBe(3000);
    expect(config.emailProvider).toBe('console');
  });

  it('accepts the postgresql:// scheme', () => {
    const url = 'postgresql://u:p@localhost/financas';

    expect(loadConfig({ DATABASE_URL: url, ...SECRETS }).databaseUrl).toBe(url);
  });

  it('does not expose variables the API must not use', () => {
    const config = loadConfig({
      DATABASE_URL, DATABASE_MIGRATION_URL: 'postgres://owner@x/db', ...SECRETS,
    });

    expect(Object.keys(config).sort())
      .toEqual(['databaseUrl', 'emailProvider', 'jwtSecret', 'mfaEncryptionKey', 'port']);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it.each([
    ['a non-postgres URL', 'mysql://u:p@localhost/db'],
    ['a non-URL value', 'not a url'],
  ])('rejects %s as DATABASE_URL', (_case, value) => {
    expect(() => loadConfig({ DATABASE_URL: value, ...SECRETS })).toThrow(/DATABASE_URL/);
  });

  it.each(['0', '65536', '3.5', 'abc'])('rejects PORT=%s', (port) => {
    expect(() => loadConfig({ PORT: port, DATABASE_URL, ...SECRETS })).toThrow(/PORT/);
  });

  it('rejects an unknown EMAIL_PROVIDER', () => {
    expect(() => loadConfig({ DATABASE_URL, EMAIL_PROVIDER: 'smtp', ...SECRETS }))
      .toThrow(/EMAIL_PROVIDER/);
  });

  it.each([
    ['a short JWT_SECRET', { JWT_SECRET: 'short' }, /JWT_SECRET/],
    ['a 31-byte key', { MFA_ENCRYPTION_KEY: SHORT_KEY }, /MFA_ENCRYPTION_KEY/],
    ['a non-base64 key', { MFA_ENCRYPTION_KEY: 'not base64!' }, /MFA_ENCRYPTION_KEY/],
  ])('rejects %s', (_case, override, message) => {
    expect(() => loadConfig({ DATABASE_URL, ...SECRETS, ...override })).toThrow(message);
  });

  it('reports every invalid variable at once', () => {
    expect(() => loadConfig({ PORT: 'abc', EMAIL_PROVIDER: 'smtp' }))
      .toThrow(/PORT[\s\S]*DATABASE_URL[\s\S]*EMAIL_PROVIDER/);
  });
});
