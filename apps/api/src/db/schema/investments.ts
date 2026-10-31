import { sql } from 'drizzle-orm';
import {
  boolean, check, date, pgTable, smallint, text, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import {
  CASCADE, createdAt, id, instant, integerAmount, isOneOf,
} from './columns';
import { households, users } from './identity';
import {
  ARCHIVED_BY, FIXED_TERM_ASSET_TYPES, INTEREST_PAYMENTS, RATE_TYPES, SPREAD_RATE_TYPES,
  VISIBILITIES,
} from './values';

// Investments & Goals (02-data-model.md) — InvestmentHoldingAccessor,
// IndexRateAccessor, GoalAccessor. Valuation snapshots live in valuations.ts.

export const investmentHoldings = pgTable('investment_holdings', {
  id: id(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, CASCADE),
  assetType: text('asset_type').notNull(),
  ticker: text('ticker'),
  quantity: integerAmount('quantity').notNull(),
  costBasis: integerAmount('cost_basis').notNull(),
  // Fixed-term types only (OQ-50); percent × 10,000 (OQ-86).
  rateType: text('rate_type'),
  rateValue: integerAmount('rate_value'),
  // CDI/Selic only: a spread on top of the percent of the index (OQ-205).
  rateSpread: integerAmount('rate_spread'),
  incentivised: boolean('incentivised'),
  // Fixed-term types only, from the buy (OQ-201) — the Engine recomputes from it.
  interestPayment: text('interest_payment'),
  // Fixed-term types only: the contract's maturity date, as typed (OQ-205).
  dueDate: date('due_date'),
  archivedAt: instant('archived_at'),
  archivedBy: text('archived_by'),
  maturedNotifiedAt: instant('matured_notified_at'),
  createdAt: createdAt(),
}, (table) => [
  check('investment_holdings_rate_type_check', isOneOf(table.rateType, RATE_TYPES)),
  check(
    'investment_holdings_rate_pair_check',
    sql`(${table.rateType} IS NULL) = (${table.rateValue} IS NULL)`,
  ),
  check(
    'investment_holdings_rate_spread_check',
    sql`${table.rateSpread} IS NULL OR ${isOneOf(table.rateType, SPREAD_RATE_TYPES)}`,
  ),
  check(
    'investment_holdings_interest_payment_check',
    isOneOf(table.interestPayment, INTEREST_PAYMENTS),
  ),
  check(
    'investment_holdings_interest_payment_pair_check',
    sql`(${table.rateType} IS NULL) = (${table.interestPayment} IS NULL)`,
  ),
  check(
    'investment_holdings_due_date_pair_check',
    sql`(${table.rateType} IS NULL) = (${table.dueDate} IS NULL)`,
  ),
  // A fixed-term Holding always carries its terms (OQ-224): the pair checks
  // above then require the rest of them.
  check(
    'investment_holdings_fixed_term_terms_check',
    sql`NOT (${isOneOf(table.assetType, FIXED_TERM_ASSET_TYPES)}) OR ${table.rateType} IS NOT NULL`,
  ),
  check('investment_holdings_archived_by_check', isOneOf(table.archivedBy, ARCHIVED_BY)),
  check(
    'investment_holdings_archive_pair_check',
    sql`(${table.archivedAt} IS NULL) = (${table.archivedBy} IS NULL)`,
  ),
]);

export const investmentScheduleEntries = pgTable('investment_schedule_entries', {
  id: id(),
  holdingId: uuid('holding_id').notNull().references(() => investmentHoldings.id, CASCADE),
  kind: text('kind').notNull(),
  amount: integerAmount('amount').notNull(),
  date: date('date').notNull(),
  postedAt: instant('posted_at'),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('investment_schedule_entries_event_key').on(table.holdingId, table.date, table.kind),
  check('investment_schedule_entries_amount_check', sql`${table.amount} > 0`),
]);

export const indexRateValues = pgTable('index_rate_values', {
  id: id(),
  householdId: uuid('household_id').notNull().references(() => households.id, CASCADE),
  indexCode: text('index_code').notNull(),
  value: integerAmount('value').notNull(),
  asOfDate: date('as_of_date').notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('index_rate_values_day_key').on(table.householdId, table.indexCode, table.asOfDate),
]);

export const goals = pgTable('goals', {
  id: id(),
  householdId: uuid('household_id').notNull().references(() => households.id, CASCADE),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  name: text('name').notNull(),
  targetAmount: integerAmount('target_amount').notNull(),
  targetCurrency: text('target_currency').notNull(),
  dueDate: date('due_date').notNull(),
  visibility: text('visibility').notNull(),
  // The one reversible lifecycle flag (FR-8.8/8.9, OQ-78).
  completedAt: instant('completed_at'),
  createdAt: createdAt(),
}, (table) => [
  check('goals_visibility_check', isOneOf(table.visibility, VISIBILITIES)),
  check('goals_currency_check', sql`${table.targetCurrency} ~ '^[A-Z]{3}$'`),
]);

export const goalAllocations = pgTable('goal_allocations', {
  id: id(),
  holdingId: uuid('holding_id').notNull().references(() => investmentHoldings.id, CASCADE),
  goalId: uuid('goal_id').notNull().references(() => goals.id, CASCADE),
  // Whole percent, 1–100 (OQ-87); the per-holding 100% cap is application-level.
  percentage: smallint('percentage').notNull(),
  // The split in effect from `valid_from` until `valid_to` (exclusive; null for
  // the current one), so progress on a past date reads that day's split (OQ-206).
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to'),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('goal_allocations_pair_key').on(table.holdingId, table.goalId)
    .where(sql`${table.validTo} IS NULL`),
  check('goal_allocations_percentage_check', sql`${table.percentage} BETWEEN 1 AND 100`),
  check(
    'goal_allocations_period_check',
    sql`${table.validTo} IS NULL OR ${table.validTo} > ${table.validFrom}`,
  ),
]);
