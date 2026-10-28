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
import createAccountTransactionAccessor from './accessors/accountTransactionAccessor';
import createBudgetAccessor from './accessors/budgetAccessor';
import createAuditLogAccessor from './accessors/auditLogAccessor';
import createCardTransactionAccessor from './accessors/cardTransactionAccessor';
import createCategoryAccessor from './accessors/categoryAccessor';
import createCreditCardAccessor from './accessors/creditCardAccessor';
import createEmailAccessor from './accessors/emailAccessor';
import createGoalAccessor from './accessors/goalAccessor';
import createHouseholdAccessor from './accessors/householdAccessor';
import createIndexRateAccessor from './accessors/indexRateAccessor';
import createInvestmentHoldingAccessor from './accessors/investmentHoldingAccessor';
import createInvitationAccessor from './accessors/invitationAccessor';
import createNotificationInboxAccessor from './accessors/notificationInboxAccessor';
import createSessionAccessor from './accessors/sessionAccessor';
import createUserAccessor from './accessors/userAccessor';
import createValuationSnapshotAccessor from './accessors/valuationSnapshotAccessor';
import createApp from './app';
import { logging } from './config/constants';
import loadEnv from './config/env';
import { createInvestmentProductEngine } from './engines/investmentProduct';
import { createNotificationEngine } from './engines/notification';
import { createReportingEngine } from './engines/reporting';
import type { Database } from './db/database';
import { createManagers } from './managers';
import type { AccountStores } from './managers/account';
import type { TransactionStores } from './managers/transaction';
import { createAuthenticationUtility } from './utilities/authentication';
import { createAuthorizationUtility } from './utilities/authorization';
import { createServiceBus } from './utilities/serviceBus';
import { newCorrelationId } from './utilities/correlationId';
import { failureDetails } from './utilities/domainError';
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
    { ...failureDetails(error), correlationId: message.correlationId },
  ),
});
const authorization = createAuthorizationUtility({ findMembership: households.findMembership });

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
  goals: createGoalAccessor(over),
});

/**
 * TransactionManager's Accessors over a database or one transaction (OQ-175).
 *
 * @param over - The database, or a transaction.
 * @returns The Accessors.
 */
const transactionStoresOver = (over: Database): TransactionStores => ({
  ...accountStoresOver(over),
  accountTransactions: createAccountTransactionAccessor(over),
  cardTransactions: createCardTransactionAccessor(over),
  holdings: createInvestmentHoldingAccessor(over),
  valuations: createValuationSnapshotAccessor(over),
});
const indexRates = createIndexRateAccessor(db);
// InsightsManager's reads (M4, OQ-201): ReportingEngine over one instance of
// each Accessor it needs, shared with the Manager's own reads.
const insightStores = {
  accounts: createAccountAccessor(db),
  creditCards: createCreditCardAccessor(db),
  budgets: createBudgetAccessor(db),
  goals: createGoalAccessor(db),
  holdings: createInvestmentHoldingAccessor(db),
  valuations: createValuationSnapshotAccessor(db),
  accountTransactions: createAccountTransactionAccessor(db),
  cardTransactions: createCardTransactionAccessor(db),
};
const reporting = createReportingEngine({
  listAccounts: insightStores.accounts.list,
  accountBalancesAsOf: insightStores.accounts.balancesAsOf,
  listCreditCards: insightStores.creditCards.listByAccounts,
  cardBalancesAsOf: insightStores.creditCards.balancesAsOf,
  accountMonthlySums: insightStores.accountTransactions.monthlySums,
  cardMonthlySums: insightStores.cardTransactions.monthlySums,
  listBudgets: insightStores.budgets.list,
  budgetPeriodsAsOf: insightStores.budgets.periodsAsOf,
  listGoals: insightStores.goals.list,
  listAllocations: insightStores.goals.listAllocations,
  findHoldings: insightStores.holdings.findByIds,
  latestSnapshots: insightStores.valuations.latestAsOf,
  costBasisAsOf: insightStores.accountTransactions.costBasisAsOf,
});
const {
  identity, account, transaction, insights,
} = createManagers({
  bus,
  identity: {
    users: createUserAccessor(db),
    sessions: createSessionAccessor(db),
    households,
    invitations: createInvitationAccessor(db),
    authentication,
    authorization,
    notifications,
    webAppUrl: env.webAppUrl,
    now: () => new Date(),
  },
  account: {
    ...accountStoresOver(db),
    holdings: createInvestmentHoldingAccessor(db),
    valuations: createValuationSnapshotAccessor(db),
    indexRates,
    households,
    notifications,
    authorization,
    inTransaction: createUnitOfWork(db, accountStoresOver),
    now: () => new Date(),
  },
  transaction: {
    ...transactionStoresOver(db),
    investmentProducts: createInvestmentProductEngine({ latestIndexRate: indexRates.latest }),
    authorization,
    inTransaction: createUnitOfWork(db, transactionStoresOver),
    now: () => new Date(),
  },
  insights: {
    reporting,
    investmentProducts: createInvestmentProductEngine({ latestIndexRate: indexRates.latest }),
    goals: insightStores.goals,
    accounts: insightStores.accounts,
    holdings: insightStores.holdings,
    accountTransactions: insightStores.accountTransactions,
    authorization,
    now: () => new Date(),
  },
});

serve({
  fetch: createApp({
    identity, account, transaction, insights, verifyAccessToken: authentication.verifyAccessToken,
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
