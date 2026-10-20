import { describe, expect, it } from 'vitest';
import {
  createFormatter, dateConventions, decimalSeparator, formatDate, formatList, formatMoney,
  formatPercent, formatRate, moneyConventions,
} from '../../../src/utilities/formatting';

// Utility (BDT: unit, pure — nothing to mock). `Intl` writes a no-break
// space between `R$` and the amount (pt-BR writes none before %).

const NBSP = '\u00a0';

describe('formatMoney', () => {
  it('writes minor units in the currency’s own conventions', () => {
    expect(formatMoney(123456, 'BRL')).toBe(`R$${NBSP}1.234,56`);
    expect(formatMoney(123456, 'USD')).toBe('$1,234.56');
    expect(formatMoney(5, 'USD')).toBe('$0.05');
  });

  it('writes a negative amount with the true minus sign', () => {
    expect(formatMoney(-4599, 'USD')).toBe('−$45.99');
    expect(formatMoney(-5840, 'BRL')).toBe(`−R$${NBSP}58,40`);
  });

  it('writes + on a positive amount only when asked', () => {
    expect(formatMoney(320000, 'USD', { sign: 'always' })).toBe('+$3,200.00');
    expect(formatMoney(-4599, 'USD', { sign: 'always' })).toBe('−$45.99');
    expect(formatMoney(0, 'USD', { sign: 'always' })).toBe('$0.00');
    expect(formatMoney(320000, 'USD', { sign: 'auto' })).toBe('$3,200.00');
  });
});

describe('moneyConventions', () => {
  it('reads each currency’s symbol, separators and cents in its own conventions', () => {
    expect(moneyConventions('BRL')).toEqual({
      symbol: 'R$', decimal: ',', group: '.', minorDigits: 2,
    });
    expect(moneyConventions('USD')).toEqual({
      symbol: '$', decimal: '.', group: ',', minorDigits: 2,
    });
  });
});

describe('decimalSeparator', () => {
  it('reads the interface language’s decimal sign', () => {
    expect(decimalSeparator('pt-BR')).toBe(',');
    expect(decimalSeparator('en-US')).toBe('.');
  });
});

describe('dateConventions', () => {
  it('reads the interface language’s numeric date order and separator', () => {
    expect(dateConventions('pt-BR')).toEqual({ order: ['day', 'month', 'year'], separator: '/' });
    expect(dateConventions('en-US')).toEqual({ order: ['month', 'day', 'year'], separator: '/' });
  });
});

describe('formatRate', () => {
  it('writes percent × 10,000 with two decimals in the interface language', () => {
    expect(formatRate(105000, 'en-US')).toBe('10.50%');
    expect(formatRate(105000, 'pt-BR')).toBe('10,50%');
  });

  it('rounds to two decimals and keeps a negative rate’s sign', () => {
    expect(formatRate(101234, 'en-US')).toBe('10.12%');
    expect(formatRate(-5000, 'en-US')).toBe('−0.50%');
  });
});

describe('formatPercent', () => {
  it('writes a whole percent in the interface language', () => {
    expect(formatPercent(40, 'en-US')).toBe('40%');
    expect(formatPercent(100, 'pt-BR')).toBe('100%');
  });
});

describe('formatDate', () => {
  it('writes a day numerically by default, in each locale’s order', () => {
    expect(formatDate('2026-09-30', 'pt-BR')).toBe('30/09/2026');
    expect(formatDate('2026-09-30', 'en-US')).toBe('09/30/2026');
  });

  it('never moves the day across a time zone', () => {
    expect(formatDate('2026-01-01', 'en-US')).toBe('01/01/2026');
  });

  it('writes each named style', () => {
    expect(formatDate('2026-09-07', 'en-US', 'dayMonth')).toBe('Sep 7');
    expect(formatDate('2026-09-07', 'en-US', 'monthYear')).toBe('September 2026');
    expect(formatDate('2026-09-07', 'pt-BR', 'monthYear')).toBe('setembro de 2026');
    expect(formatDate('2026-09-07', 'en-US', 'weekdayDayMonth')).toBe('Mon, Sep 7');
  });

  it('returns the input when it isn’t a date', () => {
    expect(formatDate('not-a-date', 'en-US')).toBe('not-a-date');
  });
});

describe('formatList', () => {
  it('joins names with the locale’s conjunction', () => {
    expect(formatList(['Casa', 'Praia', 'Sítio'], 'en-US')).toBe('Casa, Praia, and Sítio');
    expect(formatList(['Casa', 'Praia', 'Sítio'], 'pt-BR')).toBe('Casa, Praia e Sítio');
    expect(formatList(['Casa'], 'pt-BR')).toBe('Casa');
  });
});

describe('createFormatter', () => {
  it('binds every formatter but money to the locale', () => {
    const formatter = createFormatter('pt-BR');

    expect(formatter.money(123456, 'USD')).toBe('$1,234.56');
    expect(formatter.rate(105000)).toBe('10,50%');
    expect(formatter.percent(40)).toBe('40%');
    expect(formatter.date('2026-09-30')).toBe('30/09/2026');
    expect(formatter.date('2026-09-07', 'dayMonth')).toBe('7 de set.');
    expect(formatter.list(['A', 'B'])).toBe('A e B');
  });
});
