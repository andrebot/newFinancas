import {
  act, fireEvent, render, screen, waitFor,
} from '@testing-library/react';
import { createRef, useRef } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  CloseButton, focusFirstField, Modal, type ModalSurface,
} from '../../../../src/kit/modal/Modal';

// Kit component (BDT: Interaction tier → unit): the shell the drawer and the
// dialog share. Only the caller's close handler is a stand-in; Floating UI
// and the transition status run for real in jsdom.

const surface: ModalSurface = { scrim: 'test-scrim', panel: 'test-panel', transitionMs: 0 };

/** The test caller's props. */
interface HolderProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/**
 * A caller with a heading and one field, the field taking the opening focus.
 *
 * @param props - The open state and the close spy.
 * @returns The shell around a heading and a field.
 */
function Holder({ open, onClose }: HolderProps) {
  const field = useRef<HTMLInputElement | null>(null);
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="heading"
      initialFocus={field}
      surface={surface}
    >
      <h2 id="heading">Exportar</h2>
      <input ref={field} aria-label="De" />
    </Modal>
  );
}

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(<Holder open={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a modal dialog named by the heading, with the caller’s scrim and panel', async () => {
    render(<Holder open onClose={vi.fn()} />);

    const dialog = await screen.findByRole('dialog', { name: 'Exportar' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.className).toBe('test-panel');
    expect(document.querySelector('.test-scrim')).not.toBeNull();
  });

  it('gives the opening focus to the field it is told', async () => {
    render(<Holder open onClose={vi.fn()} />);

    const field = await screen.findByRole('textbox', { name: 'De' });
    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  it('marks the scrim and panel open once in', async () => {
    render(<Holder open onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('dialog').dataset.status).toBe('open'));
    expect((document.querySelector('.test-scrim') as HTMLElement).dataset.status).toBe('open');
  });

  it('asks to close on Esc and on a press on the scrim', async () => {
    const onClose = vi.fn();
    render(<Holder open onClose={onClose} />);
    await screen.findByRole('dialog');

    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    });
    await act(async () => {
      fireEvent.mouseDown(document.querySelector('.test-scrim') as Element);
    });

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('goes away once the caller closes it', async () => {
    const { rerender } = render(<Holder open onClose={vi.fn()} />);
    await screen.findByRole('dialog');

    rerender(<Holder open={false} onClose={vi.fn()} />);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('CloseButton', () => {
  it('is a labelled button that reports its click and takes the ref', () => {
    const onClick = vi.fn();
    const buttonRef = createRef<HTMLButtonElement>();
    render(<CloseButton label="Fechar" onClick={onClick} buttonRef={buttonRef} />);

    const button = screen.getByRole('button', { name: 'Fechar' });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledOnce();
    expect(buttonRef.current).toBe(button);
  });
});

describe('focusFirstField', () => {
  it('points at the body’s first enabled field', () => {
    const body = document.createElement('div');
    body.innerHTML = '<input disabled aria-label="A"><select aria-label="B"></select>';
    const target = { current: null as HTMLElement | null };

    focusFirstField(target, { current: null })(body);

    expect(target.current).toBe(body.querySelector('select'));
  });

  it('falls back to the ✕ when the body has nothing to focus', () => {
    const body = document.createElement('div');
    const close = document.createElement('button');
    const target = { current: null as HTMLElement | null };

    focusFirstField(target, { current: close })(body);

    expect(target.current).toBe(close);
  });

  it('points nowhere once the body is gone and there is no ✕', () => {
    const target = { current: document.createElement('input') as HTMLElement | null };

    focusFirstField(target, { current: null })(null);

    expect(target.current).toBeNull();
  });
});
