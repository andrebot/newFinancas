// Composition root for `pnpm generate:mfacode` (OQ-98): prints the demo users'
// current TOTP code, so signing in locally needs no authenticator app. No logic
// lives here, so it is excluded from unit coverage; `currentTotp` is tested.
import { createLogger, logger } from '@financas/logging';
import { demoSeed } from '../../config/constants';
import { newCorrelationId } from '../../utilities/correlationId';
import { currentTotp } from '../../utilities/authentication/mfa';

const log = createLogger({ label: 'mfa-code', correlationId: newCorrelationId(), actor: 'system' });

log.info(
  `Demo MFA code (ana@ / ben@demo.financas.local): ${currentTotp(demoSeed.totpSecret, new Date())}`,
  { consoleOnly: true },
);
logger.end();
