import type { LedgerItem } from '@financas/api-types';
import { useState } from 'react';
import { useAlerts } from '../../../../utilities/AlertProvider';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { RequestOutcome } from '../../../../utilities/requestOutcome';
import {
  applyRefused, deleteAsked, deleteCancelled, deleteEnded, deleteStarted, draftChanged,
  draftOpened, INITIAL_BROWSE_STATE, rowToggled, type BrowseState,
} from './browseState';
import { browseText } from './browseText';
import {
  isRangeClear, NO_FILTERS, rangeProblemsOf, type LedgerFilters,
} from './ledgerFilters';

// The Browse Transactions Flow's controller (FL16, OQ-220): the open row and
// its delete, sent through the Experience and toasted once done — the
// Experience's refetch takes the row away — and the filter drawer's draft,
// started from the applied filters each time the drawer opens and handed up
// by Show once its range is sound. Neither this nor the Flow calls the backend.

/** What the Experience holds and does for the Flow. */
export interface BrowseTransactionsRequests {
  /** The applied filters; the ledger's query is keyed by them. */
  readonly filters: LedgerFilters;
  /** Takes new filters: Show, a removed Holding, Clear filters. */
  readonly onFiltersChange: (filters: LedgerFilters) => void;
  /** Whether the filter drawer is open — the page header's Filter button opens it. */
  readonly filterOpen: boolean;
  /** Closes the drawer: Show, ✕, Esc or the scrim. */
  readonly onFilterClose: () => void;
  /** `DELETE …/transactions/:transactionId`; a success refetches the ledger. */
  readonly onDelete: (item: LedgerItem) => Promise<RequestOutcome>;
}

/** What the Flow renders from and calls. */
export interface BrowseTransactionsController {
  readonly state: BrowseState;
  /** Opens or closes a row. */
  readonly toggleRow: (key: string, open: boolean) => void;
  /** Shows the open row's delete confirm. */
  readonly askDelete: () => void;
  /** Hides it. */
  readonly cancelDelete: () => void;
  /** Deletes the row. */
  readonly confirmDelete: (item: LedgerItem) => void;
  /** Takes the drawer's edited draft. */
  readonly changeDraft: (draft: LedgerFilters) => void;
  /** Applies the draft, once its range is sound. */
  readonly apply: () => void;
  /** Empties the draft — the Holding too. */
  readonly clearDraft: () => void;
}

/** A state update, as `setState` takes it. */
type Update = (update: (state: BrowseState) => BrowseState) => void;

/**
 * Starts the draft from the applied filters whenever the drawer opens. It
 * adjusts while rendering, as React advises for state that follows a prop.
 *
 * @param filterOpen - Whether the drawer is open.
 * @param filters - The applied filters.
 * @param update - The state's setter.
 */
function useDraftOnOpen(filterOpen: boolean, filters: LedgerFilters, update: Update) {
  const [wasOpen, setWasOpen] = useState(filterOpen);
  if (filterOpen === wasOpen) return;
  setWasOpen(filterOpen);
  if (filterOpen) update((state) => draftOpened(state, filters));
}

/**
 * Holds the Flow's state and runs its delete and its filters.
 *
 * @param requests - The applied filters, the drawer's state and the Experience's handlers.
 * @returns The controller.
 */
export default function useBrowseTransactions(
  requests: BrowseTransactionsRequests,
): BrowseTransactionsController {
  const {
    filters, onFiltersChange, filterOpen, onFilterClose, onDelete,
  } = requests;
  const [state, setState] = useState<BrowseState>(INITIAL_BROWSE_STATE);
  const translator = useI18n();
  const alerts = useAlerts();
  useDraftOnOpen(filterOpen, filters, setState);

  /**
   * Sends the delete: a success is toasted and closes the row; a failure stays
   * in the confirm. The confirm is busy while it is out, so none doubles it.
   *
   * @param item - The row.
   */
  const runDelete = async (item: LedgerItem) => {
    setState(deleteStarted);
    const outcome = await onDelete(item);
    if (outcome.ok) alerts.success(browseText(translator, 'deleted'));
    setState((current) => deleteEnded(current, outcome.ok ? undefined : outcome.error));
  };

  /** Hands the draft up and closes the drawer — or, with an unsound range, shows why. */
  const apply = () => {
    if (!isRangeClear(rangeProblemsOf(state.draft.range))) {
      setState(applyRefused);
      return;
    }
    onFiltersChange(state.draft);
    onFilterClose();
  };

  return {
    state,
    toggleRow: (key, open) => setState((current) => rowToggled(current, key, open)),
    askDelete: () => setState(deleteAsked),
    cancelDelete: () => setState(deleteCancelled),
    confirmDelete: (item) => {
      runDelete(item);
    },
    changeDraft: (draft) => setState((current) => draftChanged(current, draft)),
    apply,
    clearDraft: () => setState((current) => draftChanged(current, NO_FILTERS)),
  };
}
