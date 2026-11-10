import { useNavigate } from 'react-router';
import { toRequestOutcome } from '../../api/outcome';
import { manageFinances, shell } from '../../config/constants';
import {
  useDeleteIndexRateMutation, useDeleteMarketValueMutation, useEditIndexRateMutation,
  useEditMarketValueMutation, useRecordIndexRateMutation, useRecordMarketValueMutation,
  useSaveHoldingAllocationsMutation,
} from './api';
import type { HoldingRequests } from './flows/holdingMaintenance/HoldingPanel';
import type { RateRequests } from './flows/ratesMaintenance/RateSlot';
import { marketValueBodyOf } from './trackInvestments';

// The writes Track Investments' Flows ask of the Experience (X7; OQ-234,
// OQ-235): each one sent through its endpoint and answered as the Flow's
// `RequestOutcome` — ok, or the failure's code — which the Flow turns into
// K46/K47's `done` / `refused` and a toast. The endpoints' cache tags refresh
// what each write changed; no Flow refetches anything itself.

/**
 * Builds the address of the ledger filtered by one Holding (OQ-222).
 *
 * @param holdingId - The Holding.
 * @returns The Transactions page's path and search.
 */
export const transactionsOfHolding = (holdingId: string) => (
  `${shell.paths.transactions}?${new URLSearchParams({
    [manageFinances.holdingParam]: holdingId,
  }).toString()}`);

/**
 * Holding Maintenance's requests: the split and the market values, and the
 * way to the ledger filtered by a Holding.
 *
 * @param householdId - The household.
 * @returns The requests.
 */
export const useHoldingRequests = (householdId: string): HoldingRequests => {
  const navigate = useNavigate();
  const [saveAllocations] = useSaveHoldingAllocationsMutation();
  const [recordValue] = useRecordMarketValueMutation();
  const [editValue] = useEditMarketValueMutation();
  const [deleteValue] = useDeleteMarketValueMutation();
  return {
    onSaveAllocations: async (holdingId, allocations) => toRequestOutcome(
      await saveAllocations({ householdId, holdingId, allocations }),
    ),
    onRecordValue: async (holdingId, value) => toRequestOutcome(
      await recordValue({ householdId, holdingId, ...marketValueBodyOf(value) }),
    ),
    onEditValue: async (holdingId, snapshotId, value) => toRequestOutcome(
      await editValue({
        householdId, holdingId, snapshotId, ...marketValueBodyOf(value),
      }),
    ),
    onDeleteValue: async (holdingId, snapshotId) => toRequestOutcome(
      await deleteValue({ householdId, holdingId, snapshotId }),
    ),
    onSeeTransactions: (holdingId) => {
      navigate(transactionsOfHolding(holdingId));
    },
  };
};

/**
 * Rates Maintenance's requests: record, edit and delete an index's value.
 *
 * @param householdId - The household.
 * @returns The requests.
 */
export const useRateRequests = (householdId: string): RateRequests => {
  const [recordRate] = useRecordIndexRateMutation();
  const [editRate] = useEditIndexRateMutation();
  const [deleteRate] = useDeleteIndexRateMutation();
  return {
    onRecord: async (index, input) => toRequestOutcome(
      await recordRate({ householdId, index, ...input }),
    ),
    onEdit: async (index, valueId, input) => toRequestOutcome(
      await editRate({
        householdId, index, valueId, ...input,
      }),
    ),
    onDelete: async (index, valueId) => toRequestOutcome(
      await deleteRate({ householdId, index, valueId }),
    ),
  };
};
