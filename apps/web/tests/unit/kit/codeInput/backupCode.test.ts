import { describe, expect, it } from 'vitest';
import {
  backupCodeMask, formatBackupCode, parseBackupCode,
} from '../../../../src/kit/codeInput/backupCode';

// Pure mask (BDT: Utility-like → unit, nothing mocked).

describe('parseBackupCode', () => {
  it('raises lower case and drops dashes and spaces', () => {
    expect(parseBackupCode('7hjx-21na q4kd')).toBe('7HJX21NAQ4KD');
  });

  it('reads the look-alikes O, I and L as 0, 1 and 1, as the API does', () => {
    expect(parseBackupCode('oIl0')).toBe('0110');
  });

  it('drops characters a code never holds', () => {
    expect(parseBackupCode('AU!*Z')).toBe('AZ');
  });

  it('stops at a code’s length', () => {
    expect(parseBackupCode('7HJX21NAQ4KD9WTE55')).toBe('7HJX21NAQ4KD9WTE');
  });
});

describe('formatBackupCode', () => {
  it('shows the code in dashed groups of four', () => {
    expect(formatBackupCode('7HJX21NAQ4KD9WTE')).toBe('7HJX-21NA-Q4KD-9WTE');
  });

  it('adds a dash only once the next group has begun', () => {
    expect(formatBackupCode('7HJX')).toBe('7HJX');
    expect(formatBackupCode('7HJX2')).toBe('7HJX-2');
  });

  it('shows nothing for an empty code', () => {
    expect(formatBackupCode('')).toBe('');
  });
});

describe('backupCodeMask', () => {
  it('reads back what it shows', () => {
    const clean = '7HJX21NAQ4KD9WTE';

    expect(backupCodeMask.parse(backupCodeMask.format(clean))).toBe(clean);
  });
});
