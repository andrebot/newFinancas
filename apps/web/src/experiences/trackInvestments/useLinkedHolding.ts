import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { shell } from '../../config/constants';

// The Holding a link opened the Holdings tab on — the bell's "View holding"
// (OQ-243, PR #172 review). The address's `holding` parameter is taken once
// per visit and then dropped from the address, so a later tab switch or a
// reload doesn't jump back to it. Each visit carries its own key: the tab
// remounts Holding Maintenance on it, so a link followed while the tab is
// already open still chooses the Holding's account and opens its row.

/** The Holding a link pointed at, and the visit that brought it. */
export interface LinkedHolding {
  readonly holdingId: string | undefined;
  /** Changes with every link followed; `none` before the first. */
  readonly visit: string;
}

/** Before any link is followed. */
const NOT_LINKED: LinkedHolding = { holdingId: undefined, visit: 'none' };

/**
 * Drops the `holding` parameter from the address once it is taken, replacing
 * the entry so Back doesn't bring it back.
 *
 * @param fromAddress - The Holding the address names, if any.
 */
const useDropFromAddress = (fromAddress: string | undefined) => {
  const [, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (fromAddress === undefined) return;
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.delete(shell.holdingParam);
      return params;
    }, { replace: true });
  }, [fromAddress, setSearchParams]);
};

/**
 * Takes the Holding the address names, once per visit, and drops it from the address.
 *
 * @returns The linked Holding and its visit's key.
 */
export default function useLinkedHolding(): LinkedHolding {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fromAddress = searchParams.get(shell.holdingParam) ?? undefined;
  const [linked, setLinked] = useState<LinkedHolding>(NOT_LINKED);
  // A new visit naming a Holding replaces the one held, as the page renders.
  if (fromAddress !== undefined && linked.visit !== location.key) {
    setLinked({ holdingId: fromAddress, visit: location.key });
  }
  useDropFromAddress(fromAddress);
  return linked;
}
