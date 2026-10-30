import { describe, expect, it } from 'vitest';
import { pickByHash, stableHash } from '../../../src/utilities/stableHash';

// The stable string hash (BDT: Utility, unit; pure, nothing mocked).

describe('stableHash', () => {
  it('hashes the empty text to 0', () => {
    expect(stableHash('')).toBe(0);
  });

  it('multiplies by 31 per character', () => {
    expect(stableHash('ab')).toBe(97 * 31 + 98);
  });

  it('gives the same text the same hash every time', () => {
    expect(stableHash('3f2c-account')).toBe(stableHash('3f2c-account'));
  });

  it('stays a non-negative 32-bit number on a long text', () => {
    const hash = stableHash('x'.repeat(500));
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(2 ** 32);
  });
});

describe('pickByHash', () => {
  it('picks the choice the hash lands on', () => {
    const choices = ['first', 'second', 'third'] as const;
    expect(pickByHash('ab', choices)).toBe(choices[(97 * 31 + 98) % 3]);
  });

  it('always picks the only choice of one', () => {
    expect(pickByHash('anything', ['only'])).toBe('only');
  });
});
