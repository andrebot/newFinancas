import type {
  Account, AccountChanges, AccountFilter, AccountMonthBalance,
} from '../../accessors/accountAccessor';
import type { MonthRange } from '../../accessors/calendarMonth';
import type {
  CreditCard, CreditCardChanges, CreditCardMonthBalance, NewCreditCard,
} from '../../accessors/creditCardAccessor';
import type { AccountType, Visibility } from '../../db/schema/values';
import type { AccessRequest, DataAction } from '../../utilities/authorization';
import { checkFields, nonBlank } from '../../utilities/validation';
import { forbidden, requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import inSequence from '../sequence';
import requireValidFields, { requireNoProblems } from '../validation';
import { viewAccounts, type AccountView } from './accountViews';
import {
  requestLogger, todayOf, type AccountDeps, type AccountStores,
} from './context';
import {
  accountArchived, accountNotFound, cardsNotAllowed, creditCardNotFound,
} from './errors';

// Financial Accounts and their Credit Cards (financial-accounts/uc-01..03,
// FR-2). An Account is personal (its owner's alone) or shared (the permission
// table, plus a Member may edit what they created — FR-1.7, OQ-111). Cards are
// changed only through their Account's edit (OQ-35), and every write that
// touches both Accessors runs in one transaction (OQ-175).

/** The Account types that take Credit Cards (FR-2.7). */
const CARD_ACCOUNT_TYPES: ReadonlySet<AccountType> = new Set([
  'checking', 'savings', 'credit_card_only',
]);

/** A card to attach, as the route validated it. */
export type CardInput = Omit<NewCreditCard, 'accountId'>;

/** An Account to create, as the route validated it. */
export interface AccountInput {
  readonly name: string;
  readonly type: AccountType;
  readonly currency: string;
  readonly visibility: Visibility;
  /** Minor units: the balance today (OQ-169); 0 when left out. */
  readonly openingBalance?: number | undefined;
  readonly cards?: readonly CardInput[] | undefined;
}

/** An attached card's changes, as the route validated them. */
export type CardEdit = { readonly id: string } & {
  readonly [Field in keyof CreditCardChanges]?: CreditCardChanges[Field] | undefined;
};

/** The card changes of an Account edit (FR-2.9). */
export interface CardChanges {
  readonly add?: readonly CardInput[] | undefined;
  readonly edit?: readonly CardEdit[] | undefined;
  readonly remove?: readonly string[] | undefined;
}

/** An Account edit as the route validated it: any field may be left out. */
export interface AccountEdit {
  readonly name?: string | undefined;
  readonly visibility?: Visibility | undefined;
  readonly cards?: CardChanges | undefined;
}

/**
 * The access request for an action on an Account; for one that isn't there,
 * only the membership check, so a non-member still learns nothing.
 *
 * @param account - The Account, if found.
 * @param action - The data action.
 * @returns What AuthorizationUtility decides on.
 */
const accessTo = (account: Account | undefined, action: DataAction): AccessRequest => (
  account
    ? { action, visibility: account.visibility, ownerUserId: account.ownerUserId }
    : { action: 'data.view', visibility: 'shared', ownerUserId: null }
);

/**
 * Loads an Account the caller may take an action on.
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param ids - The household and the Account.
 * @param action - The data action.
 * @returns The Account.
 * @throws {ApiError} 404 `household.not_found` / `account.not_found`; 403 `auth.forbidden`.
 */
const loadAccount = async (
  deps: AccountDeps,
  context: SignedInContext,
  ids: { readonly householdId: string; readonly accountId: string },
  action: DataAction,
): Promise<Account> => {
  const account = await deps.accounts.findById(ids.householdId, ids.accountId);
  const { userId } = context.actor;
  await requireAccess(
    deps.authorization,
    userId,
    ids.householdId,
    accessTo(account, action),
    accountNotFound,
  );
  if (!account) throw accountNotFound();
  return account;
};

/**
 * The fields an Account edit changes: the name trimmed, fields not sent left out.
 *
 * @param edit - The edit, its name already checked as non-blank.
 * @returns What AccountAccessor writes.
 */
export const accountChangesOf = (edit: AccountEdit): AccountChanges => {
  const candidates = { name: edit.name?.trim(), visibility: edit.visibility };
  return Object.fromEntries(
    Object.entries(candidates).filter(([, value]) => value !== undefined),
  );
};

/**
 * The fields a card edit changes: its id and fields not sent left out.
 *
 * @param edit - The card edit.
 * @returns What CreditCardAccessor writes.
 */
export const cardChangesOf = ({ id: _, ...fields }: CardEdit): CreditCardChanges => (
  Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined))
);

