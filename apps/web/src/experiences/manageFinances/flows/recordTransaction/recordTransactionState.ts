import type {
  HoldingAllocation, InvestmentHolding, InvestmentScheduleEntry, LedgerItem,
} from '@financas/api-types';
import type { AllocationGoal, AllocationRow } from '../../../../kit/allocationEditor/allocation';
import type { RequestFailure } from '../../../../utilities/requestOutcome';
import type { Problems } from './transactionChecks';
import { editableOf, type Editable } from './transactionRequest';
import { isFixedTermBuy, takesHoldingSplit, type TransactionForm } from './transactionForm';

// The Record Transaction Flow's state (FL15; OQ-201, OQ-206): the form, and
// on an edit the form it opened with; what the Flow asked the Experience to
// read — an account's Holdings (the Holding picker), a Holding's split (a
// sell's, pre-filled) and a fixed-term buy's schedule (whether it has started,
// which locks the amount, date and terms — D8); the request that is out, its
// last failure and the refusals of the last submit. The Flow never calls the
// backend: every read and write is the Experience's. Pure, so the rules test
// without React.

/** A read the Flow asked for: loading, failed, or its data. */
export type Load<Data> = { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly error: RequestFailure }
  | { readonly status: 'loaded'; readonly data: Data };

/** A Goal as the split shows it: its name, its progress, whether it is completed. */
export interface SplitGoal extends AllocationGoal {
  /** A completed Goal's share is kept or removed, never grown (FR-8.9). */
  readonly completed: boolean;
}

/** The transaction an edit is about, with the Holding a trade names. */
export interface EditedTransaction {
  readonly item: LedgerItem;
  /** A buy's Holding, for its terms (the Experience reads it). */
  readonly holding?: InvestmentHolding | undefined;
}

/** The Flow's accumulated state. */
export interface RecordTransactionState {
  readonly form: TransactionForm;
  /** On an edit, the form as it opened: the changes are against it. */
  readonly original?: TransactionForm | undefined;
  /** Each account's Holdings, by account id, once asked for. */
  readonly holdings: Readonly<Record<string, Load<readonly InvestmentHolding[]>>>;
  /** The Holding whose split was asked for, and how it went. */
  readonly split?: { readonly holdingId: string; readonly load: Load<null> } | undefined;
  /** An edited fixed-term buy's schedule: has an entry posted (D8)? */
  readonly schedule?: Load<boolean> | undefined;
  /** The record or save is out: the drawer waits. */
  readonly out: boolean;
  /** Its last failure, for the drawer's banner. */
  readonly lastError?: RequestFailure | undefined;
  /** The last submit's refusals, shown until the field changes. */
  readonly problems: Problems;
  /** How many submits were refused; each moves the focus to the first refusal. */
  readonly refusals: number;
}

/**
 * Builds the state a drawer opens with.
 *
 * @param form - The new form, or the edit's pre-filled one.
 * @param editing - Whether it is an edit.
 * @returns The opening state.
 */
export const openedWith = (form: TransactionForm, editing: boolean): RecordTransactionState => ({
  form,
  original: editing ? form : undefined,
  holdings: {},
  out: false,
  problems: {},
  refusals: 0,
});

/**
 * Keeps a split read only while the form still holds its rows: the same
 * Holding, on a kind pre-filled from it. Once the rows are dropped — another
 * kind, account or Holding — it is read again when they come back.
 *
 * @param split - The split read, if any.
 * @param form - The changed form.
 * @returns The read, or nothing.
 */
const splitKept = (split: RecordTransactionState['split'], form: TransactionForm) => (
  split?.holdingId === form.holdingId && takesHoldingSplit(form.kind) ? split : undefined
);

/**
 * Applies a change to the form; the refusals of the fields it touched clear,
 * and a split read whose rows it dropped is forgotten.
 *
 * @param state - The current state.
 * @param form - The changed form.
 * @param cleared - The fields whose refusals go.
 * @returns The state with the new form.
 */
export const formChanged = (
  state: RecordTransactionState,
  form: TransactionForm,
  cleared: readonly (keyof Problems)[],
): RecordTransactionState => ({
  ...state,
  form,
  split: splitKept(state.split, form),
  problems: Object.fromEntries(
    Object.entries(state.problems).filter(([field]) => !cleared.includes(field as keyof Problems)),
  ),
});

/**
 * Tells which account's Holdings the form needs and hasn't asked for.
 *
 * @param state - The current state.
 * @param needed - Whether the kind picks a Holding.
 * @returns The account id to read, or nothing.
 */
export const holdingsToLoad = (state: RecordTransactionState, needed: boolean) => {
  const { accountId } = state.form;
  if (!needed || accountId === undefined || state.holdings[accountId]) return undefined;
  return accountId;
};

/**
 * Records how an account's Holdings read went (or that it started).
 *
 * @param state - The current state.
 * @param accountId - The account.
 * @param load - Its Holdings, loading or failed.
 * @returns The state with the read.
 */
