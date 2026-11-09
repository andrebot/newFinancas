import type { LedgerItem } from '@financas/api-types';
import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { ActivityCard } from '../../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/ActivityCard';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Activity (BDT: Interaction, unit; nothing mocked but the handlers).

const DIVIDEND: LedgerItem = {
  ledger: 'account', id: 'd', kind: 'investment_dividend', date: '2026-09-15', amount: 89000,
};
const BUY: LedgerItem = {
  ledger: 'account',
  id: 'b',
  kind: 'investment_buy',
  date: '2026-03-20',
  amount: 3680000,
  quantity: 40_000_000_000,
};

describe('ActivityCard', () => {
  it('lists the latest transactions: a trade with its units and price, a payout in mint', () => {
    renderInLocale(
      <ActivityCard
        read={{ status: 'ready', data: [DIVIDEND, BUY] }}
        currency="BRL"
        onSeeAll={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Activity' })).toBeTruthy();
    expect(screen.getByText('Dividend')).toBeTruthy();
    expect(screen.getByText('09/15/2026')).toBeTruthy();
    expect(screen.getByText('+R$ 890,00')).toBeTruthy();
    expect(screen.getByText('Buy · 400 units')).toBeTruthy();
    expect(screen.getByText('03/20/2026 · R$ 92,00 each')).toBeTruthy();
    expect(screen.getByText('−R$ 36.800,00')).toBeTruthy();
  });

  it('asks for the ledger', () => {
    const onSeeAll = vi.fn();
    renderInLocale(
      <ActivityCard read={{ status: 'ready', data: [] }} currency="BRL" onSeeAll={onSeeAll} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'See in Transactions' }));

    expect(onSeeAll).toHaveBeenCalled();
    expect(screen.getByText('No transactions yet.')).toBeTruthy();
  });

  it('shows placeholders while loading, and a failure with Try again', () => {
    const retry = vi.fn();
    const view = renderInLocale(
      <ActivityCard read={{ status: 'loading' }} currency="BRL" onSeeAll={vi.fn()} />,
    );
    expect(screen.getByRole('status', { name: 'Loading the latest transactions' })).toBeTruthy();

    view.rerenderInLocale(
      <ActivityCard read={{ status: 'failed', retry }} currency="BRL" onSeeAll={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText("Couldn't load this holding's details.")).toBeTruthy();
    expect(retry).toHaveBeenCalled();
  });

  it('names a transaction with no kind or date as it can', () => {
    renderInLocale(
      <ActivityCard
        read={{ status: 'ready', data: [{ ledger: 'card', id: 'x' }] }}
        currency="BRL"
        onSeeAll={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});
