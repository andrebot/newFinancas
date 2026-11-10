import type { IndexRateSeries } from '@financas/api-types';
import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import type { RateSlotProps } from '../../../../../../src/experiences/trackInvestments/flows/ratesMaintenance/RateSlot';
import {
  RatesMaintenanceFlow, type RatesMaintenanceFlowProps,
} from '../../../../../../src/experiences/trackInvestments/flows/ratesMaintenance/RatesMaintenanceFlow';
import { renderInLocale } from '../../../../../support/renderInLocale';

// The Rates Maintenance Flow (BDT: Flow, unit). Each index's slot is stubbed —
// it has its own suite — so the Flow is tested on the read's three states,
// what it hands each slot, and which form and drawer it keeps open. The
// Experience's reads and requests are the props it is handed; the translator
// and the kit stay real.

vi.mock('../../../../../../src/experiences/trackInvestments/flows/ratesMaintenance/RateSlot', () => ({
  /**
   * The slot's stand-in: the index, what is open, and the toggles.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  RateSlot: ({
    series, holdings, form, history,
  }: RateSlotProps) => (
    <section
      data-testid={`slot-${series.index}`}
      data-form={String(form.open)}
      data-history={String(history.open)}
      data-holdings={String(holdings?.length)}
    >
      <button type="button" onClick={form.onOpen}>{`update ${series.index}`}</button>
      <button type="button" onClick={form.onClose}>{`cancel ${series.index}`}</button>
      <button type="button" onClick={history.onOpen}>{`history ${series.index}`}</button>
      <button type="button" onClick={history.onClose}>{`done ${series.index}`}</button>
    </section>
  ),
}));

const SERIES: IndexRateSeries[] = ['selic', 'cdi', 'ipca', 'igpm'].map((index) => ({
  index: index as IndexRateSeries['index'],
  unit: index === 'selic' || index === 'cdi' ? 'annual_percent' : 'trailing_12m_percent',
  values: [],
}));

/**
 * Renders the Flow with the rates read.
 *
 * @param over - Props to change.
 * @returns The props.
 */
const renderFlow = (over: Partial<RatesMaintenanceFlowProps> = {}) => {
  const props: RatesMaintenanceFlowProps = {
    rates: { status: 'ready', data: SERIES },
    holdings: [],
    recorders: [],
    viewer: { selfUserId: 'ana', role: 'Member' },
    requests: { onRecord: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() },
    ...over,
  };
  renderInLocale(<RatesMaintenanceFlow {...props} />);
  return props;
};

/**
 * Reads a slot stand-in's data.
 *
 * @param index - Its index.
 * @returns Its dataset.
 */
const slot = (index: string) => screen.getByTestId(`slot-${index}`).dataset;

describe('RatesMaintenanceFlow', () => {
  it('shows a placeholder while the rates load', () => {
    renderFlow({ rates: { status: 'loading' } });
    expect(screen.getByRole('status', { name: 'Loading the rates' })).toBeTruthy();
  });

  it('shows the failure with Try again', () => {
    const retry = vi.fn();
    renderFlow({ rates: { status: 'failed', retry } });

    expect(screen.getByText("Couldn't load the rates.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });

  it('says what the rates are for, then a card per index in the API\'s order', () => {
    renderFlow();

    expect(screen.getByText('Reference rates for fixed income projections.')).toBeTruthy();
    expect(screen.getAllByTestId(/^slot-/).map((node) => node.dataset.testid))
      .toEqual(['slot-selic', 'slot-cdi', 'slot-ipca', 'slot-igpm']);
    expect(slot('selic').holdings).toBe('0');
  });

  it('keeps one form open on the page at a time, and closes it', () => {
    renderFlow();

    fireEvent.click(screen.getByRole('button', { name: 'update selic' }));
    expect(slot('selic').form).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'update ipca' }));
    expect(slot('selic').form).toBe('false');
    expect(slot('ipca').form).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'cancel ipca' }));
    expect(slot('ipca').form).toBe('false');
  });

  it('opens and closes one index\'s history', () => {
    renderFlow();

    fireEvent.click(screen.getByRole('button', { name: 'history cdi' }));
    expect(slot('cdi').history).toBe('true');
    expect(slot('selic').history).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'done cdi' }));
    expect(slot('cdi').history).toBe('false');
  });
});
