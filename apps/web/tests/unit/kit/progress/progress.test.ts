import { describe, expect, it } from 'vitest';
import {
  FILL_MOTION_DURATION,
  clampPercent,
  progressAttributes,
} from '../../../../src/kit/progress/progress';

// Kit utility (BDT: Utility → unit, nothing mocked): pure helpers.

describe('clampPercent', () => {
  it('keeps a value between 0 and 100', () => {
    expect(clampPercent(32)).toBe(32);
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(100)).toBe(100);
  });

  it('holds values outside the range to its ends, and a non-number to 0', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(112)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
  });
});

describe('progressAttributes', () => {
  it('describes a progress bar from 0 to 100, rounding the value', () => {
    expect(progressAttributes('Emergency Fund', 33.6, '34%')).toEqual({
      role: 'progressbar',
      'aria-label': 'Emergency Fund',
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'aria-valuenow': 34,
      'aria-valuetext': '34%',
    });
  });

  it('leaves out a missing or empty value text', () => {
    expect(progressAttributes('Goal', 10)['aria-valuetext']).toBeUndefined();
    expect(progressAttributes('Goal', 10, '')['aria-valuetext']).toBeUndefined();
  });
});

describe('FILL_MOTION_DURATION', () => {
  it('stays within the design system’s 150–250ms', () => {
    expect(FILL_MOTION_DURATION).toBe('duration-200');
  });
});
