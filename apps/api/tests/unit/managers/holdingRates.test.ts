import { describe, expect, it } from 'vitest';
import { engineRateOf, holdingRateOf } from '../../../src/managers/holdingRates';

// A fixed-term rate in the Engine's and the Holding row's shapes (OQ-205),
// shared by TransactionManager and InsightsManager (slice 3 review, A1).

describe('rate builders (OQ-205)', () => {
  it('gives the Engine its rate and drops a missing spread', () => {
    expect(engineRateOf({ type: 'ipca', value: 2.5 })).toEqual({ type: 'ipca', value: 2.5 });
    expect(engineRateOf({ type: 'cdi', value: 90, spread: 1.5 })).toEqual({
      type: 'cdi',
      value: 90,
      spread: 1.5,
    });
  });

  it('stores the Holding terms with a null spread when none was given', () => {
    expect(holdingRateOf({ type: 'ipca', value: 2.5 })).toEqual({
      rateType: 'ipca',
      rateValue: 2.5,
      rateSpread: null,
    });
    expect(holdingRateOf({ type: 'cdi', value: 90, spread: 1.5 })).toEqual({
      rateType: 'cdi',
      rateValue: 90,

      rateSpread: 1.5,
    });
  });
});
