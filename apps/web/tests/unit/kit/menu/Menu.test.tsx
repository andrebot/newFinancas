import {
  act, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  Menu, type MenuEntry, type MenuProps, type MenuTriggerProps,
} from '../../../../src/kit/menu/Menu';

// Kit component (BDT: Interaction tier → unit): only the caller's handlers
// are stand-ins; Floating UI runs for real in jsdom.

type Role = 'admin' | 'member' | 'viewer';

/**
 * Builds the entries of a member row's menu: the role group, then actions.
 *
 * @param value - The member's current role.
 * @returns The entries and the spies behind them.
 */
const memberEntries = (value: Role | null) => {
  const onChange = vi.fn();
  const onArchive = vi.fn();
  const onRemove = vi.fn();
  const entries: readonly MenuEntry<Role>[] = [
    {
      kind: 'radio',
      label: 'Papel',
      value,
      onChange,
      options: [
        {
          value: 'admin',
          label: 'Admin',
          icon: 'shield-person-outline',
          description: 'Gerencia membros',
        },
        { value: 'member', label: 'Membro', icon: 'edit-note-outline' },
        { value: 'viewer', label: 'Leitor', disabledReason: 'Somente o dono' },
      ],
    },
    { kind: 'separator' },
    {
      kind: 'action',
      id: 'archive',
      label: 'Arquivar',
      icon: 'archive-outline',
      onSelect: onArchive,
    },
    {
      kind: 'action', id: 'remove', label: 'Remover', tone: 'danger', onSelect: onRemove,
    },
  ];
  return {
    entries, onChange, onArchive, onRemove,
  };
};

/**
 * Draws the trigger button the menu opens from.
 *
 * @param props - The ref and ARIA / click props the menu hands its trigger.
 * @returns The button.
 */
const button = (props: MenuTriggerProps) => <button type="button" {...props}>Membro</button>;

/**
 * Renders a member's menu, with a paragraph outside it to click on.
 *
 * @param value - The member's current role.
 * @param overrides - Props replacing the defaults.
 * @returns The spies and the render result.
 */
const renderMenu = (value: Role | null = 'member', overrides: Partial<MenuProps<Role>> = {}) => {
  const spies = memberEntries(value);
  const result = render(
    <>
      <Menu label="Papel de Sam" trigger={button} entries={spies.entries} {...overrides} />
      <p>Fora</p>
    </>,
  );
  return { ...spies, ...result };
};

/**
 * Finds the menu's trigger.
 *
 * @returns The trigger button.
 */
const trigger = () => screen.getByRole('button', { name: 'Membro' });

/**
 * Clicks an element and lets Floating UI settle its position and focus.
 *
 * @param target - What to click.
 */
const click = async (target: Element) => {
  await act(async () => {
    fireEvent.click(target);
  });
};

/**
 * Presses a key on the element that has focus and lets Floating UI settle.
 *
 * @param key - The key to press.
 * @param target - Where the key goes; the focused element by default.
 */
const press = async (key: string, target: Element = document.activeElement!) => {
  await act(async () => {
    fireEvent.keyDown(target, { key });
  });
};

/**
 * Waits for the focus to land on an element; Floating UI moves it a frame
 * after the key press.
 *
 * @param find - Finds the element expected to have focus.
 */
const expectFocusOn = async (find: () => Element) => {
  await waitFor(() => expect(document.activeElement).toBe(find()));
};

