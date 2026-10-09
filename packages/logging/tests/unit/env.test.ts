import { describe, expect, it } from 'vitest';
import { readLoggingEnv, resolveLogDir } from '../../src/env';
import { isLogLevel } from '../../src/levels';

describe('resolveLogDir', () => {
  it('prefers LOG_DIR, then XDG_STATE_HOME, then ~/.local/state', () => {
    expect(resolveLogDir({ LOG_DIR: '/var/log/f' }, '/home/me')).toBe('/var/log/f');
    expect(resolveLogDir({ XDG_STATE_HOME: '/state' }, '/home/me')).toBe('/state/financas/logs');
    expect(resolveLogDir({}, '/home/me')).toBe('/home/me/.local/state/financas/logs');
  });
});

describe('readLoggingEnv', () => {
  it('defaults to info, the XDG directory and the "financas" prefix', () => {
    expect(readLoggingEnv({}, '/home/me')).toEqual({
      level: 'info',
      logDir: '/home/me/.local/state/financas/logs',
      filePrefix: 'financas',
      testMode: false,
    });
  });

  it('reads LOG_LEVEL, LOG_FILE_PREFIX and test mode', () => {
    expect(readLoggingEnv({ LOG_LEVEL: 'audit', LOG_FILE_PREFIX: 'api', VITEST: 'true' }, '/h'))
      .toMatchObject({ level: 'audit', filePrefix: 'api', testMode: true });
  });

  it.each([
    [{ LOG_LEVEL: 'loud' }, /LOG_LEVEL/],
    [{ LOG_FILE_PREFIX: '../etc' }, /LOG_FILE_PREFIX/],
  ])('rejects %j', (env, message) => {
    expect(() => readLoggingEnv(env, '/h')).toThrow(message);
  });
});

describe('isLogLevel', () => {
  it.each([
    ['audit', true], ['debug', true], ['verbose', false], ['toString', false],
  ])('%s → %s', (value, ok) => {
    expect(isLogLevel(value)).toBe(ok);
  });
});
