import { describe, expect, it } from 'vitest';
import {
  assetFamilyOf, assetTypeName, familyName, holdingIdOf,
} from '../../../src/experiences/holdingNames';
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
