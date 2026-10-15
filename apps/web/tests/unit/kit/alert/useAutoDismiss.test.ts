import { act, renderHook } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { useAutoDismiss } from '../../../../src/kit/alert/useAutoDismiss';

// Kit hook (BDT: Interaction tier → unit): only the clock is faked.

describe('useAutoDismiss', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('dismisses once the time is up', () => {
    const onDismiss = vi.fn();
    renderHook(() => useAutoDismiss(1000, onDismiss));

    act(() => vi.advanceTimersByTime(999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('never dismisses a toast that stays', () => {
    const onDismiss = vi.fn();
    renderHook(() => useAutoDismiss(null, onDismiss));

    act(() => vi.advanceTimersByTime(60_000));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('pauses while hovered and starts the full time over on leaving', () => {
    const onDismiss = vi.fn();
    const { result } = renderHook(() => useAutoDismiss(1000, onDismiss));

    act(() => vi.advanceTimersByTime(800));
    act(() => result.current.onPointerEnter());
    act(() => vi.advanceTimersByTime(5000));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => result.current.onPointerLeave());
    act(() => vi.advanceTimersByTime(999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('stays paused while focus is inside, even once the pointer leaves', () => {
    const onDismiss = vi.fn();
    const { result } = renderHook(() => useAutoDismiss(1000, onDismiss));

    act(() => {
      result.current.onPointerEnter();
      result.current.onFocus();
    });
    act(() => result.current.onPointerLeave());
    act(() => vi.advanceTimersByTime(5000));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => result.current.onBlur());
    act(() => vi.advanceTimersByTime(1000));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('calls the latest onDismiss without restarting the time', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = renderHook(
      ({ onDismiss }) => useAutoDismiss(1000, onDismiss),
      { initialProps: { onDismiss: first } },
    );

    act(() => vi.advanceTimersByTime(600));
    rerender({ onDismiss: latest });
    act(() => vi.advanceTimersByTime(400));

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });
});
