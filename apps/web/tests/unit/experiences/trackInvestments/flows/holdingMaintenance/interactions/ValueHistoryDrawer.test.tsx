import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  ValueHistoryDrawer, type ValueHistoryDrawerProps,
} from '../../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/ValueHistoryDrawer';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Value History Editor (BDT: Interaction, unit; nothing mocked but the
// caller's handlers — the Drawer, K46 and the translator run for real; K46's
// editing has its own suite, so this checks what the drawer hands it).

/**
 * Renders XPML11's drawer.
 *
 * @param over - Props to change.
 * @returns The props.
 */
const renderDrawer = (over: Partial<ValueHistoryDrawerProps> = {}) => {
  const props: ValueHistoryDrawerProps = {
    open: true,
    ticker: 'XPML11',
    currency: 'BRL',
    entries: [
      { key: 'aug', date: '2026-08-31', value: 11000000 },
      {
        key: 'jul', date: '2026-07-31', value: 11165000, lockedReason: 'From a trade',
      },
    ],
    invested: 11000000,
    readOnly: false,
    onSave: vi.fn().mockResolvedValue('done'),
    onDelete: vi.fn().mockResolvedValue('done'),
    onClose: vi.fn(),
    ...over,
  };
  renderInLocale(<ValueHistoryDrawer {...props} />);
  return props;
};

describe('ValueHistoryDrawer', () => {
  it('titles the drawer with the Holding and shows its values, a trade\'s locked', () => {
    renderDrawer();

    expect(screen.getByRole('dialog', { name: 'XPML11' })).toBeTruthy();
    expect(screen.getByText('Value history')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'XPML11: value history' })).toBeTruthy();
    expect(screen.getByText('invested R$ 110 mil')).toBeTruthy();
    expect(screen.getByText('From a trade')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit value of 08/31/2026' })).toBeTruthy();
  });

  it('writes the values in money, each change in percent (R4 V7)', () => {
    renderDrawer();

    expect(screen.getAllByText(/^R\$\s110\.000,00$/).length).toBeGreaterThan(0);
    expect(screen.getByText('−1.5%')).toBeTruthy();
  });

  it('tells what a save recalculates, from the value\'s month on', () => {
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Edit value of 08/31/2026' }));

    expect(screen.getByText('Net worth for August 2026 onward is recalculated on save.'))
      .toBeTruthy();
  });

  it('closes on Done, and reads only when asked', () => {
    const props = renderDrawer({ readOnly: true, invested: 0 });

    expect(screen.queryByRole('button', { name: 'Edit value of 08/31/2026' })).toBeNull();
    expect(screen.queryByText(/^invested/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(props.onClose).toHaveBeenCalled();
  });
});
