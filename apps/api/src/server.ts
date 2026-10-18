// Composition root: reads the environment, wires the real dependencies and binds
// the app to a port. No logic lives here, so it is excluded from unit coverage
// and exercised by the E2E smoke test instead.
import { readdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import { createLogger, logger, resolveLogDir } from '@financas/logging';
import { serve } from '@hono/node-server';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import createAccountAccessor from './accessors/accountAccessor';
import createBudgetAccessor from './accessors/budgetAccessor';
import createAuditLogAccessor from './accessors/auditLogAccessor';
import createCategoryAccessor from './accessors/categoryAccessor';
import createCreditCardAccessor from './accessors/creditCardAccessor';
import createEmailAccessor from './accessors/emailAccessor';
import createHouseholdAccessor from './accessors/householdAccessor';
import createInvitationAccessor from './accessors/invitationAccessor';
import createNotificationInboxAccessor from './accessors/notificationInboxAccessor';
import createSessionAccessor from './accessors/sessionAccessor';
import createUserAccessor from './accessors/userAccessor';
import createApp from './app';
import { logging } from './config/constants';
import loadEnv from './config/env';
import { createNotificationEngine } from './engines/notification';
import type { Database } from './db/database';
import {
  createAccountManager, subscribeAccountManager, type AccountStores,
} from './managers/account';
import { createIdentityManager } from './managers/identity';
import { createAuthenticationUtility } from './utilities/authentication';
import { createAuthorizationUtility } from './utilities/authorization';
import { createServiceBus } from './utilities/serviceBus';
import { newCorrelationId } from './utilities/correlationId';
import { createAuditSink } from './utilities/logging/auditSink';
import { logFileLister, reconcileAudit } from './utilities/logging/reconcile';
import createUnitOfWork from './utilities/unitOfWork';

const env = loadEnv(process.env);
const pool = new pg.Pool({ connectionString: env.databaseUrl });
const db = drizzle(pool);
const auditLog = createAuditLogAccessor(db);
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

const authentication = createAuthenticationUtility({
  jwtSecret: env.jwtSecret, mfaEncryptionKey: env.mfaEncryptionKey,
});
const notifications = createNotificationEngine({
  insertNotification: createNotificationInboxAccessor(db).insert,
  sendEmail: createEmailAccessor(env.emailProvider).send,
});
const households = createHouseholdAccessor(db);
const bus = createServiceBus({
  now: () => new Date(),
  onHandlerError: (error, message) => log.error(
    `Subscriber failed for ${message.topic}`,
    { error: String(error), correlationId: message.correlationId },
  ),
});
const authorization = createAuthorizationUtility({ findMembership: households.findMembership });
const identity = createIdentityManager({
  users: createUserAccessor(db),
  sessions: createSessionAccessor(db),
  households,
  invitations: createInvitationAccessor(db),
  authentication,
  authorization,
  bus,
  notifications,
  webAppUrl: env.webAppUrl,
  now: () => new Date(),
});

/**
 * AccountManager's Accessors over a database or one transaction (OQ-175).
 *
 * @param over - The database, or a transaction.
 * @returns The Accessors.
 */
const accountStoresOver = (over: Database): AccountStores => ({
  categories: createCategoryAccessor(over),
  accounts: createAccountAccessor(over),
  creditCards: createCreditCardAccessor(over),
  budgets: createBudgetAccessor(over),
});
const account = createAccountManager({
  ...accountStoresOver(db),
  authorization,
  inTransaction: createUnitOfWork(db, accountStoresOver),
  now: () => new Date(),
});
subscribeAccountManager(bus, account);

serve({
  fetch: createApp({
    identity, account, verifyAccessToken: authentication.verifyAccessToken,
  }).fetch,
  port: env.port,
});
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
