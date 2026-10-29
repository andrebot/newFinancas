import {
  act, fireEvent, screen, waitFor, within,
} from '@testing-library/react';
import { useState } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { messageIdOf } from '../../../../src/kit/field/Field';
import {
  MultiSelect, type MultiSelectProps,
} from '../../../../src/kit/multiSelect/MultiSelect';
import type { SelectEntry } from '../../../../src/kit/select/options';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handler is a stand-in; the real checkboxes, translator and Floating UI run
// in jsdom.

type Holding = 'xpml' | 'knri' | 'hglg' | 'mxrf' | 'vale' | 'itsa' | 'cdb';

const holdings: readonly SelectEntry<Holding>[] = [
  {
    group: 'FIIs',
    options: [
      { value: 'xpml', label: 'XPML11', trailing: <span>R$84,10</span> },
      { value: 'knri', label: 'KNRI11', leading: <span>■</span> },
      { value: 'hglg', label: 'HGLG11' },
      { value: 'mxrf', label: 'MXRF11', description: 'Monthly payer' },
    ],
  },
  {
    group: 'Stocks',
    options: [
      { value: 'vale', label: 'VALE3' },
      { value: 'itsa', label: 'ITSA4' },
    ],
  },
  { value: 'cdb', label: 'CDB Inter', disabledReason: 'Matured' },
];

type Props = MultiSelectProps<Holding>;

/**
 * A caller holding the choice, as the payout chart will.
 *
 * @param props - The multi-select's props, the starting choice as `value`.
 * @returns The multi-select, with a paragraph outside it to click on.
 */
function Holder({ value: initial, onChange, ...rest }: Props) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <MultiSelect
        {...rest}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
      <p>Outside</p>
    </>
  );
}

/**
 * Renders a held multi-select of holdings in en-US.
 *
 * @param overrides - Props over the defaults.
 * @returns The change spy.
 */
const renderHolder = (overrides: Partial<Props> = {}) => {
  const onChange = vi.fn();
  renderInLocale(
    <Holder
      label="Holdings"
      options={holdings}
      value={[]}
      onChange={onChange}
      summary={(chosen, total) => `${chosen} of ${total} holdings`}
      {...overrides}
    />,
  );
  return onChange;
};

/**
 * Finds the trigger by its label.
 *
 * @returns The trigger button.
 */
const trigger = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Holdings' });

/**
 * Clicks the trigger and lets Floating UI settle its position and focus.
 */
const togglePanel = async () => {
  await act(async () => {
    fireEvent.click(trigger());
  });
};

/**
 * Finds the open panel.
 *
 * @returns The dialog.
 */
const panel = () => screen.getByRole('dialog', { name: 'Holdings' });

/**
 * Finds a row's checkbox by its label.
 *
 * @param name - The option's label.
 * @returns The checkbox.
 */
const box = (name: string | RegExp) => screen.getByRole<HTMLInputElement>('checkbox', { name });

