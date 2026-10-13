// Composition root for `pnpm db:seed:demo` (OQ-98): connects as the application
// role and applies the demo seed. No logic lives here, so it is excluded from
// unit coverage; the seed itself is tested against PGlite.
import { createLogger, logger } from '@financas/logging';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { demoSeed } from '../../config/constants';
import loadEnv from '../../config/env';
import { createAuthenticationUtility } from '../../utilities/authentication';
import { newCorrelationId } from '../../utilities/correlationId';
import applyDemoSeed from './applyDemoSeed';
import { buildDemoSeed } from './demoSeed';

const env = loadEnv(process.env);
const pool = new pg.Pool({ connectionString: env.databaseUrl });
const authentication = createAuthenticationUtility({
  jwtSecret: env.jwtSecret, mfaEncryptionKey: env.mfaEncryptionKey,
});
const log = createLogger({ label: 'seed', correlationId: newCorrelationId(), actor: 'system' });

authentication.hashPassword(demoSeed.password)
  .then((passwordHash) => applyDemoSeed(drizzle(pool), buildDemoSeed(new Date(), {
    passwordHash, encryptedMfaSecret: authentication.sealMfaSecret(demoSeed.totpSecret),
  })))
  .then(() => log.info(
    'Demo household seeded. Sign in as ana@ or ben@demo.financas.local, '
      + `password ${demoSeed.password}; TOTP secret ${demoSeed.totpSecret} `
      + '(add it to an authenticator app)',
    { consoleOnly: true },
  ))
  .catch((error: unknown) => {
    log.error('Demo seed failed', { error: String(error) });
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
    logger.end();
  });
