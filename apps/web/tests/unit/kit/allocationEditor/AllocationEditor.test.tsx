import {
  act, fireEvent, screen, waitFor, within,
} from '@testing-library/react';
import { useState } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  AllocationEditor, boxIdOf, type AllocationGoal, type AllocationRow,
} from '../../../../src/kit/allocationEditor/AllocationEditor';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit component (BDT: Interaction tier → unit): display and events only; the
// translator, the formatter, the number input and the menu run for real.

const HOUSE: AllocationGoal = { id: 'house', name: 'House Down Payment', progress: 57 };
const FUND: AllocationGoal = { id: 'fund', name: 'Emergency Fund' };
const LAPTOP: AllocationGoal = { id: 'laptop', name: 'New Laptop Fund' };
const CAR: AllocationGoal = { id: 'car', name: 'New Car' };

const SPLIT: readonly AllocationRow[] = [
  {
    goalId: 'house', name: HOUSE.name, percent: 60, progress: 57,
  },
  { goalId: 'fund', name: FUND.name, percent: 25 },
];

/** The holder's props: where the split starts, the Goals and whether errors show. */
interface HolderProps {
  readonly initial: readonly AllocationRow[];
  readonly goals: readonly AllocationGoal[];
  readonly showErrors?: boolean | undefined;
  readonly onChange: (rows: AllocationRow[]) => void;
}

/**
 * Holds the split as a caller would, reporting each change.
 *
 * @param props - The first split, the Goals, whether errors show and the spy.
 * @returns The editor.
 */
function Holder({
  initial, goals, showErrors, onChange,
}: HolderProps) {
  const [rows, setRows] = useState(initial);
  return (
    <AllocationEditor
      rows={rows}
      goals={goals}
      showErrors={showErrors}
      onChange={(next) => {
        onChange(next);
        setRows(next);
      }}
    />
  );
}

/**
 * Renders the editor held in state.
 *
 * @param props - The first split, the Goals and whether errors show.
 * @returns The change spy.
 */
const renderEditor = ({
  initial = SPLIT, goals = [HOUSE, FUND, LAPTOP], showErrors,
}: Partial<Omit<HolderProps, 'onChange'>> = {}) => {
  const onChange = vi.fn();
  renderInLocale(
    <Holder initial={initial} goals={goals} showErrors={showErrors} onChange={onChange} />,
  );
  return onChange;
};

/**
 * Finds a share's percent box by its Goal.
 *
 * @param goal - The Goal's name.
 * @returns The box.
 */
const boxOf = (goal: string) => screen.getByRole<HTMLInputElement>(
  'textbox',
  { name: `Percentage for ${goal}` },
);

/**
 * Finds the total line's text.
 *
 * @returns The live region under the rows.
 */
const totalLine = () => document.querySelector('p[aria-live="polite"]')!;

/**
 * Clicks an element and lets Floating UI settle.
 *
 * @param target - What to click.
 */
const click = async (target: Element) => {
  await act(async () => {
    fireEvent.click(target);
  });
};

describe('boxIdOf', () => {
  it('joins the editor id and the Goal', () => {
    expect(boxIdOf(':r1:', 'house')).toBe(':r1:-house');
  });
});

