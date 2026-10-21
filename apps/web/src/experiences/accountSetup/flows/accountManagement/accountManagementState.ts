import type {
  Account, CardNetwork, CreditCard, Currency,
} from '@financas/api-types';
import type {
  DataOutcome, RequestFailure, RequestOutcome,
} from '../../../../utilities/requestOutcome';

// The Account & Card Management Flow's state (FL11; OQ-175): the household's
// accounts as the Flow last fetched them, the request that is out, the open
// drawer (create, or edit one account) and the archive confirm inside it. The
// transitions are pure so the Flow's rules test without React. A success
// changes the list the way the API did — create appends the returned account,
// edit replaces with the server's copy, archive stamps `archivedAt` locally —
// so the Flow never reloads after a write. The Experience's tag invalidation
// still refetches its cached copy for the app's other readers; the Flow keeps
// its own list and doesn't read that refetch.

/** An account type (OQ-76). */
export type AccountType = 'checking' | 'savings' | 'credit_card_only' | 'investment';

/** Personal or shared (FR-2.3, OQ-169). */
export type Visibility = 'personal' | 'shared';

/** The account types that take credit cards (FR-2.7, OQ-11): all but investment. */
const CARD_ACCOUNT_TYPES: ReadonlySet<AccountType> = new Set([
  'checking', 'savings', 'credit_card_only',
]);

/**
 * Tells whether an account type takes credit cards (FR-2.7, OQ-11).
 *
 * @param type - The account type.
 * @returns Whether its forms offer cards.
 */
export const takesCards = (type: AccountType): boolean => CARD_ACCOUNT_TYPES.has(type);

/** A card as the forms hold it: its network and the fields the API stores. */
export interface CardDraft {
  readonly network: CardNetwork;
  /** The last four digits — nothing else is ever kept (NFR-SEC-7). */
  readonly last4: string;
  /** 1–28, the day of its month the billing cycle closes (OQ-170). */
  readonly closingDay: number;
  /** 1–28, the day of its month the bill is due. */
  readonly dueDay: number;
  /** 1–12. */
  readonly expirationMonth: number;
  /** Full year, e.g. 2030. */
  readonly expirationYear: number;
}

/** What the create form emits (OQ-169). */
export interface NewAccount {
  readonly name: string;
  readonly type: AccountType;
  readonly currency: Currency;
  readonly visibility: Visibility;
  /** Today's balance in minor units, or `null` when left out — the API stores 0. */
  readonly openingBalance: number | null;
  readonly cards: CardDraft[];
}

/** A card slot in the edit drawer: an attached card (with its id) or a new one. An
 * attached card's network and last four digits are fixed (OQ-192). */
export interface CardSlot extends CardDraft {
  /** Present while the card is attached to the account. */
  readonly id?: string | undefined;
  /** An attached card marked for removal, not yet sent. */
  readonly removed?: boolean | undefined;
}

/** What an attached card may change: its billing days and expiration (OQ-192). */
export type CardBilling = Pick<
  CardDraft, 'closingDay' | 'dueDay' | 'expirationMonth' | 'expirationYear'
>;

/** One attached card's edit: its id and its billing fields. */
export type CardEdit = CardBilling & { readonly id: string };

/** The card changes an edit sends, in the contract's shape (OQ-35). */
export interface CardChanges {
  readonly add?: CardDraft[];
  readonly edit?: CardEdit[];
  readonly remove?: string[];
}

/** What the edit form emits (FR-2.9, OQ-35). */
export interface AccountEdit {
  readonly accountId: string;
  /** The name, always sent back as it stands. */
  readonly name: string;
  /** Only when its creator changed it (FR-2.3); left out otherwise. */
  readonly visibility?: Visibility | undefined;
  /** Only when a card moved; left out otherwise. */
  readonly cards?: CardChanges | undefined;
}

/** The full set of card changes, before thinning to what actually moved. */
export interface FullCardChanges {
  readonly add: CardDraft[];
  readonly edit: CardEdit[];
  readonly remove: string[];
}

/**
 * Thins the card changes down to what actually moved, for an edit's payload.
 *
 * @param changes - The full set, possibly all empty.
 * @returns What `PATCH` takes, or nothing when no card moved.
 */
export const sparseCardChanges = (changes: FullCardChanges): CardChanges | undefined => {
  if (changes.add.length === 0 && changes.edit.length === 0 && changes.remove.length === 0) {
    return undefined;
  }
  return {
    ...(changes.add.length > 0 ? { add: changes.add } : {}),
    ...(changes.edit.length > 0 ? { edit: changes.edit } : {}),
    ...(changes.remove.length > 0 ? { remove: changes.remove } : {}),
  };
};

/** The request that is out, if any. */
export type Outgoing = { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly accountId: string }
  | { readonly kind: 'archive'; readonly accountId: string };

