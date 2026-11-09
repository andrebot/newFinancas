import type { InvestmentHolding } from '@financas/api-types';
import { describe, expect, it } from 'vitest';
import {
  chosenIdsOf, parseSelection, queryIdsOf, selectionOf, serializeSelection,
} from '../../../src/experiences/payoutSelection';

// The payout chart's choice of Holdings (BDT: pure helpers, unit, nothing mocked).

const HOLDINGS: InvestmentHolding[] = [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }];

describe('parseSelection', () => {
  it('is every Holding when nothing is stored', () => {
    expect(parseSelection(null)).toBe('all');
  });

  it('reads "all" and a list of ids', () => {
    expect(parseSelection('"all"')).toBe('all');
    expect(parseSelection('["h1","h3"]')).toEqual(['h1', 'h3']);
  });

  it('is every Holding when what is stored is unreadable', () => {
    expect(parseSelection('{broken')).toBe('all');
    expect(parseSelection('[1,2]')).toBe('all');
    expect(parseSelection('{"ids":[]}')).toBe('all');
  });
});

describe('serializeSelection', () => {
  it('round-trips through parseSelection', () => {
    expect(parseSelection(serializeSelection('all'))).toBe('all');
    expect(parseSelection(serializeSelection(['h2']))).toEqual(['h2']);
    expect(parseSelection(serializeSelection([]))).toEqual([]);
  });
});

describe('chosenIdsOf', () => {
  it('lists every Holding for "all"', () => {
    expect(chosenIdsOf('all', HOLDINGS)).toEqual(['h1', 'h2', 'h3']);
  });

  it('keeps the Holdings\' order and drops one that is gone', () => {
    expect(chosenIdsOf(['h3', 'gone', 'h1'], HOLDINGS)).toEqual(['h1', 'h3']);
  });
});

describe('selectionOf', () => {
  it('remembers every Holding chosen as "all"', () => {
    expect(selectionOf(['h3', 'h1', 'h2'], HOLDINGS)).toBe('all');
  });

  it('remembers a partial choice as its ids', () => {
    expect(selectionOf(['h2'], HOLDINGS)).toEqual(['h2']);
    expect(selectionOf([], HOLDINGS)).toEqual([]);
  });

  it('keeps the ids while there are no Holdings to compare with', () => {
    expect(selectionOf([], [])).toEqual([]);
  });
});

describe('queryIdsOf', () => {
  it('asks for every Holding with no list', () => {
    expect(queryIdsOf('all')).toBeUndefined();
  });

  it('asks for the chosen ids', () => {
    expect(queryIdsOf(['h1'])).toEqual(['h1']);
  });
});
