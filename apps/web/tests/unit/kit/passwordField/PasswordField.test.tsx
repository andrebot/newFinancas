import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  PasswordField, type PasswordFieldProps,
} from '../../../../src/kit/passwordField/PasswordField';
import { messageIdOf } from '../../../../src/kit/field/Field';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handler is a stand-in; the real text field, eye button and meter render.

/**
 * Finds the password input by its label (a password input has no role).
 *
 * @param label - The field's label.
 * @returns The input.
 */
const inputLabelled = (label: string) => screen.getByLabelText<HTMLInputElement>(label);

/**
 * Finds the eye button.
 *
 * @returns The show / hide button.
 */
const eyeButton = () => (
  screen.getByRole<HTMLButtonElement>('button', { name: 'Mostrar senha' })
);

/**
 * Finds the path drawn by the eye button's icon (the ripple aside).
 *
 * @returns The icon's path data.
 */
const eyeGlyph = () => eyeButton().querySelector('svg path')?.getAttribute('d');

/**
 * Renders the password field labelled "Senha" with an empty value, named
 * eye button and a stand-in change handler, plus any props given.
 *
 * @param props - The props to set or override.
 * @returns The render result.
 */
const renderField = (props: Partial<PasswordFieldProps> = {}) => render(
  <PasswordField
    label="Senha"
    value=""
    onChange={vi.fn()}
    revealLabel="Mostrar senha"
    {...props}
  />,
);

describe('PasswordField', () => {
  it('is a masked input with the value it is given and an unpressed eye button', () => {
    renderField({ value: 'segredo' });

    expect(inputLabelled('Senha').type).toBe('password');
    expect(inputLabelled('Senha').value).toBe('segredo');
    expect(eyeButton().getAttribute('aria-pressed')).toBe('false');
    expect(eyeButton().type).toBe('button');
  });

  it('shows the password on a press and hides it again on the next, keeping one name', () => {
    renderField({ value: 'segredo' });
    const hiddenGlyph = eyeGlyph();

    fireEvent.click(eyeButton());
    expect(inputLabelled('Senha').type).toBe('text');
    expect(eyeButton().getAttribute('aria-pressed')).toBe('true');
    expect(eyeGlyph()).not.toBe(hiddenGlyph);

    fireEvent.click(eyeButton());
    expect(inputLabelled('Senha').type).toBe('password');
    expect(eyeButton().getAttribute('aria-pressed')).toBe('false');
    expect(eyeGlyph()).toBe(hiddenGlyph);
  });

  it('reports the new text and leaves the value to the caller', () => {
    const onChange = vi.fn();
    renderField({ value: 'abc', onChange });

    fireEvent.change(inputLabelled('Senha'), { target: { value: 'abcd' } });

    expect(onChange).toHaveBeenCalledExactlyOnceWith('abcd');
    expect(inputLabelled('Senha').value).toBe('abc');
  });

  it('never spell-checks, capitalises or corrects, and passes native props through', () => {
    const ref = createRef<HTMLInputElement>();
    renderField({ autoComplete: 'new-password', name: 'password', ref });

    const input = inputLabelled('Senha');
    expect(input.getAttribute('spellcheck')).toBe('false');
    expect(input.getAttribute('autocapitalize')).toBe('none');
    expect(input.getAttribute('autocorrect')).toBe('off');
    expect(input.autocomplete).toBe('new-password');
    expect(input.name).toBe('password');
    expect(ref.current).toBe(input);
  });

  it('disables the eye button with the field', () => {
    renderField({ disabled: true });

    expect(inputLabelled('Senha').disabled).toBe(true);
    expect(eyeButton().disabled).toBe(true);
  });

  it('draws no meter without a reading, and is described only by its message', () => {
    renderField({ hint: 'Dica', id: 'pw' });

    expect(inputLabelled('Senha').getAttribute('aria-describedby')).toBe(messageIdOf('pw'));
  });

  it('draws the meter under the box and is described by its caption, then the message', () => {
    renderField({
      error: 'Obrigatório',
      id: 'pw',
      strength: {
        reading: { level: 'fair', segments: 2, hint: 'avoid_dates' },
        caption: 'Razoável · evite datas e anos',
      },
    });

    const caption = screen.getByText('Razoável · evite datas e anos');
    expect(inputLabelled('Senha').getAttribute('aria-describedby'))
      .toBe(`${caption.id} ${messageIdOf('pw')}`);
  });

  it('keeps a caller’s own description ahead of the meter’s', () => {
    renderField({
      'aria-describedby': 'rules',
      strength: {
        reading: { level: 'too_short', segments: 0, hint: 'add_length' },
        caption: 'Muito curta',
      },
    });

    const caption = screen.getByText('Muito curta');
    expect(inputLabelled('Senha').getAttribute('aria-describedby')).toBe(`rules ${caption.id}`);
  });
});
