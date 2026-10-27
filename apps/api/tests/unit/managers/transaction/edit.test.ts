import { findKind } from '@financas/reference';
import { describe, expect, it } from 'vitest';
import { editableFieldsOf } from '../../../../src/managers/transaction/edit';

// The per-kind edit fields (OQ-201 D6/D8): the base values for every kind,
// quantity on trades, terms on fixed-term buys — and the debenture flag only
// on a debenture.

describe('editableFieldsOf', () => {
  it('gives a cash kind its base fields and nothing else', () => {
    const fields = editableFieldsOf(findKind('withdrawal')!);
    expect(fields.has('amount')).toBe(true);
    expect(fields.has('quantity')).toBe(false);
    expect(fields.has('dueDate')).toBe(false);
  });

  it('adds quantity to a trade', () => {
    const fields = editableFieldsOf(findKind('investment_sell')!);
    expect(fields.has('quantity')).toBe(true);
    expect(fields.has('incentivised')).toBe(false);
  });

  it('adds the terms to a fixed-term buy, without the debenture flag', () => {
    const fields = editableFieldsOf(findKind('investment_buy')!, 'cdb');
    expect(fields.has('dueDate')).toBe(true);
    expect(fields.has('incentivised')).toBe(false);
  });

  it('adds the debenture flag to a debenture buy', () => {
    const fields = editableFieldsOf(findKind('investment_buy')!, 'debenture');
    expect(fields.has('dueDate')).toBe(true);
    expect(fields.has('incentivised')).toBe(true);
  });

  it('treats a missing asset type as market-priced', () => {
    const fields = editableFieldsOf(findKind('investment_buy')!);
    expect(fields.has('quantity')).toBe(true);
    expect(fields.has('dueDate')).toBe(false);
    expect(fields.has('incentivised')).toBe(false);
  });
});
