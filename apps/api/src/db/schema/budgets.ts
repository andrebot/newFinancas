import { sql } from 'drizzle-orm';
import {
  check, pgTable, smallint, text, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import {
  CASCADE, SET_NULL, createdAt, id, integerAmount, isOneOf,
} from './columns';
import { categories, subcategories } from './categories';
import { households, users } from './identity';
import { VISIBILITIES } from './values';

// Budgets (02-data-model.md) — BudgetAccessor.

export const budgets = pgTable('budgets', {
  id: id(),
  householdId: uuid('household_id').notNull().references(() => households.id, CASCADE),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  name: text('name').notNull(),
  targetAmount: integerAmount('target_amount').notNull(),
  currency: text('currency').notNull(),
  visibility: text('visibility').notNull(),
  createdAt: createdAt(),
}, (table) => [
  check('budgets_visibility_check', isOneOf(table.visibility, VISIBILITIES)),
  check('budgets_currency_check', sql`${table.currency} ~ '^[A-Z]{3}$'`),
]);

export const budgetTargets = pgTable('budget_targets', {
  id: id(),
  budgetId: uuid('budget_id').notNull().references(() => budgets.id, CASCADE),
  categoryId: uuid('category_id').references(() => categories.id),
  subcategoryId: uuid('subcategory_id').references(() => subcategories.id),
  // Scope, denormalized from the Budget so FR-4.7 can be a plain unique index.
  householdId: uuid('household_id').notNull().references(() => households.id, CASCADE),
  visibility: text('visibility').notNull(),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
}, (table) => [
  check(
    'budget_targets_one_target_check',
    sql`(${table.categoryId} IS NULL) <> (${table.subcategoryId} IS NULL)`,
  ),
  check('budget_targets_visibility_check', isOneOf(table.visibility, VISIBILITIES)),
  // FR-4.7: one claim per category/subcategory per scope. A shared scope is the
  // household (owner_user_id is only provenance there); a personal one, the owner.
  uniqueIndex('budget_targets_shared_category_key').on(table.householdId, table.categoryId)
    .where(sql`${table.visibility} = 'shared' AND ${table.categoryId} IS NOT NULL`),
  uniqueIndex('budget_targets_personal_category_key')
    .on(table.householdId, table.ownerUserId, table.categoryId)
    .where(sql`${table.visibility} = 'personal' AND ${table.categoryId} IS NOT NULL`),
  uniqueIndex('budget_targets_shared_subcategory_key').on(table.householdId, table.subcategoryId)
    .where(sql`${table.visibility} = 'shared' AND ${table.subcategoryId} IS NOT NULL`),
  uniqueIndex('budget_targets_personal_subcategory_key')
    .on(table.householdId, table.ownerUserId, table.subcategoryId)
    .where(sql`${table.visibility} = 'personal' AND ${table.subcategoryId} IS NOT NULL`),
]);

export const budgetPeriods = pgTable('budget_periods', {
  id: id(),
  // SET NULL: periods survive their Budget's deletion as history (FR-4.10).
  budgetId: uuid('budget_id').references(() => budgets.id, SET_NULL),
  // Snapshotted from the Budget so orphaned history stays findable and readable (OQ-95).
  householdId: uuid('household_id').notNull().references(() => households.id, CASCADE),
  currency: text('currency').notNull(),
  year: smallint('year').notNull(),
  month: smallint('month').notNull(),
  targetAmount: integerAmount('target_amount').notNull(),
  spendAmount: integerAmount('spend_amount').notNull().default(0),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('budget_periods_month_key').on(table.budgetId, table.year, table.month),
  check('budget_periods_month_check', sql`${table.month} BETWEEN 1 AND 12`),
  check('budget_periods_currency_check', sql`${table.currency} ~ '^[A-Z]{3}$'`),
]);
