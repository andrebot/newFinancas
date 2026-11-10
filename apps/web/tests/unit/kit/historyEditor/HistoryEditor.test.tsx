import {
  act, fireEvent, screen, waitFor, within,
} from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  HistoryEditor, type HistoryEditorProps, type HistoryEntry, type HistoryOutcome,
} from '../../../../src/kit/historyEditor/HistoryEditor';
import {
  changeToneOf, defaultValueLabelOf,
} from '../../../../src/kit/historyEditor/HistoryEditorParts';
import {
  editingKeyOf, openStillListed, outcomeOf, settlingKeyOf,
} from '../../../../src/kit/historyEditor/useHistoryEditing';
import { renderInLocale } from '../../../support/renderInLocale';
import typeInto from '../../../support/typeInto';

// Kit component (BDT: Interaction tier → unit): only the caller's callbacks
// are stand-ins; the translator, the inputs, K38 and K26 run for real.

const ENTRIES: HistoryEntry[] = [
  { key: 'aug', date: '2026-08-31', value: 11000000 },
  { key: 'jul', date: '2026-07-31', value: 11165000 },
  {
    key: 'jun', date: '2026-06-30', value: 10807000, lockedReason: 'From a buy',
  },
];

const RATES: HistoryEntry[] = [
  { key: 'sep', date: '2026-09-30', value: 107500 },
  { key: 'aug', date: '2026-08-31', value: 105000 },
];

/** A promise the test settles by hand, to see the editor while a request runs. */
interface Deferred {
  readonly promise: Promise<HistoryOutcome>;
  readonly settle: (outcome: HistoryOutcome) => void;
}

/**
 * Builds a promise the test settles.
 *
 * @returns The promise and its settler.
 */
const deferred = (): Deferred => {
  let settle: (outcome: HistoryOutcome) => void = () => {};
  const promise = new Promise<HistoryOutcome>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
};

/**
 * Renders the editor over BRL market values.
 *
 * @param props - What to change in the defaults.
 * @param locale - The interface language.
 * @returns The render's result and the callbacks.
 */
const renderEditor = (
  props: Partial<HistoryEditorProps> = {},
  locale: 'en-US' | 'pt-BR' = 'en-US',
) => {
  const onSave = vi.fn<HistoryEditorProps['onSave']>(async () => 'done');
  const onDelete = vi.fn<HistoryEditorProps['onDelete']>(async () => 'done');
  const impactHint = vi.fn((fromDate: string) => `Recalculated from ${fromDate}.`);
  const all = {
    entries: ENTRIES,
    valueKind: { kind: 'money', currency: 'BRL' },
    chartLabel: 'XPML11 value history',
    impactHint,
    onSave,
    onDelete,
    ...props,
  } satisfies HistoryEditorProps;
  const view = renderInLocale(<HistoryEditor {...all} />, locale);
  return {
    ...view, onSave, onDelete, impactHint, props: all,
  };
};

/**
 * Finds a button by its name.
 *
 * @param name - The button's name.
 * @returns The button.
 */
const button = (name: string | RegExp) => screen.getByRole<HTMLButtonElement>('button', { name });

/**
 * Lists the rows' text, newest first.
 *
 * @returns Each row's text.
 */
const rowTexts = () => within(screen.getByRole('list', { name: 'Saved values' }))
  .getAllByRole('listitem')
  .map((row) => row.textContent);

/**
 * Finds a value's row by its date.
 *
 * @param date - The date as the row writes it.
 * @returns The row.
 */
const rowOf = (date: string) => within(screen.getByRole('list', { name: 'Saved values' }))
  .getByText(date)
  .closest('li') as HTMLLIElement;

/**
 * Waits until an element holds focus.
 *
 * @param find - Finds the element.
 */
const expectFocusOn = async (find: () => HTMLElement) => {
  await waitFor(() => expect(document.activeElement).toBe(find()));
};

