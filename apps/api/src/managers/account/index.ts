import createAccounts from './accounts';
import createBudgets from './budgets';
import createCategories from './categories';
import type { AccountDeps } from './context';
import { createEventHandlers } from './events';
import createGoals from './goals';

// AccountManager (M2, VBD §2.1): what a user sets up, or maintains, ahead of any
// cash-flow event — built in parts (OQ-174): Categories and their default
// seeding first, then Accounts and Credit Cards, then Budgets, then Goals. Each use case
// decides; the Accessors apply (OQ-107).

export type { AccountDeps, AccountStores } from './context';
export type {
  AccountEdit, AccountInput, CardChanges, CardEdit, CardInput,
} from './accounts';
export type { AccountView, CreditCardView } from './accountViews';
export type { BudgetEdit, BudgetInput, TargetInput } from './budgets';
export type { CategoryEdit } from './categories';
export type { AccountEventHandlers } from './events';
export type { GoalEdit, GoalInput } from './goals';
export { subscribeAccountManager } from './events';
// What the use cases answer with, as the routes map them to JSON: the routes see
// the Manager's results, never an Accessor (code review A3, OQ-163).
export type {
  Category, NewCategory, Subcategory,
} from '../../accessors/categoryAccessor';
export type { AccountFilter, AccountMonthBalance } from '../../accessors/accountAccessor';
export type { MonthRange } from '../../accessors/calendarMonth';
export type { Budget, BudgetPeriod, BudgetTarget } from '../../accessors/budgetAccessor';
export type { CreditCardMonthBalance } from '../../accessors/creditCardAccessor';
export type { Goal, GoalStatus } from '../../accessors/goalAccessor';

/**
 * Creates AccountManager.
 *
 * @param deps - The Accessors and Utilities it calls, and the clock.
 * @returns Every AccountManager use case, and its event handlers.
 */
export const createAccountManager = (deps: AccountDeps) => ({
  ...createCategories(deps),
  ...createAccounts(deps),
  ...createBudgets(deps),
  ...createGoals(deps),
  ...createEventHandlers(deps),
});

export type AccountManager = ReturnType<typeof createAccountManager>;