/**
 * Checks an Account may be edited this way: not archived (OQ-175), and its
 * visibility changed only by its creator (FR-2.3, OQ-169).
 *
 * @param account - The Account.
 * @param actorId - The acting user.
 * @param visibility - The visibility asked for, if any.
 * @throws {ApiError} 409 `account.archived`; 403 `auth.forbidden`.
 */
const requireEditable = (
  account: Account,
  actorId: string,
  visibility: Visibility | undefined,
): void => {
  if (account.archivedAt) throw accountArchived();
  const changesVisibility = visibility !== undefined && visibility !== account.visibility;
  if (changesVisibility && account.ownerUserId !== actorId) throw forbidden();
};

/**
 * Checks an edit's card changes before anything is written: new cards only on
 * an Account type that takes them (FR-2.7), edits and removals only of this
 * Account's own cards.
 *
 * @param account - The Account.
 * @param attached - Its cards.
 * @param cards - The changes.
 * @throws {ApiError} 422 `account.cards_not_allowed`; 404 `credit_card.not_found`.
 */
const requireCardChanges = (
  account: Account,
  attached: readonly CreditCard[],
  cards: CardChanges,
): void => {
  if ((cards.add ?? []).length > 0 && !CARD_ACCOUNT_TYPES.has(account.type)) {
    throw cardsNotAllowed();
  }
  const own = new Set(attached.map(({ id }) => id));
  const named = [...(cards.edit ?? []).map(({ id }) => id), ...(cards.remove ?? [])];
  if (named.some((id) => !own.has(id))) throw creditCardNotFound();
};

/**
 * Writes an edit's card changes: attach, edit, then remove — one at a time,
 * inside the edit's transaction. A card gone since the check throws, so the
 * whole edit rolls back.
 *
 * @param stores - The Accessors, over the transaction.
 * @param accountId - The Account.
 * @param cards - The changes, already checked.
 * @param today - `YYYY-MM-DD`: where a new card's first cycle opens.
 * @returns The attached cards' ids.
 * @throws {ApiError} 404 `credit_card.not_found`.
 */
const writeCardChanges = async (
  stores: AccountStores,
  accountId: string,
  cards: CardChanges,
  today: string,
): Promise<string[]> => {
  const added = await inSequence(cards.add ?? [], (card) => (
    stores.creditCards.insert({ ...card, accountId }, today)
  ));
  await inSequence(cards.edit ?? [], async (edit) => {
    if (!(await stores.creditCards.update(accountId, edit.id, cardChangesOf(edit)))) {
      throw creditCardNotFound();
    }
  });
  await inSequence(cards.remove ?? [], async (creditCardId) => {
    if (!(await stores.creditCards.remove(accountId, creditCardId))) throw creditCardNotFound();
  });
  return added.map(({ id }) => id);
};

/**
 * Audits each card change of an edit (or a creation) as its own entry.
 *
 * @param context - The signed-in request.
 * @param householdId - The household.
 * @param changes - The attached cards' ids, and the edited and removed ones.
 */
