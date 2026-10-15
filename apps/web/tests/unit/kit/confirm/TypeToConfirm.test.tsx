import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  matchesPhrase, TypeToConfirm, type TypeToConfirmProps,
} from '../../../../src/kit/confirm/TypeToConfirm';

// Kit component (BDT: Interaction tier → unit): nothing mocked; the real
// TextField, Button and Icon draw the field, the buttons and the glyph.

/**
 * Renders a type-to-confirm with test defaults, the given props on top.
 *
 * @param props - The props to override.
 * @returns The handlers the confirm was given.
 */
const renderConfirm = (props: Partial<TypeToConfirmProps> = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const onChange = vi.fn();
  render(
    <TypeToConfirm
      message="Excluir a família Casa Silva?"
      phrase="Casa Silva"
      value=""
      onChange={onChange}
      label='Digite "Casa Silva" para confirmar'
      confirmLabel="Excluir família"
      cancelLabel="Cancelar"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel, onChange };
};

/**
 * Finds the confirm button.
 *
 * @returns The confirm button.
 */
const confirmButton = () => screen.getByRole<HTMLButtonElement>(
  'button',
  { name: 'Excluir família' },
);

describe('matchesPhrase', () => {
  it('matches the phrase, ignoring spaces around it', () => {
    expect(matchesPhrase('Casa Silva', 'Casa Silva')).toBe(true);
    expect(matchesPhrase('  Casa Silva ', 'Casa Silva ')).toBe(true);
  });

  it('is case-sensitive and needs the whole phrase', () => {
    expect(matchesPhrase('casa silva', 'Casa Silva')).toBe(false);
    expect(matchesPhrase('Casa', 'Casa Silva')).toBe(false);
  });

  it('never matches an empty phrase', () => {
    expect(matchesPhrase('', '')).toBe(false);
    expect(matchesPhrase(' ', '  ')).toBe(false);
  });
});

describe('TypeToConfirm', () => {
  it('is a coral form named by its warning, with a labelled field', () => {
    renderConfirm();

    const form = screen.getByRole('form', { name: 'Excluir a família Casa Silva?' });
    expect(form.className).toContain('bg-coral/10');
    expect(screen.getByLabelText('Digite "Casa Silva" para confirmar')).toBeTruthy();
    expect(confirmButton().className).toContain('bg-coral');
  });

  it('passes the typed text up and holds none itself', () => {
    const { onChange } = renderConfirm();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Casa' } });
    expect(onChange).toHaveBeenCalledWith('Casa');
    expect(screen.getByRole<HTMLInputElement>('textbox').value).toBe('');
  });

  it('keeps the confirm locked until the phrase matches', () => {
    const { onConfirm } = renderConfirm({ value: 'casa silva' });

    expect(confirmButton().disabled).toBe(true);
    fireEvent.submit(screen.getByRole('form'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('runs the confirm from the button once the phrase matches', () => {
    const { onConfirm, onCancel } = renderConfirm({ value: 'Casa Silva' });

    expect(confirmButton().disabled).toBe(false);
    fireEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('runs the confirm on Enter in the field once the phrase matches', () => {
    const { onConfirm } = renderConfirm({ value: 'Casa Silva ' });

    fireEvent.submit(screen.getByRole('textbox'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('starts with focus on the field and gives it back on cancel', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const { onCancel } = renderConfirm();

    expect(document.activeElement).toBe(screen.getByRole('textbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('cancels on Escape in the field without letting it reach the page', () => {
    const onPageKey = vi.fn();
    document.addEventListener('keydown', onPageKey);
    const { onCancel } = renderConfirm();

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onPageKey).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onPageKey);
  });

  it('while busy, spins on confirm, ignores submits and can\'t be cancelled or edited', () => {
    const { onConfirm, onCancel } = renderConfirm({ value: 'Casa Silva', busy: true });

    expect(confirmButton().getAttribute('aria-busy')).toBe('true');
    fireEvent.submit(screen.getByRole('form'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLInputElement>('textbox').disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancelar' }).disabled).toBe(true);
    fireEvent.keyDown(confirmButton(), { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
