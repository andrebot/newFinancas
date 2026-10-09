// Composition root: reads the environment, wires the real dependencies and binds
// the app to a port. No logic lives here, so it is excluded from unit coverage
// and exercised by the E2E smoke test instead.
import { readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import { createLogger, logger, resolveLogDir } from '@financas/logging';
import { serve } from '@hono/node-server';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import createAuditLogAccessor from './accessors/auditLogAccessor';
import createApp from './app';
import { logging } from './config/constants';
import loadEnv from './config/env';
import { newCorrelationId } from './utilities/correlationId';
import { createAuditSink } from './utilities/logging/auditSink';
import { logFileLister, reconcileAudit } from './utilities/logging/reconcile';

const env = loadEnv(process.env);
const pool = new pg.Pool({ connectionString: env.databaseUrl });
const auditLog = createAuditLogAccessor(drizzle(pool));
const log = createLogger({ label: 'api', correlationId: newCorrelationId(), actor: 'system' });

// Audit events (log.audit) are also stored in audit_log_entries (OQ-110).
logger.add(createAuditSink({
  insert: auditLog.insert,
  delaysMs: logging.auditRetryDelaysMs,
  sleep: (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
  }),
  onGiveUp: (record) => log.error(
    `Audit entry not stored, kept for reconciliation: ${record.action}`,
    { auditId: record.id },
  ),
}));

serve({ fetch: createApp().fetch, port: env.port });
log.info('API started', { port: env.port });

// Restore audit entries the sink could not store last time (OQ-110).
const logDir = resolveLogDir(process.env, os.homedir());
reconcileAudit({
  listLogFiles: logFileLister(logDir, logging.apiFilePrefix, readdir),
  readFile: (file) => readFile(file, 'utf8'),
  insertMany: auditLog.insertMany,
})
  .then((restored) => log.info('Audit reconciled', { restored }))
  .catch((error: unknown) => log.error('Audit reconciliation failed', { error: String(error) }));
