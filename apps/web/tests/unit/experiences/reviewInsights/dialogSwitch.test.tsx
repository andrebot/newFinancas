import { act, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  createDialogSwitch, useDialogOpen, type DialogSwitch,
} from '../../../../src/experiences/reviewInsights/dialogSwitch';

// A dialog's open flag (BDT: unit, nothing mocked).

describe('createDialogSwitch', () => {
  it('starts closed, opens and closes, telling its listeners only on a change', () => {
    const dialog = createDialogSwitch();
    const listener = vi.fn();
    const stop = dialog.subscribe(listener);

    expect(dialog.isOpen()).toBe(false);
    expect(dialog.opens()).toBe(0);
    dialog.open();
    dialog.open();
    expect(dialog.isOpen()).toBe(true);
    expect(dialog.opens()).toBe(1);
    dialog.close();
    expect(dialog.isOpen()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    dialog.open();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(dialog.opens()).toBe(2);
  });
});

/**
 * Shows a switch's flag.
 *
 * @param props - The switch.
 * @returns The flag, as text.
 */
function Probe({ dialog }: { readonly dialog: DialogSwitch }) {
  return <output>{String(useDialogOpen(dialog))}</output>;
}

describe('useDialogOpen', () => {
  it('re-renders when the switch flips', () => {
    const dialog = createDialogSwitch();
    render(<Probe dialog={dialog} />);

    expect(screen.getByRole('status').textContent).toBe('false');
    act(() => dialog.open());
    expect(screen.getByRole('status').textContent).toBe('true');
  });
});
