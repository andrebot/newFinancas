import type { IndexRateSeries, IndexRateValue } from '@financas/api-types';
import {
  fireEvent, screen, waitFor,
} from '@testing-library/react';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { RateCardProps } from '../../../../../../src/experiences/trackInvestments/flows/ratesMaintenance/interactions/RateCard';
import type { RateHistoryDrawerProps } from '../../../../../../src/experiences/trackInvestments/flows/ratesMaintenance/interactions/RateHistoryDrawer';
import type { RateUpdateEntryProps } from '../../../../../../src/experiences/trackInvestments/flows/ratesMaintenance/interactions/RateUpdateEntry';
import {
  RateSlot, type RateRequests, type RateSlotProps,
} from '../../../../../../src/experiences/trackInvestments/flows/ratesMaintenance/RateSlot';
import { AlertProvider } from '../../../../../../src/utilities/AlertProvider';
import { createAlertQueue, type AlertQueue } from '../../../../../../src/utilities/alerts';
import { renderInLocale } from '../../../../../support/renderInLocale';
import { holdingOf, holdingWithout } from '../../../portfolioFixtures';

// One index on Rates Maintenance (BDT: Flow tier, unit). Its Interactions are
// stubbed — they have their own suites — so this checks what it hands each
// one and how it answers the Experience's requests; the translator and the
// toast queue stay real.

/** Every `entries` list the card stand-in was handed, in order. */
const seenEntries: unknown[] = [];

vi.mock('../../../../../../src/experiences/trackInvestments/flows/ratesMaintenance/interactions/RateCard', () => ({
  /**
   * The card's stand-in: what it was handed, its form, and its two buttons.
   *
   * @param props - What the slot passes.
   * @returns The stub.
   */
  RateCard: ({
    name, about, unit, tone, entries, usedBy, mayRecord, historyReadOnly, updateForm, onUpdate,
    onOpenHistory,
  }: RateCardProps) => {
    seenEntries.push(entries);
    return (
      <section
        data-testid="card"
        data-name={name}
        data-about={about}
        data-unit={unit}
        data-tone={tone}
        data-entries={entries.map((entry) => entry.lockedReason ?? entry.key).join(',')}
        data-used-by={
        usedBy?.map((holding) => `${holding.id}:${holding.name}`).join(',') ?? 'unknown'
      }
        data-may-record={String(mayRecord)}
        data-history-read-only={String(historyReadOnly)}
      >
        {updateForm}
        <button type="button" onClick={onUpdate}>update</button>
        <button type="button" onClick={onOpenHistory}>history</button>
      </section>
    );
  },
}));
vi.mock('../../../../../../src/experiences/trackInvestments/flows/ratesMaintenance/interactions/RateUpdateEntry', () => ({
  /**
   * The form's stand-in: its texts, a save of 10.25% on Oct 1st, and a cancel.
   *
   * @param props - What the slot passes.
   * @returns The stub.
   */
  RateUpdateEntry: ({
    name, valueLabel, hint, onSave, onCancel,
  }: RateUpdateEntryProps) => (
    <div data-testid="form" data-name={name} data-label={valueLabel} data-hint={hint}>
      <button
        type="button"
        onClick={() => {
          onSave({ date: '2026-10-01', value: 102500 }).then((outcome) => {
            document.body.dataset.outcome = outcome;
          });
        }}
      >
        save new
      </button>
      <button type="button" onClick={onCancel}>cancel</button>
    </div>
  ),
}));
vi.mock('../../../../../../src/experiences/trackInvestments/flows/ratesMaintenance/interactions/RateHistoryDrawer', () => ({
  /**
   * The drawer's stand-in: what it was handed, an edit, a delete and Done.
   *
   * @param props - What the slot passes.
   * @returns The stub, or nothing while closed.
   */
  RateHistoryDrawer: ({
    open, indexName, valueLabel, hint, readOnly, onSave, onDelete, onClose,
  }: RateHistoryDrawerProps) => (open ? (
    <div
      data-testid="drawer"
      data-name={indexName}
      data-label={valueLabel}
      data-hint={hint}
      data-read-only={String(readOnly)}
    >
      <button
        type="button"
        onClick={() => {
          onSave({ key: 'sep', date: '2026-09-29', value: 105000 });
        }}
      >
        edit value
      </button>
      <button
        type="button"
        onClick={() => {
          onDelete('sep');
        }}
      >
        delete value
      </button>
      <button type="button" onClick={onClose}>done</button>
    </div>
  ) : null),
}));

