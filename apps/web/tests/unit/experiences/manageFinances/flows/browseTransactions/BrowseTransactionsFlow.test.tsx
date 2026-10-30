import { act, fireEvent, screen } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  BrowseTransactionsFlow, DayTotals, type BrowseTransactionsFlowProps,
} from '../../../../../../src/experiences/manageFinances/flows/browseTransactions/BrowseTransactionsFlow';
import type { FilterPanelProps } from '../../../../../../src/experiences/manageFinances/flows/browseTransactions/interactions/FilterPanel';
import type { LedgerRowProps } from '../../../../../../src/experiences/manageFinances/flows/browseTransactions/interactions/LedgerRow';
import {
  holdingFilters, NO_FILTERS, type LedgerFilters,
} from '../../../../../../src/experiences/manageFinances/flows/browseTransactions/ledgerFilters';
import { AlertProvider } from '../../../../../../src/utilities/AlertProvider';
import { createAlertQueue, type AlertQueue } from '../../../../../../src/utilities/alerts';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';
import { renderInLocale } from '../../../../../support/renderInLocale';
import {
  ACCOUNTS, CATEGORIES, accountRowOf, cardRowOf, omit, pageOf,
} from './fixtures';

// The Browse Transactions Flow (BDT: Flow, unit). Its Interactions are
// stubbed — they have their own suites — so the Flow is tested against its
// state, its delete and its filters; the Experience's pages, filters and
// requests are the props it is handed. The kit's grouped list, the toast queue
// and the translator stay real.

