import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { tooltip } from '../../../../src/config/constants';
import { Tooltip, type TooltipProps } from '../../../../src/kit/tooltip/Tooltip';

// Kit component (BDT: Interaction tier → unit): nothing is a stand-in but the
// clock; Floating UI runs for real in jsdom.

/**
 * Renders a tooltip on a plain button, with overrides.
 *
 * @param overrides - Props replacing the defaults.
 * @returns The render result.
 */
const renderTooltip = (overrides: Partial<TooltipProps> = {}) => render(
  <Tooltip content="Remove Sam" {...overrides}>
    {overrides.children ?? ((props) => <button type="button" {...props}>×</button>)}
  </Tooltip>,
);

const trigger = () => screen.getByRole('button', { name: '×' });

/** Lets Floating UI position the chip. */
const flush = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
};

/**
 * Rests the mouse on an element for a while.
 *
 * @param element - Where.
 * @param ms - For how long.
 */
const hover = async (element: Element, ms: number) => {
  fireEvent.pointerEnter(element, { pointerType: 'mouse' });
  fireEvent.mouseMove(element);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Tooltip — hover', () => {
  it('shows after the pointer rests, describing the trigger', async () => {
    renderTooltip();

    await hover(trigger(), tooltip.openDelayMs - 1);
    expect(screen.queryByRole('tooltip')).toBeNull();
    await hover(trigger(), 1);

    const chip = screen.getByRole('tooltip');
    expect(chip.textContent).toBe('Remove Sam');
    expect(chip.className).toContain('bg-ink');
    expect(trigger().getAttribute('aria-describedby')).toBe(chip.id);
  });

  it('goes when the pointer leaves', async () => {
    renderTooltip();
    await hover(trigger(), tooltip.openDelayMs);

    fireEvent.pointerLeave(trigger(), { pointerType: 'mouse' });
    fireEvent.mouseLeave(trigger());
    await flush();

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('never shows on touch', async () => {
    renderTooltip();

    fireEvent.pointerEnter(trigger(), { pointerType: 'touch' });
    fireEvent.mouseMove(trigger());
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(tooltip.openDelayMs);
    });

    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Tooltip — focus and dismissal', () => {
  it('shows at once on focus and goes on blur', async () => {
    renderTooltip();

    act(() => trigger().focus());
    await flush();
    expect(screen.getByRole('tooltip')).toBeTruthy();

    act(() => trigger().blur());
    await flush();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('goes on Escape and on a press', async () => {
    renderTooltip();
    act(() => trigger().focus());
    await flush();

    fireEvent.keyDown(document, { key: 'Escape' });
    await flush();
    expect(screen.queryByRole('tooltip')).toBeNull();

    await hover(trigger(), tooltip.openDelayMs);
    fireEvent.pointerDown(trigger());
    fireEvent.mouseDown(trigger());
    await flush();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Tooltip — naming and composition', () => {
  it('adds no description when it repeats the trigger’s name', async () => {
    renderTooltip({ repeatsName: true });

    act(() => trigger().focus());
    await flush();

    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(screen.getByText('Remove Sam').getAttribute('aria-hidden')).toBe('true');
    expect(trigger().getAttribute('aria-describedby')).toBeNull();
  });

  it('merges another trigger’s ref and handlers', async () => {
    const ref = vi.fn();
    const onClick = vi.fn();
    renderTooltip({ triggerProps: { ref, onClick } });

    fireEvent.click(trigger());

    expect(ref).toHaveBeenCalledWith(trigger());
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('wraps a disabled trigger in a focusable span that takes the events', async () => {
    renderTooltip({
      content: 'Claimed by Groceries',
      children: <button type="button" disabled>Food</button>,
    });
    const wrapper = screen.getByRole('button', { name: 'Food' }).parentElement as HTMLElement;
    expect(wrapper.tagName).toBe('SPAN');
    expect(wrapper.tabIndex).toBe(0);

    act(() => wrapper.focus());
    await flush();

    const chip = screen.getByRole('tooltip');
    expect(chip.textContent).toBe('Claimed by Groceries');
    expect(wrapper.getAttribute('aria-describedby')).toBe(chip.id);
  });
});