describe('changeToneOf', () => {
  it('colours a market value\'s rise and fall, never a rate or no change', () => {
    expect(changeToneOf({ unit: 'ratio', amount: 0.1 })).toBe('text-mint');
    expect(changeToneOf({ unit: 'ratio', amount: -0.1 })).toBe('text-coral');
    expect(changeToneOf({ unit: 'ratio', amount: 0 })).toBe('text-muted');
    expect(changeToneOf({ unit: 'points', amount: 2500 })).toBe('text-muted');
    expect(changeToneOf(undefined)).toBe('text-muted');
  });

  it('colours a change by what it shows: one that rounds to 0.0% stays muted', () => {
    expect(changeToneOf({ unit: 'ratio', amount: -0.00001 })).toBe('text-muted');
    expect(changeToneOf({ unit: 'ratio', amount: 0.0004 })).toBe('text-muted');
    expect(changeToneOf({ unit: 'ratio', amount: -0.0005 })).toBe('text-coral');
  });
});

describe('defaultValueLabelOf', () => {
  it('names the field with the currency\'s symbol, or as a percent', () => {
    const translate = (key: string, params?: Record<string, string>) => (
      `${key}${JSON.stringify(params ?? {})}`
    );

    expect(defaultValueLabelOf({ kind: 'money', currency: 'USD' }, translate))
      .toBe('valueMoney{"symbol":"$"}');
    expect(defaultValueLabelOf({ kind: 'rate' }, translate)).toBe('valueRate{}');
  });
});

describe('useHistoryEditing helpers', () => {
  it('reads a failed request as a refusal', async () => {
    await expect(outcomeOf(async () => 'done')).resolves.toBe('done');
    await expect(outcomeOf(() => Promise.reject(new Error('down')))).resolves.toBe('refused');
  });

  it('closes what is open once its value left the list', () => {
    expect(openStillListed(null, ENTRIES)).toBeNull();
    expect(openStillListed({ mode: 'add' }, [])).toEqual({ mode: 'add' });
    expect(openStillListed({ mode: 'edit', key: 'aug' }, ENTRIES))
      .toEqual({ mode: 'edit', key: 'aug' });
    expect(openStillListed({ mode: 'delete', key: 'gone' }, ENTRIES)).toBeNull();
  });

  it('shows a value as loading only while its list is the one it was in', () => {
    expect(settlingKeyOf(null, ENTRIES)).toBeUndefined();
    expect(settlingKeyOf({ key: 'jul', entries: ENTRIES }, ENTRIES)).toBe('jul');
    expect(settlingKeyOf({ key: 'jul', entries: ENTRIES }, [...ENTRIES])).toBeUndefined();
  });

  it('names the value whose form is open', () => {
    expect(editingKeyOf({ mode: 'edit', key: 'aug' })).toBe('aug');
    expect(editingKeyOf({ mode: 'delete', key: 'aug' })).toBeUndefined();
    expect(editingKeyOf(null)).toBeUndefined();
  });
});

