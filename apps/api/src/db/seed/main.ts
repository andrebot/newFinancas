// Composition root for `pnpm db:seed:demo` (OQ-98): connects as the application
// role and applies the demo seed. No logic lives here, so it is excluded from
// unit coverage; the seed itself is tested against PGlite.
/* eslint-disable no-console */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import loadEnv from '../../config/env';
import applyDemoSeed from './applyDemoSeed';
import { buildDemoSeed } from './demoSeed';

const pool = new pg.Pool({ connectionString: loadEnv(process.env).databaseUrl });

applyDemoSeed(drizzle(pool), buildDemoSeed(new Date()))
  .then(() => console.log('Demo household seeded (ana@ / ben@demo.financas.local)'))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
