import { findKind, type Direction } from '@financas/reference';
import type {
  AccountTransaction, AccountTransactionAccessor,
} from '../accessors/accountTransactionAccessor';
import type {
  ValuationSnapshot, ValuationSnapshotAccessor,
} from '../accessors/valuationSnapshotAccessor';
import inSequence from './sequence';

// A market-priced Holding's value over time (FR-5.2, OQ-222): the money moves
// it, not the units. Walking its history in order — date, then time written —
// a market value typed in sets it, a buy adds what was paid, a sell or
// redemption takes off what came in (never below zero), and a position sold
// out is worth nothing. Each trade's automatic snapshot holds the value right
// after it. A trade recorded, edited or deleted, or a market value typed in,
// changes every later value, so the whole history is restated after each —
// TransactionManager and AccountManager share it here. A fixed-term Holding
// has no snapshots (OQ-51), so restating it changes nothing.

/** What restating a Holding's values reads and writes. */
export interface HoldingValueStores {
  readonly accountTransactions: Pick<AccountTransactionAccessor, 'listTrades'>;
  readonly valuations: Pick<ValuationSnapshotAccessor, 'list' | 'updateAutomatic'>;
}

/** One step of a Holding's history: a market value typed in, or a trade. */
type HistoryStep = {
  readonly date: string;
  readonly createdAt: Date;
} & ({ readonly typed: number } | { readonly trade: AccountTransaction });

/**
 * A Holding's value after a trade: the money moves it, not the units — a buy
 * adds what was paid, a sell takes off what came in, never below zero, and a
 * position sold out is worth nothing. The units serve the position and its
 * average cost (IRPF), never the value.
 *
 * @param before - The Holding's value before the trade.
 * @param direction - `out` for a buy (money into the Holding), `in` for a sell.
 * @param amount - The trade's amount, positive.
 * @param heldAfter - The units held after the trade.
 * @returns The value after it.
 */
export const valueAfterTrade = (
  before: number,
  direction: Direction,
  amount: number,
  heldAfter: number,
): number => {
  if (heldAfter === 0) return 0;
  return Math.max(0, before + (direction === 'out' ? amount : -amount));
};

/**
 * Orders a Holding's history: date, then time written, a typed value before a
 * trade written at the same instant.
 *
 * @param trades - Its trades.
 * @param snapshots - Its snapshots; only the typed-in ones are steps.
 * @returns The steps, oldest first.
 */
const historyOf = (
  trades: readonly AccountTransaction[],
  snapshots: readonly ValuationSnapshot[],
): HistoryStep[] => [
  ...snapshots.filter((snapshot) => snapshot.source === 'manual').map((snapshot) => ({
    date: snapshot.asOfDate, createdAt: snapshot.createdAt, typed: snapshot.valuation,
  })),
  ...trades.map((trade) => ({ date: trade.date, createdAt: trade.createdAt, trade })),
].sort((left, right) => (
  left.date.localeCompare(right.date) || left.createdAt.getTime() - right.createdAt.getTime()
));

/**
 * Walks a Holding's history to the value right after each trade.
 *
 * @param trades - Its trades, each with its deltas.
 * @param snapshots - Its snapshots; the typed-in ones set the value.
 * @returns Each trade's value, by transaction id.
 */
export const tradeValuesOf = (
  trades: readonly AccountTransaction[],
  snapshots: readonly ValuationSnapshot[],
): Map<string, number> => {
  const values = new Map<string, number>();
  let value = 0;
  let held = 0;
  historyOf(trades, snapshots).forEach((step) => {
    if ('typed' in step) {
      value = step.typed;
      return;
    }
    const { trade } = step;
    held += trade.trade?.quantityDelta ?? 0;
    const direction = findKind(trade.kind)?.direction === 'in' ? 'in' : 'out';
    value = valueAfterTrade(value, direction, trade.amount, held);
    values.set(trade.id, value);
  });
  return values;
};

/**
 * Restates a Holding's automatic snapshots from its whole history, writing
 * only those whose value or date moved — one at a time, as one unit of work
 * needs (OQ-175).
 *
 * @param stores - The trades and the snapshots, over the write's transaction.
 * @param holdingId - The Holding.
 */
export const restateHoldingValues = async (
  stores: HoldingValueStores,
  holdingId: string,
): Promise<void> => {
  const trades = await stores.accountTransactions.listTrades(holdingId);
  const snapshots = await stores.valuations.list(holdingId);
  const values = tradeValuesOf(trades, snapshots);
  const dates = new Map(trades.map((trade) => [trade.id, trade.date]));
  const moved = snapshots.filter((snapshot) => {
    const transactionId = snapshot.accountTransactionId;
    if (transactionId === null || !values.has(transactionId)) return false;
    return snapshot.valuation !== values.get(transactionId)
      || snapshot.asOfDate !== dates.get(transactionId);
  });
  await inSequence(moved, (snapshot) => stores.valuations.updateAutomatic(
    snapshot.accountTransactionId!,
    {
      valuation: values.get(snapshot.accountTransactionId!)!,
      asOfDate: dates.get(snapshot.accountTransactionId!)!,
    },
  ));
};
