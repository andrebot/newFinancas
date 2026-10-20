import {
  act, fireEvent, screen, waitFor,
} from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { Drawer, focusFirstField } from '../../../../src/kit/drawer/Drawer';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit component (BDT: Interaction tier → unit): only the caller's close
// handler is a stand-in; Floating UI, the translator and the transition
// status run for real in jsdom.

/** The test caller's props: the drawer's content and a spy on its close requests. */
interface HolderProps {
  readonly onClose: () => void;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
  readonly caption?: string;
}

/**
 * A caller holding the open state, opened by its own button, as a Flow will.
 *
 * @param props - The close spy, the body and the footer.
 * @returns The opener and the drawer.
 */
function Holder({
  onClose, children = <input aria-label="Nome" />, footer, caption = 'Editar conta',
}: HolderProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Editar</button>
      <Drawer
        open={open}
        title="Conta corrente"
        caption={caption}
        footer={footer}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      >
        {children}
      </Drawer>
    </>
  );
}

/**
 * Renders the holder in pt-BR.
 *
 * @param props - Overrides for the body, footer and caption.
 * @returns The close spy.
 */
const renderHolder = (props: Partial<HolderProps> = {}) => {
  const onClose = vi.fn();
  renderInLocale(<Holder onClose={onClose} {...props} />, 'pt-BR');
  return onClose;
};

/**
 * Opens the drawer from its button, focused first as a click would, and lets
 * Floating UI settle the focus.
 */
const openDrawer = async () => {
  const opener = screen.getByRole('button', { name: 'Editar' });
  opener.focus();
  await act(async () => {
    fireEvent.click(opener);
  });
};

describe('Drawer', () => {
  it('renders nothing while closed', () => {
    renderInLocale(
      <Drawer open={false} title="Conta" onClose={vi.fn()}>Corpo</Drawer>,
      'pt-BR',
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a modal dialog named by its title, with the caption and a translated ✕', async () => {
    renderHolder({ footer: <button type="button">Salvar</button> });

    await openDrawer();

    const dialog = screen.getByRole('dialog', { name: 'Conta corrente' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Editar conta')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDefined();
  });

  it('slides in: the status goes from initial to open', async () => {
    renderHolder();

    await openDrawer();

    await waitFor(() => expect(screen.getByRole('dialog').dataset.status).toBe('open'));
  });

  it('leaves out the caption and the footer when not given', async () => {
    renderInLocale(
      <Drawer open title="Conta" onClose={vi.fn()}><p>Corpo</p></Drawer>,
      'pt-BR',
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelectorAll('.border-t')).toHaveLength(0);
    expect(dialog.querySelector('.uppercase')).toBeNull();
  });

  it('puts the focus on the body’s first field', async () => {
    renderHolder();

    await openDrawer();

    const field = screen.getByRole('textbox', { name: 'Nome' });
    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  it('puts the focus on the ✕ when the body has nothing to focus', async () => {
    renderHolder({ children: <p>Só texto</p> });

    await openDrawer();

    const close = screen.getByRole('button', { name: 'Fechar' });
    await waitFor(() => expect(document.activeElement).toBe(close));
  });

  it('asks to close on the ✕, then slides out and gives focus back', async () => {
    const onClose = renderHolder();
    await openDrawer();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    });

    expect(onClose).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Editar' }));
  });

  it('asks to close on Esc', async () => {
    const onClose = renderHolder();
    await openDrawer();

    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('asks to close on a press on the scrim', async () => {
    const onClose = renderHolder();
    await openDrawer();

    const scrim = document.querySelector('.bg-scrim');
    expect(scrim).not.toBeNull();
    await act(async () => {
      fireEvent.mouseDown(scrim as Element);
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps asking the caller, who may stay open (a save out)', async () => {
    const onClose = vi.fn();
    renderInLocale(
      <Drawer open title="Conta" onClose={onClose}><input aria-label="Nome" /></Drawer>,
      'pt-BR',
    );
    await screen.findByRole('dialog');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    });

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog')).toBeDefined();
  });
});

describe('focusFirstField', () => {
  it('points nowhere once the body is gone and there is no ✕', () => {
    const target = { current: document.createElement('input') as HTMLElement | null };

    focusFirstField(target, { current: null })(null);

    expect(target.current).toBeNull();
  });
});
