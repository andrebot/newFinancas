import type { Currency } from '@financas/api-types';
import { useCallback, useState } from 'react';
import { money } from '../config/constants';
import type { PreferenceStorage } from '../utilities/safeStorage';

// A $ / R$ switch's currency (FL17, FL18; OQ-221, OQ-233): the Flow's own
// state — it asks nothing of the backend — opened on the last pick this
// browser remembers, R$ the first time, and remembered again on every change.
// Month Overview's summary and the payout chart each keep their own pick. A new
// storage — another household's — is read afresh (review round 1); the caller
// keeps one storage object per key, so a re-render doesn't count as a new one.

/** The switch's currency and how to change it. */
export interface RememberedCurrency {
  readonly currency: Currency;
  readonly changeCurrency: (currency: Currency) => void;
}

/**
 * Reads a switch's remembered currency.
 *
 * @param stored - What storage holds, if anything.
 * @returns The currency, or the default when nothing (or something unknown) is stored.
 */
export const rememberedCurrency = (stored: string | null): Currency => (
  money.currencies.find((currency) => currency === stored) ?? money.defaultCurrency
);

/**
 * Holds a switch's currency, remembered across visits.
 *
 * @param memory - Where the last pick is kept.
 * @returns The currency and its setter.
 */
export default function useRememberedCurrency(memory: PreferenceStorage): RememberedCurrency {
  const [picked, setPicked] = useState(() => ({
    memory, currency: rememberedCurrency(memory.read()),
  }));
  // A pick made with another storage is stale: read this one instead.
  const currency = picked.memory === memory
    ? picked.currency
    : rememberedCurrency(memory.read());
  const changeCurrency = useCallback((next: Currency) => {
    setPicked({ memory, currency: next });
    memory.write(next);
  }, [memory]);
  return { currency, changeCurrency };
}
