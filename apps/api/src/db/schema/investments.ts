import { sql } from 'drizzle-orm';
import {
  boolean, check, date, pgTable, smallint, text, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import {
  CASCADE, createdAt, id, instant, integerAmount, isOneOf,
} from './columns';
import { households, users } from './identity';
import { ARCHIVED_BY, RATE_TYPES, VISIBILITIES } from './values';

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
  incentivised: boolean('incentivised'),
  archivedAt: instant('archived_at'),
  archivedBy: text('archived_by'),
  maturedNotifiedAt: instant('matured_notified_at'),
  createdAt: createdAt(),
}, (t) => [
  check('investment_holdings_rate_type_check', isOneOf(t.rateType, RATE_TYPES)),
  check(
    'investment_holdings_rate_pair_check',
    sql`(${t.rateType} IS NULL) = (${t.rateValue} IS NULL)`,
  ),
  check('investment_holdings_archived_by_check', isOneOf(t.archivedBy, ARCHIVED_BY)),
  check(
    'investment_holdings_archive_pair_check',
    sql`(${t.archivedAt} IS NULL) = (${t.archivedBy} IS NULL)`,
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
}, (t) => [
  uniqueIndex('investment_schedule_entries_event_key').on(t.holdingId, t.date, t.kind),
]);

export const indexRateValues = pgTable('index_rate_values', {
  id: id(),
  householdId: uuid('household_id').notNull().references(() => households.id, CASCADE),
  indexCode: text('index_code').notNull(),
  value: integerAmount('value').notNull(),
  asOfDate: date('as_of_date').notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('index_rate_values_day_key').on(t.householdId, t.indexCode, t.asOfDate),
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
}, (t) => [
  check('goals_visibility_check', isOneOf(t.visibility, VISIBILITIES)),
  check('goals_currency_check', sql`${t.targetCurrency} ~ '^[A-Z]{3}$'`),
]);

export const goalAllocations = pgTable('goal_allocations', {
  id: id(),
  holdingId: uuid('holding_id').notNull().references(() => investmentHoldings.id, CASCADE),
  goalId: uuid('goal_id').notNull().references(() => goals.id, CASCADE),
  // Whole percent, 1–100 (OQ-87); the per-holding 100% cap is application-level.
  percentage: smallint('percentage').notNull(),
  createdAt: createdAt(),
}, (t) => [
  uniqueIndex('goal_allocations_pair_key').on(t.holdingId, t.goalId),
  check('goal_allocations_percentage_check', sql`${t.percentage} BETWEEN 1 AND 100`),
]);
