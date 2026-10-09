// Composition root for `pnpm db:seed:demo` (OQ-98): connects as the application
// role and applies the demo seed. No logic lives here, so it is excluded from
// unit coverage; the seed itself is tested against PGlite.
import os from 'node:os';
import { createLogger, resolveLogDir } from '@financas/logging';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import loadEnv from '../../config/env';
import { newCorrelationId } from '../../utilities/correlationId';
import { createLoggingUtility, newAuditId } from '../../utilities/logging';
import applyDemoSeed from './applyDemoSeed';
import { buildDemoSeed } from './demoSeed';

const env = loadEnv(process.env);
const pool = new pg.Pool({ connectionString: env.databaseUrl });
const logger = createLogger({
  level: env.logLevel, logDir: resolveLogDir(process.env, os.homedir()), filePrefix: 'seed',
});
const logging = createLoggingUtility({ logger, now: () => new Date(), newId: newAuditId });
const correlationId = newCorrelationId();

applyDemoSeed(drizzle(pool), buildDemoSeed(new Date()))
  .then(() => logging.logActivity({
    correlationId,
    actor: 'system',
    action: 'seed.demo',
    details: { users: 'ana@demo.financas.local, ben@demo.financas.local' },
  }))
  .catch((error: unknown) => {
    logging.logError({
      correlationId, actor: 'system', action: 'seed.demo', error,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    logger.end();
  });
