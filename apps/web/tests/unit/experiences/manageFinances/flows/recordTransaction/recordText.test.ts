import { describe, expect, it } from 'vitest';
import { assetTypeName, recordText } from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/recordText';
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
