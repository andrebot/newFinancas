import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import { catalogs, SUPPORTED_LOCALES } from '@financas/i18n';
import { CATEGORY_ICONS, type CategoryIcon } from '@financas/reference';
import {
  describe, expect, it, vi,
} from 'vitest';
import { iconPicker } from '../../../../src/config/constants';
import {
  IconGrid,
  IconPicker,
  moreButton,
  PANEL_TILE,
  ROW_TILE,
  rowIcons,
  type IconPickerProps,
} from '../../../../src/kit/iconPicker/IconPicker';

// Kit component (BDT: Interaction tier → unit): only the caller's handlers
// are stand-ins; the popover and Floating UI run for real in jsdom.

const names = catalogs['en-US'].categoryIcons;

/**
 * Names an icon as the en-US catalog does.
 *
 * @param icon - The icon.
 * @returns Its English name.
 */
const iconLabel = (icon: CategoryIcon) => names[icon];

/**
 * Renders the picker with test labels and the given overrides.
 *
 * @param overrides - Props replacing the defaults.
 * @returns The change handler the picker reports to.
 */
const renderPicker = (overrides: Partial<IconPickerProps> = {}) => {
  const onChange = vi.fn();
  render(
    <IconPicker
      label="Icon"
      moreLabel="More icons"
      value="pets"
      onChange={onChange}
      iconLabel={iconLabel}
      {...overrides}
    />,
  );
  return onChange;
};

/**
 * Clicks "More icons" and lets Floating UI settle the panel.
 */
const openPanel = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'More icons' }));
  });
};

describe('the categoryIcons catalog section', () => {
  it.each(SUPPORTED_LOCALES)('names every category icon, in picker order, in %s', (locale) => {
    expect(Object.keys(catalogs[locale].categoryIcons)).toEqual([...CATEGORY_ICONS]);
  });
});

describe('rowIcons', () => {
  it('shows the quick picks as they are when one of them is selected', () => {
    expect(rowIcons('flight')).toEqual(iconPicker.quickIcons);
  });

  it('puts another selected icon first and keeps the row’s length', () => {
    expect(rowIcons('bolt', ['pets', 'flight', 'redeem'])).toEqual(['bolt', 'pets', 'flight']);
  });
});

describe('tile classes', () => {
  it('draws the mockup’s 36px rounded squares', () => {
    expect(ROW_TILE).toContain('grid size-9 cursor-pointer place-items-center rounded-xl');
    expect(PANEL_TILE).toContain('grid size-9 cursor-pointer place-items-center rounded-xl');
  });

  it('marks a row tile selected from its checked radio, with the keyboard ring', () => {
    expect(ROW_TILE).toContain('has-checked:bg-mintdeep has-checked:text-mint');
    expect(ROW_TILE).toContain('has-focus-visible:outline-mint');
  });

  it('marks a panel tile selected from aria-pressed, with the keyboard ring', () => {
    expect(PANEL_TILE).toContain('aria-pressed:bg-mintdeep aria-pressed:text-mint');
    expect(PANEL_TILE).toContain('focus-visible:outline-mint');
  });
});

describe('moreButton', () => {
  it('draws a named button carrying the popover’s props', () => {
    const ref = vi.fn();
    render(moreButton('More icons')({ ref, 'aria-expanded': false }));

    const button = screen.getByRole('button', { name: 'More icons' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(ref).toHaveBeenCalledWith(button);
  });
});

describe('IconGrid', () => {
  it('offers every category icon, the selected one pressed', () => {
    render(<IconGrid value="bolt" onChange={vi.fn()} iconLabel={iconLabel} close={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(CATEGORY_ICONS.length);
    expect(screen.getByRole('button', { name: 'Electricity' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(screen.getByRole('button', { name: 'Home' }).getAttribute('aria-pressed'))
      .toBe('false');
  });

  it('picks the clicked icon, then closes', () => {
    const onChange = vi.fn();
    const close = vi.fn();
    render(<IconGrid value="bolt" onChange={onChange} iconLabel={iconLabel} close={close} />);

    fireEvent.click(screen.getByRole('button', { name: 'Travel' }));

    expect(onChange).toHaveBeenCalledWith('flight');
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('IconPicker', () => {
  it('draws a named radio group of the quick picks, the selected one checked', () => {
    renderPicker({ value: 'flight' });

    const group = screen.getByRole('radiogroup', { name: 'Icon' });
    expect(group).toBeTruthy();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(iconPicker.quickIcons);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Travel' }).checked).toBe(true);
  });

  it('shows a selected icon from beyond the quick picks first', () => {
    renderPicker({ value: 'bolt' });

    expect(screen.getAllByRole('radio')[0]!.getAttribute('aria-label')).toBe('Electricity');
  });

  it('reports a quick pick the user chooses', () => {
    const onChange = renderPicker();

    fireEvent.click(screen.getByRole('radio', { name: 'Gifts' }));

    expect(onChange).toHaveBeenCalledWith('redeem');
  });

  it('opens every icon from "More icons" and closes once one is picked', async () => {
    const onChange = renderPicker();
    await openPanel();

    const panel = screen.getByRole('dialog', { name: 'More icons' });
    expect(panel.style.width).toBe(`${iconPicker.panelWidth}px`);
    fireEvent.click(screen.getByRole('button', { name: 'Electricity' }));

    expect(onChange).toHaveBeenCalledWith('bolt');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
