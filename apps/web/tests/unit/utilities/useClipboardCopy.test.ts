import { captureLogs } from '@financas/logging/browser';
import { act, renderHook } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import useClipboardCopy from '../../../src/utilities/useClipboardCopy';

// Utility (BDT: unit, only the external sink mocked): the browser's clipboard.

const writeText = vi.fn(async (_text: string) => undefined);

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  writeText.mockReset();
});

describe('useClipboardCopy', () => {
  it('copies the text and says so for two seconds', async () => {
    const { result } = renderHook(() => useClipboardCopy());
    expect(result.current.copied).toBe(false);

    await act(() => result.current.copy('JBSW Y3DP'));
    expect(writeText).toHaveBeenCalledWith('JBSW Y3DP');
    expect(result.current.copied).toBe(true);

    act(() => vi.advanceTimersByTime(1999));
    expect(result.current.copied).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.copied).toBe(false);
  });

  it('restarts the two seconds on another copy', async () => {
    const { result } = renderHook(() => useClipboardCopy());

    await act(() => result.current.copy('a'));
    act(() => vi.advanceTimersByTime(1500));
    await act(() => result.current.copy('b'));
    act(() => vi.advanceTimersByTime(1500));

    expect(result.current.copied).toBe(true);
  });

  it('logs a refused copy and claims nothing', async () => {
    writeText.mockRejectedValueOnce(new Error('NotAllowedError'));
    const logs = captureLogs();
    const { result } = renderHook(() => useClipboardCopy());

    await act(() => result.current.copy('a'));
    logs.stop();

    expect(result.current.copied).toBe(false);
    expect(logs.events).toContainEqual(expect.objectContaining({
      level: 'warn', label: 'ClipboardUtility', error: 'Error: NotAllowedError',
    }));
  });

  it('stops the timer when unmounted', async () => {
    const { result, unmount } = renderHook(() => useClipboardCopy());

    await act(() => result.current.copy('a'));
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
