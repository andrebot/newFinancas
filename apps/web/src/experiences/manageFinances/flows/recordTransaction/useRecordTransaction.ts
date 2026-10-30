import { useEffect, useState } from 'react';
import type {
  Account, HoldingAllocation, InvestmentHolding, InvestmentScheduleEntry,
  TransactionCreateRequest, TransactionUpdateRequest,
} from '@financas/api-types';
import { useAlerts } from '../../../../utilities/AlertProvider';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { DataOutcome, RequestOutcome } from '../../../../utilities/requestOutcome';
import useFocusFirstInvalid from '../../../../utilities/useFocusFirstInvalid';
import useToday from '../../../../utilities/useToday';
import {
  editableNow, formChanged, hasStarted, holdingsLoaded, holdingsRetried,
  holdingsToLoad, loadedHoldingsOf, openedWith, requestEnded, requestStarted, scheduleToLoad,
  splitRowsOf, splitToLoad, submitRefused,
  type EditedTransaction, type RecordTransactionState, type SplitGoal,
} from './recordTransactionState';
import { recordText } from './recordText';
import { isClear, problemsOf, type CheckedField } from './transactionChecks';
import {
  currencyOf, isBuy, isTrade, namesHolding, newFormOf, withHoldingSplit, type TransactionForm,
} from './transactionForm';
import { changesOf, createRequestOf, editFormOf } from './transactionRequest';

// The Record Transaction Flow's controller (FL15): its state and what changes
// it — a form change, which asks the Experience for whatever the new form
// needs read (an account's Holdings, a sell's Holding split, OQ-206); an
// edited fixed-term buy's schedule, read once (D8); the retries; and the
// submit, checked, then sent as a record or an edit's changes. The Flow
// renders what this holds; neither calls the backend.

/** What the Experience reads and writes for the Flow. */
export interface RecordTransactionRequests {
  /** `GET …/accounts/:accountId/holdings`. */
  readonly onLoadHoldings: (
    accountId: string,
  ) => Promise<DataOutcome<readonly InvestmentHolding[]>>;
  /** `GET …/holdings/:holdingId/allocations`. */
  readonly onLoadSplit: (holdingId: string) => Promise<DataOutcome<readonly HoldingAllocation[]>>;
  /** `GET …/holdings/:holdingId/schedule-entries`. */
  readonly onLoadSchedule: (
    holdingId: string,
  ) => Promise<DataOutcome<readonly InvestmentScheduleEntry[]>>;
  /** `POST …/transactions`. */
  readonly onRecord: (request: TransactionCreateRequest) => Promise<RequestOutcome>;
  /** `PATCH …/transactions/:transactionId`. */
  readonly onSave: (
    transactionId: string,
    changes: TransactionUpdateRequest,
  ) => Promise<RequestOutcome>;
  /** Closes the drawer — after a success too, so the Experience refreshes. */
  readonly onClose: () => void;
}

/** What the controller works from: the edited row, the lists and the requests. */
export interface RecordTransactionInput extends RecordTransactionRequests {
  readonly transaction?: EditedTransaction | undefined;
  readonly accounts: readonly Account[];
  readonly goals: readonly SplitGoal[];
}

/** What the Flow renders from and calls. */
export interface RecordTransactionController {
  readonly state: RecordTransactionState;
  /** Applies a form change; the refusals of the fields it answers clear. */
  readonly change: (form: TransactionForm, cleared: readonly CheckedField[]) => void;
  /** Asks for the chosen account's Holdings again. */
  readonly retryHoldings: () => void;
  /** Asks for the chosen Holding's split again. */
  readonly retrySplit: () => void;
  /** Checks the form and sends it. */
  readonly submit: () => void;
}

/** A state update, as `setState` takes it. */
type Update = (update: (state: RecordTransactionState) => RecordTransactionState) => void;

/**
 * Asks the Experience for an account's Holdings, once a new transaction's kind
 * picks one; an edit shows its Holding, never picks one.
 *
 * @param state - The state after a change.
 * @param setState - The Flow's state update.
 * @param onLoadHoldings - The Experience's read.
 */
const loadHoldings = async (
  state: RecordTransactionState,
  setState: Update,
  onLoadHoldings: RecordTransactionRequests['onLoadHoldings'],
) => {
  const accountId = holdingsToLoad(state, namesHolding(state.form.kind) && !state.original);
  if (accountId === undefined) return;
  setState((current) => holdingsLoaded(current, accountId, { status: 'loading' }));
  const outcome = await onLoadHoldings(accountId);
  setState((current) => holdingsLoaded(current, accountId, outcome.ok
    ? { status: 'loaded', data: outcome.data }
    : { status: 'failed', error: outcome.error }));
};

/**
 * Applies a Holding's split read: the read's state, and the rows pre-filled
 * unless another Holding was picked meanwhile.
 *
 * @param current - The state as it stands.
 * @param holdingId - The Holding read.
 * @param outcome - The read's answer.
 * @param goals - The Goals the user can see, for the rows.
 * @returns The state with the read applied.
 */
const splitRead = (
  current: RecordTransactionState,
  holdingId: string,
  outcome: DataOutcome<readonly HoldingAllocation[]>,
  goals: readonly SplitGoal[],
): RecordTransactionState => {
  if (current.split?.holdingId !== holdingId) return current;
  if (!outcome.ok) {
    return { ...current, split: { holdingId, load: { status: 'failed', error: outcome.error } } };
  }
  return {
    ...current,
    split: { holdingId, load: { status: 'loaded', data: null } },
    form: withHoldingSplit(current.form, holdingId, splitRowsOf(outcome.data, goals)),
  };
};