describe('MultiSelect', () => {
  it('starts closed, sums up the choice and describes the trigger with it', () => {
    renderHolder({ value: ['vale', 'xpml', 'knri', 'hglg', 'mxrf'] });

    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
    const summary = document.getElementById(trigger().getAttribute('aria-describedby')!)!;
    expect(summary.textContent).toBe('5 of 7 holdings · XPML11, KNRI11, HGLG11 +2');
  });

  it('ignores chosen values no option holds', () => {
    renderHolder({ value: ['vale', 'sold' as Holding] });
    expect(trigger().textContent).toBe('1 of 7 holdings · VALE3');
  });

  it('lists no names while nothing is chosen', () => {
    renderHolder();
    expect(trigger().textContent).toBe('0 of 7 holdings');
  });

  it('shows the placeholder while nothing is chosen', () => {
    renderHolder({ placeholder: 'Pick holdings' });
    expect(trigger().textContent).toBe('Pick holdings');
  });

  it('opens a dialog named by the label, with the groups and their counts', async () => {
    renderHolder({ value: ['xpml'] });
    await togglePanel();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    const fiis = within(panel()).getByRole('group', { name: 'FIIs' });
    expect(within(fiis).getByText('1/4')).toBeDefined();
    expect(within(fiis).getAllByRole('checkbox')).toHaveLength(4);
    expect(box(/XPML11/).checked).toBe(true);
    expect(box(/KNRI11/).checked).toBe(false);
    expect(screen.getByText('R$84,10')).toBeDefined();
    expect(screen.getByText('Monthly payer')).toBeDefined();
    // The group is described by its count; the loose option sits in no group.
    expect(within(panel()).getByRole('group', { name: 'FIIs', description: '1/4' }))
      .toBeDefined();
    expect(within(panel()).getAllByRole('group')).toHaveLength(2);
  });

  it('mutes an unticked row’s label', async () => {
    renderHolder({ value: ['xpml'] });
    await togglePanel();

    expect(screen.getByText('XPML11').className).not.toContain('text-muted');
    expect(screen.getByText('KNRI11').className).toContain('text-muted');
  });

  it('reports every tick at once, in display order, and stays open', async () => {
    const onChange = renderHolder({ value: ['vale'] });
    await togglePanel();

    fireEvent.click(box(/KNRI11/));
    expect(onChange).toHaveBeenLastCalledWith(['knri', 'vale']);
    fireEvent.click(box(/VALE3/));
    expect(onChange).toHaveBeenLastCalledWith(['knri']);
    expect(panel()).toBeDefined();
  });

  it('shows why a disabled option can’t be ticked', async () => {
    renderHolder();
    await togglePanel();

    expect(box(/CDB Inter/).disabled).toBe(true);
    expect(screen.getByText('Matured')).toBeDefined();
  });

  it('applies All, the caller’s presets and Clear', async () => {
    const onChange = renderHolder({
      value: ['xpml'],
      presets: [{ label: 'Stocks', values: ['vale', 'itsa'] }],
    });
    await togglePanel();
    const buttons = within(panel()).getAllByRole('button').map((button) => button.textContent);
    expect(buttons.slice(0, 3)).toEqual(['All', 'Stocks', 'Clear']);

    fireEvent.click(screen.getByRole('button', { name: 'Stocks' }));
    expect(onChange).toHaveBeenLastCalledWith(['vale', 'itsa']);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onChange).toHaveBeenLastCalledWith(['xpml', 'knri', 'hglg', 'mxrf', 'vale', 'itsa']);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('focuses the first preset on open, and Done closes and returns focus', async () => {
    renderHolder();
    await togglePanel();
    await waitFor(() => expect(document.activeElement?.textContent).toBe('All'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  it('closes on Esc and gives focus back to the trigger', async () => {
    renderHolder();
    await togglePanel();
    await waitFor(() => expect(document.activeElement?.textContent).toBe('All'));
    await act(async () => {
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  it('closes on a click outside and gives focus back to the trigger', async () => {
    renderHolder();
    await togglePanel();
    await waitFor(() => expect(document.activeElement?.textContent).toBe('All'));
    await act(async () => {
      fireEvent.pointerDown(screen.getByText('Outside'));
      fireEvent.mouseDown(screen.getByText('Outside'));
    });

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  it('closes when focus leaves it, leaving focus where it went', async () => {
    renderHolder({ hint: 'Shown on the chart' });
    await togglePanel();
    await waitFor(() => expect(document.activeElement?.textContent).toBe('All'));
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);

    // Tab moves focus out of the panel to a control after it.
    await act(async () => {
      fireEvent.focusOut(document.activeElement!, { relatedTarget: elsewhere });
      elsewhere.focus();
    });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });

  it('shows the note beside Done', async () => {
    renderHolder({ note: 'The 5 largest keep their colour.' });
    await togglePanel();
    expect(within(panel()).getByText('The 5 largest keep their colour.')).toBeDefined();
  });

  it('narrows the groups to the search, says when nothing matches, and starts over', async () => {
    renderHolder({ search: { label: 'Search holdings', noResults: 'No holdings found' } });
    await togglePanel();

    const searchBox = screen.getByRole('searchbox', { name: 'Search holdings' });
    await waitFor(() => expect(document.activeElement).toBe(searchBox));
    fireEvent.change(searchBox, { target: { value: 'vale' } });
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    // The heading still counts the whole group.
    expect(within(panel()).getByText('0/2')).toBeDefined();

    fireEvent.change(searchBox, { target: { value: 'tesouro' } });
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.getByText('No holdings found')).toBeDefined();

    await togglePanel();
    await togglePanel();
    expect(screen.getByRole<HTMLInputElement>('searchbox').value).toBe('');
    expect(screen.getAllByRole('checkbox')).toHaveLength(7);
  });

  it('applies presets to the whole list while the search narrows it', async () => {
    const onChange = renderHolder({
      search: { label: 'Search holdings', noResults: 'No holdings found' },
    });
    await togglePanel();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'vale' } });

    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    expect(onChange).toHaveBeenLastCalledWith(['xpml', 'knri', 'hglg', 'mxrf', 'vale', 'itsa']);
  });

  it('ties the hint to the trigger after the summary', () => {
    renderHolder({ id: 'payout', hint: 'Shown on the chart' });
    expect(trigger().getAttribute('aria-describedby'))
      .toBe(`payout-summary ${messageIdOf('payout')}`);
  });

  it('shows the error and turns coral', () => {
    renderHolder({ error: 'Pick at least one' });
    expect(trigger().getAttribute('aria-invalid')).toBe('true');
    expect(trigger().className).toContain('border-coral');
    expect(screen.getByText('Pick at least one')).toBeDefined();
  });

  it('can hide its label, keeping it for screen readers', () => {
    renderHolder({ labelHidden: true, className: 'w-full' });
    expect(screen.getByText('Holdings').className).toContain('sr-only');
    expect(trigger().closest('.w-full')).not.toBeNull();
  });

  it('can be disabled, and then never opens', async () => {
    renderHolder({ disabled: true });
    await togglePanel();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
