import type { InvestmentHolding } from '@financas/api-types';
import { useCallback, useState } from 'react';
import type { PreferenceStorage } from '../utilities/safeStorage';
import {
  parseSelection, selectionOf, serializeSelection, type PayoutSelection,
} from './payoutSelection';

// The payout chart's choice of Holdings, held by the Experience that asks for
// the payouts report (FL18, FL21; OQ-233): it is the query's argument, so it
// lives where the query does, never in the Flow. Opened on what this browser
// remembers for the household — the caller hands in that household's storage,
// one object per household — and remembered again on every change. Another
// household's storage is read afresh, so a household switch never carries a
// choice over (review round 1).

/** The choice and how to change it. */
export interface PayoutSelectionState {
  readonly selection: PayoutSelection;
  /**
   * Takes what the selector chose.
   *
   * @param ids - The ids chosen.
   * @param holdings - The household's Holdings, to tell when every one is chosen.
   */
  readonly choose: (ids: readonly string[], holdings: readonly InvestmentHolding[]) => void;
}

/**
 * Holds the payout chart's Holdings, remembered across visits.
 *
 * @param memory - Where this household's last choice is kept.
 * @returns The choice and its setter.
 */
export default function usePayoutSelection(memory: PreferenceStorage): PayoutSelectionState {
  const [chosen, setChosen] = useState(() => ({
    memory, selection: parseSelection(memory.read()),
  }));
  // A choice made with another household's storage is stale: read this one instead.
  const selection = chosen.memory === memory
    ? chosen.selection
    : parseSelection(memory.read());
  const choose = useCallback((ids: readonly string[], holdings: readonly InvestmentHolding[]) => {
    const next = selectionOf(ids, holdings);
    setChosen({ memory, selection: next });
    memory.write(serializeSelection(next));
  }, [memory]);
  return { selection, choose };
}