/**
 * Asks the Experience for a new sell's or redemption's Holding split, to
 * pre-fill it (OQ-206).
 *
 * @param state - The state after a change.
 * @param setState - The Flow's state update.
 * @param onLoadSplit - The Experience's read.
 * @param goals - The Goals the user can see, for the rows.
 */
const loadSplit = async (
  state: RecordTransactionState,
  setState: Update,
  onLoadSplit: RecordTransactionRequests['onLoadSplit'],
  goals: readonly SplitGoal[],
) => {
  const holdingId = splitToLoad(state, isTrade(state.form.kind) && !isBuy(state.form.kind));
  if (holdingId === undefined) return;
  setState((current) => ({ ...current, split: { holdingId, load: { status: 'loading' } } }));
  const outcome = await onLoadSplit(holdingId);
  setState((current) => splitRead(current, holdingId, outcome, goals));
};

/**
 * Reads an edited fixed-term buy's schedule once, to lock what it may no
 * longer change (D8); a failed read leaves everything open — the server still
 * refuses (409 `transaction.schedule_started`).
 *
 * @param state - The state.
 * @param setState - The Flow's state update.
 * @param onLoadSchedule - The Experience's read.
 */
const useScheduleRead = (
  state: RecordTransactionState,
  setState: Update,
  onLoadSchedule: RecordTransactionRequests['onLoadSchedule'],
) => {
  const holdingId = scheduleToLoad(state);
  useEffect(() => {
    if (holdingId === undefined) return;
    setState((current) => ({ ...current, schedule: { status: 'loading' } }));
    onLoadSchedule(holdingId).then((outcome) => setState((current) => ({
      ...current,
      schedule: outcome.ok
        ? { status: 'loaded', data: hasStarted(outcome.data) }
        : { status: 'failed', error: outcome.error },
    })));
  }, [holdingId, onLoadSchedule, setState]);
};

/**
 * Builds the state a drawer opens with: the row's form on an edit, else a new one.
 *
 * @param transaction - The row an edit is about, if any.
 * @param accounts - The accounts the user can see.
 * @param today - Today, `YYYY-MM-DD`.
 * @returns The opening state.
 */
const openingStateOf = (
  transaction: EditedTransaction | undefined,
  accounts: readonly Account[],
  today: string,
) => (transaction
  ? openedWith(editFormOf(transaction.item, transaction.holding), true)
  : openedWith(newFormOf(accounts, today), false));

/**
 * Builds the request a passing form sends: an edit's changes — `null` when
 * nothing changed — or a new transaction's record.
 *
 * @param state - The state, its form checked.
 * @param input - The edited row, the accounts and the requests.
 * @returns The request to send, `null` for an unchanged edit, nothing without a currency.
 */
const requestOf = (state: RecordTransactionState, input: RecordTransactionInput) => {
  const { original, form } = state;
  const transactionId = input.transaction?.item.id;
  if (original && transactionId) {
    const changes = changesOf(original, form, editableNow(state));
    if (Object.keys(changes).length === 0) return null;
    return { done: 'saved', send: () => input.onSave(transactionId, changes) } as const;
  }
  const currency = currencyOf(form, input.accounts);
  if (!currency) return undefined;
  return { done: 'recorded', send: () => input.onRecord(createRequestOf(form, currency)) } as const;
};

/**
 * Holds the Flow's state and runs its reads and its write.
 *
 * @param input - The edited row, the lists and the Experience's requests.
 * @returns The controller.
 */
export default function useRecordTransaction(
  input: RecordTransactionInput,
): RecordTransactionController {
  const {
    transaction, accounts, goals, onLoadHoldings, onLoadSplit, onLoadSchedule, onClose,
  } = input;
  const translator = useI18n();
  const alerts = useAlerts();
  const today = useToday();
  const [state, setState] = useState(() => openingStateOf(transaction, accounts, today));
  useFocusFirstInvalid(state.refusals);
  useScheduleRead(state, setState, onLoadSchedule);

  /**
   * Starts the reads a new state needs.
   *
   * @param next - The state just set.
   */
  const startReads = (next: RecordTransactionState) => {
    loadHoldings(next, setState, onLoadHoldings);
    loadSplit(next, setState, onLoadSplit, goals);
  };

  /**
   * Sets a new state and starts the reads it needs.
   *
   * @param next - The new state.
   */
  const moveTo = (next: RecordTransactionState) => {
    setState(() => next);
    startReads(next);
  };

  /**
   * Sends the record or save: a success is toasted and closes the drawer; a
   * failure stays in its banner.
   *
   * @param send - The Experience's request.
   * @param done - The success toast's key.
   */
  const run = async (send: () => Promise<RequestOutcome>, done: 'recorded' | 'saved') => {
    setState(requestStarted);
    const outcome = await send();
    setState((current) => requestEnded(current, outcome.ok ? undefined : outcome.error));
    if (!outcome.ok) return;
    alerts.success(recordText(translator, done));
    onClose();
  };

  /**
   * Checks the form and sends it; an edit with no change just closes. The
   * button is busy while a request is out and disabled while an edit's
   * schedule is read, so neither reaches here.
   */
  const submit = () => {
    const editable = state.original ? editableNow(state) : undefined;
    const problems = problemsOf(state.form, { holdings: loadedHoldingsOf(state), editable });
    if (!isClear(problems)) {
      setState((current) => submitRefused(current, problems));
      return;
    }
    const request = requestOf(state, input);
    if (request === null) onClose();
    else if (request) run(request.send, request.done);
  };

  return {
    state,
    change: (form, cleared) => moveTo(formChanged(state, form, cleared)),
    retryHoldings: () => moveTo(holdingsRetried(state, state.form.accountId ?? '')),
    retrySplit: () => moveTo({ ...state, split: undefined }),
    submit,
  };
}
