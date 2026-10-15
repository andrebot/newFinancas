import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { boxClasses, inputClasses, TextField } from '../../../../src/kit/textField/TextField';
import { messageIdOf } from '../../../../src/kit/field/Field';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handler is a stand-in; the real Field frames the input.

/**
 * Finds the text field's input by its accessible name.
 *
 * @param name - The input's accessible name.
 * @returns The input.
 */
const inputNamed = (name: string) => screen.getByRole<HTMLInputElement>('textbox', { name });

describe('TextField', () => {
  it('is a native text input named by its label, showing the value it is given', () => {
    render(<TextField label="Nome da casa" value="Casa Silva" onChange={vi.fn()} />);

    const input = inputNamed('Nome da casa');
    expect(input.type).toBe('text');
    expect(input.value).toBe('Casa Silva');
  });

  it('reports the new text and leaves the state to the caller', () => {
    const onChange = vi.fn();
    render(<TextField label="Nome" value="Jo" onChange={onChange} />);

    fireEvent.change(inputNamed('Nome'), { target: { value: 'Joana' } });

    expect(onChange).toHaveBeenCalledExactlyOnceWith('Joana');
    expect(inputNamed('Nome').value).toBe('Jo');
  });

  it('passes native props through to the input', () => {
    render(
      <TextField
        label="E-mail"
        value=""
        onChange={vi.fn()}
        type="email"
        name="email"
        autoComplete="email"
        placeholder="voce@exemplo.com"
        required
      />,
    );

    const input = inputNamed('E-mail');
    expect(input.type).toBe('email');
    expect(input.name).toBe('email');
    expect(input.autocomplete).toBe('email');
    expect(input.placeholder).toBe('voce@exemplo.com');
    expect(input.required).toBe(true);
  });

  it('forwards its ref to the input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<TextField label="Nome" value="" onChange={vi.fn()} ref={ref} />);

    expect(ref.current).toBe(inputNamed('Nome'));
  });

  it('uses the id it is given, else makes one', () => {
    const { rerender } = render(
      <TextField label="Nome" value="" onChange={vi.fn()} id="hh-name" />,
    );
    expect(inputNamed('Nome').id).toBe('hh-name');

    rerender(<TextField label="Nome" value="" onChange={vi.fn()} />);
    expect(inputNamed('Nome').id).not.toBe('');
  });

  it('is described by its hint', () => {
    render(
      <TextField label="Ticker" value="" onChange={vi.fn()} hint="Liga a uma posição" id="tk" />,
    );

    expect(inputNamed('Ticker').getAttribute('aria-describedby')).toBe(messageIdOf('tk'));
    expect(screen.getByText('Liga a uma posição')).toBeDefined();
  });

  it('shows the error in place of the hint, turns coral and is invalid', () => {
    render(
      <TextField label="Ticker" value="" onChange={vi.fn()} hint="Dica" error="Obrigatório" />,
    );

    const input = inputNamed('Ticker');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText('Dica')).toBeNull();
    expect(screen.getByText('Obrigatório')).toBeDefined();
    expect(input.parentElement?.className).toBe(boxClasses(true));
  });

  it('draws the slots inside the box, around the input', () => {
    render(
      <TextField
        label="Valor"
        value=""
        onChange={vi.fn()}
        leading="R$"
        trailing={<button type="button">Mostrar</button>}
      />,
    );

    const box = inputNamed('Valor').parentElement as HTMLElement;
    expect(box.className).toBe(boxClasses(false));
    expect(box.firstElementChild?.textContent).toBe('R$');
    expect(box.lastElementChild?.textContent).toBe('Mostrar');
  });

  it('draws no slot wrappers when the slots are empty', () => {
    render(<TextField label="Nome" value="" onChange={vi.fn()} />);

    expect(inputNamed('Nome').parentElement?.children).toHaveLength(1);
  });

  it('puts the layout classes on the field and the text classes on the input', () => {
    const { container } = render(
      <TextField
        label="Código"
        value=""
        onChange={vi.fn()}
        className="w-48"
        inputClassName="font-mono"
      />,
    );

    expect((container.firstChild as HTMLElement).className).toContain('w-48');
    expect(inputNamed('Código').className).toBe(inputClasses('font-mono'));
  });

  it('can be disabled', () => {
    render(<TextField label="Nome" value="" onChange={vi.fn()} disabled />);

    expect(inputNamed('Nome').disabled).toBe(true);
  });
});

describe('boxClasses', () => {
  it('draws a line border with a mint focus halo while valid', () => {
    const classes = boxClasses(false);
    expect(classes).toContain('border-line');
    expect(classes).toContain('focus-within:border-mint');
    expect(classes).not.toContain('coral');
  });

  it('draws a coral border and halo while invalid', () => {
    const classes = boxClasses(true);
    expect(classes).toContain('border-coral');
    expect(classes).toContain('focus-within:ring-coral/15');
    expect(classes).not.toContain('border-line');
  });
});

describe('inputClasses', () => {
  it('appends the caller’s text classes', () => {
    expect(inputClasses('tabular-nums').endsWith(' tabular-nums')).toBe(true);
  });

  it('adds nothing without them', () => {
    expect(inputClasses()).toBe(inputClasses(''));
    expect(inputClasses()).toContain('type-body-lg');
  });
});
