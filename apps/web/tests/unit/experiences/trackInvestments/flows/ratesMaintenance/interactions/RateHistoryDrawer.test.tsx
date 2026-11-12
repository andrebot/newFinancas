import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  RateHistoryDrawer, type RateHistoryDrawerProps,
} from '../../../../../../../src/experiences/trackInvestments/flows/ratesMaintenance/interactions/RateHistoryDrawer';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import typeInto from '../../../../../../support/typeInto';

// Rate History Editor (BDT: Interaction, unit; nothing mocked but the
// caller's handlers — the Drawer, K46 and the translator run for real; K46's
// editing has its own suite, so this checks what the drawer hands it).

/**
 * Renders Selic's drawer: one value of the viewer's, one locked.
 *
 * @param over - Props to change.
 * @returns The props.
 */
const renderDrawer = (over: Partial<RateHistoryDrawerProps> = {}) => {
  const props: RateHistoryDrawerProps = {
    open: true,
    indexName: 'Selic',
    valueLabel: 'Value (% a year)',
    tone: 'sky',
    entries: [
      { key: 'sep', date: '2026-09-30', value: 105000 },
      {
        key: 'aug', date: '2026-08-31', value: 107500, lockedReason: 'Added by Ben',
      },
    ],
    hint: 'Payouts for 1 holding are projected from the latest value.',
    readOnly: false,
    onSave: vi.fn().mockResolvedValue('done'),
    onDelete: vi.fn().mockResolvedValue('done'),
    onClose: vi.fn(),
    ...over,
  };
  renderInLocale(<RateHistoryDrawer {...props} />);
  return props;
};

describe('RateHistoryDrawer', () => {
  it('titles the drawer with the index and lists its values, another\'s locked', () => {
    renderDrawer();

    expect(screen.getByRole('dialog', { name: 'Selic' })).toBeTruthy();
    expect(screen.getByText('Rate history')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Selic: rate history' })).toBeTruthy();
    expect(screen.getByText('Added by Ben')).toBeTruthy();
    expect(screen.getByText(/latest value; older values are kept/)).toBeTruthy();
  });

  it('edits with the unit\'s label and the hint, refusing a day already taken', async () => {
    const { onSave } = renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Edit value of 09/30/2026' }));

    expect(screen.getByRole('textbox', { name: 'Value (% a year)' })).toBeTruthy();
    expect(screen.getByText('Payouts for 1 holding are projected from the latest value.'))
      .toBeTruthy();

    typeInto('Date', '08/31/2026');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();

    typeInto('Date', '09/29/2026');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(onSave).toHaveBeenCalledWith({ key: 'sep', date: '2026-09-29', value: 105000 });
  });

  it('writes each change in points (R4 V7)', () => {
    renderDrawer();

    expect(screen.getByText('−0.25 pp')).toBeTruthy();
  });

  it('only reads for a Viewer, and closes on Done', () => {
    const { onClose } = renderDrawer({ readOnly: true });

    expect(screen.queryByRole('button', { name: 'Add a past value' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalled();
  });
});
