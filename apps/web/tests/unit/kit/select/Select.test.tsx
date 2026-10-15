import {
  act, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { messageIdOf } from '../../../../src/kit/field/Field';
import {
  Select, triggerClasses, type SelectEntry, type SelectProps,
} from '../../../../src/kit/select/Select';

// Kit component (BDT: Interaction tier → unit): only the caller's handler is
// a stand-in; Floating UI runs for real in jsdom.

type Account = 'itau' | 'main' | 'emergency' | 'nubank';

const accounts: readonly SelectEntry<Account>[] = [
  { value: 'itau', label: 'Itaú Conta', trailing: <span>BRL</span> },
  {
    group: 'USD',
    options: [
      { value: 'main', label: 'Main Checking', leading: <span>●</span> },
      { value: 'emergency', label: 'Emergency Fund', disabledReason: 'Arquivada' },
    ],
  },
  { value: 'nubank', label: 'Nubank', description: 'Conta e cartão' },
];

/**
 * Renders a select of accounts with the given overrides.
 *
 * @param overrides - Props replacing the defaults.
 * @returns The change handler and the render result.
 */
const renderSelect = (overrides: Partial<SelectProps<Account>> = {}) => {
  const onChange = vi.fn();
  const result = render(
    <>
      <Select
        label="Conta"
        options={accounts}
        value={null}
        onChange={onChange}
        placeholder="Escolha uma conta"
        {...overrides}
      />
      <p>Fora</p>
    </>,
  );
  return { onChange, ...result };
};

/**
 * Finds the select's trigger by its label.
 *
 * @returns The trigger button.
 */
const trigger = () => screen.getByRole<HTMLButtonElement>('combobox', { name: 'Conta' });

/**
 * Clicks the trigger and lets Floating UI settle its position and focus.
 */
const openList = async () => {
  await act(async () => {
    fireEvent.click(trigger());
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

describe('Select', () => {
  it('starts closed, a combobox labelled by the field, showing the placeholder', () => {
    renderSelect();

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger().textContent).toBe('Escolha uma conta');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('shows the chosen option’s icon and label', () => {
    renderSelect({ value: 'main' });

    expect(trigger().textContent).toBe('●Main Checking');
  });

  it('opens a listbox named by the label, controlled by the trigger, in a portal', async () => {
    const { container } = renderSelect();

    await openList();

    const listbox = screen.getByRole('listbox', { name: 'Conta' });
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-controls')).toBe(listbox.id);
    expect(container.contains(listbox)).toBe(false);
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('draws groups under their heading, and the slots and description', async () => {
    renderSelect();

    await openList();

    const group = screen.getByRole('group', { name: 'USD' });
    expect(group.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(screen.getByRole('option', { name: /Itaú Conta/ }).textContent).toBe('Itaú ContaBRL');
    expect(screen.getByText('Conta e cartão')).toBeDefined();
  });

  it('marks the chosen option selected, in mint with a check', async () => {
    renderSelect({ value: 'nubank' });

    await openList();

    const option = screen.getByRole('option', { name: /Nubank/ });
    expect(option.getAttribute('aria-selected')).toBe('true');
    expect(option.querySelector('svg')).not.toBeNull();
    expect(option.querySelector('.text-mint')?.textContent).toBe('Nubank');
    const other = screen.getByRole('option', { name: /Itaú/ });
    expect(other.getAttribute('aria-selected')).toBe('false');
  });

  it('reports the clicked option and closes', async () => {
    const { onChange } = renderSelect();
    await openList();

    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: /Main Checking/ }));
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith('main');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('shows why a disabled option can’t be picked, and ignores a click on it', async () => {
    const { onChange } = renderSelect();
    await openList();

    const option = screen.getByRole('option', { name: /Emergency Fund/ });
    expect(option.getAttribute('aria-disabled')).toBe('true');
    const reason = document.getElementById(option.getAttribute('aria-describedby')!);
    expect(reason?.textContent).toBe('Arquivada');

    await act(async () => {
      fireEvent.click(option);
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('walks the options with the arrows, skipping disabled ones, and picks on Enter', async () => {
    const { onChange } = renderSelect({ value: 'main' });
    await openList();

    // From the chosen Main Checking, past the disabled Emergency Fund.
    await press('ArrowDown', screen.getByRole('listbox').parentElement!);
    await press('Enter');

    expect(onChange).toHaveBeenCalledExactlyOnceWith('nubank');
  });

  it('jumps to an option by typing its first letters while open', async () => {
    const { onChange } = renderSelect();
    await openList();

    await press('n', screen.getByRole('listbox').parentElement!);
    await press('Enter');

    expect(onChange).toHaveBeenCalledExactlyOnceWith('nubank');
  });

  it('picks by typing while closed, as a native select does', async () => {
    const { onChange } = renderSelect();

    await press('m', trigger());

    expect(onChange).toHaveBeenCalledExactlyOnceWith('main');
  });

  it('closes on Esc and gives focus back to the trigger', async () => {
    renderSelect();
    await openList();

    await press('Escape');

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on a click outside', async () => {
    renderSelect();
    await openList();

    await act(async () => {
      fireEvent.pointerDown(screen.getByText('Fora'));
      fireEvent.mouseDown(screen.getByText('Fora'));
    });

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('narrows the list as the search is typed, and starts over on reopening', async () => {
    renderSelect({
      search: { label: 'Buscar conta', placeholder: 'Buscar', noResults: 'Nada encontrado' },
    });
    await openList();

    const searchBox = screen.getByRole('searchbox', { name: 'Buscar conta' });
    // Floating UI moves focus on the next frame.
    await waitFor(() => expect(document.activeElement).toBe(searchBox));
    fireEvent.change(searchBox, { target: { value: 'itau' } });

    expect(screen.getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Itaú ContaBRL']);

    await openList();
    await openList();
    expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('');
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('says so when the search matches nothing', async () => {
    renderSelect({ search: { label: 'Buscar conta', noResults: 'Nada encontrado' } });
    await openList();

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'viagem' } });

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('Nada encontrado')).toBeDefined();
  });

  it('ties the hint to the trigger', () => {
    renderSelect({ id: 'conta', hint: 'A moeda segue a conta' });

    expect(trigger().getAttribute('aria-describedby')).toBe(messageIdOf('conta'));
    expect(trigger().className).toBe(triggerClasses(false));
  });

  it('shows the error, turns coral and is invalid', () => {
    renderSelect({ hint: 'Dica', error: 'Escolha uma conta' });

    expect(trigger().getAttribute('aria-invalid')).toBe('true');
    expect(trigger().className).toBe(triggerClasses(true));
    expect(screen.queryByText('Dica')).toBeNull();
  });

  it('puts the layout classes on the field', () => {
    const { container } = renderSelect({ className: 'w-48' });

    expect((container.firstChild as HTMLElement).className).toContain('w-48');
  });

  it('can be disabled, and then never opens', async () => {
    renderSelect({ disabled: true });

    await openList();

    expect(trigger().disabled).toBe(true);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('triggerClasses', () => {
  it('draws a line border with a mint halo while focused or open', () => {
    const classes = triggerClasses(false);
    expect(classes).toContain('border-line');
    expect(classes).toContain('focus:border-mint');
    expect(classes).toContain('aria-expanded:border-mint');
    expect(classes).not.toContain('coral');
  });

  it('draws a coral border and halo while invalid', () => {
    const classes = triggerClasses(true);
    expect(classes).toContain('border-coral');
    expect(classes).toContain('ring-coral/15');
    expect(classes).not.toContain('border-line');
  });
});
