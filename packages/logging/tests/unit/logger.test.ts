import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import {
  buildTransports, captureLogs, createLogger, logger,
} from '../../src/logger';
import loggingSettings from '../../src/settings';

describe('the logger', () => {
  it('is silent under Vitest until a test captures it, and again once it finishes', () => {
    expect(logger.silent).toBe(true);
    let stop = (): void => {};

    const logs = captureLogs((cleanUp) => {
      stop = cleanUp;
    });
    expect(logger.silent).toBe(false);
    createLogger({ label: 'x' }).info('during');
    stop();
    createLogger({ label: 'x' }).info('after');

    expect(logger.silent).toBe(true);
    expect(logs.events.map((event) => event.message)).toEqual(['during']);
  });

  it('adds a child logger\'s context to every event (financas\' createLogger)', () => {
    const logs = captureLogs(onTestFinished);

    const context = { label: 'IdentityManager', correlationId: 'c1', actor: 'user:u1' };
    createLogger(context).info('Login', { deviceInfo: 'Firefox' });

    expect(logs.events).toEqual([expect.objectContaining({
      ...context, level: 'info', message: 'Login', deviceInfo: 'Firefox',
    })]);
  });

  it('has an audit level that stamps the entry with an id and time', () => {
    const logs = captureLogs(onTestFinished);

    createLogger({ actor: 'user:u1' })
      .audit('CreateBudget', { entityType: 'Budget', entityId: 'b1', householdId: 'h1' });

    const [event] = logs.events;
    expect(event).toMatchObject({ level: 'audit', message: 'CreateBudget', entityType: 'Budget' });
    expect(event?.auditId).toMatch(/^[0-9a-f-]{36}$/);
    expect(event?.auditAt).toBe(event?.timestamp);
  });

  it('redacts credentials before any transport sees them', () => {
    const logs = captureLogs(onTestFinished);

    createLogger({ label: 'x' }).info('Login', { password: 'hunter2' });

    expect(logs.events[0]?.password).toBe('[redacted]');
  });
});

// The two tests below run in order: the first throws after capturing, the
// second checks the capture still ended with it (OQ-199).
describe('a capture whose test throws', () => {
  it.fails('throws while capturing', () => {
    captureLogs(onTestFinished);
    expect(logger.silent).toBe(false);
    throw new Error('the awaited call failed');
  });

  it('has been stopped by the runner all the same', () => {
    expect(logger.silent).toBe(true);
  });
});

describe('buildTransports', () => {
  it('has the console and a daily JSON file, and nothing in test mode', async () => {
    const logDir = await mkdtemp(path.join(os.tmpdir(), 'financas-logging-'));
    const settings = {
      level: 'info', logDir, filePrefix: 'api', testMode: false,
    } as const;

    const transports = buildTransports(settings);

    expect(transports[0]).toBeInstanceOf(winston.transports.Console);
    expect(transports[1]).toBeInstanceOf(DailyRotateFile);
    // Reconcile finds the daily files by this name; retention keeps them that long.
    expect((transports[1] as unknown as { options: Record<string, unknown> }).options)
      .toMatchObject({
        dirname: logDir,
        filename: 'api-%DATE%.log',
        maxFiles: `${loggingSettings.retentionDays}d`,
      });
    const line = transports[0]?.format?.transform({ level: 'warn', message: 'hi', label: 'x' });
    expect((line as Record<symbol, unknown>)[Symbol.for('message')])
      .toBe(' WARN  [--------] - x: hi');
    expect(buildTransports({ ...settings, testMode: true })).toEqual([]);
    transports.forEach((transport) => transport.close?.());
    await rm(logDir, { recursive: true, force: true });
  });

  it('keeps console-only events (live secrets) out of the file, not the console', async () => {
    const logDir = await mkdtemp(path.join(os.tmpdir(), 'financas-logging-'));
    const [consoleTransport, file] = buildTransports({
      level: 'info', logDir, filePrefix: 'api', testMode: false,
    }) as [winston.transport, winston.transport];
    const secret = { level: 'info', message: 'Email', consoleOnly: true };
    const line = consoleTransport.format!.transform({ ...secret }) as Record<symbol, unknown>;

    expect(file.format!.transform({ ...secret })).toBe(false);
    expect(file.format!.transform({ level: 'info', message: 'kept' })).toBeTruthy();
    expect(line[Symbol.for('message')]).toBe(' INFO  [--------] - Email');
    [consoleTransport, file].forEach((transport) => transport.close?.());
    await rm(logDir, { recursive: true, force: true });
  });
});
