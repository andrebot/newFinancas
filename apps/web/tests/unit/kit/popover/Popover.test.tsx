import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { Popover, renderContent, type PopoverProps } from '../../../../src/kit/popover/Popover';

// Kit component (BDT: Interaction tier → unit): only the caller's handlers
// are stand-ins; Floating UI runs for real in jsdom.

/**
 * Renders a popover with a plain button trigger and the given overrides.
 *
 * @param overrides - Props replacing the defaults.
 * @returns The render result.
 */
const renderPopover = (overrides: Partial<PopoverProps> = {}) => render(
  <>
    <Popover
      label="Notificações"
      trigger={(props) => <button type="button" {...props}>Sino</button>}
      {...overrides}
    >
      {overrides.children ?? <button type="button">Aceitar</button>}
    </Popover>
    <p>Fora</p>
  </>,
);

/**
 * Clicks the trigger and lets Floating UI settle its position and focus.
 */
const openPanel = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Sino' }));
  });
};

describe('Popover', () => {
  it('starts closed, with the trigger announcing a dialog', () => {
    renderPopover();

    const trigger = screen.getByRole('button', { name: 'Sino' });
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a dialog named by its label when the trigger is clicked', async () => {
    renderPopover();

    await openPanel();

    const dialog = screen.getByRole('dialog', { name: 'Notificações' });
    expect(dialog.className).toContain('shadow-overlay');
    const trigger = screen.getByRole('button', { name: 'Sino' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(dialog.id);
  });

  it('renders the panel outside the trigger’s container, in a portal', async () => {
    const { container } = renderPopover();

    await openPanel();

    expect(container.contains(screen.getByRole('dialog'))).toBe(false);
  });

  it('closes when the trigger is clicked again', async () => {
    renderPopover();
    await openPanel();

    await openPanel();

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Esc and gives focus back to the trigger', async () => {
    renderPopover();
    await openPanel();

    await act(async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sino' }));
  });

  it('closes on a click outside', async () => {
    renderPopover();
    await openPanel();

    await act(async () => {
      fireEvent.pointerDown(screen.getByText('Fora'));
      fireEvent.mouseDown(screen.getByText('Fora'));
      fireEvent.click(screen.getByText('Fora'));
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reports each open and close to the caller', async () => {
    const onOpenChange = vi.fn();
    renderPopover({ onOpenChange });

    await openPanel();
    await openPanel();

    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('hands close to a content function', async () => {
    const onOpenChange = vi.fn();
    renderPopover({
      onOpenChange,
      children: (close) => <button type="button" onClick={close}>Ver investimento</button>,
    });
    await openPanel();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Ver investimento' }));
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('applies the width it is given', async () => {
    renderPopover({ width: 400 });

    await openPanel();

    expect(screen.getByRole('dialog').style.width).toBe('400px');
  });
});

describe('renderContent', () => {
  it('returns plain content as is', () => {
    expect(renderContent('Vazio', vi.fn())).toBe('Vazio');
  });

  it('calls a content function with close', () => {
    const close = vi.fn();
    const build = vi.fn(() => 'Conteúdo');

    expect(renderContent(build, close)).toBe('Conteúdo');
    expect(build).toHaveBeenCalledExactlyOnceWith(close);
  });
});
