// Composition root for `pnpm audit:reconcile` (OQ-110): restores audit entries
// missing from the database, from the daily log files. The API also does this
// at every start. No logic lives here, so it is excluded from unit coverage.
import { readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import { createLogger, resolveLogDir } from '@financas/logging';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import createAuditLogAccessor from '../../accessors/auditLogAccessor';
import { logging as loggingSettings } from '../../config/constants';
import loadEnv from '../../config/env';
import { newCorrelationId } from '../correlationId';
import { createLoggingUtility, newAuditId } from '.';
import { logFileLister, reconcileAudit } from './reconcile';

const env = loadEnv(process.env);
const pool = new pg.Pool({ connectionString: env.databaseUrl });
const auditLog = createAuditLogAccessor(drizzle(pool));
const logDir = resolveLogDir(process.env, os.homedir());
const logger = createLogger({ level: env.logLevel, logDir, filePrefix: 'audit-reconcile' });
const logging = createLoggingUtility({ logger, now: () => new Date(), newId: newAuditId });
const correlationId = newCorrelationId();

reconcileAudit({
  listLogFiles: logFileLister(logDir, loggingSettings.filePrefix, readdir),
  readFile: (file) => readFile(file, 'utf8'),
  insertMany: auditLog.insertMany,
})
  .then((restored) => logging.logActivity({
    correlationId, actor: 'system', action: 'audit.reconciled', details: { restored, logDir },
  }))
  .catch((error: unknown) => {
    logging.logError({
      correlationId, actor: 'system', action: 'audit.reconcile', error,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    logger.end();
  });
