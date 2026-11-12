import { describe, expect, it } from 'vitest';
import {
  dashboardReadOf, periodOfMonth,
} from '../../../../src/experiences/reviewInsights/reviewInsights';
import { ACCOUNTS } from '../monthFixtures';
import { HOLDINGS } from '../portfolioFixtures';
import { DASHBOARD } from './dashboardFixtures';

// What the Review Insights Experience reads its queries into (BDT: unit,
// pure — nothing to mock).

const LOADED = {
  report: { data: DASHBOARD, isError: false },
  holdings: { data: HOLDINGS, isError: false },
  accounts: { data: ACCOUNTS, isError: false },
};

describe('dashboardReadOf (OQ-242)', () => {
  it('is loaded once the report, the Holdings and the accounts are in', () => {
    expect(dashboardReadOf(LOADED)).toEqual({
      status: 'loaded', report: DASHBOARD, holdings: HOLDINGS, accounts: ACCOUNTS,
    });
  });

  it.each(['report', 'holdings', 'accounts'] as const)('waits for the %s', (read) => {
    expect(dashboardReadOf({ ...LOADED, [read]: { isError: false } }))
      .toEqual({ status: 'loading' });
  });

  it.each(['report', 'holdings', 'accounts'] as const)('fails as one when the %s fails', (read) => {
    expect(dashboardReadOf({ ...LOADED, [read]: { isError: true } }))
      .toEqual({ status: 'failed' });
  });
});

describe('periodOfMonth', () => {
  it('reads the report\'s YYYY-MM', () => {
    expect(periodOfMonth('2026-09')).toEqual({ year: 2026, month: 9 });
  });
});