/**
 * Builds a Selic value.
 *
 * @param id - Its id.
 * @param asOf - Its day.
 * @param createdByUserId - Who recorded it.
 * @returns The value.
 */
const valueOf = (id: string, asOf: string, createdByUserId: string | null): IndexRateValue => ({
  id, index: 'selic', value: 105000, asOf, createdByUserId, createdAt: `${asOf}T12:00:00Z`,
});

const SELIC: IndexRateSeries = {
  index: 'selic',
  unit: 'annual_percent',
  values: [
    valueOf('sep', '2026-09-30', 'ana'),
    valueOf('aug', '2026-08-31', 'ben'),
    valueOf('jul', '2026-07-31', null),
  ],
};
const HOLDINGS = [
  holdingOf('selic29', { ticker: 'Tesouro Selic 2029', rate: { type: 'selic', value: 1000000 } }),
  holdingWithout(holdingOf('cdb', { rate: { type: 'selic', value: 1000000 } }), 'ticker'),
  holdingOf('matured', { rate: { type: 'selic', value: 1000000 }, dueDate: '2001-01-01' }),
  holdingOf('ipca35', { rate: { type: 'ipca', value: 55000 } }),
];

let queue: AlertQueue;

beforeEach(() => {
  queue = createAlertQueue(3);
  seenEntries.length = 0;
  delete document.body.dataset.outcome;
});

const toasts = () => queue.visible().map(({ message }) => message);

/**
 * Renders Selic's slot for Ana, a Member, with every request succeeding.
 *
 * @param over - Props to change.
 * @returns The props.
 */
const renderSlot = (over: Partial<RateSlotProps> = {}) => {
  const ok = () => Promise.resolve({ ok: true as const });
  const requests: RateRequests = {
    onRecord: vi.fn(ok), onEdit: vi.fn(ok), onDelete: vi.fn(ok),
  };
  const props: RateSlotProps = {
    series: SELIC,
    holdings: HOLDINGS,
    recorders: [{ userId: 'ana', firstName: 'Ana' }, { userId: 'ben', firstName: 'Ben' }],
    viewer: { selfUserId: 'ana', role: 'Member' },
    requests,
    form: { open: false, onOpen: vi.fn(), onClose: vi.fn() },
    history: { open: false, onOpen: vi.fn(), onClose: vi.fn() },
    ...over,
  };
  const view = renderInLocale(
    <AlertProvider queue={queue}>
      <RateSlot {...props} />
    </AlertProvider>,
  );
  return {
    ...props,
    /**
     * Renders the slot again with some props changed.
     *
     * @param next - Props to change.
     */
    rerender: (next: Partial<RateSlotProps>) => view.rerenderInLocale(
      <AlertProvider queue={queue}>
        <RateSlot {...props} {...next} />
      </AlertProvider>,
    ),
  };
};

/**
 * Reads the card stand-in's data.
 *
 * @returns Its dataset.
 */
const card = () => screen.getByTestId('card').dataset;