const auditCardChanges = (
  context: SignedInContext,
  householdId: string,
  changes: { readonly added: readonly string[]; readonly cards: CardChanges },
): void => {
  const log = requestLogger(context);
  const entries = [
    ...changes.added.map((id) => ['AttachCreditCard', id] as const),
    ...(changes.cards.edit ?? []).map(({ id }) => ['EditCreditCard', id] as const),
    ...(changes.cards.remove ?? []).map((id) => ['RemoveCreditCard', id] as const),
  ];
  entries.forEach(([action, entityId]) => log.audit(action, {
    entityType: 'CreditCard', entityId, householdId,
  }));
};

/**
 * Builds the Account use cases.
 *
 * @param deps - The tier below.
 * @returns `listAccounts`, `getAccount`, `createAccount`, `editAccount`,
 *   `archiveAccount`, `getAccountBalances`, `getCreditCardBalances`.
 */
const createAccounts = (deps: AccountDeps) => ({
  /**
   * The Accounts the caller can see — every shared one and their own personal
   * ones — open ones first, each as it stands today (FR-2.3/2.4, OQ-175).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param filter - An optional visibility.
   * @returns The Accounts.
   * @throws {ApiError} 404 `household.not_found`.
   */
  listAccounts: async (
    context: SignedInContext,
    householdId: string,
    filter: AccountFilter,
  ): Promise<AccountView[]> => {
    await requireAccess(deps.authorization, context.actor.userId, householdId, accessTo(
      undefined,
      'data.view',
    ));
    const accounts = await deps.accounts.list(householdId, context.actor.userId, filter);
    return viewAccounts(deps, accounts, todayOf(deps));
  },

  /**
   * One Account the caller can see, as it stands today.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param accountId - The Account.
   * @returns The Account.
   * @throws {ApiError} 404 `household.not_found` / `account.not_found`.
   */
  getAccount: async (
    context: SignedInContext,
    householdId: string,
    accountId: string,
  ): Promise<AccountView> => {
    const account = await loadAccount(deps, context, { householdId, accountId }, 'data.view');
    const [view] = await viewAccounts(deps, [account], todayOf(deps));
    return view!;
  },

  /**
   * Creates an Account, owned by its creator, and attaches its cards — together
   * or not at all (uc-01, FR-2.1/2.7, OQ-175). The opening balance is today's.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param input - The Account; its name is trimmed and must not be blank.
   * @returns The Account, its balance the opening one and its cards owing nothing.
   * @throws {ApiError} 404 `household.not_found`; 403 `auth.forbidden`; 422
   *   `validation.failed` / `account.cards_not_allowed`.
   */
  createAccount: async (
    context: SignedInContext,
    householdId: string,
    input: AccountInput,
  ): Promise<AccountView> => {
    const ownerUserId = context.actor.userId;
    await requireAccess(deps.authorization, ownerUserId, householdId, {
      action: 'data.create', visibility: input.visibility, ownerUserId,
    });
    requireValidFields(input, { name: nonBlank });
    const { cards = [], openingBalance: startingBalance = 0, ...fields } = input;
    if (cards.length > 0 && !CARD_ACCOUNT_TYPES.has(input.type)) throw cardsNotAllowed();
    const today = todayOf(deps);
    const created = await deps.inTransaction(async (stores) => {
      const account = await stores.accounts.insert({
        ...fields,
        householdId,
        ownerUserId,
        name: input.name.trim(),
        startingBalance,
        startingBalanceDate: today,
      });
      const attached = await inSequence(cards, (card) => (
        stores.creditCards.insert({ ...card, accountId: account.id }, today)
      ));
      return { account, attached };
    });
    requestLogger(context).audit('CreateAccount', {
      entityType: 'Account', entityId: created.account.id, householdId,
    });
    auditCardChanges(context, householdId, {
      added: created.attached.map(({ id }) => id), cards: {},
    });
    return {
      ...created.account,
      currentBalance: startingBalance,
      cards: created.attached.map((card) => ({ ...card, outstandingBalance: 0 })),
    };
  },

  /**
   * Edits an Account and its cards in one write (uc-02, FR-2.3/2.9, OQ-35,
   * OQ-175). An empty edit reads the Account back, unaudited.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param accountId - The Account.
   * @param edit - The fields to change; a name is trimmed and must not be blank.
   * @returns The Account as it now stands.
   * @throws {ApiError} 404 `household.not_found` / `account.not_found` /
   *   `credit_card.not_found`; 403 `auth.forbidden`; 409 `account.archived`;
   *   422 `validation.failed` / `account.cards_not_allowed`.
   */
  editAccount: async (
    context: SignedInContext,
    householdId: string,
    accountId: string,
    edit: AccountEdit,
  ): Promise<AccountView> => {
    const account = await loadAccount(deps, context, { householdId, accountId }, 'data.edit');
    requireEditable(account, context.actor.userId, edit.visibility);
    requireNoProblems(checkFields(edit, { name: nonBlank }));
    const cards = edit.cards ?? {};
    requireCardChanges(account, await deps.creditCards.listByAccounts([accountId]), cards);
    const changes = accountChangesOf(edit);
    const today = todayOf(deps);
    const edited = await deps.inTransaction(async (stores) => {
      const updated = await stores.accounts.update(householdId, accountId, changes);
      if (!updated) throw accountNotFound();
      return { updated, added: await writeCardChanges(stores, accountId, cards, today) };
    });
    if (Object.keys(changes).length > 0) {
      requestLogger(context).audit('EditAccount', {
        entityType: 'Account', entityId: accountId, householdId,
      });
    }
    auditCardChanges(context, householdId, { added: edited.added, cards });
    const [view] = await viewAccounts(deps, [edited.updated], today);
    return view!;
  },

  /**
   * Archives an Account, one way; its history stays (uc-03, FR-2.4, OQ-34).
   * Archiving it again changes nothing and isn't audited.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param accountId - The Account.
   * @throws {ApiError} 404 `household.not_found` / `account.not_found`; 403
   *   `auth.forbidden`.
   */
  archiveAccount: async (
    context: SignedInContext,
    householdId: string,
    accountId: string,
  ): Promise<void> => {
    const account = await loadAccount(deps, context, { householdId, accountId }, 'data.delete');
    if (account.archivedAt) return;
    if (!(await deps.accounts.archive(householdId, accountId))) throw accountNotFound();
    requestLogger(context).audit('ArchiveAccount', {
      entityType: 'Account', entityId: accountId, householdId,
    });
  },

  /**
   * An Account's month balances, oldest first (FR-5.4/FR-6.6).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param accountId - The Account.
   * @param range - The months; open ends reach the history's ends.
   * @returns The balances.
   * @throws {ApiError} 404 `household.not_found` / `account.not_found`.
   */
  getAccountBalances: async (
    context: SignedInContext,
    householdId: string,
    accountId: string,
    range: MonthRange,
  ): Promise<AccountMonthBalance[]> => {
    await loadAccount(deps, context, { householdId, accountId }, 'data.view');
    return deps.accounts.listBalances(accountId, range);
  },

  /**
   * A card's billing-cycle balances, oldest first (FR-2.10); seen through its
   * Account, so a card on someone else's personal Account isn't there.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param creditCardId - The card.
   * @param range - The cycles, by closing month; open ends reach the history's ends.
   * @returns The balances.
   * @throws {ApiError} 404 `household.not_found` / `credit_card.not_found`.
   */
  getCreditCardBalances: async (
    context: SignedInContext,
    householdId: string,
    creditCardId: string,
    range: MonthRange,
  ): Promise<CreditCardMonthBalance[]> => {
    const card = await deps.creditCards.findById(householdId, creditCardId);
    const account = card && await deps.accounts.findById(householdId, card.accountId);
    await requireAccess(
      deps.authorization,
      context.actor.userId,
      householdId,
      accessTo(account, 'data.view'),
      creditCardNotFound,
    );
    if (!card) throw creditCardNotFound();
    return deps.creditCards.listBalances(creditCardId, range);
  },
});

export default createAccounts;
