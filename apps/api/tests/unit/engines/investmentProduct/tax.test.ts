import { describe, expect, it } from 'vitest';
import { regressiveTax, taxRuleOf } from '../../../../src/engines/investmentProduct/tax';

describe('taxRuleOf (OQ-79)', () => {
  it.each(['cdb', 'lc', 'lf', 'tesouro_direto'])('taxes %s regressively', (assetType) => {
    expect(taxRuleOf(assetType, 'BR', null)).toBe('regressive');
  });

  it.each(['lci', 'lca', 'cra', 'cri'])('exempts %s', (assetType) => {
    expect(taxRuleOf(assetType, 'BR', null)).toBe('exempt');
  });

  it('exempts an incentivised debenture only', () => {
    expect(taxRuleOf('debenture', 'BR', true)).toBe('exempt');
    expect(taxRuleOf('debenture', 'BR', false)).toBe('regressive');
    expect(taxRuleOf('debenture', 'BR', null)).toBe('regressive');
  });

  it.each(['cd', 'treasury'])('does not estimate a US %s', (assetType) => {
    expect(taxRuleOf(assetType, 'US', null)).toBe('not_estimated');
  });
});

describe('regressiveTax (Lei 11.033/2004)', () => {
  it.each([
    [1, 225], [180, 225],
    [181, 200], [360, 200],
    [361, 175], [720, 175],
    [721, 150], [10_000, 150],
  ])('at %i days held takes %i per mille', (daysHeld, perMille) => {
    expect(regressiveTax(1_000, daysHeld)).toBe(perMille);
  });

  it('rounds half-up to whole minor units', () => {
    expect(regressiveTax(10, 721)).toBe(2);
    expect(regressiveTax(2, 180)).toBe(0);
  });
});
