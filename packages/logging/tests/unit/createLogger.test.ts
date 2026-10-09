import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { describe, expect, it } from 'vitest';
import { buildTransports, createLogger, resolveLogDir } from '../../src/createLogger';

describe('resolveLogDir', () => {
  it('prefers LOG_DIR, then XDG_STATE_HOME, then ~/.local/state', () => {
    expect(resolveLogDir({ LOG_DIR: '/var/log/f' }, '/home/me')).toBe('/var/log/f');
    expect(resolveLogDir({ XDG_STATE_HOME: '/state' }, '/home/me')).toBe('/state/financas/logs');
    expect(resolveLogDir({}, '/home/me')).toBe('/home/me/.local/state/financas/logs');
  });
});

describe('buildTransports', () => {
  it('always has the console, plus a daily JSON file when a directory is given', async () => {
    const logDir = await mkdtemp(path.join(os.tmpdir(), 'financas-logging-'));
    const withFile = buildTransports({ level: 'info', logDir, filePrefix: 'api' });
    const consoleOnly = buildTransports({ level: 'info', logDir: undefined, filePrefix: 'api' });

    expect(withFile[0]).toBeInstanceOf(winston.transports.Console);
    expect(withFile[1]).toBeInstanceOf(DailyRotateFile);
    expect(consoleOnly).toHaveLength(1);
    withFile.forEach((transport) => transport.close?.());
    await rm(logDir, { recursive: true, force: true });
  });
});

describe('createLogger', () => {
  it('uses the requested level', () => {
    const logger = createLogger({ level: 'warn', logDir: undefined, filePrefix: 'test' });

    expect(logger.level).toBe('warn');
    logger.close();
  });
});
