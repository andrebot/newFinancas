import createCategories from './categories';
import type { AccountDeps } from './context';
import { createEventHandlers } from './events';

// AccountManager (M2, VBD §2.1): what a user sets up, or maintains, ahead of any
// cash-flow event — built in parts (OQ-174): Categories and their default
// seeding first. Each use case decides; the Accessors apply (OQ-107).

export type { AccountDeps } from './context';
export type { CategoryEdit } from './categories';
export type { AccountEventHandlers } from './events';
export { subscribeAccountManager } from './events';
// What the use cases answer with, as the routes map them to JSON: the routes see
// the Manager's results, never an Accessor (code review A3, OQ-163).
export type {
  Category, NewCategory, Subcategory,
} from '../../accessors/categoryAccessor';

/**
 * Creates AccountManager.
 *
 * @param deps - The Accessors and Utilities it calls.
 * @returns Every AccountManager use case, and its event handlers.
 */
export const createAccountManager = (deps: AccountDeps) => ({
  ...createCategories(deps),
  ...createEventHandlers(deps),
});

export type AccountManager = ReturnType<typeof createAccountManager>;
