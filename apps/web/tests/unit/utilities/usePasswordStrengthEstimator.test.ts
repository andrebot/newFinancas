import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { loadPasswordStrengthEstimator } from '../../../src/utilities/passwordStrength';
import usePasswordStrengthEstimator from '../../../src/utilities/usePasswordStrengthEstimator';

// Utility (BDT: unit, nothing mocked): the real estimator loads.

describe('usePasswordStrengthEstimator', () => {
  it('answers nothing until the estimator has loaded, then the estimator', async () => {
    const { result } = renderHook(() => usePasswordStrengthEstimator());
    expect(result.current).toBeUndefined();

    await waitFor(() => expect(result.current).toBeTypeOf('function'), { timeout: 5000 });
    expect(result.current?.('short').level).toBe('too_short');
  });

  it('drops the estimator when unmounted before it has loaded', async () => {
    const { result, unmount } = renderHook(() => usePasswordStrengthEstimator());

    unmount();
    await act(async () => {
      await loadPasswordStrengthEstimator();
    });

    expect(result.current).toBeUndefined();
  });
});
