import { sql } from 'drizzle-orm';
import {
  check, date, index, pgTable, text, uuid,
} from 'drizzle-orm/pg-core';
import { accounts, creditCards } from './accounts';
import { categories, subcategories } from './categories';
import {
  CASCADE, SET_NULL, createdAt, id, integerAmount, isOneOf,
} from './columns';
import { investmentHoldings } from './investments';
import { TRANSACTION_EFFECTS, TRANSACTION_SOURCES } from './values';

// Transactions (02-data-model.md) — AccountTransactionAccessor, CardTransactionAccessor.
// `kind` is extensible reference data (FR-3.1), validated in code.

export const accountTransactions = pgTable('account_transactions', {
  id: id(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, CASCADE),
  kind: text('kind').notNull(),
  // Persisted from EFFECT_BY_KIND so history keeps the effect in force at the time.
  effect: text('effect').notNull(),
  date: date('date').notNull(),
  amount: integerAmount('amount').notNull(),
  currency: text('currency').notNull(),
  categoryId: uuid('category_id').references(() => categories.id),
  subcategoryId: uuid('subcategory_id').references(() => subcategories.id),
  description: text('description'),
  holdingId: uuid('holding_id').references(() => investmentHoldings.id),
  // Bill payment's card; SET NULL keeps this account's history if the card's
  // (personal) account is deleted (OQ-95).
  creditCardId: uuid('credit_card_id').references(() => creditCards.id, SET_NULL),
  source: text('source').notNull().default('manual'),
  createdAt: createdAt(),
}, (t) => [
  check('account_transactions_effect_check', isOneOf(t.effect, TRANSACTION_EFFECTS)),
  check('account_transactions_source_check', isOneOf(t.source, TRANSACTION_SOURCES)),
  check('account_transactions_currency_check', sql`${t.currency} ~ '^[A-Z]{3}$'`),
  index('account_transactions_browse_idx').on(t.accountId, t.date.desc(), t.id),
  index('account_transactions_holding_idx').on(t.holdingId),
]);

export const cardTransactions = pgTable('card_transactions', {
  id: id(),
  creditCardId: uuid('credit_card_id').notNull().references(() => creditCards.id, CASCADE),
  kind: text('kind').notNull(),
  date: date('date').notNull(),
  amount: integerAmount('amount').notNull(),
  currency: text('currency').notNull(),
  categoryId: uuid('category_id').references(() => categories.id),
  subcategoryId: uuid('subcategory_id').references(() => subcategories.id),
  description: text('description'),
  createdAt: createdAt(),
}, (t) => [
  check('card_transactions_currency_check', sql`${t.currency} ~ '^[A-Z]{3}$'`),
  index('card_transactions_browse_idx').on(t.creditCardId, t.date.desc(), t.id),
]);
