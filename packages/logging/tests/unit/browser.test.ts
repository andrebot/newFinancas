import {
  afterEach, describe, expect, it, onTestFinished, vi,
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
    const capture = captureLogs(onTestFinished);
    createLogger({ label: 'I18nUtility' }).warn('unknown code', { code: 'x.y' });

    expect(capture.events).toEqual([{
      level: 'warn',
      message: 'unknown code',
      label: 'I18nUtility',
      code: 'x.y',
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    }]);
  });

  it('logs at error, warn and info, and drops debug (below the browser threshold)', () => {
    const capture = captureLogs(onTestFinished);
    const log = createLogger();
    log.error('e');
    log.warn('w');
    log.info('i');
    log.debug('d');

    expect(capture.events.map((event) => event.level)).toEqual(['error', 'warn', 'info']);
  });

  it('redacts sensitive details and keeps its context over clashing details', () => {
    const capture = captureLogs(onTestFinished);
    createLogger({ label: 'Mine' }).info('m', { password: 'p', label: 'theirs' });

    expect(capture.events[0]).toMatchObject({ password: REDACTED, label: 'Mine' });
  });

  it('stops recording once its test finishes, through the hook it is given', () => {
    let stop = (): void => {};
    const capture = captureLogs((cleanUp) => {
      stop = cleanUp;
    });
    createLogger().error('during');
    stop();
    createLogger().error('after');

    expect(capture.events.map((event) => event.message)).toEqual(['during']);
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

// The two tests below run in order: the first throws after capturing, the
// second checks the capture still ended with it (OQ-199).
describe('a browser capture whose test throws', () => {
  let leftOver: readonly unknown[] = [];

  it.fails('throws while capturing', () => {
    leftOver = captureLogs(onTestFinished).events;
    throw new Error('the awaited call failed');
  });

  it('has been stopped by the runner all the same', () => {
    createLogger().error('later');

    expect(leftOver).toEqual([]);
  });
});
