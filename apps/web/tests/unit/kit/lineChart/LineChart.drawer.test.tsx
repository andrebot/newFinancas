import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { Drawer } from '../../../../src/kit/drawer/Drawer';
import { LineChart, type LinePoint } from '../../../../src/kit/lineChart/LineChart';
import { renderInLocale } from '../../../support/renderInLocale';

// The chart where K46 puts it: inside the real Drawer, with real focus (BDT:
// both kit Interactions run for real). The seam is what matters: the drawer
// listens for Escape on the document and moves focus to its first focusable
// element, which is the plot.

const POINTS: readonly LinePoint[] = [
  {
    key: 'jun', date: '2026-06-30', value: 300, valueLabel: 'R$300', dateLabel: '30/06',
  },
  {
    key: 'aug', date: '2026-08-31', value: 200, valueLabel: 'R$200', dateLabel: '31/08',
  },
];

/**
 * Draws the chart in an open drawer, holding the pick as K46 will.
 *
 * @param props - The drawer's close callback.
 * @returns The drawer.
 */
function ChartInDrawer({ onClose }: { readonly onClose: () => void }) {
  const [selectedKey, setSelectedKey] = useState<string>();
  return (
    <Drawer open title="Value history" onClose={onClose}>
      <LineChart
        points={POINTS}
        ariaLabel="History"
        selectedKey={selectedKey}
        selectedLabel="editing"
        onSelect={setSelectedKey}
      />
    </Drawer>
  );
}

/**
 * Opens the drawer and lets its opening focus settle.
 *
 * @returns The close callback and the plot.
 */
const openDrawer = async () => {
  const onClose = vi.fn();
  renderInLocale(<ChartInDrawer onClose={onClose} />);
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  });
  return { onClose, plot: screen.getByRole('group', { name: 'History' }) };
};

/**
 * Takes the chip, if one shows.
 *
 * @returns The chip, or null.
 */
const chip = () => screen.queryByTestId('line-chart-readout');

/**
 * Presses a key where focus really is, so a test depends on it being there.
 *
 * @param key - The key.
 */
const press = (key: string) => {
  fireEvent.keyDown(document.activeElement as Element, { key });
};

describe('LineChart in a Drawer', () => {
  it('opens with focus on the plot and no chip', async () => {
    const { plot } = await openDrawer();
    expect(document.activeElement).toBe(plot);
    expect(chip()).toBeNull();
  });

  it('ends a readout on Escape and leaves the drawer open', async () => {
    const { onClose } = await openDrawer();
    press('End');
    expect(chip()).not.toBeNull();
    press('Escape');
    expect(chip()).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lets a second Escape close the drawer', async () => {
    const { onClose } = await openDrawer();
    press('End');
    press('Escape');
    expect(onClose).not.toHaveBeenCalled();
    press('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the editing pill right after a keyboard pick, focus staying on the plot', async () => {
    const { plot } = await openDrawer();
    press('Home');
    press('Enter');
    expect(document.activeElement).toBe(plot);
    expect(screen.queryByText('editing')).not.toBeNull();
    expect(chip()).toBeNull();
  });

  it('shows the editing pill right after a tap', async () => {
    const { plot } = await openDrawer();
    plot.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect;
    fireEvent.pointerDown(plot, { clientX: 0, pointerType: 'touch' });
    fireEvent.click(plot, { clientX: 0 });
    expect(screen.queryByText('editing')).not.toBeNull();
    expect(chip()).toBeNull();
  });
});
