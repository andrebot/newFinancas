import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  SignOutOthersButton, SignOutOthersConfirm,
} from '../../../../../../../src/experiences/manageProfile/flows/security/interactions/SignOutOthers';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator; only the Flow's handlers are stand-ins.

describe('SignOutOthersButton', () => {
  it('emits that the user asked', () => {
    const onOpen = vi.fn();
    renderInLocale(<SignOutOthersButton disabled={false} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out all others' }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('waits while a revoke is out', () => {
    renderInLocale(<SignOutOthersButton disabled onOpen={vi.fn()} />);

    expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(true);
  });
});

describe('SignOutOthersConfirm', () => {
  /**
   * Renders the confirm with stand-in handlers, in pt-BR.
   *
   * @param busy - Whether the revoke is out.
   * @returns The handlers.
   */
  const renderConfirm = (busy = false) => {
    const handlers = { onConfirm: vi.fn(), onCancel: vi.fn() };
    renderInLocale(<SignOutOthersConfirm busy={busy} {...handlers} />, 'pt-BR');
    return handlers;
  };

  it('asks, and emits the confirm or the cancel', () => {
    const { onConfirm, onCancel } = renderConfirm();

    expect(screen.getByRole('group', {
      name: 'Encerrar a sessão em todos os outros dispositivos? Cada um terá de entrar de novo.',
    })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar todas as outras' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('spins while the revoke is out', () => {
    renderConfirm(true);

    const confirm = screen.getByRole('button', { name: 'Encerrar todas as outras' });
    expect(confirm.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancelar' }).disabled).toBe(true);
  });
});
