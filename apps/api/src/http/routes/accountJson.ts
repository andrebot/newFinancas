import type {
  AccountMonthBalance, AccountView, Budget, BudgetPeriod, Category, CreditCardMonthBalance,
  CreditCardView, Goal, Subcategory,
} from '../../managers/account';

// AccountManager's results in the contract's JSON shapes: times as ISO strings,
// only the fields the contract names.

/**
 * A Subcategory as the contract shows it (`components/schemas/Subcategory`).
 *
 * @param subcategory - The Subcategory.
 * @returns The JSON shape.
 */
export const toSubcategoryJson = (subcategory: Subcategory) => ({
  id: subcategory.id,
  categoryId: subcategory.categoryId,
  name: subcategory.name,
  archivedAt: subcategory.archivedAt?.toISOString() ?? null,
  createdAt: subcategory.createdAt.toISOString(),
});

/**
 * A Category as the contract shows it (`components/schemas/Category`).
 *
 * @param category - The Category with its Subcategories.
 * @returns The JSON shape.
 */
export const toCategoryJson = (category: Category) => ({
  id: category.id,
  householdId: category.householdId,
  name: category.name,
  icon: category.icon,
  color: category.color,
  archivedAt: category.archivedAt?.toISOString() ?? null,
  createdAt: category.createdAt.toISOString(),
  subcategories: category.subcategories.map(toSubcategoryJson),
});

/**
 * A Credit Card as the contract shows it (`components/schemas/CreditCard`).
 *
 * @param card - The card, with what it owes now.
 * @returns The JSON shape.
 */
export const toCreditCardJson = (card: CreditCardView) => ({
  id: card.id,
  accountId: card.accountId,
  network: card.network,
  last4: card.last4,
  closingDay: card.closingDay,
  dueDay: card.dueDay,
  expirationMonth: card.expirationMonth,
  expirationYear: card.expirationYear,
  createdAt: card.createdAt.toISOString(),
  outstandingBalance: card.outstandingBalance,
});

/**
 * An Account as the contract shows it (`components/schemas/Account`).
 *
 * @param account - The Account, with its balance now and its cards.
 * @returns The JSON shape.
 */
export const toAccountJson = (account: AccountView) => ({
  id: account.id,
  householdId: account.householdId,
  ownerUserId: account.ownerUserId,
  name: account.name,
  type: account.type,
  currency: account.currency,
  visibility: account.visibility,
  startingBalanceDate: account.startingBalanceDate,
  archivedAt: account.archivedAt?.toISOString() ?? null,
  createdAt: account.createdAt.toISOString(),
  currentBalance: account.currentBalance,
  cards: account.cards.map(toCreditCardJson),
});

/**
 * An Account's month balance (`components/schemas/AccountMonthBalance`).
 *
 * @param balance - One month.
 * @returns The JSON shape.
 */
export const toAccountBalanceJson = (balance: AccountMonthBalance) => ({
  year: balance.year,
  month: balance.month,
  openingBalance: balance.openingBalance,
  endingBalance: balance.endingBalance,
  updatedAt: balance.updatedAt.toISOString(),
});

/**
 * A card's billing-cycle balance (`components/schemas/CreditCardMonthBalance`).
 *
 * @param balance - One cycle, named by its closing month.
 * @returns The JSON shape.
 */
export const toCreditCardBalanceJson = (balance: CreditCardMonthBalance) => ({
  year: balance.year,
  month: balance.month,
  openingOutstandingBalance: balance.openingOutstandingBalance,
  endingOutstandingBalance: balance.endingOutstandingBalance,
  updatedAt: balance.updatedAt.toISOString(),
});

/**
 * A Budget as the contract shows it (`components/schemas/Budget`).
 *
 * @param budget - The Budget with its targets.
 * @returns The JSON shape.
 */
export const toBudgetJson = (budget: Budget) => ({
  id: budget.id,
  householdId: budget.householdId,
  ownerUserId: budget.ownerUserId,
  name: budget.name,
  targetAmount: budget.targetAmount,
  currency: budget.currency,
  visibility: budget.visibility,
  targets: budget.targets,
  createdAt: budget.createdAt.toISOString(),
});

/**
 * One month of a Budget (`components/schemas/BudgetPeriod`).
 *
 * @param period - The month, its target and its spend.
 * @returns The JSON shape.
 */
export const toBudgetPeriodJson = (period: BudgetPeriod) => ({
  year: period.year,
  month: period.month,
  targetAmount: period.targetAmount,
  spendAmount: period.spendAmount,
  createdAt: period.createdAt.toISOString(),
});

/**
 * A Goal as the contract shows it (`components/schemas/Goal`).
 *
 * @param goal - The Goal.
 * @returns The JSON shape.
 */
export const toGoalJson = (goal: Goal) => ({
  id: goal.id,
  householdId: goal.householdId,
  ownerUserId: goal.ownerUserId,
  name: goal.name,
  targetAmount: goal.targetAmount,
  targetCurrency: goal.targetCurrency,
  dueDate: goal.dueDate,
  visibility: goal.visibility,
  createdAt: goal.createdAt.toISOString(),
  completedAt: goal.completedAt?.toISOString() ?? null,
});
