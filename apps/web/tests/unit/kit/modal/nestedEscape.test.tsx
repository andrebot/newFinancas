import { act, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import { Dialog } from '../../../../src/kit/dialog/Dialog';
import { Drawer } from '../../../../src/kit/drawer/Drawer';
import { Menu, type MenuTriggerProps } from '../../../../src/kit/menu/Menu';
import { MultiSelect } from '../../../../src/kit/multiSelect/MultiSelect';
import { Popover, type PopoverTriggerProps } from '../../../../src/kit/popover/Popover';
import { Select } from '../../../../src/kit/select/Select';
import { Tooltip } from '../../../../src/kit/tooltip/Tooltip';
import { tooltip } from '../../../../src/config/constants';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit components together (BDT: Interaction tier → unit, OQ-241): Esc with
// a floating panel open inside a modal closes that panel and never the modal
// with it — a caller honouring the close would throw a form away. Nothing is
// a stand-in but the modal's close handler.

/** One floating panel to put inside the modal: how to draw it, open it and find it. */
interface Panel {
  readonly render: () => ReactNode;
  /** Opens it the way a user does, leaving focus where a user's would be. */
  readonly open: () => Promise<void>;
  /** The open panel, or null once it closed. */
  readonly find: () => HTMLElement | null;
}

/**
 * Focuses an element and clicks it, as a press does.
 *
 * @param element - What to press.
 */
const press = async (element: HTMLElement) => {
  element.focus();
  await act(async () => {
    fireEvent.click(element);
  });
};

/**
 * A trigger button for the menu and the popover.
 *
 * @param props - The props the panel hands its trigger.
 * @returns The button.
 */
const trigger = (props: MenuTriggerProps | PopoverTriggerProps) => (
  <button type="button" {...props}>Abrir</button>
);

const OPTIONS = [{ value: 'a', label: 'Alfa' }];

const PANELS: Record<string, Panel> = {
  select: {
    render: () => <Select label="Tipo" options={OPTIONS} value={null} onChange={vi.fn()} />,
    open: () => press(screen.getByRole('combobox', { name: 'Tipo' })),
    find: () => screen.queryByRole('listbox'),
  },
  'multi-select': {
    render: () => (
      <MultiSelect
        label="Tipos"
        options={OPTIONS}
        value={[]}
        onChange={vi.fn()}
        summary={() => 'Nenhum'}
      />
    ),
    open: () => press(screen.getByRole('button', { name: /Tipos/ })),
    find: () => screen.queryByRole('dialog', { name: 'Tipos' }),
  },
  menu: {
    render: () => (
      <Menu
        label="Ações"
        trigger={trigger}
        entries={[{
          kind: 'action', id: 'archive', label: 'Arquivar', onSelect: vi.fn(),
        }]}
      />
    ),
    open: () => press(screen.getByRole('button', { name: 'Abrir' })),
    find: () => screen.queryByRole('menu'),
  },
  popover: {
    render: () => (
      <Popover label="Ajuda" trigger={trigger}><button type="button">Entendi</button></Popover>
    ),
    open: () => press(screen.getByRole('button', { name: 'Abrir' })),
    find: () => screen.queryByRole('dialog', { name: 'Ajuda' }),
  },
  // Shown by hover while focus stays in another field of the form.
  tooltip: {
    render: () => (
      <>
        <input aria-label="Nome" />
        <Tooltip content="Dica"><button type="button">Info</button></Tooltip>
      </>
    ),
    open: async () => {
      screen.getByRole('textbox', { name: 'Nome' }).focus();
      const info = screen.getByRole('button', { name: /Info/ });
      fireEvent.pointerEnter(info, { pointerType: 'mouse' });
      fireEvent.mouseMove(info);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(tooltip.openDelayMs);
      });
    },
    find: () => screen.queryByRole('tooltip'),
  },
};

const MODALS = {
  drawer: Drawer,
  dialog: Dialog,
};

afterEach(() => {
  vi.useRealTimers();
});

describe.each(Object.entries(MODALS))('Esc inside the %s', (_, ModalKind) => {
  it.each(Object.keys(PANELS))('closes the %s and keeps the modal open', async (kind) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const panel = PANELS[kind]!;
    const onClose = vi.fn();
    renderInLocale(
      <ModalKind open title="Formulário" onClose={onClose}>{panel.render()}</ModalKind>,
      'pt-BR',
    );
    await act(async () => {
      vi.runAllTimers();
    });
    await panel.open();
    expect(panel.find()).not.toBeNull();

    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    });

    expect(panel.find()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Formulário' })).toBeDefined();
  });
});
