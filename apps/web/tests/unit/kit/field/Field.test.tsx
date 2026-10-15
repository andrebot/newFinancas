import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field, fieldAria, messageIdOf } from '../../../../src/kit/field/Field';

// Kit component (BDT: Interaction tier → unit): nothing is mocked; a plain
// input stands in for the control the frame wraps.

/**
 * Renders a frame around a plain input wired to it through `fieldAria`.
 *
 * @param texts - The frame's hint and error.
 * @returns The rendered input.
 */
const renderWithInput = (texts: { hint?: string; error?: string } = {}) => {
  render(
    <Field controlId="email" label="E-mail" {...texts}>
      <input id="email" {...fieldAria('email', texts)} />
    </Field>,
  );
  return screen.getByRole('textbox', { name: 'E-mail' });
};

describe('Field', () => {
  it('labels the control it points at', () => {
    expect(renderWithInput().id).toBe('email');
  });

  it('shows the hint under the control and describes the control by it', () => {
    const input = renderWithInput({ hint: 'Usamos para entrar' });

    expect(screen.getByText('Usamos para entrar').className).toContain('text-muted');
    expect(input.getAttribute('aria-describedby')).toBe(messageIdOf('email'));
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('shows the error in place of the hint and marks the control invalid', () => {
    const input = renderWithInput({ hint: 'Usamos para entrar', error: 'E-mail inválido' });

    expect(screen.queryByText('Usamos para entrar')).toBeNull();
    expect(screen.getByText('E-mail inválido').className).toContain('text-coral');
    expect(input.getAttribute('aria-describedby')).toBe(messageIdOf('email'));
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows no message and describes nothing without a hint or error', () => {
    const input = renderWithInput();

    expect(document.getElementById(messageIdOf('email'))).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  it('keeps a hidden label for screen readers only, without its action', () => {
    render(
      <Field controlId="mfa" label="Código" labelHidden labelAction={<a href="#x">Ajuda</a>}>
        <input id="mfa" />
      </Field>,
    );

    const label = screen.getByText('Código');
    expect(label.className).toBe('sr-only');
    expect(screen.getByRole('textbox', { name: 'Código' }).id).toBe('mfa');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('places the label action beside the label, outside it', () => {
    render(
      <Field controlId="pw" label="Senha" labelAction={<a href="#forgot">Esqueceu a senha?</a>}>
        <input id="pw" />
      </Field>,
    );

    const link = screen.getByRole('link', { name: 'Esqueceu a senha?' });
    expect(link.closest('label')).toBeNull();
    expect(screen.getByLabelText('Senha').id).toBe('pw');
  });

  it('adds the layout classes to the frame', () => {
    const { container } = render(
      <Field controlId="due" label="Vencimento" className="w-48"><input id="due" /></Field>,
    );

    expect((container.firstChild as HTMLElement).className).toBe('flex flex-col gap-1.5 w-48');
  });
});

describe('fieldAria', () => {
  it('describes the control by the message when there is a hint or error', () => {
    expect(fieldAria('x1', { hint: 'Dica' }))
      .toEqual({ 'aria-describedby': 'x1-message', 'aria-invalid': undefined });
    expect(fieldAria('x1', { error: 'Erro' }))
      .toEqual({ 'aria-describedby': 'x1-message', 'aria-invalid': true });
  });

  it('returns nothing to set when there is neither', () => {
    expect(fieldAria('x1', {}))
      .toEqual({ 'aria-describedby': undefined, 'aria-invalid': undefined });
  });
});

describe('messageIdOf', () => {
  it('derives the message id from the control id', () => {
    expect(messageIdOf('tx-date')).toBe('tx-date-message');
  });
});
