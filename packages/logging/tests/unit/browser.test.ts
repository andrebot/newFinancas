import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import {
  captureLogs, consoleSink, createLogger, isTestRun,
} from '../../src/browser';
import { REDACTED } from '../../src/redact';

// The browser logger (OQ-123). Mocked: only `console`, its one sink.

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('createLogger (browser)', () => {
  it('adds its context, a timestamp and the level to every event', () => {
    const capture = captureLogs();
    createLogger({ label: 'I18nUtility' }).warn('unknown code', { code: 'x.y' });
    capture.stop();

    expect(capture.events).toEqual([{
      level: 'warn',
      message: 'unknown code',
      label: 'I18nUtility',
      code: 'x.y',
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    }]);
  });

  it('logs at error, warn and info, and drops debug (below the browser threshold)', () => {
    const capture = captureLogs();
    const log = createLogger();
    log.error('e');
    log.warn('w');
    log.info('i');
    log.debug('d');
    capture.stop();

    expect(capture.events.map((event) => event.level)).toEqual(['error', 'warn', 'info']);
  });

  it('redacts sensitive details and keeps its context over clashing details', () => {
    const capture = captureLogs();
    createLogger({ label: 'Mine' }).info('m', { password: 'p', label: 'theirs' });
    capture.stop();

    expect(capture.events[0]).toMatchObject({ password: REDACTED, label: 'Mine' });
  });

  it('stops recording once the capture stops', () => {
    const capture = captureLogs();
    capture.stop();
    createLogger().error('after');

    expect(capture.events).toEqual([]);
  });

  it('writes nothing under Vitest', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fresh = await import('../../src/browser');
    fresh.createLogger().error('quiet');

    expect(error).not.toHaveBeenCalled();
  });

  it('writes to the console outside Vitest', async () => {
    vi.stubEnv('VITEST', '');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fresh = await import('../../src/browser');
    fresh.createLogger({ label: 'L' }).error('loud');

    expect(error).toHaveBeenCalledWith('[L] loud', expect.objectContaining({ message: 'loud' }));
  });
});

describe('consoleSink', () => {
  it('writes at the console method of the level, prefixed with the label', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const event = {
      level: 'info', message: 'hello', label: 'L', timestamp: 't',
    } as const;
    consoleSink(event);

    expect(info).toHaveBeenCalledWith('[L] hello', event);
  });

  it('writes the bare message when there is no label', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const event = { level: 'warn', message: 'hello', timestamp: 't' } as const;
    consoleSink(event);

    expect(warn).toHaveBeenCalledWith('hello', event);
  });
});

describe('isTestRun', () => {
  it('is true only when process.env.VITEST is set', () => {
    expect(isTestRun({ process: { env: { VITEST: 'true' } } })).toBe(true);
    expect(isTestRun({ process: { env: {} } })).toBe(false);
    expect(isTestRun({ process: {} })).toBe(false);
    expect(isTestRun({})).toBe(false);
  });
});
