import { sql } from 'drizzle-orm';
import {
  check, pgTable, smallint, text, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import {
  CASCADE, createdAt, id, instant, integerAmount, isOneOf,
} from './columns';
import { households, users } from './identity';
import { ACCOUNT_TYPES, VISIBILITIES } from './values';

// Account Setup / Containers (02-data-model.md) — AccountAccessor, CreditCardAccessor.

export const accounts = pgTable('accounts', {
  id: id(),
  householdId: uuid('household_id').notNull().references(() => households.id, CASCADE),
  // Owner of a personal account, provenance of a shared one; the FR-1.17
  // routine deletes or nulls it first, so the FK blocks a missed one.
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  name: text('name').notNull(),
  type: text('type').notNull(),
  currency: text('currency').notNull(),
  visibility: text('visibility').notNull(),
  archivedAt: instant('archived_at'),
  createdAt: createdAt(),
}, (t) => [
  check('accounts_type_check', isOneOf(t.type, ACCOUNT_TYPES)),
  check('accounts_visibility_check', isOneOf(t.visibility, VISIBILITIES)),
  check('accounts_currency_check', sql`${t.currency} ~ '^[A-Z]{3}$'`),
]);

export const creditCards = pgTable('credit_cards', {
  id: id(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, CASCADE),
  network: text('network').notNull(),
  last4: text('last4').notNull(),
  closingDay: smallint('closing_day').notNull(),
  dueDay: smallint('due_day').notNull(),
  expirationMonth: smallint('expiration_month').notNull(),
  expirationYear: smallint('expiration_year').notNull(),
  createdAt: createdAt(),
}, (t) => [
  check('credit_cards_last4_check', sql`${t.last4} ~ '^[0-9]{4}$'`),
  check('credit_cards_closing_day_check', sql`${t.closingDay} BETWEEN 1 AND 31`),
  check('credit_cards_due_day_check', sql`${t.dueDay} BETWEEN 1 AND 31`),
  check('credit_cards_expiration_month_check', sql`${t.expirationMonth} BETWEEN 1 AND 12`),
]);

export const accountMonthBalances = pgTable('account_month_balances', {
  id: id(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, CASCADE),
  year: smallint('year').notNull(),
  month: smallint('month').notNull(),
  openingBalance: integerAmount('opening_balance').notNull(),
  endingBalance: integerAmount('ending_balance').notNull(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('account_month_balances_month_key').on(t.accountId, t.year, t.month),
  check('account_month_balances_month_check', sql`${t.month} BETWEEN 1 AND 12`),
]);

export const creditCardMonthBalances = pgTable('credit_card_month_balances', {
  id: id(),
  creditCardId: uuid('credit_card_id').notNull().references(() => creditCards.id, CASCADE),
  year: smallint('year').notNull(),
  month: smallint('month').notNull(),
  openingOutstandingBalance: integerAmount('opening_outstanding_balance').notNull(),
  endingOutstandingBalance: integerAmount('ending_outstanding_balance').notNull(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('credit_card_month_balances_month_key').on(t.creditCardId, t.year, t.month),
  check('credit_card_month_balances_month_check', sql`${t.month} BETWEEN 1 AND 12`),
]);
