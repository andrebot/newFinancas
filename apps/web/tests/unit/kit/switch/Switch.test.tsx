import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { Switch, THUMB, TRACK } from '../../../../src/kit/switch/Switch';
import FOCUS_RING from '../../../../src/kit/focusRing';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handler is a stand-in.

/**
 * Finds the switch by its accessible name.
 *
 * @param name - The switch's accessible name.
 * @returns The switch input.
 */
const switchNamed = (name: string) => screen.getByRole<HTMLInputElement>('switch', { name });

describe('Switch', () => {
  it('is a native checkbox with the switch role, named by its label only', () => {
    render(
      <Switch
        checked={false}
        onChange={vi.fn()}
        label="Incentivada"
        description="Isenta de IR"
      />,
    );

    const toggle = switchNamed('Incentivada');
    expect(toggle.type).toBe('checkbox');
    expect(toggle.className).toBe('sr-only');
  });

  it('reflects the on/off state it is given', () => {
    const { rerender } = render(<Switch checked={false} onChange={vi.fn()} label="Incentivada" />);
    expect(switchNamed('Incentivada').checked).toBe(false);

    rerender(<Switch checked onChange={vi.fn()} label="Incentivada" />);
    expect(switchNamed('Incentivada').checked).toBe(true);
  });

  it('reports the new value when the label is clicked and leaves the state to the caller', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Incentivada" />);

    fireEvent.click(screen.getByText('Incentivada'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(switchNamed('Incentivada').checked).toBe(false);
  });

  it('reports false when a switch that is on is clicked', () => {
    const onChange = vi.fn();
    render(<Switch checked onChange={onChange} label="Incentivada" />);

    fireEvent.click(switchNamed('Incentivada'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('puts the input in the track, which holds a decorative thumb', () => {
    render(<Switch checked onChange={vi.fn()} label="Incentivada" />);
    const track = switchNamed('Incentivada').parentElement!;

    expect(track.className).toBe(TRACK);
    const thumb = track.lastElementChild!;
    expect(thumb.className).toBe(THUMB);
    expect(thumb.getAttribute('aria-hidden')).toBe('true');
  });

  it('describes the switch by its description and has no description without one', () => {
    const { rerender } = render(
      <Switch checked={false} onChange={vi.fn()} label="Incentivada" description="Isenta de IR" />,
    );
    expect(screen.getByRole('switch', { description: 'Isenta de IR' })).toBeDefined();

    rerender(<Switch checked={false} onChange={vi.fn()} label="Incentivada" />);
    expect(switchNamed('Incentivada').hasAttribute('aria-describedby')).toBe(false);
  });

  it('cannot be toggled when disabled', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Incentivada" disabled />);

    fireEvent.click(screen.getByText('Incentivada'));

    expect(switchNamed('Incentivada').disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('TRACK and THUMB', () => {
  it('turns the track mint when on, and it carries the focus ring', () => {
    expect(TRACK).toContain('bg-line');
    expect(TRACK).toContain('has-checked:bg-mint');
    expect(TRACK).toContain(FOCUS_RING);
  });

  it('slides the thumb to the end and darkens it when on', () => {
    expect(THUMB).toContain('bg-muted');
    expect(THUMB).toContain('group-has-checked:translate-x-4');
    expect(THUMB).toContain('group-has-checked:bg-onmint');
  });
});
