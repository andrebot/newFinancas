// Composition root: reads the environment, wires the real dependencies and binds
// the app to a port. No logic lives here, so it is excluded from unit coverage
// and exercised by the E2E smoke test instead.
import { readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import { resolveLogDir } from '@financas/logging';
import { serve } from '@hono/node-server';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import createAuditLogAccessor from './accessors/auditLogAccessor';
import createApp from './app';
import { logging as loggingSettings } from './config/constants';
import loadEnv from './config/env';
import { newCorrelationId } from './utilities/correlationId';
import {
  createApiLogger, createLoggingUtility, newAuditId,
} from './utilities/logging';
import { logFileLister, reconcileAudit } from './utilities/logging/reconcile';

const env = loadEnv(process.env);
const db = drizzle(new pg.Pool({ connectionString: env.databaseUrl }));
const auditLog = createAuditLogAccessor(db);
const logDir = resolveLogDir(process.env, os.homedir());
const logger = createApiLogger({ level: env.logLevel, logDir, auditInsert: auditLog.insert });
const logging = createLoggingUtility({ logger, now: () => new Date(), newId: newAuditId });

serve({ fetch: createApp({ logging }).fetch, port: env.port });
logging.logActivity({
  correlationId: newCorrelationId(),
  actor: 'system',
  action: 'api.started',
  details: { port: env.port, logDir },
});

// Restore audit entries the sink could not store last time (OQ-110).
const reconcileId = newCorrelationId();
reconcileAudit({
  listLogFiles: logFileLister(logDir, loggingSettings.filePrefix, readdir),
  readFile: (file) => readFile(file, 'utf8'),
  insertMany: auditLog.insertMany,
})
  .then((restored) => logging.logActivity({
    correlationId: reconcileId, actor: 'system', action: 'audit.reconciled', details: { restored },
  }))
  .catch((error: unknown) => logging.logError({
    correlationId: reconcileId, actor: 'system', action: 'audit.reconcile', error,
  }));
