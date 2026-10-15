import type { KeyboardEvent } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  indexOfValue, isPickKey, pickHandlers, typeaheadLabelsOf,
} from '../../../../src/kit/select/useSelectList';
import type { SelectOption } from '../../../../src/kit/select/options';

// Kit helpers (BDT: Utility → unit): the pure pieces of the select's
// behaviour. The hook itself runs for real in the Select tests.

const options: readonly SelectOption<'brl' | 'usd'>[] = [
  { value: 'brl', label: 'Itaú Conta' },
  { value: 'usd', label: 'Main Checking', disabledReason: 'Sem saldo' },
];

/**
 * Builds a key event stand-in carrying a key and a spy for `preventDefault`.
 *
 * @param key - The key pressed.
 * @returns The event.
 */
const keyEvent = (key: string) => ({ key, preventDefault: vi.fn() }) as unknown as KeyboardEvent;

describe('indexOfValue', () => {
  it('finds the position of a drawn value', () => {
    expect(indexOfValue(options, 'usd')).toBe(1);
  });

  it('gives null for a value not drawn or no value', () => {
    expect(indexOfValue(options.slice(0, 1), 'usd')).toBeNull();
    expect(indexOfValue(options, null)).toBeNull();
  });
});

describe('typeaheadLabelsOf', () => {
  it('gives each enabled option its label and a disabled one none', () => {
    expect(typeaheadLabelsOf(options)).toEqual(['Itaú Conta', null]);
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
  it('picks an enabled option on click', () => {
    const pick = vi.fn();

    pickHandlers(options[0]!, pick).onClick();

    expect(pick).toHaveBeenCalledExactlyOnceWith(options[0]);
  });

  it('picks an enabled option on Enter, keeping the key from the page', () => {
    const pick = vi.fn();
    const event = keyEvent('Enter');

    pickHandlers(options[0]!, pick).onKeyDown(event);

    expect(pick).toHaveBeenCalledExactlyOnceWith(options[0]);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('ignores other keys', () => {
    const pick = vi.fn();
    const event = keyEvent('a');

    pickHandlers(options[0]!, pick).onKeyDown(event);

    expect(pick).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('never picks a disabled option', () => {
    const pick = vi.fn();
    const handlers = pickHandlers(options[1]!, pick);

    handlers.onClick();
    handlers.onKeyDown(keyEvent('Enter'));

    expect(pick).not.toHaveBeenCalled();
  });
});
