import { findKind } from '@financas/reference';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { Account } from '../../../../src/accessors/accountAccessor';
import {
  accountMovementOf, accrueBudget, budgetAccrualOf, cardMovementOf, engineRateOf, holdingRateOf,
} from '../../../../src/managers/transaction/effects';
import type { TransactionStores } from '../../../../src/managers/transaction/context';

// The signed effects a kind makes (OQ-201 D1/D4): one place decides the signs —
// in raises an Account and lowers its Budget spend, out does the reverse; a card
// charge raises its outstanding balance.

const ACCOUNT: Account = {
  id: 'a1',
  householdId: 'h1',
  ownerUserId: null,
  name: 'Nubank',
  type: 'checking',
  currency: 'BRL',
  visibility: 'shared',
  startingBalanceDate: '2026-01-01',
  archivedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const VALUES = { amount: 5_000, currency: 'BRL', date: '2026-10-13' };

describe('accountMovementOf', () => {
  it('raises the Account for money in and lowers it for money out', () => {
    expect(accountMovementOf(findKind('deposit')!, VALUES)).toEqual({
      amount: 5_000,
      currency: 'BRL',

      date: '2026-10-13',
    });
    expect(accountMovementOf(findKind('withdrawal')!, VALUES)).toEqual({
      amount: -5_000,
      currency: 'BRL',

      date: '2026-10-13',
    });
  });

  it('signs a transfer by its direction too', () => {
    expect(accountMovementOf(findKind('transfer_sent')!, VALUES).amount).toBe(-5_000);
    expect(accountMovementOf(findKind('transfer_received')!, VALUES).amount).toBe(5_000);
  });
});

describe('cardMovementOf', () => {
  it('raises the outstanding balance for a charge and lowers it for a refund', () => {
    expect(cardMovementOf(findKind('charge')!, VALUES)).toEqual({
      amount: 5_000,
      currency: 'BRL',
      date: '2026-10-13',
    });
    expect(cardMovementOf(findKind('refund')!, VALUES)).toEqual({
      amount: -5_000,
      currency: 'BRL',
      date: '2026-10-13',
    });
  });
});

describe('budgetAccrualOf', () => {
  it('is null when the transaction names no category (OQ-201 D4)', () => {
    expect(budgetAccrualOf(ACCOUNT, findKind('withdrawal')!, VALUES, null, null)).toBeNull();
  });

  it('counts spend as out minus in per category', () => {
    const out = budgetAccrualOf(ACCOUNT, findKind('withdrawal')!, VALUES, 'c1', null);
    expect(out).toEqual({
      scope: { householdId: 'h1', visibility: 'shared', ownerUserId: null },
      currency: 'BRL',
      categoryId: 'c1',
      subcategoryId: null,
      amount: 5_000,
      date: '2026-10-13',
    });
    expect(budgetAccrualOf(ACCOUNT, findKind('deposit')!, VALUES, 'c1', null)!.amount).toBe(-5_000);
  });

  it('takes the scope of its Account', () => {
    const personal: Account = {
      ...ACCOUNT, id: 'a2', ownerUserId: 'u1', visibility: 'personal',
    };
    expect(budgetAccrualOf(personal, findKind('withdrawal')!, VALUES, null, 's1')).toMatchObject({
      scope: { householdId: 'h1', visibility: 'personal', ownerUserId: 'u1' }, subcategoryId: 's1',
    });
  });
});

describe('accrueBudget', () => {
  it('counts the accrual against the Budget that claims it', async () => {
    const accrueIfClaimed = vi.fn().mockResolvedValue(undefined);
    const stores = { budgets: { accrueIfClaimed } } as unknown as TransactionStores;
    await accrueBudget(stores, budgetAccrualOf(
      ACCOUNT,
      findKind('withdrawal')!,
      VALUES,
      'c1',
      null,
    ));
    expect(accrueIfClaimed).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is no accrual', async () => {
    const accrueIfClaimed = vi.fn();
    const stores = { budgets: { accrueIfClaimed } } as unknown as TransactionStores;
    await accrueBudget(stores, null);
    expect(accrueIfClaimed).not.toHaveBeenCalled();
  });
});

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
