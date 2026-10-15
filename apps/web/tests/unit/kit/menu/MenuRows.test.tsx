import { describe, expect, it } from 'vitest';
import type { MenuRow } from '../../../../src/kit/menu/entries';
import { menuRowClasses, rowAria, rowTone } from '../../../../src/kit/menu/MenuRows';

// Kit helpers (BDT: Utility → unit, nothing mocked): a menu row's classes,
// colour and ARIA state. The rows themselves render in the Menu tests.

/**
 * Builds a row with the given overrides.
 *
 * @param overrides - Fields replacing the defaults.
 * @returns The row.
 */
const row = (overrides: Partial<MenuRow> = {}): MenuRow => ({
  key: 'edit',
  index: 0,
  role: 'menuitem',
  label: 'Editar',
  checked: false,
  danger: false,
  select: () => {},
  ...overrides,
});

describe('menuRowClasses', () => {
  it('highlights an enabled row', () => {
    expect(menuRowClasses(true, false)).toContain('bg-ink/5');
    expect(menuRowClasses(false, false)).not.toContain('bg-ink/5');
  });

  it('fades a disabled row and never highlights it', () => {
    const classes = menuRowClasses(true, true);

    expect(classes).toContain('opacity-45');
    expect(classes).toContain('cursor-not-allowed');
    expect(classes).not.toContain('bg-ink/5');
  });
});

describe('rowTone', () => {
  it('draws the current choice in mint, a destructive action in coral, else neutral', () => {
    expect(rowTone(row({ checked: true }), 'text-ink')).toBe('text-mint');
    expect(rowTone(row({ danger: true }), 'text-ink')).toBe('text-coral');
    expect(rowTone(row(), 'text-muted')).toBe('text-muted');
  });
});

describe('rowAria', () => {
  it('gives an action its role and nothing else', () => {
    expect(rowAria(row(), 'reason')).toEqual({
      role: 'menuitem',
      'aria-checked': undefined,
      'aria-disabled': undefined,
      'aria-describedby': undefined,
    });
  });

  it('says whether a radio row is checked', () => {
    expect(rowAria(row({ role: 'menuitemradio' }), 'reason')['aria-checked']).toBe(false);
    expect(rowAria(row({ role: 'menuitemradio', checked: true }), 'reason')['aria-checked'])
      .toBe(true);
  });

  it('marks a disabled row and points at its reason', () => {
    const aria = rowAria(row({ disabledReason: 'Somente o dono' }), 'reason');

    expect(aria['aria-disabled']).toBe(true);
    expect(aria['aria-describedby']).toBe('reason');
  });
});
