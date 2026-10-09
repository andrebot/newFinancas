// Composition root for `pnpm audit:reconcile` (OQ-110): restores audit entries
// missing from the database, from the API's daily log files. The API also does
// this at every start. No logic lives here, so it is excluded from unit coverage.
import { readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import { createLogger, logger, resolveLogDir } from '@financas/logging';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import createAuditLogAccessor from '../../accessors/auditLogAccessor';
import { logging } from '../../config/constants';
import loadEnv from '../../config/env';
import { newCorrelationId } from '../correlationId';
import { logFileLister, reconcileAudit } from './reconcile';

const pool = new pg.Pool({ connectionString: loadEnv(process.env).databaseUrl });
const auditLog = createAuditLogAccessor(drizzle(pool));
const logDir = resolveLogDir(process.env, os.homedir());
const log = createLogger({
  label: 'audit-reconcile', correlationId: newCorrelationId(), actor: 'system',
});

reconcileAudit({
  listLogFiles: logFileLister(logDir, logging.apiFilePrefix, readdir),
  readFile: (file) => readFile(file, 'utf8'),
  insertMany: auditLog.insertMany,
})
  .then((restored) => log.info('Audit reconciled', { restored, logDir }))
  .catch((error: unknown) => {
    // Drizzle wraps the database error; its cause holds the actual reason.
    const cause = error instanceof Error && error.cause ? String(error.cause) : undefined;
    log.error('Audit reconciliation failed', { error: String(error), cause });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    logger.end();
  });
