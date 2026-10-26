import { sql } from 'drizzle-orm';
import {
  check, date, index, pgTable, text, uuid,
} from 'drizzle-orm/pg-core';
import { accounts, creditCards } from './accounts';
import { categories, subcategories } from './categories';
import {
  CASCADE, SET_NULL, createdAt, id, integerAmount, isOneOf,
} from './columns';
import { users } from './identity';
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
  // A trade's signed changes to its Holding, so an edit or delete undoes
  // exactly them (OQ-171); null for every other kind.
  quantityDelta: integerAmount('quantity_delta'),
  costBasisDelta: integerAmount('cost_basis_delta'),
  // Who recorded it (OQ-111); null for schedule posts and once FR-1.17 anonymizes it.
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  source: text('source').notNull().default('manual'),
  createdAt: createdAt(),
}, (table) => [
  check('account_transactions_effect_check', isOneOf(table.effect, TRANSACTION_EFFECTS)),
  check('account_transactions_source_check', isOneOf(table.source, TRANSACTION_SOURCES)),
  check('account_transactions_currency_check', sql`${table.currency} ~ '^[A-Z]{3}$'`),
  // Amounts are positive; the kind says which way money moves (OQ-98).
  check('account_transactions_amount_check', sql`${table.amount} > 0`),
  check(
    'account_transactions_trade_deltas_check',
    sql`(${table.quantityDelta} IS NULL) = (${table.costBasisDelta} IS NULL)`,
  ),
  // Browse pages newest first on (date, id) (FR-3.12); NULLS FIRST is what
  // ORDER BY … DESC means, so the index serves the order and the cursor.
  index('account_transactions_browse_idx').on(
    table.accountId,
    table.date.desc().nullsFirst(),
    table.id.desc().nullsFirst(),
  ),
  index('account_transactions_holding_idx').on(table.holdingId),
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
  // Who recorded it (OQ-111, OQ-201); null once FR-1.17 anonymizes it.
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: createdAt(),
}, (table) => [
  check('card_transactions_currency_check', sql`${table.currency} ~ '^[A-Z]{3}$'`),
  check('card_transactions_amount_check', sql`${table.amount} > 0`),
  // Browse's order, as on account_transactions.
  index('card_transactions_browse_idx').on(
    table.creditCardId,
    table.date.desc().nullsFirst(),
    table.id.desc().nullsFirst(),
  ),
]);
