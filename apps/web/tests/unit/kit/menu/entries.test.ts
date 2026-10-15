import {
  describe, expect, it, vi,
} from 'vitest';
import {
  actionRow, checkedIndexOf, radioRows, rowsOf, toMenuSections,
  type MenuAction, type MenuEntry, type MenuRadioGroup,
} from '../../../../src/kit/menu/entries';

// Kit helper (BDT: Utility → unit, nothing mocked): turning the caller's
// actions, radio groups and separators into the sections and rows drawn.

type Role = 'admin' | 'member' | 'viewer';

const edit: MenuAction = {
  kind: 'action', id: 'edit', label: 'Editar', icon: 'edit-outline', onSelect: vi.fn(),
};

const remove: MenuAction = {
  kind: 'action', id: 'delete', label: 'Excluir', tone: 'danger', onSelect: vi.fn(),
};

/**
 * Builds the role group with the given current role.
 *
 * @param value - The current role.
 * @returns The radio group, with a spy as its change handler.
 */
const roles = (value: Role | null): MenuRadioGroup<Role> => ({
  kind: 'radio',
  label: 'Papel',
  value,
  onChange: vi.fn(),
  options: [
    { value: 'admin', label: 'Admin', description: 'Gerencia membros' },
    { value: 'member', label: 'Membro' },
    { value: 'viewer', label: 'Leitor', disabledReason: 'Somente o dono' },
  ],
});

describe('actionRow', () => {
  it('turns an action into a menuitem row at its position', () => {
    const row = actionRow(edit, 3);

    expect(row).toMatchObject({
      key: 'edit',
      index: 3,
      role: 'menuitem',
      label: 'Editar',
      icon: 'edit-outline',
      checked: false,
      danger: false,
    });
    row.select();
    expect(edit.onSelect).toHaveBeenCalledOnce();
  });

  it('marks a destructive action', () => {
    expect(actionRow(remove, 0).danger).toBe(true);
  });
});

describe('radioRows', () => {
  it('numbers the options from the offset and checks the current one', () => {
    const rows = radioRows(roles('member'), 2);

    expect(rows.map((row) => [row.key, row.index, row.role, row.checked])).toEqual([
      ['admin', 2, 'menuitemradio', false],
      ['member', 3, 'menuitemradio', true],
      ['viewer', 4, 'menuitemradio', false],
    ]);
    expect(rows[0]!.description).toBe('Gerencia membros');
    expect(rows[2]!.disabledReason).toBe('Somente o dono');
  });

  it('hands the picked value to the group', () => {
    const group = roles(null);

    radioRows(group, 0)[0]!.select();

    expect(group.onChange).toHaveBeenCalledExactlyOnceWith('admin');
  });
});

describe('toMenuSections', () => {
  it('runs consecutive actions together, numbering rows across sections', () => {
    const entries: readonly MenuEntry<Role>[] = [edit, { ...edit, id: 'archive' }];

    const sections = toMenuSections(entries);

    expect(sections).toHaveLength(1);
    expect(rowsOf(sections).map((row) => row.index)).toEqual([0, 1]);
  });

  it('keeps a radio group, separators and the actions around them apart', () => {
    const entries: readonly MenuEntry<Role>[] = [
      roles('member'), edit, { kind: 'separator' }, remove,
    ];

    const sections = toMenuSections(entries);

    expect(sections.map((section) => section.kind)).toEqual(['rows', 'rows', 'separator', 'rows']);
    expect(sections[0]).toMatchObject({ radio: true, label: 'Papel' });
    expect(sections[1]).toMatchObject({ radio: false });
    expect(rowsOf(sections).map((row) => [row.key, row.index])).toEqual([
      ['admin', 0], ['member', 1], ['viewer', 2], ['edit', 3], ['delete', 4],
    ]);
  });

  it('never folds an action into an empty radio group before it', () => {
    const entries: readonly MenuEntry<Role>[] = [{ ...roles(null), options: [] }, edit];

    expect(toMenuSections(entries)).toHaveLength(2);
  });

  it('gives nothing for no entries', () => {
    expect(toMenuSections([])).toEqual([]);
  });
});

describe('checkedIndexOf', () => {
  it('finds the current choice', () => {
    expect(checkedIndexOf(rowsOf(toMenuSections<Role>([edit, roles('viewer')])))).toBe(3);
  });

  it('gives null when nothing is checked', () => {
    expect(checkedIndexOf(rowsOf(toMenuSections<Role>([edit, roles(null)])))).toBeNull();
  });
});
