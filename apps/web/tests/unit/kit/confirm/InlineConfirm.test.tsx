import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  CONFIRM_RINGS, InlineConfirm, type InlineConfirmProps,
} from '../../../../src/kit/confirm/InlineConfirm';

// Kit component (BDT: Interaction tier → unit): nothing mocked; the real Icon
// and Button draw the glyph and the two buttons.

/**
 * Renders a confirm with test defaults, the given props on top.
 *
 * @param props - The props to override.
 * @returns The handlers the confirm was given and a way to remove it.
 */
const renderConfirm = (props: Partial<InlineConfirmProps> = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const { unmount } = render(
    <InlineConfirm
      tone="destructive"
      message={(
        <>
          Arquivar
          {' '}
          <b>Moradia</b>
          ?
        </>
      )}
      confirmLabel="Arquivar"
      cancelLabel="Cancelar"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel, unmount };
};

describe('InlineConfirm', () => {
  it('is a group named by its question, tinted coral when it cannot be undone', () => {
    renderConfirm();

    const group = screen.getByRole('group', { name: 'Arquivar Moradia?' });
    expect(group.className).toContain('bg-coral/10');
    expect(group.querySelector('svg')!.getAttribute('class')).toContain('text-coral');
    expect(screen.getByRole('button', { name: 'Arquivar' }).className).toContain('bg-coral');
  });

  it('is tinted mint, with a mint confirm, when it can be undone', () => {
    renderConfirm({ tone: 'reversible', confirmLabel: 'Concluir' });

    expect(screen.getByRole('group').className).toContain('border-mint/30');
    expect(screen.getByRole('button', { name: 'Concluir' }).className).toContain('bg-mint');
  });

  it('shows the glyph it is given instead of the tone\'s', () => {
    const { unmount } = renderConfirm();
    const toneGlyph = screen.getByRole('group').querySelector('svg')!.innerHTML;
    unmount();

    renderConfirm({ icon: 'close' });
    expect(screen.getByRole('group').querySelector('svg')!.innerHTML).not.toBe(toneGlyph);
  });

  it('runs the confirm', () => {
    const { onConfirm, onCancel } = renderConfirm();

    fireEvent.click(screen.getByRole('button', { name: 'Arquivar' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('starts with focus on Cancel and gives it back on cancel', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    const { onCancel } = renderConfirm();

    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    expect(document.activeElement).toBe(cancel);
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('cancels on Escape without letting it reach the page', () => {
    const onPageKey = vi.fn();
    document.addEventListener('keydown', onPageKey);
    const { onCancel } = renderConfirm();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancelar' }), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onPageKey).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onPageKey);
  });

  it('ignores other keys', () => {
    const { onCancel } = renderConfirm();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancelar' }), { key: 'Enter' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('while busy, spins on confirm and can\'t be cancelled', () => {
    const { onConfirm, onCancel } = renderConfirm({ busy: true });

    const confirm = screen.getByRole('button', { name: 'Arquivar' });
    expect(confirm.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
    const cancel = screen.getByRole<HTMLButtonElement>('button', { name: 'Cancelar' });
    expect(cancel.disabled).toBe(true);
    fireEvent.keyDown(confirm, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('gives the host a ring in the tone\'s colour', () => {
    expect(CONFIRM_RINGS.destructive).toBe('ring-1 ring-coral/40');
    expect(CONFIRM_RINGS.reversible).toBe('ring-1 ring-mint/40');
  });
});
