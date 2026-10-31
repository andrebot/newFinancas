import {
  fireEvent, screen, within, cleanup,
} from '@testing-library/react';
import type { Category } from '@financas/api-types';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  categoryChipsOf, FilterPanel, sourceChipsOf, sourceValueOf, withSources,
  type FilterPanelProps,
} from '../../../../../../../src/experiences/manageFinances/flows/browseTransactions/interactions/FilterPanel';
import {
  NO_FILTERS, type LedgerFilters,
} from '../../../../../../../src/experiences/manageFinances/flows/browseTransactions/ledgerFilters';
import { createTranslator } from '../../../../../../../src/utilities/i18n';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import { ACCOUNTS, CATEGORIES, omit } from '../fixtures';

// Filter Panel (BDT: Interaction → unit): renders the draft, emits each edit,
// Show and Clear all; the real kit and catalog.

const translator = createTranslator('en-US');

/**
 * Renders the open drawer with handlers to watch.
 *
 * @param over - The props to change.
 * @returns The handlers.
 */
const renderPanel = (over: Partial<FilterPanelProps> = {}) => {
  const handlers = {
    onClose: vi.fn(), onDraftChange: vi.fn(), onApply: vi.fn(), onClearAll: vi.fn(),
  };
  renderInLocale(
    <FilterPanel
      open
      draft={NO_FILTERS}
      accounts={ACCOUNTS}
      categories={CATEGORIES}
      showRangeErrors={false}
      {...handlers}
      {...over}
    />,
  );
  return handlers;
};

/** The draft the last edit sent. */
const lastDraft = (onDraftChange: ReturnType<typeof vi.fn>) => (
  onDraftChange.mock.lastCall?.[0] as LedgerFilters
);

describe('the source picker', () => {
  it('lists open accounts, then their cards, then archived ones tagged', () => {
    expect(sourceChipsOf(ACCOUNTS, translator).map(({ value, label, tag }) => [value, label, tag]))
      .toEqual([
        ['account:itau', 'Itaú Conta', undefined],
        ['account:chase', 'Main Checking', undefined],
        ['account:nucard', 'Nubank', undefined],
        ['card:visa1', 'Visa •••• 1111', undefined],
        ['card:nu1', 'Visa •••• 2222', undefined],
        ['account:old', 'Old', 'Archived'],
      ]);
  });

  it('reads and splits the picked accounts and cards', () => {
    const draft = { ...NO_FILTERS, accountIds: ['itau'], creditCardIds: ['nu1'] };

    expect(sourceValueOf(draft)).toEqual(['account:itau', 'card:nu1']);
    expect(withSources(NO_FILTERS, ['card:visa1', 'account:chase'])).toMatchObject({
      accountIds: ['chase'], creditCardIds: ['visa1'],
    });
  });

  it('names an account with no name plainly', () => {
    expect(sourceChipsOf([omit(ACCOUNTS[0]!, 'name', 'cards')], translator))
      .toEqual([{ value: 'account:itau', label: '' }]);
  });
});

describe('the category picker', () => {
  it('lists open categories, then archived ones tagged', () => {
    expect(categoryChipsOf(CATEGORIES, translator).map(({ label, tag }) => [label, tag]))
      .toEqual([['Groceries', undefined], ['Housing', undefined], ['Retired', 'Archived']]);
  });
});

