import type { InvestmentHolding } from '@financas/api-types';
import type { ReactNode } from 'react';
import { toSourceState } from '../../api/sourceState';
import type { SourceState } from '../../utilities/sourceState';
import { holdingIdOf } from '../holdingNames';
import {
  useListHoldingActivityQuery, useListHoldingSplitQuery, useListValuationSnapshotsQuery,
} from './api';
import type { HoldingDetails } from './flows/holdingMaintenance/HoldingPanel';
import { readsMarketDetails } from './trackInvestments';

// Holding Maintenance's `details` slot (FL19, OQ-234): an open row's split,
// value history and latest transactions, read for as long as the row is open —
// K43 mounts its panel only then — and refreshed by their cache tags after a
// write. A fixed-term Holding has no value history or activity to read.

/** What a fixed-term Holding answers for the reads it doesn't make. */
const NOTHING_TO_READ: SourceState<readonly never[]> = { status: 'ready', data: [] };

/** The open Holding, and how its panel renders what was read. */
export interface HoldingDetailsReaderProps {
  readonly householdId: string;
  readonly holding: InvestmentHolding;
  readonly render: (details: HoldingDetails) => ReactNode;
}

/**
 * Reads an open Holding's details and hands them to its panel.
 *
 * @param props - The household, the Holding and the panel's render function.
 * @returns The panel.
 */
export function HoldingDetailsReader({ householdId, holding, render }: HoldingDetailsReaderProps) {
  const target = { householdId, holdingId: holdingIdOf(holding) };
  const marketPriced = readsMarketDetails(holding);
  const allocations = useListHoldingSplitQuery(target);
  const snapshots = useListValuationSnapshotsQuery(target, { skip: !marketPriced });
  const activity = useListHoldingActivityQuery(target, { skip: !marketPriced });
  return render({
    allocations: toSourceState(allocations),
    snapshots: marketPriced ? toSourceState(snapshots) : NOTHING_TO_READ,
    activity: marketPriced ? toSourceState(activity) : NOTHING_TO_READ,
  });
}
