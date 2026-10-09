// Composition root for `pnpm db:seed:demo` (OQ-98): connects as the application
// role and applies the demo seed. No logic lives here, so it is excluded from
// unit coverage; the seed itself is tested against PGlite.
import { createLogger, logger } from '@financas/logging';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import loadEnv from '../../config/env';
import { newCorrelationId } from '../../utilities/correlationId';
import applyDemoSeed from './applyDemoSeed';
import { buildDemoSeed } from './demoSeed';

const pool = new pg.Pool({ connectionString: loadEnv(process.env).databaseUrl });
const log = createLogger({ label: 'seed', correlationId: newCorrelationId(), actor: 'system' });

applyDemoSeed(drizzle(pool), buildDemoSeed(new Date()))
  .then(() => log.info('Demo household seeded', { users: 'ana@ / ben@demo.financas.local' }))
  .catch((error: unknown) => {
    log.error('Demo seed failed', { error: String(error) });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    logger.end();
  });