vi.mock('../../../../../../src/experiences/manageFinances/flows/browseTransactions/interactions/LedgerRow', () => ({
  /**
   * The row's stand-in: its key facts, and a button per event.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  LedgerRow: ({
    item, access, expanded, confirming, deleting, failure, onExpandedChange, onEdit, onDelete,
    onConfirmDelete, onCancelDelete,
  }: LedgerRowProps) => (
    <div
      data-testid={`row ${item.id}`}
      data-access={access}
      data-expanded={String(expanded)}
      data-confirming={String(confirming)}
      data-deleting={String(deleting)}
      data-failure={failure ?? ''}
    >
      <button type="button" onClick={() => onExpandedChange(!expanded)}>
        {`toggle ${item.id}`}
      </button>
      <button type="button" onClick={onEdit}>{`edit ${item.id}`}</button>
      <button type="button" onClick={onDelete}>{`delete ${item.id}`}</button>
      <button type="button" onClick={onConfirmDelete}>{`confirm ${item.id}`}</button>
      <button type="button" onClick={onCancelDelete}>{`cancel ${item.id}`}</button>
    </div>
  ),
}));
vi.mock('../../../../../../src/experiences/manageFinances/flows/browseTransactions/interactions/FilterPanel', () => ({
  /**
   * The drawer's stand-in: its draft, and a button per event.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  FilterPanel: ({
    open, draft, showRangeErrors, onDraftChange, onApply, onClearAll, onClose,
  }: FilterPanelProps) => (
    <div
      data-testid="filters"
      data-open={String(open)}
      data-draft={JSON.stringify(draft)}
      data-errors={String(showRangeErrors)}
    >
      <button type="button" onClick={() => onDraftChange({ ...draft, kinds: ['charge'] })}>
        tick charge
      </button>
      <button
        type="button"
        onClick={() => onDraftChange({
          ...draft, range: { preset: 'custom', from: '2026-02-01', to: '2026-01-01' },
        })}
      >
        reverse range
      </button>
      <button type="button" onClick={onApply}>show</button>
      <button type="button" onClick={onClearAll}>clear all</button>
      <button type="button" onClick={onClose}>close</button>
    </div>
  ),
}));

/**
 * Builds an observer that never fires: the grouped list's paging has its own suite.
 *
 * @returns The stand-in.
 */
function QuietObserver() {
  return { observe: vi.fn(), disconnect: vi.fn() };
}

// Passed as a spread: a literal `role` attribute reads as an ARIA role to the linter.
const OWNER = { selfUserId: 'me', role: 'Owner' };

let queue: AlertQueue;

beforeEach(() => {
  queue = createAlertQueue(3);
  vi.stubGlobal('IntersectionObserver', QuietObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The toasts on screen. */
const toasts = () => queue.visible().map(({ message }) => message);

const ROWS = [cardRowOf({ id: 'c1' }), accountRowOf({ id: 't1', accountId: 'old' })];

const PAGE = pageOf(ROWS, {
  dayTotals: [
    { date: '2026-09-12', currency: 'USD', net: -4_599 },
    { date: '2026-09-12', currency: 'BRL', net: -3_990 },
    { date: '2026-09-14', currency: 'BRL', net: -8_690 },
  ],
  monthCounts: [{ month: '2026-09', count: 7 }],
});

/**
 * Renders the Flow with its handlers spied.
 *
 * @param over - The props over the defaults.
 * @returns The handlers and a rerender with other props.
 */
const renderFlow = (over: Partial<BrowseTransactionsFlowProps> = {}) => {
  const handlers = {
    onFiltersChange: vi.fn<(filters: LedgerFilters) => void>(),
    onFilterClose: vi.fn(),
    onReachedEnd: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(async (): Promise<RequestOutcome> => ({ ok: true })),
  };
  /**
   * Builds the Flow.
   *
   * @param props - The props over the defaults.
   * @returns The element.
   */
  const flow = (props: Partial<BrowseTransactionsFlowProps>) => (
    <AlertProvider queue={queue}>
      <BrowseTransactionsFlow
        ledger={{ pages: [PAGE], hasMore: false, status: 'idle' }}
        filters={NO_FILTERS}
        filterOpen={false}
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        {...OWNER}
        {...handlers}
        {...props}
      />
    </AlertProvider>
  );
  const view = renderInLocale(flow(over));
  return {
    ...handlers,
    rerender: (props: Partial<BrowseTransactionsFlowProps>) => view.rerenderInLocale(flow(props)),
  };
};

/** A row stub's data attribute. */
const rowData = (id: string, name: string) => (
  screen.getByTestId(`row ${id}`).getAttribute(`data-${name}`)
);

/** The filter stub's draft. */
const draft = () => JSON.parse(screen.getByTestId('filters').getAttribute('data-draft') ?? '{}');

describe('the ledger', () => {
  it('lists the rows under their month, with its count, and their days', () => {
    renderFlow();

    expect(screen.getByRole('heading', { level: 2 }).textContent)
      .toBe('All transactions newest first');
    expect(screen.getByRole('heading', { name: /September 2026/ }).parentElement?.textContent)
      .toContain('7 transactions');
    expect(screen.getByTestId('row c1')).toBeDefined();
    expect(rowData('c1', 'access')).toBe('manage');
    expect(rowData('t1', 'access')).toBe('archived');
  });

  it('names an unknown month count 0 and a day with no totals plainly', () => {
    renderFlow({
      ledger: {
        pages: [pageOf([omit(accountRowOf(), 'date')])], hasMore: false, status: 'idle',
      },
    });

    expect(screen.getByText('0 transactions')).toBeDefined();
  });

  it('shows the empty ledger, or the empty filtered one', () => {
    const { rerender } = renderFlow({ ledger: { pages: [], hasMore: false, status: 'idle' } });
    expect(screen.getByText('No transactions yet')).toBeDefined();

    rerender({
      ledger: { pages: [], hasMore: false, status: 'idle' }, filters: holdingFilters('h'),
    });
    expect(screen.getByText('Nothing matches these filters')).toBeDefined();
  });

  it('asks for the next page again after one failed', () => {
    const { onReachedEnd } = renderFlow({
      ledger: { pages: [PAGE], hasMore: true, status: 'error' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onReachedEnd).toHaveBeenCalled();
  });
});

describe('DayTotals', () => {
  it("writes each currency's net, R$ first, a dot between", () => {
    renderInLocale(
      <DayTotals totals={[{ currency: 'BRL', net: -3_990 }, { currency: 'USD', net: 320_000 }]} />,
    );

    expect(document.body.textContent).toMatch(/−R\$\s39,90·\+\$3,200\.00/);
  });
});

describe('the header', () => {
  it('turns into the filtered heading with Clear filters', () => {
    const { onFiltersChange } = renderFlow({ filters: { ...NO_FILTERS, kinds: ['charge'] } });

    expect(screen.getByRole('heading', { level: 2 }).textContent)
      .toContain('Filtered transactions');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onFiltersChange).toHaveBeenCalledWith(NO_FILTERS);
  });

  it('shows the Holding filter as a chip that removes it', () => {
    const filters = { ...holdingFilters('bbas3'), kinds: ['investment_buy'] };
    const { onFiltersChange } = renderFlow({ filters, holdingName: 'BBAS3' });

    const chip = screen.getByRole('button', { name: 'Stop filtering by BBAS3' });
    expect(chip.textContent).toBe('Holding · BBAS3');
    fireEvent.click(chip);
    expect(onFiltersChange).toHaveBeenCalledWith({ ...filters, holdingId: undefined });
  });

  it('names a Holding chip it has no name for plainly', () => {
    renderFlow({ filters: holdingFilters('bbas3') });

    expect(screen.getByRole('button', { name: 'Stop filtering by' })).toBeDefined();
  });
});

describe('rows', () => {
  it('keeps one row open', () => {
    renderFlow();

    fireEvent.click(screen.getByText('toggle c1'));
    expect(rowData('c1', 'expanded')).toBe('true');
    fireEvent.click(screen.getByText('toggle t1'));
    expect(rowData('c1', 'expanded')).toBe('false');
    expect(rowData('t1', 'expanded')).toBe('true');
    fireEvent.click(screen.getByText('toggle t1'));
    expect(rowData('t1', 'expanded')).toBe('false');
  });

  it('asks the Experience to edit a row', () => {
    const { onEdit } = renderFlow();

    fireEvent.click(screen.getByText('edit c1'));
    expect(onEdit).toHaveBeenCalledWith(ROWS[0]);
  });
});

describe('the delete', () => {
  it('asks, sends, toasts and closes the row', async () => {
    let answer: (outcome: RequestOutcome) => void = () => {};
    const onDelete = vi.fn(() => new Promise<RequestOutcome>((resolve) => {
      answer = resolve;
    }));
    renderFlow({ onDelete });
    fireEvent.click(screen.getByText('toggle c1'));
    fireEvent.click(screen.getByText('delete c1'));
    expect(rowData('c1', 'confirming')).toBe('true');
    expect(rowData('t1', 'confirming')).toBe('false');

    fireEvent.click(screen.getByText('confirm c1'));
    expect(onDelete).toHaveBeenCalledWith(ROWS[0]);
    expect(rowData('c1', 'deleting')).toBe('true');
    await act(async () => answer({ ok: true }));

    expect(toasts()).toEqual(['Transaction deleted.']);
    expect(rowData('c1', 'expanded')).toBe('false');
    expect(rowData('c1', 'deleting')).toBe('false');
  });

  it('keeps a failure in the confirm, then cancels', async () => {
    renderFlow({
      onDelete: vi.fn(async (): Promise<RequestOutcome> => ({
        ok: false, error: { code: 'transaction.holding_in_use', params: { count: 2 } },
      })),
    });
    fireEvent.click(screen.getByText('toggle c1'));
    fireEvent.click(screen.getByText('delete c1'));
    await act(async () => fireEvent.click(screen.getByText('confirm c1')));

    expect(rowData('c1', 'confirming')).toBe('true');
    expect(rowData('c1', 'failure')).not.toBe('');
    expect(rowData('t1', 'failure')).toBe('');
    expect(toasts()).toEqual([]);
    fireEvent.click(screen.getByText('cancel c1'));
    expect(rowData('c1', 'confirming')).toBe('false');
  });
});

describe('the filters', () => {
  it('starts the draft from the applied filters each time the drawer opens', () => {
    const { rerender } = renderFlow();
    fireEvent.click(screen.getByText('tick charge'));
    expect(draft().kinds).toEqual(['charge']);

    rerender({ filterOpen: true, filters: holdingFilters('bbas3') });
    expect(screen.getByTestId('filters').getAttribute('data-open')).toBe('true');
    expect(draft()).toEqual(holdingFilters('bbas3'));
    rerender({ filterOpen: false, filters: holdingFilters('bbas3') });
    expect(draft()).toEqual(holdingFilters('bbas3'));
  });

  it('applies the draft with Show, closing the drawer', () => {
    const { onFiltersChange, onFilterClose } = renderFlow({ filterOpen: true });

    fireEvent.click(screen.getByText('tick charge'));
    fireEvent.click(screen.getByText('show'));
    expect(onFiltersChange).toHaveBeenCalledWith({ ...NO_FILTERS, kinds: ['charge'] });
    expect(onFilterClose).toHaveBeenCalled();
  });

  it('refuses an unsound range, showing why', () => {
    const { onFiltersChange } = renderFlow({ filterOpen: true });

    fireEvent.click(screen.getByText('reverse range'));
    fireEvent.click(screen.getByText('show'));
    expect(onFiltersChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('filters').getAttribute('data-errors')).toBe('true');
  });

  it('empties the draft with Clear all, and closes through the Experience', () => {
    const { onFilterClose } = renderFlow({ filterOpen: true, filters: holdingFilters('bbas3') });

    fireEvent.click(screen.getByText('clear all'));
    expect(draft()).toEqual(NO_FILTERS);
    fireEvent.click(screen.getByText('close'));
    expect(onFilterClose).toHaveBeenCalled();
  });
});
