import { sql } from 'drizzle-orm';
import {
  check, date, pgTable, text, uuid,
} from 'drizzle-orm/pg-core';
import {
  CASCADE, createdAt, id, integerAmount, isOneOf,
} from './columns';
import { investmentHoldings } from './investments';
import { accountTransactions } from './transactions';
import { SNAPSHOT_SOURCES } from './values';

// Valuation snapshots (02-data-model.md, Investments) — ValuationSnapshotAccessor.
// Own file because it references both holdings and transactions.

const valuationSnapshots = pgTable('valuation_snapshots', {
  id: id(),
  holdingId: uuid('holding_id').notNull().references(() => investmentHoldings.id, CASCADE),
  // Total value of the holding, not a per-unit price (FR-5.2).
  valuation: integerAmount('valuation').notNull(),
  asOfDate: date('as_of_date').notNull(),
  source: text('source').notNull(),
  // Set for `transaction` snapshots, which die with their transaction (OQ-56).
  accountTransactionId: uuid('account_transaction_id').unique()
    .references(() => accountTransactions.id, CASCADE),
  createdAt: createdAt(),
}, (t) => [
  check('valuation_snapshots_source_check', isOneOf(t.source, SNAPSHOT_SOURCES)),
  check(
    'valuation_snapshots_source_link_check',
    sql`(${t.source} = 'transaction') = (${t.accountTransactionId} IS NOT NULL)`,
  ),
]);

export default valuationSnapshots;
