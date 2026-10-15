import type { KeyboardEvent } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  disabledIndicesOf, isPickKey, pickHandlers, typeaheadLabelsOf, type ListItem,
} from '../../../../src/kit/floatingList/listItems';

// Kit helper (BDT: Utility → unit, nothing mocked): the rules the select and
// the menu share for walking and picking their rows.

const items: readonly ListItem[] = [
  { label: 'Itaú Conta' },
  { label: 'Main Checking', disabledReason: 'Sem saldo' },
  { label: 'Nubank' },
];

/**
 * Builds a key event stand-in carrying a key and a spy for `preventDefault`.
 *
 * @param key - The key pressed.
 * @returns The event.
 */
const keyEvent = (key: string) => ({ key, preventDefault: vi.fn() }) as unknown as KeyboardEvent;

describe('typeaheadLabelsOf', () => {
  it('gives each enabled row its label and a disabled one none', () => {
    expect(typeaheadLabelsOf(items)).toEqual(['Itaú Conta', null, 'Nubank']);
  });
});

describe('disabledIndicesOf', () => {
  it('lists the positions of the rows with a reason', () => {
    expect(disabledIndicesOf(items)).toEqual([1]);
  });
});

describe('isPickKey', () => {
  it('picks on Enter and Space only', () => {
    expect(isPickKey(keyEvent('Enter'))).toBe(true);
    expect(isPickKey(keyEvent(' '))).toBe(true);
    expect(isPickKey(keyEvent('ArrowDown'))).toBe(false);
  });
});

describe('pickHandlers', () => {
  it('picks an enabled row on click', () => {
    const pick = vi.fn();

    pickHandlers(items[0]!, pick).onClick();

    expect(pick).toHaveBeenCalledExactlyOnceWith(items[0]);
  });

  it('picks an enabled row on Enter, keeping the key from the page', () => {
    const pick = vi.fn();
    const event = keyEvent('Enter');

    pickHandlers(items[0]!, pick).onKeyDown(event);

    expect(pick).toHaveBeenCalledExactlyOnceWith(items[0]);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('ignores other keys', () => {
    const pick = vi.fn();
    const event = keyEvent('a');

    pickHandlers(items[0]!, pick).onKeyDown(event);

    expect(pick).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('never picks a disabled row', () => {
    const pick = vi.fn();
    const handlers = pickHandlers(items[1]!, pick);

    handlers.onClick();
    handlers.onKeyDown(keyEvent('Enter'));

    expect(pick).not.toHaveBeenCalled();
  });
});