describe('AllocationEditor', () => {
  it('lists each share with its box, its ring when given and its remove button', () => {
    renderEditor();

    expect(boxOf('House Down Payment').value).toBe('60');
    expect(boxOf('Emergency Fund').value).toBe('25');
    expect(screen.getByRole('progressbar', { name: 'Progress of House Down Payment' })
      .getAttribute('aria-valuenow')).toBe('57');
    expect(screen.queryByRole('progressbar', { name: 'Progress of Emergency Fund' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Emergency Fund' })).toBeTruthy();
  });

  it('draws a reached Goal\'s ring in mint', () => {
    renderEditor({ initial: [{ ...SPLIT[0]!, progress: 100 }] });

    const ring = screen.getByRole('progressbar', { name: 'Progress of House Down Payment' });
    expect(ring.querySelector('.stroke-mint')).not.toBeNull();
  });

  it('sums the split up beside a bar with one segment per Goal', () => {
    renderEditor();

    expect(totalLine().textContent).toBe('85% allocated · 15% free');
    expect(totalLine().className).not.toContain('text-coral');
    const bar = screen.getByRole('progressbar', { name: 'Allocated' });
    expect(bar.getAttribute('aria-valuetext')).toBe('85% allocated · 15% free');
    expect(bar.querySelectorAll('.bg-sky, .bg-sky\\/60')).toHaveLength(2);
  });

  it('hands the whole split on as a share is typed', () => {
    const onChange = renderEditor();

    fireEvent.change(boxOf('Emergency Fund'), { target: { value: '30' } });

    expect(onChange).toHaveBeenLastCalledWith([SPLIT[0], { ...SPLIT[1], percent: 30 }]);
    expect(totalLine().textContent).toBe('90% allocated · 10% free');
  });

  it('lets the total pass 100% while typing, in coral', () => {
    renderEditor();

    fireEvent.change(boxOf('Emergency Fund'), { target: { value: '50' } });

    expect(totalLine().textContent).toBe('110% allocated · 10% over');
    expect(totalLine().className).toContain('text-coral');
  });

  it('removes a share and sends focus to the editor', async () => {
    const onChange = renderEditor();

    await click(screen.getByRole('button', { name: 'Remove House Down Payment' }));

    expect(onChange).toHaveBeenLastCalledWith([SPLIT[1]]);
    expect(screen.queryByRole('textbox', { name: 'Percentage for House Down Payment' })).toBeNull();
    await waitFor(() => expect(document.activeElement?.getAttribute('tabindex')).toBe('-1'));
  });

  it('moves focus again on a second removal in a row', async () => {
    renderEditor();

    await click(screen.getByRole('button', { name: 'Remove House Down Payment' }));
    const editor = await waitFor(() => {
      expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
      return document.activeElement as HTMLElement;
    });
    const remove = screen.getByRole('button', { name: 'Remove Emergency Fund' });
    remove.focus();
    await click(remove);

    await waitFor(() => expect(document.activeElement).toBe(editor));
  });

  it('names the last Goal left on the add button, adding it and focusing its box', async () => {
    const onChange = renderEditor();

    await click(screen.getByRole('button', { name: 'Add goal · New Laptop Fund' }));

    expect(onChange).toHaveBeenLastCalledWith([
      ...SPLIT, {
        goalId: 'laptop', name: 'New Laptop Fund', percent: null, progress: undefined,
      },
    ]);
    await waitFor(() => expect(document.activeElement).toBe(boxOf('New Laptop Fund')));
    expect(screen.queryByRole('button', { name: /Add goal/ })).toBeNull();
  });

  it('opens a menu of the Goals left when more than one is', async () => {
    const onChange = renderEditor({ goals: [HOUSE, FUND, LAPTOP, CAR] });

    await click(screen.getByRole('button', { name: 'Add goal' }));
    const menu = screen.getByRole('menu', { name: 'Goals to add' });
    expect([...menu.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent))
      .toEqual(['New Laptop Fund', 'New Car']);
    await click(screen.getByRole('menuitem', { name: 'New Car' }));

    expect(onChange).toHaveBeenLastCalledWith([
      ...SPLIT, {
        goalId: 'car', name: 'New Car', percent: null, progress: undefined,
      },
    ]);
    await waitFor(() => expect(document.activeElement).toBe(boxOf('New Car')));
  });

  it('starts empty: no rows, the add button and nothing allocated', () => {
    renderEditor({ initial: [], goals: [HOUSE, FUND] });

    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add goal' })).toBeTruthy();
    expect(totalLine().textContent).toBe('0% allocated · 100% free');
  });

  it('shows a completed Goal\'s share fixed, tagged and removable', () => {
    renderEditor({
      initial: [{
        goalId: 'trip', name: 'Trip', percent: 30, completed: true,
      }, {
        goalId: 'gone', name: 'Gone', percent: null, completed: true,
      }],
      goals: [],
      showErrors: true,
    });

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getAllByText('Completed')).toHaveLength(2);
    const [trip, gone] = screen.getAllByRole('listitem');
    expect(within(trip!).getByText('30%')).toBeTruthy();
    expect(within(gone!).getByText('0%')).toBeTruthy();
    expect(screen.queryByText('Enter at least 1%')).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Trip' })).toBeTruthy();
  });

  it('shows an empty or 0% share\'s error only when asked', () => {
    const initial = [...SPLIT, { goalId: 'laptop', name: LAPTOP.name, percent: 0 }];
    const { rerenderInLocale } = renderInLocale(
      <AllocationEditor rows={initial} goals={[]} onChange={vi.fn()} />,
    );
    expect(screen.queryByText('Enter at least 1%')).toBeNull();
    expect(boxOf('New Laptop Fund').hasAttribute('aria-invalid')).toBe(false);

    rerenderInLocale(<AllocationEditor rows={initial} goals={[]} onChange={vi.fn()} showErrors />);

    const error = screen.getByText('Enter at least 1%');
    const box = boxOf('New Laptop Fund');
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(box.getAttribute('aria-describedby')).toBe(error.id);
    expect(box.className).toContain('border-coral');
    expect(boxOf('House Down Payment').hasAttribute('aria-invalid')).toBe(false);
  });

  it('speaks the interface language', () => {
    renderInLocale(
      <AllocationEditor rows={SPLIT} goals={[HOUSE, FUND, LAPTOP]} onChange={vi.fn()} />,
      'pt-BR',
    );

    expect(screen.getByRole('textbox', { name: 'Porcentagem para Emergency Fund' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Adicionar meta · New Laptop Fund' })).toBeTruthy();
    expect(totalLine().textContent).toBe('85% alocado · 15% livre');
  });
});