describe('Menu', () => {
  it('starts closed, its trigger announcing a menu', () => {
    renderMenu();

    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens a named menu in a portal, controlled by the trigger', async () => {
    const { container } = renderMenu();

    await click(trigger());

    const menu = screen.getByRole('menu', { name: 'Papel de Sam' });
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-controls')).toBe(menu.id);
    expect(container.contains(menu)).toBe(false);
  });

  it('draws the radio group, the separator and the actions', async () => {
    renderMenu();

    await click(trigger());

    expect(screen.getByRole('group', { name: 'Papel' }).children).toHaveLength(3);
    // Only the radio rows are grouped; the actions stand alone.
    expect(screen.getAllByRole('group')).toHaveLength(1);
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
    expect(screen.getByRole('separator')).toBeDefined();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Arquivar', 'Remover',
    ]);
    expect(screen.getByText('Gerencia membros')).toBeDefined();
  });

  it('checks the current choice, in mint with a check', async () => {
    renderMenu();

    await click(trigger());

    const member = screen.getByRole('menuitemradio', { name: 'Membro' });
    expect(member.getAttribute('aria-checked')).toBe('true');
    expect(member.className).toContain('bg-ink/5');
    expect(member.querySelectorAll('svg')).toHaveLength(2);
    expect(screen.getByRole('menuitemradio', { name: /Admin/ }).getAttribute('aria-checked'))
      .toBe('false');
  });

  it('draws a destructive action in coral', async () => {
    renderMenu();

    await click(trigger());

    expect(screen.getByText('Remover').className).toContain('text-coral');
  });

  it('shows why a row is disabled and never picks it', async () => {
    const { onChange } = renderMenu();
    await click(trigger());
    const viewer = screen.getByRole('menuitemradio', { name: /Leitor/ });

    await click(viewer);

    expect(viewer.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(viewer.getAttribute('aria-describedby')!)!.textContent)
      .toBe('Somente o dono');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('picks a radio option on click, closes and returns focus to the trigger', async () => {
    const { onChange } = renderMenu();
    await click(trigger());

    await click(screen.getByRole('menuitemradio', { name: /Admin/ }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('admin');
    expect(screen.queryByRole('menu')).toBeNull();
    await expectFocusOn(trigger);
  });

  it('runs an action on click', async () => {
    const { onArchive, onChange } = renderMenu();
    await click(trigger());

    await click(screen.getByRole('menuitem', { name: 'Arquivar' }));

    expect(onArchive).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('starts the keyboard on the current choice and walks past disabled rows', async () => {
    const { onRemove } = renderMenu();
    trigger().focus();

    await press('ArrowDown');
    await expectFocusOn(() => screen.getByRole('menuitemradio', { name: 'Membro' }));
    // Roving focus: only the active row is in the tab order.
    const rows = [...screen.getAllByRole('menuitemradio'), ...screen.getAllByRole('menuitem')];
    expect(rows.filter((row) => row.tabIndex === 0).map((row) => row.textContent))
      .toEqual([document.activeElement!.textContent]);

    await press('ArrowDown');
    await expectFocusOn(() => screen.getByRole('menuitem', { name: 'Arquivar' }));

    await press('ArrowDown');
    await press('Enter');
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('loops from the last row to the first', async () => {
    renderMenu(null);
    trigger().focus();

    await press('ArrowUp');
    await expectFocusOn(() => screen.getByRole('menuitem', { name: 'Remover' }));

    await press('ArrowDown');
    await expectFocusOn(() => screen.getByRole('menuitemradio', { name: /Admin/ }));
  });

  it('picks with Space', async () => {
    const { onChange } = renderMenu();
    trigger().focus();
    await press('ArrowDown');
    await expectFocusOn(() => screen.getByRole('menuitemradio', { name: 'Membro' }));

    await press(' ');

    expect(onChange).toHaveBeenCalledExactlyOnceWith('member');
  });

  it('jumps forward to the next row starting with the typed letters', async () => {
    renderMenu();
    trigger().focus();
    await press('ArrowDown');
    await expectFocusOn(() => screen.getByRole('menuitemradio', { name: 'Membro' }));

    await press('r');

    await expectFocusOn(() => screen.getByRole('menuitem', { name: 'Remover' }));
  });

  it('closes on Esc and on a click outside, returning focus to the trigger', async () => {
    renderMenu();
    await click(trigger());

    await press('Escape');
    expect(screen.queryByRole('menu')).toBeNull();
    await expectFocusOn(trigger);

    await click(trigger());
    await act(async () => {
      fireEvent.pointerDown(screen.getByText('Fora'));
      fireEvent.mouseDown(screen.getByText('Fora'));
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('takes the width asked for', async () => {
    renderMenu('member', { width: 300 });

    await click(trigger());

    expect(screen.getByRole('menu').style.width).toBe('300px');
  });
});
