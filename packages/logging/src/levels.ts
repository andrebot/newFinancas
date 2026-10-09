// Log levels (OQ-110): Winston's npm levels plus `audit`, which sits above `info`
// so a quieter console (LOG_LEVEL=warn) still shows audit events. The audit sink
// has its own level, so storing audit entries never depends on LOG_LEVEL.

export const LEVELS = {
  error: 0,
  warn: 1,
  audit: 2,
  info: 3,
  debug: 4,
} as const;

export type LogLevel = keyof typeof LEVELS;

/**
 * Tells whether a value is one of the levels.
 *
 * @param value - e.g. `LOG_LEVEL`.
 * @returns `true` for a known level.
 */
export const isLogLevel = (value: string): value is LogLevel => Object.hasOwn(LEVELS, value);
