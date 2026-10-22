import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  SetupCompleteSummary,
} from '../../../../../../../src/experiences/onboard/flows/guidedSetup/interactions/SetupCompleteSummary';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Setup Complete Summary (BDT: Interaction, unit): the real kit and
// translator; only the way out is a stand-in. Mockup 14.

const SUMMARY = {
  accounts: 1, cards: 1, categories: 6, budgets: 2,
};

describe('the summary', () => {
  it('names the household and counts what was set up', () => {
    renderInLocale(
      <SetupCompleteSummary householdName="The Doe Family" summary={SUMMARY} onFinish={vi.fn()} />,
    );
    expect(screen.getByRole('heading', { name: 'The Doe Family is ready' })).toBeTruthy();
    expect(screen.getByText('account · 1 card')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('categories')).toBeTruthy();
    expect(screen.getByText('budgets')).toBeTruthy();
  });

  it('pluralizes in pt-BR', () => {
    renderInLocale(
      <SetupCompleteSummary
        householdName="Casa"
        summary={{
          accounts: 2, cards: 3, categories: 1, budgets: 1,
        }}
        onFinish={vi.fn()}
      />,
      'pt-BR',
    );
    expect(screen.getByText('contas · 3 cartões')).toBeTruthy();
    expect(screen.getByText('categoria')).toBeTruthy();
  });

  it('emits where each next step goes, and the Dashboard', () => {
    const onFinish = vi.fn();
    renderInLocale(
      <SetupCompleteSummary householdName="Doe" summary={SUMMARY} onFinish={onFinish} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Record a transaction/ }));
    fireEvent.click(screen.getByRole('button', { name: /Invite your household/ }));
    fireEvent.click(screen.getByRole('button', { name: /Create a goal/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Go to Dashboard' }));
    expect(onFinish.mock.calls)
      .toEqual([['transactions'], ['household'], ['goals'], ['dashboard']]);
  });
});
