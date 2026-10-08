import { describe, expect, it } from 'vitest';
import loadConfig from '../../../src/config/loadConfig';

const DATABASE_URL = 'postgres://financas_app:secret@localhost:5432/financas';

describe('loadConfig', () => {
  it('maps a complete environment to the typed config', () => {
    const config = loadConfig({ PORT: '4000', DATABASE_URL, EMAIL_PROVIDER: 'console' });

    expect(config).toEqual({ port: 4000, databaseUrl: DATABASE_URL, emailProvider: 'console' });
  });

  it('defaults PORT to 3000 and EMAIL_PROVIDER to console', () => {
    const config = loadConfig({ DATABASE_URL });

    expect(config.port).toBe(3000);
    expect(config.emailProvider).toBe('console');
  });

  it('accepts the postgresql:// scheme', () => {
    const url = 'postgresql://u:p@localhost/financas';

    expect(loadConfig({ DATABASE_URL: url }).databaseUrl).toBe(url);
  });

  it('does not expose variables the API must not use', () => {
    const config = loadConfig({ DATABASE_URL, DATABASE_MIGRATION_URL: 'postgres://owner@x/db' });

    expect(Object.keys(config).sort()).toEqual(['databaseUrl', 'emailProvider', 'port']);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it.each([
    ['a non-postgres URL', 'mysql://u:p@localhost/db'],
    ['a non-URL value', 'not a url'],
  ])('rejects %s as DATABASE_URL', (_case, value) => {
    expect(() => loadConfig({ DATABASE_URL: value })).toThrow(/DATABASE_URL/);
  });

  it.each(['0', '65536', '3.5', 'abc'])('rejects PORT=%s', (port) => {
    expect(() => loadConfig({ PORT: port, DATABASE_URL })).toThrow(/PORT/);
  });

  it('rejects an unknown EMAIL_PROVIDER', () => {
    expect(() => loadConfig({ DATABASE_URL, EMAIL_PROVIDER: 'smtp' })).toThrow(/EMAIL_PROVIDER/);
  });

  it('reports every invalid variable at once', () => {
    expect(() => loadConfig({ PORT: 'abc', EMAIL_PROVIDER: 'smtp' }))
      .toThrow(/PORT[\s\S]*DATABASE_URL[\s\S]*EMAIL_PROVIDER/);
  });
});
