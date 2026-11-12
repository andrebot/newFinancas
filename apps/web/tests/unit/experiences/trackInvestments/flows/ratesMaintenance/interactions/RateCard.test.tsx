import { fireEvent, screen, waitFor } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  RateCard, type RateCardProps,
} from '../../../../../../../src/experiences/trackInvestments/flows/ratesMaintenance/interactions/RateCard';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Rate Card (BDT: Interaction, unit; nothing mocked but the caller's handlers
// — K38, the kit and the translator run for real).

const IPCA: RateCardProps['entries'] = [
  { key: 'sep', date: '2026-09-30', value: 44200 },
  { key: 'aug', date: '2026-08-31', value: 42400 },
  { key: 'feb', date: '2026-02-28', value: 39300 },
];

/**
 * Builds the card's props: IPCA with three values and one Holding.
 *
 * @param over - Props to change.
 * @returns The props.
 */
const propsOf = (over: Partial<RateCardProps> = {}): RateCardProps => ({
  name: 'IPCA',
  about: 'Inflation, last 12 months',
  unit: 'over 12 months',
  tone: 'sun',
  entries: IPCA,
  usedBy: [{ id: 'ipca35', name: 'Tesouro IPCA+ 2035' }],
  mayRecord: true,
  historyReadOnly: false,
  onUpdate: vi.fn(),
  onOpenHistory: vi.fn(),
  ...over,
});

describe('RateCard', () => {
  it('shows the index, its latest value and unit, and the change it made', () => {
    renderInLocale(<RateCard {...propsOf()} />);

    expect(screen.getByRole('heading', { name: 'IPCA' })).toBeTruthy();
    expect(screen.getByText('Inflation, last 12 months')).toBeTruthy();
    expect(screen.getAllByText('4.42%').some((node) => node.classList.contains('type-heading-lg')))
      .toBe(true);
    expect(screen.getByText('over 12 months')).toBeTruthy();
    expect(screen.getByText('as of 09/30/2026 · +0.18 pp vs Aug')).toBeTruthy();
  });

  it('draws only the last six months, in the index\'s colour', () => {
    renderInLocale(<RateCard {...propsOf()} />);

    expect(screen.getByRole('group', { name: 'IPCA: recent values' })).toBeTruthy();
    const table = screen.getByRole('table', { name: 'IPCA: recent values' });
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('reads unchanged, or the day when both values fall in one month', () => {
    const { rerenderInLocale } = renderInLocale(<RateCard {...propsOf({
      entries: [
        { key: 'b', date: '2026-09-30', value: 105000 },
        { key: 'a', date: '2026-08-31', value: 105000 },
      ],
    })}
    />);
    expect(screen.getByText('as of 09/30/2026 · unchanged')).toBeTruthy();

    rerenderInLocale(<RateCard {...propsOf({
      entries: [
        { key: 'b', date: '2026-09-30', value: 102500 },
        { key: 'a', date: '2026-09-18', value: 105000 },
      ],
    })}
    />);
    expect(screen.getByText('as of 09/30/2026 · −0.25 pp vs Sep 18')).toBeTruthy();
  });

  it('gives only the day for a first value, with nothing to compare', () => {
    renderInLocale(<RateCard {...propsOf({
      entries: [{ key: 'sep', date: '2026-09-30', value: 105000 }],
    })}
    />);

    expect(screen.getByText('as of 09/30/2026')).toBeTruthy();
  });

  it('names the year when the value before is from another one', () => {
    renderInLocale(<RateCard {...propsOf({
      entries: [
        { key: 'b', date: '2026-01-31', value: 44200 },
        { key: 'a', date: '2025-12-31', value: 42400 },
      ],
    })}
    />);

    expect(screen.getByText('as of 01/31/2026 · +0.18 pp vs Dec 2025')).toBeTruthy();
  });

  it('leaves the focus alone when another card\'s form took it', async () => {
    const { rerenderInLocale } = renderInLocale(
      <>
        <input aria-label="elsewhere" />
        <RateCard {...propsOf({ updateForm: <p>the form</p> })} />
      </>,
    );
    screen.getByRole('textbox', { name: 'elsewhere' }).focus();

    rerenderInLocale(
      <>
        <input aria-label="elsewhere" />
        <RateCard {...propsOf()} />
      </>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Update' })).toBeTruthy());
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'elsewhere' }));
  });

  it('takes no focus when it appears, or re-renders, with no form ever open (R4 V6)', () => {
    const { rerenderInLocale } = renderInLocale(<RateCard {...propsOf()} />);
    expect(document.activeElement).toBe(document.body);

    rerenderInLocale(<RateCard {...propsOf({ entries: IPCA.slice(1) })} />);
    expect(document.activeElement).toBe(document.body);
  });

  it('says so for an index with no value yet, and draws nothing', () => {
    renderInLocale(<RateCard {...propsOf({ entries: [], usedBy: [] })} />);

    expect(screen.getByText('No value yet')).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.getByText('Not used by any holding yet')).toBeTruthy();
  });

  it('lists every Holding it feeds, and nothing while they load', () => {
    const { rerenderInLocale } = renderInLocale(<RateCard {...propsOf({
      usedBy: [{ id: 'a', name: 'Tesouro Selic 2029' }, { id: 'b', name: 'Tesouro Selic 2029' }],
    })}
    />);
    expect(screen.getAllByText('Tesouro Selic 2029')).toHaveLength(2);
    expect(screen.getByText('Used by')).toBeTruthy();

    rerenderInLocale(<RateCard {...propsOf({ usedBy: undefined })} />);
    expect(screen.queryByText('Used by')).toBeNull();
  });

  it('asks for the form and the drawer', () => {
    const props = propsOf();
    renderInLocale(<RateCard {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    fireEvent.click(screen.getByRole('button', { name: 'History' }));

    expect(props.onUpdate).toHaveBeenCalled();
    expect(props.onOpenHistory).toHaveBeenCalled();
  });

  it('offers a Viewer no Update, and History that only reads', () => {
    renderInLocale(<RateCard {...propsOf({ mayRecord: false, historyReadOnly: true })} />);

    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    expect(screen.getByRole('button', { name: 'View history' })).toBeTruthy();
  });

  it('shows the open form in the buttons\' place, and gives focus back to Update', async () => {
    const { rerenderInLocale } = renderInLocale(
      <RateCard {...propsOf({ updateForm: <p>the form</p> })} />,
    );
    expect(screen.getByText('the form')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();

    rerenderInLocale(<RateCard {...propsOf()} />);
    await waitFor(() => expect(document.activeElement)
      .toBe(screen.getByRole('button', { name: 'Update' })));
  });
});