describe('HistoryEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 30, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('the list', () => {
    it('lists the values newest first, each with what it changed', () => {
      renderEditor();

      expect(rowTexts()).toEqual([
        '08/31/2026R$\u00a0110.000,00−1.5%Edit value of 08/31/2026Delete value of 08/31/2026',
        '07/31/2026R$\u00a0111.650,00+3.3%Edit value of 07/31/2026Delete value of 07/31/2026',
        '06/30/2026R$\u00a0108.070,00From a buy—No change to show',
      ]);
    });

    it('colours a market value\'s change', () => {
      renderEditor();

      expect(screen.getByText('−1.5%').className).toContain('text-coral');
      expect(screen.getByText('+3.3%').className).toContain('text-mint');
    });

    it('writes a rate\'s change in points, in the interface language', () => {
      renderEditor({ entries: RATES, valueKind: { kind: 'rate' } }, 'pt-BR');

      expect(screen.getByText('+0,25 p.p.').className).toContain('text-muted');
    });

    it('names each value\'s buttons by its date', () => {
      renderEditor();

      expect(button('Edit value of 08/31/2026')).toBeTruthy();
      expect(button('Delete value of 07/31/2026')).toBeTruthy();
    });

    it('locks a value that can\'t be changed: no buttons, its reason shown', () => {
      renderEditor();

      expect(screen.queryByRole('button', { name: 'Edit value of 06/30/2026' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Delete value of 06/30/2026' })).toBeNull();
      expect(screen.getByTitle("Can't be changed")).toBeTruthy();
    });

    it('draws the chart over the values, a locked one not pickable', () => {
      renderEditor({ reference: { value: 11000000, label: 'invested R$110k' } });

      expect(screen.getByRole('group', { name: 'XPML11 value history' })).toBeTruthy();
      expect(screen.getByText('invested R$110k')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /^06\/30\/2026/ })).toBeNull();
      expect(screen.getByRole('button', { name: /^08\/31\/2026/ })).toBeTruthy();
    });

    it('draws no chart with no values, only the button that adds one', () => {
      renderEditor({ entries: [] });

      expect(screen.queryByRole('group', { name: 'XPML11 value history' })).toBeNull();
      expect(button('Add a past value')).toBeTruthy();
    });
  });

  describe('editing a value', () => {
    it('opens the value in a form in its place, focused on its date', async () => {
      renderEditor();
      fireEvent.click(button('Edit value of 07/31/2026'));

      const date = screen.getByRole<HTMLInputElement>('textbox', { name: 'Date' });
      expect(date.value).toBe('07/31/2026');
      expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Value (R$)' }).value)
        .toBe('111.650,00');
      expect(rowTexts()).toHaveLength(3);
      await expectFocusOn(() => date);
    });

    it('marks the value on the chart with its pill', () => {
      renderEditor();
      fireEvent.click(button('Edit value of 07/31/2026'));

      expect(screen.getByRole('button', { name: /^07\/31\/2026/ }).getAttribute('aria-current'))
        .toBe('true');
      expect(screen.getByText('Jul · editing')).toBeTruthy();
    });

    it('opens the value picked on the chart, and goes back there on close', async () => {
      renderEditor();
      const marker = screen.getByRole('button', { name: /^08\/31\/2026/ });
      marker.focus();
      fireEvent.click(marker);

      expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Date' }).value)
        .toBe('08/31/2026');
      fireEvent.click(button('Cancel'));
      await expectFocusOn(() => screen.getByRole('button', { name: /^08\/31\/2026/ }));
    });

    it('says what a save recalculates, from the earlier of the two days', () => {
      const { impactHint } = renderEditor();
      fireEvent.click(button('Edit value of 07/31/2026'));

      expect(screen.getByText('Recalculated from 2026-07-31.')).toBeTruthy();
      typeInto('Date', '06/15/2026');
      expect(screen.getByText('Recalculated from 2026-06-15.')).toBeTruthy();
      expect(impactHint).toHaveBeenCalledWith('2026-06-15');
    });

    it('saves the value with its key, then shows it loading until a refetch', async () => {
      const { onSave, rerenderInLocale, props } = renderEditor();
      fireEvent.click(button('Edit value of 07/31/2026'));
      typeInto('Value (R$)', '112.000,00');
      fireEvent.click(button('Save'));

      expect(onSave.mock.calls).toEqual([[{ key: 'jul', date: '2026-07-31', value: 11200000 }]]);
      await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Date' })).toBeNull());
      expect(rowOf('07/31/2026').getAttribute('aria-busy')).toBe('true');
      expect(button('Edit value of 07/31/2026').disabled).toBe(true);
      expect(button('Edit value of 08/31/2026').disabled).toBe(false);
      await expectFocusOn(() => screen.getByRole('list', { name: 'Saved values' }));

      const refetched = ENTRIES.map((entry) => (
        entry.key === 'jul' ? { ...entry, value: 11200000 } : entry
      ));
      rerenderInLocale(<HistoryEditor {...props} entries={refetched} />);
      expect(rowOf('07/31/2026').getAttribute('aria-busy')).toBe('false');
      expect(rowOf('07/31/2026').textContent).toContain('112.000,00');
    });

    it('names the form by the value it edits', () => {
      renderEditor();
      fireEvent.click(button('Edit value of 07/31/2026'));

      expect(screen.getByRole('form', { name: 'Edit value of 07/31/2026' })).toBeTruthy();
    });

    it('waits on a running save, then keeps the form when it is refused', async () => {
      const request = deferred();
      const { onSave } = renderEditor();
      onSave.mockReturnValueOnce(request.promise);
      fireEvent.click(button('Edit value of 08/31/2026'));
      fireEvent.click(button('Save'));

      expect(button('Cancel').disabled).toBe(true);
      expect(button('Edit value of 07/31/2026').disabled).toBe(true);
      expect(button('Add a past value').disabled).toBe(true);
      fireEvent.click(button('Save'));
      fireEvent.submit(button('Save').closest('form') as HTMLFormElement);
      expect(onSave).toHaveBeenCalledTimes(1);

      const outside = vi.fn();
      document.addEventListener('keydown', outside);
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Date' }), { key: 'Escape' });
      expect(outside).not.toHaveBeenCalled();
      expect(screen.getByRole('textbox', { name: 'Date' })).toBeTruthy();
      document.removeEventListener('keydown', outside);

      await act(async () => request.settle('refused'));
      expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Date' }).value)
        .toBe('08/31/2026');
      expect(button('Cancel').disabled).toBe(false);
    });

    it('keeps a value picked on the chart from opening while a request runs', async () => {
      const request = deferred();
      const { onSave } = renderEditor();
      onSave.mockReturnValueOnce(request.promise);
      fireEvent.click(button('Edit value of 08/31/2026'));
      fireEvent.click(button('Save'));
      fireEvent.click(screen.getByRole('button', { name: /^07\/31\/2026/ }));

      expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Date' }).value)
        .toBe('08/31/2026');
      await act(async () => request.settle('done'));
    });

    it('shows the problems instead of saving, focused on the first', async () => {
      const { onSave } = renderEditor();
      fireEvent.click(button('Edit value of 08/31/2026'));
      typeInto('Value (R$)', '');
      typeInto('Date', '10/01/2026');
      fireEvent.click(button('Save'));

      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByText('Date is later than allowed.')).toBeTruthy();
      expect(screen.getByText('Required.')).toBeTruthy();
      await expectFocusOn(() => screen.getByRole('textbox', { name: 'Date' }));
    });

    it('shows no problem before a save is tried', () => {
      renderEditor();
      fireEvent.click(button('Edit value of 08/31/2026'));
      typeInto('Value (R$)', '');

      expect(screen.queryByText('Required.')).toBeNull();
    });

    it('refuses a rate on a day that already has one', () => {
      const { onSave } = renderEditor({
        entries: RATES, valueKind: { kind: 'rate' }, uniqueDays: true,
      });
      fireEvent.click(button('Edit value of 09/30/2026'));
      typeInto('Date', '08/31/2026');
      fireEvent.click(button('Save'));

      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByText('This day already has a value.')).toBeTruthy();
    });

    it('takes a rate in a rate field, named by the caller when it says so', () => {
      const { onSave } = renderEditor({
        entries: RATES, valueKind: { kind: 'rate' }, valueLabel: 'Value (% a.a.)',
      });
      fireEvent.click(button('Edit value of 09/30/2026'));
      typeInto('Value (% a.a.)', '10.75');
      fireEvent.click(button('Save'));

      expect(onSave.mock.calls).toEqual([[{ key: 'sep', date: '2026-09-30', value: 107500 }]]);
    });

    it('names the rate field as a percent by default', () => {
      renderEditor({ entries: RATES, valueKind: { kind: 'rate' } });
      fireEvent.click(button('Edit value of 09/30/2026'));

      expect(screen.getByRole('textbox', { name: 'Value (%)' })).toBeTruthy();
    });

    it('cancels on Escape without letting it reach the drawer', async () => {
      const outside = vi.fn();
      document.addEventListener('keydown', outside);
      renderEditor();
      fireEvent.click(button('Edit value of 08/31/2026'));
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Date' }), { key: 'Escape' });

      expect(screen.queryByRole('textbox', { name: 'Date' })).toBeNull();
      expect(outside).not.toHaveBeenCalled();
      document.removeEventListener('keydown', outside);
      await expectFocusOn(() => button('Edit value of 08/31/2026'));
    });

    it('closes the form once its value left the list, focus on the list', async () => {
      const { rerenderInLocale, props } = renderEditor();
      fireEvent.click(button('Edit value of 08/31/2026'));
      rerenderInLocale(<HistoryEditor {...props} entries={ENTRIES.slice(1)} />);

      expect(screen.queryByRole('textbox', { name: 'Date' })).toBeNull();
      await expectFocusOn(() => screen.getByRole('list', { name: 'Saved values' }));
    });

    it('keeps what was typed when the open value is picked on the chart again', () => {
      renderEditor();
      fireEvent.click(button('Edit value of 07/31/2026'));
      typeInto('Value (R$)', '1,00');
      fireEvent.click(screen.getByRole('button', { name: /^07\/31\/2026/ }));

      expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Value (R$)' }).value)
        .toBe('1,00');
    });

    it('moves to another value, dropping what was typed', () => {
      renderEditor();
      fireEvent.click(button('Edit value of 08/31/2026'));
      typeInto('Value (R$)', '1,00');
      fireEvent.click(screen.getByRole('button', { name: /^07\/31\/2026/ }));

      expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Value (R$)' }).value)
        .toBe('111.650,00');
    });
  });

  describe('adding a value', () => {
    it('opens an empty form in the button\'s place and saves it without a key', async () => {
      const { onSave } = renderEditor();
      fireEvent.click(button('Add a past value'));

      expect(screen.queryByRole('button', { name: 'Add a past value' })).toBeNull();
      expect(screen.getByRole('form', { name: 'New value' })).toBeTruthy();
      expect(screen.queryByText(/Recalculated/)).toBeNull();
      typeInto('Date', '07/15/2026');
      typeInto('Value (R$)', '109.000,00');
      expect(screen.getByText('Recalculated from 2026-07-15.')).toBeTruthy();
      fireEvent.click(button('Save'));

      expect(onSave.mock.calls)
        .toEqual([[{ key: undefined, date: '2026-07-15', value: 10900000 }]]);
      await expectFocusOn(() => button('Add a past value'));
    });

    it('draws the value about to be saved on the chart once it is complete', () => {
      renderEditor();
      fireEvent.click(button('Add a past value'));
      typeInto('Date', '09/15/2026');

      expect(screen.queryByTestId('line-chart-pending')).toBeNull();
      typeInto('Value (R$)', '109.000,00');
      expect(screen.getByTestId('line-chart-pending')).toBeTruthy();
    });

    it('goes back to the button on Cancel', async () => {
      renderEditor();
      fireEvent.click(button('Add a past value'));
      fireEvent.click(button('Cancel'));

      await expectFocusOn(() => button('Add a past value'));
    });
  });

  describe('deleting a value', () => {
    it('asks first, saying what the delete recalculates', () => {
      renderEditor();
      fireEvent.click(button('Delete value of 07/31/2026'));

      expect(screen.getByRole('group', {
        name: "Delete the value of 07/31/2026? This can't be undone. Recalculated from 2026-07-31.",
      })).toBeTruthy();
    });

    it('deletes on confirm, then dims the value until the list drops it', async () => {
      const { onDelete, rerenderInLocale, props } = renderEditor();
      fireEvent.click(button('Delete value of 07/31/2026'));
      fireEvent.click(button('Delete'));

      expect(onDelete.mock.calls).toEqual([['jul']]);
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull());
      expect(rowOf('07/31/2026').getAttribute('aria-busy')).toBe('true');
      expect(rowOf('07/31/2026').className).toContain('opacity-50');
      expect(button('Delete value of 07/31/2026').disabled).toBe(true);
      await expectFocusOn(() => screen.getByRole('list', { name: 'Saved values' }));

      rerenderInLocale(
        <HistoryEditor {...props} entries={ENTRIES.filter((entry) => entry.key !== 'jul')} />,
      );
      expect(rowTexts().some((text) => text?.startsWith('07/31/2026'))).toBe(false);
    });

    it('keeps the confirm when the delete is refused', async () => {
      const request = deferred();
      const { onDelete } = renderEditor();
      onDelete.mockReturnValueOnce(request.promise);
      fireEvent.click(button('Delete value of 07/31/2026'));
      fireEvent.click(button('Delete'));
      fireEvent.click(button('Delete'));

      expect(onDelete).toHaveBeenCalledTimes(1);
      await act(async () => request.settle('refused'));
      expect(button('Delete')).toBeTruthy();
    });

    it('goes back to the value on Cancel', async () => {
      const { onDelete } = renderEditor();
      fireEvent.click(button('Delete value of 07/31/2026'));
      fireEvent.click(button('Cancel'));

      expect(onDelete).not.toHaveBeenCalled();
      await expectFocusOn(() => button('Delete value of 07/31/2026'));
    });
  });

  describe('read-only', () => {
    it('shows the values and the chart with nothing to change', () => {
      renderEditor({ readOnly: true });

      expect(rowTexts()).toHaveLength(3);
      expect(screen.queryByRole('button', { name: /^Edit value/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Delete value/ })).toBeNull();
      expect(screen.queryByTitle("Can't be changed")).toBeNull();
      expect(screen.queryByRole('button', { name: 'Add a past value' })).toBeNull();
      expect(screen.queryByRole('button', { name: /^08\/31\/2026/ })).toBeNull();
      expect(screen.getByText('From a buy')).toBeTruthy();
    });
  });
});
