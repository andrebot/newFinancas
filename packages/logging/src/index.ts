// Shared logging (U2, OQ-110): the logger every process uses, its console line,
// redaction and actor labels. The API's LoggingUtility adds the audit sink.
export { actorLabel, actorUserId, type Actor } from './events';
export { formatConsoleLine, type ConsoleEvent } from './consoleFormat';
export {
  buildTransports, createLogger, resolveLogDir, type LoggerOptions, type LogLevel,
} from './createLogger';
export { redact, REDACTED } from './redact';
export { default as loggingSettings } from './settings';
