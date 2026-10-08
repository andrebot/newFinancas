import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from '../../../src/db/schema';

const tables: PgTable[] = Object.values(schema).filter((value) => value instanceof PgTable);
const configs = tables.map((table) => getTableConfig(table));

/**
 * Lists every foreign key as `table.column` → `referenced_table on-delete-action`.
 *
 * @returns One entry per foreign key in the schema.
 */
const foreignKeys = (): Record<string, string> => Object.fromEntries(configs.flatMap(
  (config) => config.foreignKeys.map((fk) => {
    const reference = fk.reference();
    const target = getTableConfig(reference.foreignTable).name;
    const key = `${config.name}.${reference.columns[0]!.name}`;
    return [key, `${target} ${fk.onDelete ?? 'no action'}`];
  }),
));

/**
 * Finds a table's configuration by its SQL name.
 *
 * @param name - Table name.
 * @returns The table configuration.
 */
const config = (name: string) => configs.find((c) => c.name === name)!;

describe('database schema (02-data-model.md)', () => {
  it('defines the 26 v1 tables', () => {
    expect(configs).toHaveLength(26);
    expect(configs.map((c) => c.name)).not.toContain('dashboard_widgets');
  });

  it('gives every table a uuid primary key named id', () => {
    configs.forEach((c) => {
      const id = c.columns.find((column) => column.name === 'id');
      expect(id?.primary, c.name).toBe(true);
      expect(id?.getSQLType(), c.name).toBe('uuid');
    });
  });

  // OQ-95: (A) parts of a parent cascade; (B) owner/actor references are NO ACTION
  // so a user delete fails unless the FR-1.17 routine handled them; (C) references
  // to never-deleted rows are NO ACTION; history-keeping references SET NULL.
  it('applies the agreed ON DELETE rule to every foreign key', () => {
    expect(foreignKeys()).toEqual({
      'account_month_balances.account_id': 'accounts cascade',
      'accounts.household_id': 'households cascade',
      'accounts.owner_user_id': 'users no action',
      'account_transactions.account_id': 'accounts cascade',
      'account_transactions.category_id': 'categories no action',
      'account_transactions.credit_card_id': 'credit_cards set null',
      'account_transactions.holding_id': 'investment_holdings no action',
      'account_transactions.subcategory_id': 'subcategories no action',
      'budget_periods.budget_id': 'budgets set null',
      'budget_periods.household_id': 'households cascade',
      'budgets.household_id': 'households cascade',
      'budgets.owner_user_id': 'users no action',
      'budget_targets.budget_id': 'budgets cascade',
      'budget_targets.category_id': 'categories no action',
      'budget_targets.household_id': 'households cascade',
      'budget_targets.owner_user_id': 'users no action',
      'budget_targets.subcategory_id': 'subcategories no action',
      'card_transactions.category_id': 'categories no action',
      'card_transactions.credit_card_id': 'credit_cards cascade',
      'card_transactions.subcategory_id': 'subcategories no action',
      'categories.household_id': 'households cascade',
      'credit_card_month_balances.credit_card_id': 'credit_cards cascade',
      'credit_cards.account_id': 'accounts cascade',
      'goal_allocations.goal_id': 'goals cascade',
      'goal_allocations.holding_id': 'investment_holdings cascade',
      'goals.household_id': 'households cascade',
      'goals.owner_user_id': 'users no action',
      'household_memberships.household_id': 'households cascade',
      'household_memberships.user_id': 'users cascade',
      'index_rate_values.created_by_user_id': 'users no action',
      'index_rate_values.household_id': 'households cascade',
      'investment_holdings.account_id': 'accounts cascade',
      'investment_schedule_entries.holding_id': 'investment_holdings cascade',
      'invitations.household_id': 'households cascade',
      'invitations.invited_by_user_id': 'users no action',
      'invitations.invited_user_id': 'users cascade',
      'mfa_recovery_codes.user_id': 'users cascade',
      'notifications.user_id': 'users cascade',
      'password_reset_tokens.user_id': 'users cascade',
      'sessions.user_id': 'users cascade',
      'subcategories.category_id': 'categories cascade',
      'valuation_snapshots.account_transaction_id': 'account_transactions cascade',
      'valuation_snapshots.holding_id': 'investment_holdings cascade',
    });
  });

  it('keeps owner and actor references nullable, for anonymization (FR-1.17)', () => {
    const actorColumns = Object.keys(foreignKeys())
      .filter((key) => /\.(owner_user_id|invited_by_user_id|created_by_user_id)$/.test(key));

    // accounts/budgets/budget_targets/goals owner, invitations inviter, index rate creator.
    expect(actorColumns).toHaveLength(6);
    actorColumns.forEach((key) => {
      const [table, column] = key.split('.');
      expect(config(table!).columns.find((c) => c.name === column)?.notNull, key).toBe(false);
    });
  });

  it('keeps the audit log free of foreign keys (NFR-AUD-1)', () => {
    expect(config('audit_log_entries').foreignKeys).toEqual([]);
  });

  it('declares the uniqueness the data model requires', () => {
    const uniqueIndexes = configs.flatMap((c) => c.indexes
      .filter((index) => index.config.unique)
      .map((index) => index.config.name));

    expect(uniqueIndexes).toEqual(expect.arrayContaining([
      'users_email_key',
      'household_memberships_one_owner_key',
      'budget_targets_shared_category_key',
      'budget_targets_personal_category_key',
      'budget_targets_shared_subcategory_key',
      'budget_targets_personal_subcategory_key',
      'budget_periods_month_key',
      'investment_schedule_entries_event_key',
      'index_rate_values_day_key',
      'goal_allocations_pair_key',
    ]));
  });
});
