import { describe, expect, it } from 'vitest';
import { indexOfValue } from '../../../../src/kit/select/useSelectList';
import type { SelectOption } from '../../../../src/kit/select/options';

// Kit helpers (BDT: Utility → unit): the pure pieces of the select's
// behaviour (the list rules it shares with the menu are tested in
// floatingList). The hook itself runs for real in the Select tests.

const options: readonly SelectOption<'brl' | 'usd'>[] = [
  { value: 'brl', label: 'Itaú Conta' },
  { value: 'usd', label: 'Main Checking', disabledReason: 'Sem saldo' },
];

describe('indexOfValue', () => {
  it('finds the position of a drawn value', () => {
    expect(indexOfValue(options, 'usd')).toBe(1);
  });

  it('gives null for a value not drawn or no value', () => {
    expect(indexOfValue(options.slice(0, 1), 'usd')).toBeNull();
    expect(indexOfValue(options, null)).toBeNull();
  });
});