/** What the Experience answers for the list. */
export type AccountsOutcome = DataOutcome<readonly Account[]>;

/** What the Experience answers for a request: a create or edit carries the account it wrote. */
export type AccountActionOutcome = RequestOutcome & { readonly data?: Account | undefined };

/** The panels' content. */
export type AccountsView = { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly error: RequestFailure }
  | { readonly status: 'loaded'; readonly accounts: readonly Account[] };

/** The drawer that is open, if any. */
export type OpenDrawer = { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly accountId: string };

/** The Flow's accumulated state. */
export interface AccountManagementState {
  readonly view: AccountsView;
  /** Its control spins and the others wait while it is out. */
  readonly out?: Outgoing | undefined;
  readonly drawer?: OpenDrawer | undefined;
  /** The archive confirm open inside the edit drawer, by account id. */
  readonly archiving?: string | undefined;
  /** The last request's failure, shown in the open drawer until it moves on. */
  readonly lastError?: RequestFailure | undefined;
}

/** The Flow as it opens: the list loading, nothing else. */
export const INITIAL_ACCOUNTS: AccountManagementState = { view: { status: 'loading' } };

/**
 * Marks the list as loading again (a retry). Any open drawer closes with it.
 *
 * @param state - The current state.
 * @returns The state while the list is fetched.
 */
export const loadingAccounts = (state: AccountManagementState): AccountManagementState => ({
  ...state, view: { status: 'loading' }, drawer: undefined, archiving: undefined,
});

/**
 * Applies the Experience's answer for the list.
 *
 * @param state - The state while the list was fetched.
 * @param outcome - The accounts, or why they failed.
 * @returns The loaded list, or the failure and its retry.
 */
export const afterLoad = (
  state: AccountManagementState,
  outcome: AccountsOutcome,
): AccountManagementState => ({
  ...state,
  view: outcome.ok
    ? { status: 'loaded', accounts: outcome.data }
    : { status: 'failed', error: outcome.error },
});

/**
 * Opens a drawer.
 *
 * @param state - The current state.
 * @param drawer - Which one, about which account for an edit.
 * @returns The state with the drawer open and no archive confirm.
 */
export const drawerOpened = (
  state: AccountManagementState,
  drawer: OpenDrawer,
): AccountManagementState => ({
  ...state, drawer, archiving: undefined, lastError: undefined,
});

/**
 * Closes the open drawer and its archive confirm — unless a request is out:
 * the drawer then stays, so a failure still has its banner to show in.
 *
 * @param state - The current state.
 * @returns The state with no drawer open, or as it was while a request is out.
 */
export const drawerClosed = (state: AccountManagementState): AccountManagementState => (
  state.out
    ? state
    : {
      ...state, drawer: undefined, archiving: undefined, lastError: undefined,
    }
);

/**
 * Opens the archive confirm inside the edit drawer.
 *
 * @param state - The current state.
 * @param accountId - Which account is archived on a yes.
 * @returns The state with the confirm open.
 */
export const archiveConfirmOpened = (
  state: AccountManagementState,
  accountId: string,
): AccountManagementState => ({ ...state, archiving: accountId });

/**
 * Closes the archive confirm; the drawer stays open.
 *
 * @param state - The current state.
 * @returns The state with no confirm open.
 */
export const archiveConfirmCancelled = (state: AccountManagementState): AccountManagementState => ({
  ...state, archiving: undefined,
});

/**
 * Marks a request as out.
 *
 * @param state - The current state.
 * @param outgoing - Which one.
 * @returns The state while it is out.
 */
export const started = (
  state: AccountManagementState,
  outgoing: Outgoing,
): AccountManagementState => ({
  ...state, out: outgoing, lastError: undefined,
});

/**
 * Splits a loaded list into the live accounts and its archived ones.
 *
 * @param accounts - The household's accounts, in any order.
 * @returns Both halves; the archived keep their order.
 */
export const splitAccounts = (accounts: readonly Account[]) => ({
  active: accounts.filter((account) => account.archivedAt === null),
  archived: accounts.filter((account) => account.archivedAt !== null),
});

/**
 * Applies a request's success to the loaded list, as the API did.
 *
 * @param view - The loaded list.
 * @param outgoing - The request that succeeded.
 * @param written - The account a create or an edit returned, the server's copy.
 * @returns The list after it.
 */
const applied = (
  view: Extract<AccountsView, { status: 'loaded' }>,
  outgoing: Outgoing,
  written?: Account,
): AccountsView => {
  if (outgoing.kind === 'create') {
    return written ? { ...view, accounts: [...view.accounts, written] } : view;
  }
  if (outgoing.kind === 'edit') {
    return written
      ? {
        ...view,
        accounts: view.accounts.map((account) => (
          account.id === written.id ? written : account
        )),
      }
      : view;
  }
  const archivedAt = new Date().toISOString();
  return {
    ...view,
    accounts: view.accounts.map((account) => (
      account.archivedAt === null && account.id === outgoing.accountId
        ? { ...account, archivedAt }
        : account
    )),
  };
};

