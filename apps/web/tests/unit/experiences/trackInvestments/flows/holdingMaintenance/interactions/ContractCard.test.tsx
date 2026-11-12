import type { InvestmentHolding } from '@financas/api-types';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ContractCard, estimateNoteOf, termLeftOf,
} from '../../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/ContractCard';
import { createFormatter } from '../../../../../../../src/utilities/formatting';
import { createTranslator } from '../../../../../../../src/utilities/i18n';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import { holdingOf, holdingWithout } from '../../../../portfolioFixtures';

// Contract (BDT: Interaction, unit; nothing mocked — the kit and the
// translator run for real). Mockup 51's Tesouro Selic 2029.

const SELIC: InvestmentHolding = holdingOf('selic29', {
  assetType: 'tesouro_direto',
  ticker: 'Tesouro Selic 2029',
  costBasis: 14000000,
  boughtOn: '2025-01-10',
  dueDate: '2029-03-15',
  rate: { type: 'selic', value: 1000000, spread: null },
  expectedPayout: 21220000,
  expectedTaxes: { estimated: true, amount: 1083000 },
  projectionUnavailable: null,
});

const TEXTS = {
  translator: createTranslator('en-US'),
  formatter: createFormatter('en-US'),
  currency: 'BRL' as const,
};

describe('ContractCard', () => {
  it('shows the terms, read-only, with the term elapsed and the estimate', () => {
    renderInLocale(
      <ContractCard
        holding={SELIC}
        currency="BRL"
        today="2026-10-01"
        latestIndex={{ value: 105000, unit: 'annual_percent' }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Contract' })).toBeTruthy();
    expect([...document.querySelectorAll('dt')].map((term) => term.textContent))
      .toEqual(['Invested', 'Bought', 'Expected payout', 'Expected taxes']);
    expect(screen.getByText('Term elapsed')).toBeTruthy();
    expect(screen.getByText('read-only')).toBeTruthy();
    expect(screen.getByText('01/10/2025')).toBeTruthy();
    expect(screen.getByText('R$ 212.200,00')).toBeTruthy();
    expect(screen.getByText('−R$ 10.830,00')).toBeTruthy();
    expect(screen.getByText('2 yrs 5 mo to go')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Term elapsed' })
      .getAttribute('aria-valuenow')).toBe('41');
    expect(screen.getByText(
      'Estimate if Selic stays at 10.50% a year · net ≈ R$ 201.370,00',
    )).toBeTruthy();
  });

  it('leaves the term out without the buy\'s date, and dashes what isn\'t known', () => {
    renderInLocale(
      <ContractCard
        holding={{
          ...SELIC, boughtOn: null, expectedPayout: null, expectedTaxes: null,
        }}
        currency="BRL"
        today="2026-10-01"
      />,
    );

    expect(screen.queryByText('Term elapsed')).toBeNull();
    expect(screen.getAllByText('—').length).toBe(3);
    expect(screen.getByText('Estimate')).toBeTruthy();
  });

  it('says a US instrument\'s taxes are not estimated', () => {
    renderInLocale(
      <ContractCard
        holding={{
          ...SELIC, expectedTaxes: { estimated: false }, rate: { type: 'fixed', value: 50000 },
        }}
        currency="USD"
        today="2026-10-01"
      />,
    );

    expect(screen.getByText('Not estimated')).toBeTruthy();
    expect(screen.getByText('Estimate · taxes not estimated')).toBeTruthy();
  });
});

describe('ContractCard with missing figures', () => {
  it('counts a missing cost or tax amount as nothing', () => {
    const bare = holdingWithout(SELIC, 'costBasis');
    renderInLocale(
      <ContractCard
        holding={{ ...bare, expectedTaxes: { estimated: true } }}
        currency="BRL"
        today="2026-10-01"
      />,
    );

    // Invested and the taxes: no minus on a zero (OQ-211).
    expect(screen.getAllByText('R$ 0,00')).toHaveLength(2);
  });
});

describe('estimateNoteOf', () => {
  it('says why there is no estimate when the index has no value', () => {
    const missing = {
      ...SELIC,
      projectionUnavailable: { reason: 'index_missing' as const, indexCode: 'ipca' as const },
    };

    expect(estimateNoteOf(missing, undefined, TEXTS))
      .toBe('IPCA has no value yet — record one in Rates to see the estimate.');
  });

  it('gives pt-BR the article its index takes (review round 1)', () => {
    const portuguese = {
      translator: createTranslator('pt-BR'),
      formatter: createFormatter('pt-BR'),
      currency: 'BRL' as const,
    };
    const cdi = { ...SELIC, rate: { type: 'cdi' as const, value: 1_100_000 } };

    expect(estimateNoteOf(SELIC, { value: 105000, unit: 'annual_percent' }, portuguese))
      .toMatch(/^Estimativa se a Selic ficar em 10,50% ao ano/);
    expect(estimateNoteOf(cdi, { value: 105000, unit: 'annual_percent' }, portuguese))
      .toMatch(/^Estimativa se o CDI ficar em/);
  });

  it('quotes a 12-month index over 12 months, and an estimate with no taxes known', () => {
    const ipca = { ...SELIC, rate: { type: 'ipca' as const, value: 55000 } };

    expect(estimateNoteOf(ipca, { value: 45000, unit: 'trailing_12m_percent' }, TEXTS))
      .toBe('Estimate if IPCA stays at 4.50% over 12 months · net ≈ R$\u00A0201.370,00');
    expect(estimateNoteOf({ ...SELIC, rate: null }, undefined, TEXTS)).toBe(
      'Estimate · net ≈ R$\u00A0201.370,00',
    );
    expect(estimateNoteOf(
      { ...SELIC, expectedTaxes: { estimated: true } },
      undefined,
      TEXTS,
    )).toBe('Estimate if Selic stays at 0.00% a year · net ≈ R$\u00A0212.200,00'.replace(
      ' if Selic stays at 0.00% a year',
      '',
    ));
  });
});

describe('termLeftOf', () => {
  const texts = { translator: TEXTS.translator, formatter: TEXTS.formatter };
  const term = {
    elapsedPercent: 50, yearsLeft: 0, monthsLeft: 0, daysLeft: 0, matured: false,
  };

  it('writes the years and months to go, either alone', () => {
    expect(termLeftOf({ ...term, yearsLeft: 1 }, '2027-10-01', texts)).toBe('1 yr to go');
    expect(termLeftOf({ ...term, monthsLeft: 3 }, '2027-01-01', texts)).toBe('3 mo to go');
  });

  it('counts the days under a month, never "this month" (review round 1)', () => {
    expect(termLeftOf({ ...term, daysLeft: 26 }, '2026-12-05', texts)).toBe('26 days to go');
    expect(termLeftOf({ ...term, daysLeft: 1 }, '2026-11-10', texts)).toBe('1 day to go');
  });

  it('says when a contract past its date matured', () => {
    expect(termLeftOf({ ...term, elapsedPercent: 100, matured: true }, '2024-03-15', texts))
      .toBe('Matured on 03/15/2024');
  });
});
