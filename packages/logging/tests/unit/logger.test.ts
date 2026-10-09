import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { describe, expect, it } from 'vitest';
import {
  buildTransports, captureLogs, createLogger, logger,
} from '../../src/logger';

describe('the logger', () => {
  it('is silent under Vitest until a test captures it', () => {
    expect(logger.silent).toBe(true);

    const logs = captureLogs();
    expect(logger.silent).toBe(false);
    logs.stop();

    expect(logger.silent).toBe(true);
  });

  it('adds a child logger\'s context to every event (financas\' createLogger)', () => {
    const logs = captureLogs();

    const context = { label: 'IdentityManager', correlationId: 'c1', actor: 'user:u1' };
    createLogger(context).info('Login', { deviceInfo: 'Firefox' });
    logs.stop();

    expect(logs.events).toEqual([expect.objectContaining({
      ...context, level: 'info', message: 'Login', deviceInfo: 'Firefox',
    })]);
  });

  it('has an audit level that stamps the entry with an id and time', () => {
    const logs = captureLogs();

    createLogger({ actor: 'user:u1' })
      .audit('CreateBudget', { entityType: 'Budget', entityId: 'b1', householdId: 'h1' });
    logs.stop();

    const [event] = logs.events;
    expect(event).toMatchObject({ level: 'audit', message: 'CreateBudget', entityType: 'Budget' });
    expect(event?.auditId).toMatch(/^[0-9a-f-]{36}$/);
    expect(event?.auditAt).toBe(event?.timestamp);
  });

  it('redacts credentials before any transport sees them', () => {
    const logs = captureLogs();

    createLogger({ label: 'x' }).info('Login', { password: 'hunter2' });
    logs.stop();

    expect(logs.events[0]?.password).toBe('[redacted]');
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
