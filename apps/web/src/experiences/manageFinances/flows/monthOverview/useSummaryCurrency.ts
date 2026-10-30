import type { Currency } from '@financas/api-types';
import { useCallback, useState } from 'react';
import type { PreferenceStorage } from '../../../../utilities/safeStorage';
import { rememberedCurrency } from './monthOverview';

// The $ / R$ switch's currency (FL17, OQ-221): the Flow's own state — it
// asks nothing of the backend — opened on the last pick this browser
// remembers, R$ the first time, and remembered again on every change.

/** The switch's currency and how to change it. */
export interface SummaryCurrency {
  readonly currency: Currency;
  readonly changeCurrency: (currency: Currency) => void;
}

/**
 * Holds the switch's currency, remembered across visits.
 *
 * @param memory - Where the last pick is kept.
 * @returns The currency and its setter.
 */
export default function useSummaryCurrency(memory: PreferenceStorage): SummaryCurrency {
  const [currency, setCurrency] = useState(() => rememberedCurrency(memory.read()));
  const changeCurrency = useCallback((next: Currency) => {
    setCurrency(next);
    memory.write(next);
  }, [memory]);
  return { currency, changeCurrency };
}