/**
 * Applies the Experience's answer for the request that was out. A success
 * changes the list and closes the drawer; a failure keeps everything so the
 * form still holds what was typed.
 *
 * @param state - The state while the request was out.
 * @param outcome - The Experience's answer (a create/edit carries its account).
 * @returns The next state.
 */
export const afterAction = (
  state: AccountManagementState,
  outcome: AccountActionOutcome,
): AccountManagementState => {
  const { out, view } = state;
  if (!out) return state;
  if (!outcome.ok) return { ...state, out: undefined, lastError: outcome.error };
  const nextView = view.status === 'loaded'
    ? applied(view, out, outcome.data)
    : view;
  return {
    ...state,
    view: nextView,
    out: undefined,
    drawer: undefined,
    archiving: undefined,
    lastError: undefined,
  };
};

/**
 * Tells whether a role may create an account in the household (FR-1.7): every
 * member — a Viewer too, since personal data is its owner's whatever their
 * role (OQ-192).
 *
 * @param role - The actor's role.
 * @returns Whether the Add Account button shows.
 */
export const mayCreate = (role: string | undefined) => role !== undefined;

/**
 * Tells whether a role may create a shared account (FR-1.7): everyone but a
 * Viewer, who creates personal ones only.
 *
 * @param role - The actor's role.
 * @returns Whether the create form offers Shared.
 */
export const mayShare = (role: string | undefined) => role !== undefined && role !== 'Viewer';

/**
 * Tells whether an account is editable by the actor (FR-1.7, OQ-111): a
 * personal one only by its owner whatever their role; a shared one by an
 * Owner/Admin, or a Member who created it.
 *
 * @param account - The account.
 * @param selfUserId - The signed-in user's id.
 * @param role - Their role in the household.
 * @returns Whether they may edit and archive it.
 */
export const mayEdit = (account: Account, selfUserId: string, role: string | undefined) => {
  if (!role) return false;
  if (account.visibility === 'personal') return account.ownerUserId === selfUserId;
  if (role === 'Owner' || role === 'Admin') return true;
  return role === 'Member' && account.ownerUserId === selfUserId;
};

/**
 * Tells whether the actor may change an account's visibility: only its
 * creator, whatever their role (FR-2.3).
 *
 * @param account - The account.
 * @param selfUserId - The signed-in user's id.
 * @returns Whether the control is theirs to move.
 */
export const mayChangeVisibility = (account: Account, selfUserId: string) => (
  account.ownerUserId === selfUserId
);

/** The fields a slot holds for a new card, without its bookkeeping. */
const cardFieldsOf = (slot: CardSlot): CardDraft => ({
  network: slot.network,
  last4: slot.last4,
  closingDay: slot.closingDay,
  dueDay: slot.dueDay,
  expirationMonth: slot.expirationMonth,
  expirationYear: slot.expirationYear,
});

/** The fields an attached card may change: its network and last four are fixed. */
const billingOf = (slot: CardBilling): CardBilling => ({
  closingDay: slot.closingDay,
  dueDay: slot.dueDay,
  expirationMonth: slot.expirationMonth,
  expirationYear: slot.expirationYear,
});

/**
 * Tells whether a slot's billing fields moved away from the card it edits.
 *
 * @param slot - The slot, attached and not removed.
 * @param originals - The account's cards as they were loaded.
 * @returns Whether an edit must be sent for it.
 */
const changed = (slot: CardSlot, originals: readonly CreditCard[]) => {
  const original = originals.find((card) => card.id === slot.id);
  if (!original) return true;
  const before = billingOf(original);
  return Object.entries(billingOf(slot)).some(([key, value]) => (
    before[key as keyof CardBilling] !== value
  ));
};

/**
 * Builds the card changes an edit sends from its slots: new cards added,
 * attached ones edited only where a billing field moved, removed ones dropped.
 *
 * @param slots - The drawer's card slots.
 * @param originals - The account's cards as they were loaded.
 * @returns What `PATCH` takes; empty when nothing changed.
 */
export const cardChangesOf = (
  slots: readonly CardSlot[],
  originals: readonly CreditCard[],
): FullCardChanges => {
  const add = slots.filter((slot) => slot.id === undefined).map(cardFieldsOf);
  const edit = slots.flatMap((slot) => {
    if (slot.id === undefined || slot.removed || !changed(slot, originals)) return [];
    return [{ id: slot.id, ...billingOf(slot) }];
  });
  const remove = slots.flatMap((slot) => (slot.id !== undefined && slot.removed ? [slot.id] : []));
  return { add, edit, remove };
};
