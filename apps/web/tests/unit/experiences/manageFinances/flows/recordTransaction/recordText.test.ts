import { describe, expect, it } from 'vitest';
import { recordText } from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/recordText';
import { createTranslator } from '../../../../../../src/utilities/i18n';

// The drawer's texts (BDT: Utility-like helper → unit, the real catalog).

describe('recordText', () => {
  it('writes a key built from a code, with its params', () => {
    const translator = createTranslator('pt-BR');

    expect(recordText(translator, 'field.kind')).toBe('Tipo');
    expect(recordText(translator, 'asset.locked', { ticker: 'XPML11', assetType: 'FII' }))
      .toBe('XPML11 · FII');
  });
});
