import { useState } from 'react';
import type {
  HoldingAllocation, InvestmentHolding, InvestmentScheduleEntry, LedgerItem,
} from '@financas/api-types';
import { toDataOutcome, toRequestOutcome, type EndpointResult } from '../../api/outcome';
import { useAlerts } from '../../utilities/AlertProvider';
import { useI18n } from '../../utilities/I18nProvider';
import {
  useLazyGetHoldingQuery, useLazyListHoldingAllocationsQuery, useLazyListHoldingsQuery,
  useLazyListScheduleEntriesQuery, useRecordTransactionMutation, useSaveTransactionMutation,
} from './api';
import type { EditedTransaction } from './flows/recordTransaction/recordTransactionState';
import type { RecordTransactionRequests } from './flows/recordTransaction/useRecordTransaction';
import { holdingToReadFor } from './manageFinances';

// The Record Transaction drawer as the Manage Finances Experience runs it (X6,
// OQ-219, OQ-222): whether it is open, on a new transaction or a ledger row's
// edit, and the reads and writes the Flow asks for. An edited buy opens only
// once its Holding is read — its terms come from it; when that read fails a
// toast says so and nothing opens, so Edit can be pressed again. A write
// refreshes the ledger, the month and the Goals by its cache tags, so closing
// only unmounts the drawer.

/** The drawer: closed, or open on a new transaction or an edit. */
export type DrawerState = { readonly open: false }
  | { readonly open: true; readonly transaction?: EditedTransaction | undefined };

/** What the page holds of the drawer. */
export interface RecordDrawer {
  readonly drawer: DrawerState;
  /** Opens it on a new transaction. */
  readonly openNew: () => void;
  /** Opens it on a ledger row: a buy once its Holding is read. */
  readonly openEdit: (item: LedgerItem) => Promise<void>;
  /** The Flow's reads, writes and close. */
  readonly requests: RecordTransactionRequests;
}

/**
 * Holds the drawer and answers its Flow for one household.
 *
 * @param householdId - The household.
 * @returns The drawer, its openers and the Flow's requests.
 */
export default function useRecordDrawer(householdId: string): RecordDrawer {
  const alerts = useAlerts();
  const translator = useI18n();
  const [drawer, setDrawer] = useState<DrawerState>({ open: false });
  const [readHolding] = useLazyGetHoldingQuery();
  const [readHoldings] = useLazyListHoldingsQuery();
  const [readSplit] = useLazyListHoldingAllocationsQuery();
  const [readSchedule] = useLazyListScheduleEntriesQuery();
  const [record] = useRecordTransactionMutation();
  const [save] = useSaveTransactionMutation();

  /**
   * Opens the drawer on a row, reading a buy's Holding first.
   *
   * @param item - The row to edit.
   */
  const openEdit = async (item: LedgerItem) => {
    const holdingId = holdingToReadFor(item);
    if (holdingId === undefined) {
      setDrawer({ open: true, transaction: { item } });
      return;
    }
    // An awaited trigger has settled: its result holds the data or the error.
    const result = await (readHolding({ householdId, holdingId }) as Promise<
      EndpointResult<InvestmentHolding>
    >);
    if (result.error !== undefined) {
      alerts.error(translator.text('manageFinances', 'editFailed'));
      return;
    }
    setDrawer({ open: true, transaction: { item, holding: result.data } });
  };

  return {
    drawer,
    openNew: () => setDrawer({ open: true }),
    openEdit,
    requests: {
      onLoadHoldings: async (accountId) => toDataOutcome(await (
        readHoldings({ householdId, accountId }) as Promise<
          EndpointResult<readonly InvestmentHolding[]>
        >
      )),
      onLoadSplit: async (holdingId) => toDataOutcome(await (
        readSplit({ householdId, holdingId }) as Promise<
          EndpointResult<readonly HoldingAllocation[]>
        >
      )),
      onLoadSchedule: async (holdingId) => toDataOutcome(await (
        readSchedule({ householdId, holdingId }) as Promise<
          EndpointResult<readonly InvestmentScheduleEntry[]>
        >
      )),
      onRecord: async (request) => toRequestOutcome(await record({ householdId, request })),
      onSave: async (transactionId, changes) => toRequestOutcome(
        await save({ householdId, transactionId, changes }),
      ),
      onClose: () => setDrawer({ open: false }),
    },
  };
}
