import { findKind } from '@financas/reference';
import { describe, expect, it } from 'vitest';
import {
  createProblems, fieldsForKind, type CreateRequestFields,
} from '../../../../src/managers/transaction/kindRules';

// The per-kind field rules (FR-3.1/OQ-201): a missing required field and a field
// the kind has no use for are both 422 details; fixed-term buys add their terms,
// and the debenture flag rides only a debenture (OQ-79).

const KIND = findKind('withdrawal')!;
const BUY = findKind('investment_buy')!;
const SELL = findKind('investment_sell')!;

/** The Manager reads the request as `CreateRequestFields`; tests pass full shapes. */
const asRequest = (request: Record<string, unknown>): CreateRequestFields => request;

describe('fieldsForKind', () => {
  it('gives every kind its required and optional fields', () => {
    expect(fieldsForKind(KIND).required).toEqual(['accountId']);
    expect(fieldsForKind(findKind('charge')!).required).toEqual(['creditCardId']);
    expect(fieldsForKind(findKind('credit_card_bill_payment')!).required).toEqual(['accountId',
      'creditCardId']);
  });

  it('makes a market-priced buy carry its quantity', () => {
    const fields = fieldsForKind(BUY, 'stock');
    expect(fields.required).toContain('quantity');
    expect(fields.optional).not.toContain('incentivised');
  });

  it('adds the terms to a fixed-term buy (OQ-50)', () => {
    const fields = fieldsForKind(BUY, 'cdb');
    expect(fields.required).toEqual(expect.arrayContaining(['accountId', 'assetType', 'ticker',
      'rate', 'dueDate']));
    expect(fields.optional).toContain('interestPayment');
  });

  it('lets only a debenture carry the incentivised flag (OQ-79)', () => {
    expect(fieldsForKind(BUY, 'debenture').optional).toContain('incentivised');
    expect(fieldsForKind(BUY, 'cdb').optional).not.toContain('incentivised');
  });

  it('leaves a sell to its holding and quantity', () => {
    expect(fieldsForKind(SELL).required).toEqual(['accountId', 'holdingId', 'quantity']);
  });
});

describe('createProblems', () => {
  const base = {
    kind: 'withdrawal', date: '2026-10-13', amount: 500, currency: 'BRL',
  };

  it('is empty when the fields fit the kind', () => {
    expect(createProblems(asRequest({ ...base, accountId: 'a1' }), KIND)).toEqual([]);
  });

  it('reports each missing required field', () => {
    expect(createProblems(asRequest(base), KIND)).toEqual([{
      field: 'accountId',
      code: 'field.required',
    }]);
  });

  it('reports a field the kind has no use for', () => {
    const problems = createProblems(asRequest({ ...base, accountId: 'a1', holdingId: 'h1' }), KIND);
    expect(problems).toEqual([{
      field: 'holdingId',
      code: 'object.unknown_keys',
      params: { keys: ['holdingId'] },
    }]);
  });

  it('allows the common optionals on every kind', () => {
    const request = asRequest({
      ...base, accountId: 'a1', categoryId: 'c1', subcategoryId: 's1', description: 'x',
    });
    expect(createProblems(request, KIND)).toEqual([]);
  });

  it('requires the terms of a fixed-term buy (OQ-50)', () => {
    const request = asRequest({
      ...base, kind: 'investment_buy', accountId: 'a1', assetType: 'cdb', ticker: 'CDB1',
    });
    expect(createProblems(request, BUY)).toEqual(expect.arrayContaining([
      { field: 'rate', code: 'field.required' },
      { field: 'dueDate', code: 'field.required' },
    ]));
  });

  it('refuses a due date not after the buy (OQ-205)', () => {
    const request = asRequest({
      ...base,
      kind: 'investment_buy',
      accountId: 'a1',
      assetType: 'cdb',
      ticker: 'CDB1',
      rate: { type: 'ipca', value: 2.5 },
      dueDate: '2026-10-13',
    });
    expect(createProblems(request, BUY)).toEqual([{ field: 'dueDate', code: 'date.min' }]);
  });

  it('refuses a spread on a type that has none (OQ-205)', () => {
    const request = asRequest({
      ...base,
      kind: 'investment_buy',
      accountId: 'a1',
      assetType: 'cdb',
      ticker: 'CDB1',
      rate: { type: 'ipca', value: 2.5, spread: 0.5 },
      dueDate: '2026-12-01',
    });
    expect(createProblems(request, BUY)).toEqual([{ field: 'rate.spread', code: 'field.invalid' }]);
  });

  it('allows a CDI or Selic spread (OQ-205)', () => {
    const request = asRequest({
      ...base,
      kind: 'investment_buy',
      accountId: 'a1',
      assetType: 'cdb',
      ticker: 'CDB1',
      rate: { type: 'cdi', value: 90, spread: 1.5 },
      dueDate: '2026-12-01',
    });
    expect(createProblems(request, BUY)).toEqual([]);
  });

  it('refuses a spread whose rate has no type (OQ-205)', () => {
    const request = asRequest({
      ...base,
      kind: 'investment_buy',
      accountId: 'a1',
      assetType: 'cdb',
      ticker: 'CDB1',
      rate: { value: 2.5, spread: 0.5 },
      dueDate: '2026-12-01',
    });
    expect(createProblems(request, BUY)).toEqual(expect.arrayContaining([{
      field: 'rate.spread',
      code: 'field.invalid',
    }]));
  });

  it('treats a buy with no asset type as market-priced — no term problems', () => {
    const request = asRequest({
      ...base, kind: 'investment_buy', accountId: 'a1', quantity: 2,
    });
    // Only the missing required fields — the terms are not demanded of it.
    expect(createProblems(request, BUY)).toEqual([
      { field: 'assetType', code: 'field.required' },
      { field: 'ticker', code: 'field.required' },
    ]);
  });

  it('refuses the debenture flag on a non-debenture buy (OQ-79)', () => {
    const request = asRequest({
      ...base,
      kind: 'investment_buy',
      accountId: 'a1',
      assetType: 'cdb',
      ticker: 'CDB1',
      rate: { type: 'ipca', value: 2.5 },
      dueDate: '2026-12-01',
      incentivised: true,
    });
    expect(createProblems(request, BUY)).toEqual([
      { field: 'incentivised', code: 'object.unknown_keys', params: { keys: ['incentivised'] } },
    ]);
  });

  it('allows the debenture flag on a debenture buy (OQ-79)', () => {
    const request = asRequest({
      ...base,
      kind: 'investment_buy',
      accountId: 'a1',
      assetType: 'debenture',
      ticker: 'DEB1',
      rate: { type: 'ipca', value: 2.5 },
      dueDate: '2026-12-01',
      incentivised: true,
    });
    expect(createProblems(request, BUY)).toEqual([]);
  });

  it('does not check terms on a market-priced buy', () => {
    const request = asRequest({
      ...base,
      kind: 'investment_buy',
      accountId: 'a1',
      assetType: 'stock',
      ticker: 'PETR4',
      quantity: 10,

    });
    expect(createProblems(request, BUY)).toEqual([]);
  });
});