describe('FilterPanel', () => {
  it('draws the drawer with Cash and Credit card open, the others folded', () => {
    renderPanel();

    expect(screen.getByRole('dialog', { name: 'Filter Transactions' })).toBeDefined();
    expect(screen.getByRole('checkbox', { name: 'Deposit' })).toBeDefined();
    expect(screen.getByRole('checkbox', { name: 'Charge' })).toBeDefined();
    expect(screen.queryByRole('checkbox', { name: 'Transfer sent' })).toBeNull();
    expect(screen.getByRole('button', { name: /Transfer.*2 kinds/ })).toBeDefined();
  });

  it('unfolds a group when asked, or when it holds a ticked kind', () => {
    renderPanel({ draft: { ...NO_FILTERS, kinds: ['investment_buy'] } });

    expect(screen.getByRole('checkbox', { name: 'Buy' })).toBeDefined();
    expect(screen.getAllByText('1 selected')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Transfer/ }));
    expect(screen.getByRole('checkbox', { name: 'Transfer sent' })).toBeDefined();
  });

  it('folds and unfolds a group with one toggle that keeps the focus', () => {
    renderPanel();

    const toggle = screen.getByRole('button', { name: /Transfer.*2 kinds/ });
    toggle.focus();
    fireEvent.click(toggle);
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const kinds = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(within(kinds!).getByRole('group', { name: 'Transfer' })).toBeDefined();

    fireEvent.click(toggle);
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Transfer sent' })).toBeNull();
  });

  it("ticks a kind, selects a group's all, and clears it", () => {
    const { onDraftChange } = renderPanel({ draft: { ...NO_FILTERS, kinds: ['charge'] } });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Deposit' }));
    expect(lastDraft(onDraftChange).kinds).toEqual(['deposit', 'charge']);
    fireEvent.click(screen.getByRole('button', { name: 'Select all Cash kinds' }));
    expect(lastDraft(onDraftChange).kinds).toEqual([
      'deposit', 'withdrawal', 'boleto_payment', 'pix_payment', 'pix_receipt', 'charge',
    ]);
  });

  it('offers Clear once a group is all ticked', () => {
    const { onDraftChange } = renderPanel({
      draft: { ...NO_FILTERS, kinds: ['credit_card_bill_payment', 'charge', 'refund'] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear Credit card kinds' }));
    expect(lastDraft(onDraftChange).kinds).toEqual([]);
  });

  it('picks accounts, cards and categories', () => {
    const { onDraftChange } = renderPanel();

    const sources = screen.getByRole('group', { name: 'Account / Card' });
    fireEvent.click(within(sources).getByRole('checkbox', { name: 'Visa •••• 1111' }));
    expect(lastDraft(onDraftChange).creditCardIds).toEqual(['visa1']);
    const categories = screen.getByRole('group', { name: 'Category' });
    fireEvent.click(within(categories).getByRole('checkbox', { name: 'Retired Archived' }));
    expect(lastDraft(onDraftChange).categoryIds).toEqual(['retired']);
  });

  it('turns a long list into the multi-select, summed up', () => {
    const many: readonly Category[] = Array.from({ length: 11 }, (_, index) => ({
      ...CATEGORIES[1]!, id: `c${index}`, name: `Category ${index}`,
    }));
    renderPanel({ categories: many, draft: { ...NO_FILTERS, categoryIds: ['c3'] } });

    expect(screen.getByRole('button', { name: /Category/ }).textContent)
      .toContain('1 of 11 categories');
  });

  it('names each long list\'s search (review V8)', () => {
    const categories: readonly Category[] = Array.from({ length: 11 }, (_, index) => ({
      ...CATEGORIES[1]!, id: `c${index}`, name: `Category ${index}`,
    }));
    const accounts = Array.from({ length: 11 }, (_, index) => ({
      ...ACCOUNTS[0]!, id: `a${index}`, name: `Account ${index}`, cards: [],
    }));
    renderPanel({ categories, accounts });

    fireEvent.click(screen.getByRole('button', { name: /Category/ }));
    expect(screen.getByRole('searchbox', { name: 'Search categories' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Account \/ Card/ }));
    expect(screen.getByRole('searchbox', { name: 'Search accounts and cards' })).toBeDefined();
  });

  it('writes Select all, then Clear, on a group\'s button (review V8)', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Select all Cash kinds' }).textContent)
      .toBe('Select all');
    cleanup();
    renderPanel({
      draft: {
        ...NO_FILTERS,
        kinds: ['deposit', 'withdrawal', 'boleto_payment', 'pix_payment', 'pix_receipt'],
      },
    });
    expect(screen.getByRole('button', { name: 'Clear Cash kinds' }).textContent).toBe('Clear');
  });

  it('counts no kind when none is ticked (review V10)', () => {
    renderPanel();

    expect(screen.queryByText(/selected/)).toBeNull();
  });

  it('picks a date range, and shows its errors once Show was refused', () => {
    const reversed = {
      ...NO_FILTERS, range: { preset: 'custom' as const, from: '2026-02-01', to: '2026-01-01' },
    };
    const { onDraftChange } = renderPanel({ draft: reversed, showRangeErrors: true });

    expect(screen.getByText('Editing From or To switches the preset to Custom.')).toBeDefined();
    expect(screen.getByRole('textbox', { name: /To/ }).getAttribute('aria-invalid')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Any time' }));
    expect(lastDraft(onDraftChange).range).toEqual({ preset: 'anyTime', from: '', to: '' });
  });

  it('offers every range preset, then Custom (review V4)', () => {
    renderPanel();

    const range = screen.getByRole('group', { name: 'Date range' });
    expect(within(range).getAllByRole('radio').map((radio) => radio.getAttribute('aria-label')
      ?? radio.closest('label')?.textContent)).toEqual([
      'Any time', 'This month', 'Last 30 days', 'Last 90 days', 'This year', 'Custom',
    ]);
  });

  it('shows a malformed From once Show was refused (review V4)', () => {
    renderPanel({
      draft: { ...NO_FILTERS, range: { preset: 'custom', from: '2026-13-01', to: '' } },
      showRangeErrors: true,
    });

    expect(screen.getByRole('textbox', { name: /From/ }).getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps the range quiet until Show is refused', () => {
    renderPanel({
      draft: { ...NO_FILTERS, range: { preset: 'custom', from: '2026-13-01', to: '' } },
    });

    expect(screen.getByRole('textbox', { name: /From/ }).getAttribute('aria-invalid')).toBeNull();
  });

  it('emits Show and Clear all', () => {
    const { onApply, onClearAll } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Show transactions' }));
    expect(onApply).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClearAll).toHaveBeenCalled();
  });
});