export const holdingsLoaded = (
  state: RecordTransactionState,
  accountId: string,
  load: Load<readonly InvestmentHolding[]>,
): RecordTransactionState => ({ ...state, holdings: { ...state.holdings, [accountId]: load } });

/**
 * Forgets a failed Holdings read, so it is asked for again (a retry).
 *
 * @param state - The current state.
 * @param accountId - The account.
 * @returns The state without that read.
 */
export const holdingsRetried = (
  state: RecordTransactionState,
  accountId: string,
): RecordTransactionState => {
  const holdings = Object.fromEntries(
    Object.entries(state.holdings).filter(([id]) => id !== accountId),
  );
  return { ...state, holdings };
};

/**
 * Lists the chosen account's Holdings, once read, archived ones left out.
 *
 * @param state - The current state.
 * @returns Them; none while loading or failed.
 */
export const loadedHoldingsOf = (state: RecordTransactionState): readonly InvestmentHolding[] => {
  const { accountId } = state.form;
  const load = accountId === undefined ? undefined : state.holdings[accountId];
  if (load?.status !== 'loaded') return [];
  return load.data.filter((holding) => !holding.archivedAt);
};

/**
 * Tells whose split the form needs and hasn't asked for: a new sell's or
 * redemption's Holding (OQ-206) — a buy's split is typed, an edit's not edited.
 *
 * @param state - The current state.
 * @param needed - Whether the kind carries its Holding's split.
 * @returns The Holding id to read, or nothing.
 */
export const splitToLoad = (state: RecordTransactionState, needed: boolean) => {
  const { holdingId } = state.form;
  if (!needed || state.original || holdingId === undefined) return undefined;
  return state.split?.holdingId === holdingId ? undefined : holdingId;
};

/**
 * Builds the editor's rows from a Holding's split: each visible Goal's share,
 * named and with its progress; a share whose Goal isn't listed is the
 * server's to keep (OQ-218).
 *
 * @param shares - The split read.
 * @param goals - The Goals the user can see.
 * @returns The rows, in the split's order.
 */
export const splitRowsOf = (
  shares: readonly HoldingAllocation[],
  goals: readonly SplitGoal[],
): AllocationRow[] => shares.flatMap((share) => {
  const goal = goals.find((candidate) => candidate.id === share.goalId);
  return goal ? [{
    goalId: goal.id,
    name: goal.name,
    percent: share.percentage,
    progress: goal.progress,
    completed: goal.completed,
  }] : [];
});

/**
 * Tells whether an edit needs its schedule read: a fixed-term buy's (D8).
 *
 * @param state - The current state.
 * @returns The Holding whose schedule to read, or nothing.
 */
export const scheduleToLoad = (state: RecordTransactionState) => {
  const { original } = state;
  if (!original || state.schedule || !isFixedTermBuy(original)) return undefined;
  return original.holdingId;
};

/**
 * Reads whether a schedule has started: an entry has posted.
 *
 * @param entries - The Holding's schedule.
 * @returns `true` once any entry posted.
 */
export const hasStarted = (entries: readonly InvestmentScheduleEntry[]) => (
  entries.some((entry) => entry.postedAt !== null && entry.postedAt !== undefined)
);

/**
 * Tells what the edit may change: everything while its schedule is unread or
 * its read failed (the server still refuses, 409), less once it has started.
 *
 * @param state - The current state, an edit's.
 * @returns What is editable.
 */
export const editableNow = (state: RecordTransactionState): Editable => {
  const started = state.schedule?.status === 'loaded' && state.schedule.data;
  return editableOf(state.form, started === true);
};

/**
 * Tells whether the edit still waits on its schedule, which decides what it may change.
 *
 * @param state - The current state.
 * @returns `true` while the read is out.
 */
export const awaitsSchedule = (state: RecordTransactionState) => (
  state.schedule?.status === 'loading'
);

/**
 * Records a refused submit: its refusals show, and the focus moves.
 *
 * @param state - The current state.
 * @param problems - The refusals.
 * @returns The state with them.
 */
export const submitRefused = (
  state: RecordTransactionState,
  problems: Problems,
): RecordTransactionState => ({ ...state, problems, refusals: state.refusals + 1 });

/**
 * Starts the record or save.
 *
 * @param state - The current state.
 * @returns The state with it out and no failure.
 */
export const requestStarted = (state: RecordTransactionState): RecordTransactionState => ({
  ...state, out: true, lastError: undefined, problems: {},
});

/**
 * Ends the record or save: a failure stays for the banner.
 *
 * @param state - The current state.
 * @param error - Why it failed, if it did.
 * @returns The state with nothing out.
 */
export const requestEnded = (
  state: RecordTransactionState,
  error: RequestFailure | undefined,
): RecordTransactionState => ({ ...state, out: false, lastError: error });
