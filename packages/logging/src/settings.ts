// Logging settings shared by every process (OQ-97, OQ-110). Fixed values, not
// environment variables — those (LOG_LEVEL, LOG_DIR, LOG_FILE_PREFIX) are read in env.ts.

const loggingSettings = {
  /** Daily log files are kept this long — also how far back audit recovery reaches. */
  retentionDays: 14,
  /** File name: `<prefix>-2026-10-09.log`. */
  datePattern: 'YYYY-MM-DD',
  /** Default directory under the XDG state home (`~/.local/state`). */
  directoryName: 'financas/logs',
} as const;

export default loggingSettings;
