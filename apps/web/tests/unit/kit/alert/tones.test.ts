import { describe, expect, it } from 'vitest';
import { toast } from '../../../../src/config/constants';
import {
  defaultDurationOf, roleOf, TONE_ACCENTS, TONE_ICONS,
} from '../../../../src/kit/alert/tones';

// Kit helpers (BDT: pure → unit, nothing mocked).

describe('alert tones', () => {
  it('gives each tone its own glyph and accent', () => {
    expect(new Set(Object.values(TONE_ICONS)).size).toBe(4);
    expect(TONE_ICONS.error).toBe('error-outline');
    expect(TONE_ACCENTS.success).toBe('text-mint');
    expect(TONE_ACCENTS.error).toBe('text-coral');
  });

  it('announces an error at once and the other tones politely', () => {
    expect(roleOf('error')).toBe('alert');
    expect(roleOf('warning')).toBe('status');
    expect(roleOf('success')).toBe('status');
    expect(roleOf('info')).toBe('status');
  });

  it('times success and info toasts and keeps warnings and errors', () => {
    expect(defaultDurationOf('success')).toBe(toast.durationMs);
    expect(defaultDurationOf('info')).toBe(toast.durationMs);
    expect(defaultDurationOf('warning')).toBeNull();
    expect(defaultDurationOf('error')).toBeNull();
  });
});
