import { describe, expect, it } from 'vitest';
import { nearestIndex, steppedIndex } from '../../../../src/kit/chartReadout/readoutIndex';

// The readout's arithmetic (BDT: pure functions → unit, nothing mocked).

describe('nearestIndex', () => {
  const positions = [{ left: 0 }, { left: 40 }, { left: 100 }];

  it('finds the closest position on the X axis', () => {
    expect(nearestIndex(positions, 55)).toBe(1);
    expect(nearestIndex(positions, 90)).toBe(2);
  });

  it('takes the latest of a tie', () => {
    expect(nearestIndex(positions, 20)).toBe(1);
  });

  it('reads the last of two values on one day, the one that counts', () => {
    expect(nearestIndex([{ left: 0 }, { left: 100 }, { left: 100 }], 95))
      .toBe(2);
  });

  it('answers -1 with no positions', () => {
    expect(nearestIndex([], 20)).toBe(-1);
  });
});

describe('steppedIndex', () => {
  it('moves one value along and stops at the ends', () => {
    expect(steppedIndex('ArrowLeft', 2, 5)).toBe(1);
    expect(steppedIndex('ArrowRight', 2, 5)).toBe(3);
    expect(steppedIndex('ArrowLeft', 0, 5)).toBe(0);
    expect(steppedIndex('ArrowRight', 4, 5)).toBe(4);
    expect(steppedIndex('ArrowRight', 0, 5)).toBe(1);
  });

  it('starts the arrows at the newest value with nothing active', () => {
    expect(steppedIndex('ArrowLeft', -1, 5)).toBe(4);
    expect(steppedIndex('ArrowRight', -1, 5)).toBe(4);
  });

  it('jumps to the ends', () => {
    expect(steppedIndex('Home', 2, 5)).toBe(0);
    expect(steppedIndex('End', 2, 5)).toBe(4);
  });

  it('ignores any other key', () => {
    expect(steppedIndex('a', 2, 5)).toBeUndefined();
  });
});
