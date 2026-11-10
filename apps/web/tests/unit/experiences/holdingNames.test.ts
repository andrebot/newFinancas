import { describe, expect, it } from 'vitest';
import {
  assetFamilyOf, assetTypeName, familyName, holdingIdOf, indexName, rateText,
} from '../../../src/experiences/holdingNames';
import { createFormatter } from '../../../src/utilities/formatting';
import { createTranslator } from '../../../src/utilities/i18n';

// How the pages name asset types and families (BDT: pure helpers, unit, the
// real catalog).

describe('holdingIdOf', () => {
  it('reads a Holding\'s id, and an empty one when it is missing', () => {
    expect(holdingIdOf({ id: 'xpml11' })).toBe('xpml11');
    expect(holdingIdOf({})).toBe('');
  });
});

describe('assetTypeName', () => {
  it('names an asset type, and "Other" for none', () => {
    const translator = createTranslator('en-US');

    expect(assetTypeName(translator, 'tesouro_direto')).toBe('Tesouro Direto');
    expect(assetTypeName(translator, undefined)).toBe('Other');
  });
});

describe('assetFamilyOf', () => {
  it('puts FIIs and stocks in their own families', () => {
    expect(assetFamilyOf('fii')).toBe('fii');
    expect(assetFamilyOf('stock')).toBe('stock');
  });

  it('puts every fixed-term type in fixed income', () => {
    expect(assetFamilyOf('cdb')).toBe('fixedIncome');
    expect(assetFamilyOf('tesouro_direto')).toBe('fixedIncome');
    expect(assetFamilyOf('treasury')).toBe('fixedIncome');
  });

  it('puts the rest, and no type, in other', () => {
    expect(assetFamilyOf('crypto')).toBe('other');
    expect(assetFamilyOf('fund')).toBe('other');
    expect(assetFamilyOf(undefined)).toBe('other');
  });
});

describe('familyName', () => {
  it('names a family in both languages', () => {
    expect(familyName(createTranslator('en-US'), 'fixedIncome')).toBe('Fixed income');
    expect(familyName(createTranslator('pt-BR'), 'fixedIncome')).toBe('Renda fixa');
  });
});

describe('indexName', () => {
  it('names each reference index', () => {
    const translator = createTranslator('en-US');

    expect(['selic', 'cdi', 'ipca', 'igpm'].map((code) => indexName(translator, code)))
      .toEqual(['Selic', 'CDI', 'IPCA', 'IGP-M']);
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

  it('writes it in Portuguese', () => {
    const rate = { type: 'cdi', value: 1_100_000 };

    expect(rateText(createTranslator('pt-BR'), createFormatter('pt-BR'), rate))
      .toBe('110,00% do CDI');
  });
});
