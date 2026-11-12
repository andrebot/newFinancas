import { shell } from '../config/constants';

// Where a link to one Holding leads (task 139, OQ-243): Investments' Holdings
// tab opened on it, its account chosen and its row open. The bell's "View
// holding" (Review Insights) builds it; Track Investments reads the same
// search parameters back. Shared, so neither Experience reads the other's.

/**
 * Builds the address of Investments' Holdings tab opened on one Holding.
 *
 * @param holdingId - The Holding.
 * @returns The path and search.
 */
const holdingLinkOf = (holdingId: string): string => (
  `${shell.paths.investments}?${new URLSearchParams({
    [shell.tabParam]: 'holdings', [shell.holdingParam]: holdingId,
  }).toString()}`
);

export default holdingLinkOf;
