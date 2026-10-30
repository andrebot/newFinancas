import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { balanceCardsOf } from '../../../../src/experiences/balanceCards';
import { MonthRails, periodLabelOf } from '../../../../src/experiences/interactions/MonthRails';
import { createFormatter } from '../../../../src/utilities/formatting';
import { createTranslator } from '../../../../src/utilities/i18n';
import { renderInLocale } from '../../../support/renderInLocale';
import { ACCOUNTS, goalOf, REPORT } from '../monthFixtures';

// The month's three rails (BDT: Interaction, unit; nothing mocked — the kit's
// rails and cards and the translator run for real).

const CONTENT = {
  balances: balanceCardsOf(REPORT.balances, ACCOUNTS, createTranslator('en-US')),
  budgets: REPORT.budgets,
  goals: REPORT.goals,
};

describe('periodLabelOf', () => {
  it('names the month as the period chip does', () => {
    const label = periodLabelOf(
      createTranslator('en-US'),
      createFormatter('en-US'),
      { year: 2026, month: 9 },
    );
    expect(label).toBe('September/2026');
  });

  it('names it in the interface language', () => {
    const label = periodLabelOf(
      createTranslator('pt-BR'),
      createFormatter('pt-BR'),
      { year: 2026, month: 3 },
    );
    expect(label).toBe('março/2026');
  });
});

describe('MonthRails', () => {
  it('titles each rail with the month', () => {
    renderInLocale(<MonthRails period="September/2026" content={CONTENT} />);
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent))
      .toEqual(['BalancesSeptember/2026', 'BudgetsSeptember/2026', 'GoalsSeptember/2026']);
  });

  it('leaves the period chips out on a phone, where the bar names the month', () => {
    renderInLocale(<MonthRails period="September/2026" content={CONTENT} />);
    screen.getAllByText('September/2026').forEach((chip) => {
      expect(chip.className).toContain('hidden xl:inline-block');
    });
  });

  it('scrolls the balances and the budgets, and wraps the goals (PR #145)', () => {
    renderInLocale(<MonthRails period="September/2026" content={CONTENT} />);
    expect(screen.getAllByRole('region').map((rail) => rail.getAttribute('aria-label')))
      .toEqual(['Balances', 'Budgets']);
  });

  it('draws a card per balance, a card\'s outstanding captioned', () => {
    renderInLocale(<MonthRails period="September/2026" content={CONTENT} />);
    const balances = screen.getByRole('region', { name: 'Balances' });
    expect(balances.textContent).toContain('Itaú Conta');
    expect(balances.textContent).toContain('Nubank');
    expect(screen.getAllByText('Outstanding')).toHaveLength(2);
  });

  it('draws the budgets with their status, and the goals in their own currency', () => {
    renderInLocale(<MonthRails period="September/2026" content={CONTENT} />);
    expect(screen.getByText('Household Essentials')).toBeTruthy();
    expect(screen.getByText('Over by R$ 250,00')).toBeTruthy();
    expect(screen.getByText('$6,800.00 to go')).toBeTruthy();
  });

  it('notes a goal funded in other currencies', () => {
    const goals = [goalOf('Trip', [{
      holdingId: 'petr',
      name: 'PETR4',
      percentage: 50,
      contribution: { currency: 'BRL', amount: 1000 },
    }])];
    renderInLocale(<MonthRails period="September/2026" content={{ ...CONTENT, goals }} />);
    expect(screen.getByText('Other currencies need a rate')).toBeTruthy();
  });

  it('says so on a rail with nothing to show', () => {
    renderInLocale(
      <MonthRails period="September/2026" content={{ balances: [], budgets: [], goals: [] }} />,
    );
    expect(screen.getByText('No accounts to show')).toBeTruthy();
    expect(screen.getByText('No budgets this month')).toBeTruthy();
    expect(screen.getByText('No goals yet')).toBeTruthy();
  });

  it('shows placeholders on every rail while the month loads', () => {
    renderInLocale(<MonthRails period="September/2026" content={undefined} />);
    expect(screen.getByLabelText('Loading Balances')).toBeTruthy();
    expect(screen.getByLabelText('Loading Budgets')).toBeTruthy();
    expect(screen.getByLabelText('Loading Goals')).toBeTruthy();
    expect(screen.queryByRole('region')).toBeNull();
  });
});
