import {
  act, fireEvent, screen, waitFor,
} from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { Dialog } from '../../../../src/kit/dialog/Dialog';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit component (BDT: Interaction tier → unit): only the caller's close
// handler is a stand-in; Floating UI, the translator and the transition
// status run for real in jsdom.

/** The test caller's props: the dialog's content and a spy on its close requests. */
interface HolderProps {
  readonly onClose: () => void;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
}

/**
 * A caller holding the open state, opened by its own button, as the nav menu will.
 *
 * @param props - The close spy, the body and the footer.
 * @returns The opener and the dialog.
 */
function Holder({ onClose, children = <input aria-label="De" />, footer }: HolderProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Exportar</button>
      <Dialog
        open={open}
        title="Exportar log de auditoria"
        subtitle="Família Silva · CSV"
        icon="download"
        footer={footer}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      >
        {children}
      </Dialog>
    </>
  );
}

/**
 * Renders the holder in pt-BR.
 *
 * @param props - Overrides for the body and footer.
 * @returns The close spy.
 */
const renderHolder = (props: Partial<HolderProps> = {}) => {
  const onClose = vi.fn();
  renderInLocale(<Holder onClose={onClose} {...props} />, 'pt-BR');
  return onClose;
};

/** Opens the dialog from its button, focused first as a click would. */
const openDialog = async () => {
  const opener = screen.getByRole('button', { name: 'Exportar' });
  opener.focus();
  await act(async () => {
    fireEvent.click(opener);
  });
};

describe('Dialog', () => {
  it('renders nothing while closed', () => {
    renderInLocale(
      <Dialog open={false} title="Exportar" onClose={vi.fn()}>Corpo</Dialog>,
      'pt-BR',
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a modal dialog named by its title, with subtitle, badge and translated ✕', async () => {
    renderHolder({ footer: <button type="button">Baixar CSV</button> });

    await openDialog();

    const dialog = screen.getByRole('dialog', { name: 'Exportar log de auditoria' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Família Silva · CSV')).toBeDefined();
    expect(dialog.querySelector('.bg-mint\\/15 svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Baixar CSV' })).toBeDefined();
  });

  it('is a 440px centred card from md, a full-screen sheet below it', () => {
    renderInLocale(<Dialog open title="Exportar" onClose={vi.fn()}>Corpo</Dialog>, 'pt-BR');

    const classes = screen.getByRole('dialog').className.split(' ');
    expect(classes).toEqual(expect.arrayContaining([
      'fixed', 'inset-0', 'md:inset-auto', 'md:w-[440px]', 'md:rounded-[24px]', 'md:shadow-dialog',
    ]));
  });

  it('puts its scrim over the whole viewport, the header included', () => {
    renderInLocale(<Dialog open title="Exportar" onClose={vi.fn()}>Corpo</Dialog>, 'pt-BR');

    const scrim = document.querySelector('.bg-scrim') as HTMLElement;
    expect(scrim.className).not.toContain('md:top-16');
  });

  it('grows in: the status goes from initial to open', async () => {
    renderHolder();

    await openDialog();

    await waitFor(() => expect(screen.getByRole('dialog').dataset.status).toBe('open'));
  });

  it('leaves out the subtitle, the badge and the footer when not given', async () => {
    renderInLocale(
      <Dialog open title="Exportar" onClose={vi.fn()}><p>Corpo</p></Dialog>,
      'pt-BR',
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('.text-muted.type-caption')).toBeNull();
    expect(dialog.querySelector('.bg-mint\\/15')).toBeNull();
    expect(dialog.querySelector('.justify-end')).toBeNull();
  });

  it('puts the focus on the body’s first field', async () => {
    renderHolder();

    await openDialog();

    const field = screen.getByRole('textbox', { name: 'De' });
    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  it('puts the focus on the ✕ when the body has nothing to focus', async () => {
    renderHolder({ children: <p>Só texto</p> });

    await openDialog();

    const close = screen.getByRole('button', { name: 'Fechar' });
    await waitFor(() => expect(document.activeElement).toBe(close));
  });

  it('asks to close on the ✕, then goes out and gives focus back', async () => {
    const onClose = renderHolder();
    await openDialog();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    });

    expect(onClose).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Exportar' }));
  });

  it('asks to close on Esc and on a press on the scrim', async () => {
    const onClose = vi.fn();
    renderInLocale(
      <Dialog open title="Exportar" onClose={onClose}><input aria-label="De" /></Dialog>,
      'pt-BR',
    );
    await screen.findByRole('dialog');

    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    });
    await act(async () => {
      fireEvent.mouseDown(document.querySelector('.bg-scrim') as Element);
    });

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('says Close in English', async () => {
    renderInLocale(<Dialog open title="Export" onClose={vi.fn()}>Body</Dialog>, 'en-US');

    expect(await screen.findByRole('button', { name: 'Close' })).toBeDefined();
  });
});