describe('RateSlot', () => {
  it('words the card: name, what it measures, unit and colour', () => {
    renderSlot();

    expect(card()).toMatchObject({
      name: 'Selic', about: "Brazil's policy rate", unit: 'a year', tone: 'sky',
    });
  });

  it('locks what a Member may not change, naming who recorded it', () => {
    renderSlot();

    expect(card().entries).toBe('sep,Added by Ben,Added by a former member');
    expect(card().mayRecord).toBe('true');
    expect(card().historyReadOnly).toBe('false');
  });

  it('says only that a value is locked while the members are unknown', () => {
    renderSlot({ recorders: undefined });

    expect(card().entries).toBe("sep,Can't be changed,Can't be changed");
  });

  it('hands the card a new list only when the values change (OQ-232)', () => {
    const { rerender } = renderSlot();

    rerender({ holdings: [] });
    rerender({ series: { ...SELIC, values: [...SELIC.values] } });

    expect(seenEntries).toHaveLength(3);
    expect(seenEntries[1]).toBe(seenEntries[0]);
    expect(seenEntries[2]).not.toBe(seenEntries[1]);
  });

  it('lists the active Holdings it feeds, an unnamed one too, not a matured one', () => {
    renderSlot();
    expect(card().usedBy).toBe('selic29:Tesouro Selic 2029,cdb:Unnamed holding');
  });

  it('knows nothing it feeds while the Holdings load: no chips, no hint', () => {
    renderSlot({ holdings: undefined, form: { open: true, onOpen: vi.fn(), onClose: vi.fn() } });

    expect(card().usedBy).toBe('unknown');
    expect(screen.getByTestId('form').dataset.hint).toBe('');
  });

  it('lets a Viewer only read; an unknown index takes the default colour', () => {
    renderSlot({
      viewer: { selfUserId: 'ana', role: 'Viewer' },
      series: { ...SELIC, index: 'tr' as never },
    });

    expect(card().mayRecord).toBe('false');
    expect(card().historyReadOnly).toBe('true');
    expect(card().tone).toBe('sky');
  });

  it('opens the form and the drawer through the Flow\'s toggles', () => {
    const { form, history } = renderSlot();

    fireEvent.click(screen.getByRole('button', { name: 'update' }));
    fireEvent.click(screen.getByRole('button', { name: 'history' }));

    expect(form.onOpen).toHaveBeenCalled();
    expect(history.onOpen).toHaveBeenCalled();
    expect(screen.queryByTestId('form')).toBeNull();
  });

  it('records a value from the open form, toasts it and closes the form', async () => {
    const { requests, form } = renderSlot({
      form: { open: true, onOpen: vi.fn(), onClose: vi.fn() },
    });

    expect(screen.getByTestId('form').dataset).toMatchObject({
      name: 'Update Selic',
      label: 'New value (% a year)',
      hint: 'Payouts for 2 holdings are projected from the latest value.',
    });
    fireEvent.click(screen.getByRole('button', { name: 'save new' }));

    await waitFor(() => expect(document.body.dataset.outcome).toBe('done'));
    expect(requests.onRecord).toHaveBeenCalledWith('selic', { value: 102500, asOf: '2026-10-01' });
    expect(toasts()).toEqual(['Rate saved.']);
    expect(form.onClose).toHaveBeenCalled();
  });

  it('keeps the form open and toasts why when the record is refused', async () => {
    const { form } = renderSlot({
      form: { open: true, onOpen: vi.fn(), onClose: vi.fn() },
      requests: {
        onRecord: vi.fn().mockResolvedValue({
          ok: false, error: { code: 'index_rate.duplicate_day' },
        }),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'save new' }));

    await waitFor(() => expect(document.body.dataset.outcome).toBe('refused'));
    expect(toasts()).toEqual(['This index already has a value on that date.']);
    expect(form.onClose).not.toHaveBeenCalled();
  });

  it('edits and deletes from the drawer, and closes it', async () => {
    const { requests, history } = renderSlot({
      history: { open: true, onOpen: vi.fn(), onClose: vi.fn() },
    });

    expect(screen.getByTestId('drawer').dataset).toMatchObject({
      name: 'Selic', label: 'Value (% a year)', readOnly: 'false',
    });
    fireEvent.click(screen.getByRole('button', { name: 'edit value' }));
    fireEvent.click(screen.getByRole('button', { name: 'delete value' }));
    fireEvent.click(screen.getByRole('button', { name: 'done' }));

    await waitFor(() => expect(toasts()).toEqual(['Rate saved.', 'Value deleted.']));
    expect(requests.onEdit)
      .toHaveBeenCalledWith('selic', 'sep', { value: 105000, asOf: '2026-09-29' });
    expect(requests.onDelete).toHaveBeenCalledWith('selic', 'sep');
    expect(history.onClose).toHaveBeenCalled();
  });

  it('words the trailing-12-month unit and an index no Holding tracks', () => {
    renderSlot({
      series: { index: 'igpm', unit: 'trailing_12m_percent', values: [] },
      form: { open: true, onOpen: vi.fn(), onClose: vi.fn() },
    });

    expect(card()).toMatchObject({ name: 'IGP-M', unit: 'over 12 months', tone: 'lilac' });
    expect(screen.getByTestId('form').dataset).toMatchObject({
      label: 'New value (% over 12 months)',
      hint: 'No holding is projected from it yet.',
    });
  });
});
