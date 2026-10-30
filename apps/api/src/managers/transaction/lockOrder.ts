import type { EditableRow } from './reversal';

// The order a transfer pair's two Accounts are written in (OQ-222): always by
// Account id, so two writes on opposite pairs (A→B and B→A) take their row
// locks in the same order and never wait on each other.

/**
 * Orders a pair's steps by their Accounts' ids.
 *
 * @param steps - Each side's step, with the side it acts on.
 * @returns The steps, the lower Account id first.
 */
export const inLockOrder = <Step extends { readonly side: Pick<EditableRow, 'account'> }>(
  steps: readonly Step[],
): Step[] => [...steps].sort((left, right) => (
  left.side.account.id.localeCompare(right.side.account.id)
));

/**
 * Orders Accounts by id — the order a pair's balances are moved in.
 *
 * @param accounts - The Accounts, each with what moves it.
 * @returns The same entries, the lower Account id first.
 */
export const accountsInLockOrder = <Entry extends { readonly account: { readonly id: string } }>(
  accounts: readonly Entry[],
): Entry[] => [...accounts].sort((left, right) => left.account.id.localeCompare(right.account.id));
