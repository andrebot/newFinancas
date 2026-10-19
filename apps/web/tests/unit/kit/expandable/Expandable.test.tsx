import {
  act, fireEvent, render, renderHook, screen,
} from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  Expandable,
  chevronClasses,
  expandableClasses,
  triggerClasses,
  useExpanded,
} from '../../../../src/kit/expandable/Expandable';

// Kit component (BDT: Interaction tier → unit): it renders and reports each
// toggle upward; nothing to stand in for.

/**
 * Finds the summary's button by its accessible name.
 *
 * @param name - The summary's text.
 * @returns The button.
 */
const triggerNamed = (name: string) => screen.getByRole('button', { name });

describe('expandableClasses', () => {
  it('raises a row and edges it in mint only while open', () => {
    expect(expandableClasses('row', true)).toBe('border-y border-mint/30 bg-raised');
    expect(expandableClasses('row', false)).toBe('');
  });

  it('borders a card the same way open or closed', () => {
    const card = 'overflow-hidden rounded-card border border-line';
    expect(expandableClasses('card', true)).toBe(card);
    expect(expandableClasses('card', false)).toBe(card);
  });
});

describe('triggerClasses', () => {
  it('pads a row like the ledger and a card like a section header', () => {
    expect(triggerClasses('row')).toContain('py-3 pl-5 pr-4');
    expect(triggerClasses('card')).toContain('px-5 py-3.5 text-muted');
  });

  it('gives every trigger the inset mint focus ring', () => {
    expect(triggerClasses('row')).toContain('focus-visible:outline-mint');
    expect(triggerClasses('card')).toContain('focus-visible:-outline-offset-2');
  });
});

describe('chevronClasses', () => {
  it('turns the chevron over in mint while open', () => {
    expect(chevronClasses('row', true)).toContain('rotate-180 text-mint');
    expect(chevronClasses('card', true)).toContain('rotate-180 text-mint');
  });

  it('draws a closed row chevron faint and lets a card chevron follow its text', () => {
    const chevron = 'size-5 shrink-0 transition-transform duration-200';
    expect(chevronClasses('row', false)).toBe(`${chevron} text-faint`);
    expect(chevronClasses('card', false)).toBe(chevron);
  });
});

describe('useExpanded', () => {
  it('holds its own state from the default and reports each toggle', () => {
    const onExpandedChange = vi.fn();
    const { result } = renderHook(() => useExpanded(undefined, true, onExpandedChange));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    expect(onExpandedChange).toHaveBeenLastCalledWith(false);
  });

  it('follows the caller and only asks it for the change', () => {
    const onExpandedChange = vi.fn();
    const { result } = renderHook(() => useExpanded(false, true, onExpandedChange));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it('toggles without a listener', () => {
    const { result } = renderHook(() => useExpanded(undefined, false));
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
  });
});

describe('Expandable', () => {
  it('starts closed: the button says so and there is no panel', () => {
    render(<Expandable summary="Coffee Shop">Details</Expandable>);
    const trigger = triggerNamed('Coffee Shop') as HTMLButtonElement;
    expect(trigger.type).toBe('button');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('aria-controls')).toBe(false);
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByText('Details')).toBeNull();
  });

  it('opens on click into a region the button controls and names', () => {
    render(<Expandable summary="Coffee Shop">Details</Expandable>);
    const trigger = triggerNamed('Coffee Shop');
    fireEvent.click(trigger);
    const panel = screen.getByRole('region', { name: 'Coffee Shop' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.textContent).toBe('Details');
    fireEvent.click(trigger);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('draws an open row raised and its chevron turned over', () => {
    const { container } = render(
      <Expandable summary="Tesouro Selic 2029" defaultExpanded>Contract</Expandable>,
    );
    const box = container.firstElementChild as HTMLElement;
    expect(box.className).toBe(expandableClasses('row', true));
    expect(box.querySelector('svg')?.getAttribute('class')).toBe(chevronClasses('row', true));
    expect(triggerNamed('Tesouro Selic 2029').className).toBe(triggerClasses('row'));
    expect(screen.getByRole('region').hasAttribute('class')).toBe(false);
  });

  it('draws a card bordered with a rule over its panel', () => {
    const { container } = render(
      <Expandable surface="card" summary="Archived" defaultExpanded>Pets</Expandable>,
    );
    expect((container.firstElementChild as HTMLElement).className)
      .toBe(expandableClasses('card', true));
    expect(triggerNamed('Archived').className).toBe(triggerClasses('card'));
    expect(screen.getByRole('region').className).toBe('border-t border-line');
  });

  it('keeps the caller\'s state and reports the asked-for change', () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <Expandable summary="Netflix" expanded={false} onExpandedChange={onExpandedChange}>
        Details
      </Expandable>,
    );
    fireEvent.click(triggerNamed('Netflix'));
    expect(onExpandedChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.queryByRole('region')).toBeNull();
    rerender(
      <Expandable summary="Netflix" expanded onExpandedChange={onExpandedChange}>
        Details
      </Expandable>,
    );
    expect(screen.getByRole('region', { name: 'Netflix' }).textContent).toBe('Details');
  });

  it('gives each expandable its own ids', () => {
    render(
      <>
        <Expandable summary="Netflix" defaultExpanded>One</Expandable>
        <Expandable summary="Amazon" defaultExpanded>Two</Expandable>
      </>,
    );
    expect(triggerNamed('Netflix').id).not.toBe(triggerNamed('Amazon').id);
    expect(screen.getAllByRole('region')).toHaveLength(2);
  });
});
