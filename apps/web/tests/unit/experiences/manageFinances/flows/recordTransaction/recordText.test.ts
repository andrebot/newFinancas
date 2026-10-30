import { describe, expect, it } from 'vitest';
import {
  assetTypeName, rateText, recordText,
} from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/recordText';
import { createFormatter } from '../../../../../../src/utilities/formatting';
import { createTranslator } from '../../../../../../src/utilities/i18n';

// The drawer's texts (BDT: Utility-like helper → unit, the real catalog).

describe('recordText', () => {
  it('writes a key built from a code, with its params', () => {
    const translator = createTranslator('pt-BR');

    expect(recordText(translator, 'kind.pix_payment')).toBe('Pix enviado');
    expect(recordText(translator, 'rate.cdi', { rate: '110%' })).toBe('110% do CDI');
  });
});

describe('assetTypeName', () => {
  it('names an asset type, and "Other" for none', () => {
    const translator = createTranslator('en-US');

    expect(assetTypeName(translator, 'tesouro_direto')).toBe('Tesouro Direto');
    expect(assetTypeName(translator, undefined)).toBe('Other');
  });
});

describe('rateText', () => {
  const translator = createTranslator('en-US');
  const formatter = createFormatter('en-US');

  it('quotes a rate, its spread on top, and a fixed rate when it knows none', () => {
    expect(rateText(translator, formatter, { type: 'cdi', value: 1_100_000 }))
      .toBe('110.00% of CDI');
    expect(rateText(translator, formatter, { type: 'selic', value: 1_000_000, spread: 545 }))
      .toBe('100.00% of Selic + 0.05%');
    expect(rateText(translator, formatter, { spread: null })).toBe('0.00% a year');
  });
});
