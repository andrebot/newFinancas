import { describe, expect, it } from 'vitest';
import {
  figuresOf, firstYearOf, rememberedCurrency, stripOf,
} from '../../../../../../src/experiences/manageFinances/flows/monthOverview/monthOverview';
import { accountOf, REPORT } from '../../../monthFixtures';

// What Month Overview reads from its report (BDT: Flow logic, unit; pure).

describe('stripOf', () => {
  it('keeps one currency\'s months, each read as its number', () => {
    expect(stripOf(REPORT.yearStrip, 'USD')).toEqual([
      { month: 8, in: 300000, out: 120000 },
      { month: 9, in: 320000, out: 83139 },
    ]);
  });

  it('is empty for a currency with no months', () => {
    expect(stripOf(REPORT.yearStrip.filter((row) => row.currency === 'USD'), 'BRL')).toEqual([]);
  });
});

describe('figuresOf', () => {
  it('picks one currency\'s in, out and net', () => {
    expect(figuresOf(REPORT.summary, 'BRL')).toEqual({ in: 0, out: 11680, net: -11680 });
  });

  it('reads zeros when nothing moved in the currency', () => {
    expect(figuresOf([], 'USD')).toEqual({ in: 0, out: 0, net: 0 });
  });
});

describe('firstYearOf', () => {
  it('reaches the household\'s creation when it comes first', () => {
    const accounts = [accountOf('a', { startingBalanceDate: '2025-03-01' })];
    expect(firstYearOf(accounts, '2024-06-01T00:00:00Z')).toBe(2024);
  });

  it('reaches the earliest account\'s starting balance when it comes first', () => {
    const accounts = [
      accountOf('a', { startingBalanceDate: '2025-03-01' }),
      accountOf('b', { startingBalanceDate: '2019-11-30' }),
    ];
    expect(firstYearOf(accounts, '2026-01-10T00:00:00Z')).toBe(2019);
  });

  it('is the household\'s year with no accounts', () => {
    expect(firstYearOf([], '2026-01-10T00:00:00Z')).toBe(2026);
  });
});

describe('rememberedCurrency', () => {
  it('reads a remembered currency', () => {
    expect(rememberedCurrency('USD')).toBe('USD');
  });

  it('opens on R$ when nothing is remembered', () => {
    expect(rememberedCurrency(null)).toBe('BRL');
  });

  it('opens on R$ when what is stored is not a currency', () => {
    expect(rememberedCurrency('EUR')).toBe('BRL');
  });
});
