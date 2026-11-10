import {
  describe, expect, it, vi,
} from 'vitest';
import answerOf from '../../../../src/experiences/trackInvestments/historyAnswer';
import type { Alerts } from '../../../../src/utilities/AlertProvider';

// How a Track Investments Flow answers K46/K47 (BDT: helper, unit; only the
// toast sink stands in, the Experience's answer is given).

/**
 * Builds the toast sink.
 *
 * @returns Spies for every tone.
 */
const alertsOf = (): Alerts => ({
  success: vi.fn(() => 1),
  info: vi.fn(() => 1),
  warning: vi.fn(() => 1),
  error: vi.fn(() => 1),
  dismiss: vi.fn(),
});

describe('answerOf', () => {
  it('answers done and toasts the success', async () => {
    const alerts = alertsOf();

    const outcome = await answerOf(Promise.resolve({ ok: true }), 'Saved.', alerts, vi.fn());

    expect(outcome).toBe('done');
    expect(alerts.success).toHaveBeenCalledWith('Saved.');
    expect(alerts.error).not.toHaveBeenCalled();
  });

  it('answers refused and toasts the failure, written from its code', async () => {
    const alerts = alertsOf();
    const errorText = vi.fn(({ code }: { code: string }) => `failed: ${code}`);

    const outcome = await answerOf(
      Promise.resolve({ ok: false, error: { code: 'index_rate.not_found' } }),
      'Saved.',
      alerts,
      errorText,
    );

    expect(outcome).toBe('refused');
    expect(errorText).toHaveBeenCalledWith({ code: 'index_rate.not_found' });
    expect(alerts.error).toHaveBeenCalledWith('failed: index_rate.not_found');
    expect(alerts.success).not.toHaveBeenCalled();
  });
});
