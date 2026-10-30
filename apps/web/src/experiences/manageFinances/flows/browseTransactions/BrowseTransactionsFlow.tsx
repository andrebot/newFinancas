import type { Account, Category, LedgerItem } from '@financas/api-types';
import { Fragment } from 'react';
import { Amount } from '../../../../kit/amount/Amount';
import { Button } from '../../../../kit/button/Button';
import { Card } from '../../../../kit/card/Card';
import { EmptyState } from '../../../../kit/emptyState/EmptyState';
import { GroupedList } from '../../../../kit/groupedList/GroupedList';
import { useI18n } from '../../../../utilities/I18nProvider';
import { browseText } from './browseText';
import { FilterPanel } from './interactions/FilterPanel';
import { LedgerRow } from './interactions/LedgerRow';
import { activeFilterCount, NO_FILTERS } from './ledgerFilters';
import {
  ledgerViewOf, rowKeyOf, type DayTotal, type LedgerView, type LoadedLedger,
} from './ledgerPages';
import {
  ledgerLookupOf, rowAccessOf, type LedgerLookup, type Viewer,
} from './ledgerRow';
import useBrowseTransactions, {
  type BrowseTransactionsController, type BrowseTransactionsRequests,
} from './useBrowseTransactions';

// The Browse Transactions Flow (FL16, mockups 30, 33, 34; FR-3.12, OQ-61,
// OQ-201, OQ-220): every transaction the user can see, newest first, a page
// at a time under month headers (with the month's count) and day bands (with
// the day's totals, R$ first) — never scoped by the period bar. A row opens
// to its details and, when the user may change it, Edit and Delete. The
// filter drawer edits a draft the Experience applies; a Holding filter, set
// from a Holding's "See in Transactions", shows as a chip until removed. The
// Experience holds the applied filters and the pages — its infinite query,
// refetched after every write — and opens Record Transaction for an edit (EBD:
// no Flow talks to a sibling). It never calls the backend.

/** What the Flow asks of the Experience. */
export interface BrowseTransactionsFlowProps extends BrowseTransactionsRequests, Viewer {
  /** The pages loaded so far, and whether more follow. */
  readonly ledger: LoadedLedger;
  /** Asks for the next page — near the end, and from "Try again". */
  readonly onReachedEnd: () => void;
  /** The filtered Holding's name, for its chip; "Holding" alone until it is known. */
  readonly holdingName?: string | undefined;
  /** The accounts the user can see, archived ones included, with their cards. */
  readonly accounts: readonly Account[];
  /** The household's categories, archived ones included. */
  readonly categories: readonly Category[];
  /** Asks the Experience to open Record Transaction on the row. */
  readonly onEdit: (item: LedgerItem) => void;
  /** Where the month headers stick; the kit's default sits under the App Shell's header. */
  readonly stickyTop?: string | undefined;
}

/**
 * Renders a day's totals: each currency's net, R$ first, a middle dot between.
 *
 * @param props - The day's totals.
 * @returns The totals.
 */
export function DayTotals({ totals }: { readonly totals: readonly DayTotal[] }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {totals.map(({ currency, net }, index) => (
        <Fragment key={currency}>
          {index > 0 && <span aria-hidden="true">·</span>}
          <Amount amount={net} currency={currency} tone="inflow" />
        </Fragment>
      ))}
    </span>
  );
}

/**
 * Renders the ledger's heading, Clear filters once filtered, and the Holding chip.
 *
 * @param props - The Flow's props.
 * @returns The header.
 */
function LedgerHeader({
  filters, onFiltersChange, holdingName,
}: Pick<BrowseTransactionsFlowProps, 'filters' | 'onFiltersChange' | 'holdingName'>) {
  const translator = useI18n();
  const filtered = activeFilterCount(filters) > 0;
  return (
    <div className="flex flex-col gap-3 px-5 pb-3 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-heading-sm">
          {browseText(translator, filtered ? 'title.filtered' : 'title')}
          {' '}
          <span className="ml-1 type-body-sm font-medium text-muted">
            {browseText(translator, 'order')}
          </span>
        </h2>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => onFiltersChange(NO_FILTERS)}>
            {browseText(translator, 'clearFilters')}
          </Button>
        )}
      </div>
      {filters.holdingId !== undefined && (
        <Button
          variant="tonal"
          size="sm"
          className="self-start"
          trailingIcon="close"
          aria-label={holdingName
            ? browseText(translator, 'holding.remove', { name: holdingName })
            : browseText(translator, 'holding.removeUnnamed')}
          onClick={() => onFiltersChange({ ...filters, holdingId: undefined })}
        >
          {holdingName
            ? browseText(translator, 'holding', { name: holdingName })
            : browseText(translator, 'holding.unnamed')}
        </Button>
      )}
    </div>
  );
}

/**
 * Renders the empty ledger: nothing recorded, or nothing matching.
 *
 * @param props - Whether filters are in use.
 * @returns The empty state.
 */
function EmptyLedger({ filtered }: { readonly filtered: boolean }) {
  const translator = useI18n();
  const prefix = filtered ? 'emptyFiltered' : 'empty';
  return (
    <EmptyState
      icon="receipt-long-outline"
      title={browseText(translator, `${prefix}.title`)}
      description={browseText(translator, `${prefix}.description`)}
    />
  );
}

/** What the ledger renders from. */
interface LedgerProps extends Pick<
  BrowseTransactionsFlowProps,
  'ledger' | 'onReachedEnd' | 'accounts' | 'categories' | 'onEdit' | 'stickyTop' | 'filters'
> {
  readonly controller: BrowseTransactionsController;
  readonly viewer: Viewer;
}

/** What a row renders from, besides itself. */
interface RowContext {
  readonly controller: BrowseTransactionsController;
  readonly lookup: LedgerLookup;
  readonly viewer: Viewer;
  /** The open row's delete failure, already translated. */
  readonly failure: string | undefined;
  readonly onEdit: (item: LedgerItem) => void;
}

/**
 * Renders one row of the ledger, open or closed, with its delete state.
 *
 * @param item - The row.
 * @param context - The controller, the lookup, the viewer, the failure and Edit.
 * @returns The row.
 */
const renderRow = (item: LedgerItem, context: RowContext) => {
  const { controller, lookup, viewer } = context;
  const { state } = controller;
  const key = rowKeyOf(item);
  const open = state.openRow === key;
  return (
    <LedgerRow
      item={item}
      lookup={lookup}
      access={rowAccessOf(item, lookup, viewer)}
      expanded={open}
      onExpandedChange={(expanded) => controller.toggleRow(key, expanded)}
      confirming={open && state.confirming}
      deleting={open && state.deleting}
      failure={open ? context.failure : undefined}
      onEdit={() => context.onEdit(item)}
      onDelete={controller.askDelete}
      onConfirmDelete={() => controller.confirmDelete(item)}
      onCancelDelete={controller.cancelDelete}
    />
  );
};

/**
 * Renders a day band's totals.
 *
 * @param view - The ledger as loaded.
 * @param date - The day, `YYYY-MM-DD`.
 * @returns The day's totals.
 */
const renderDayTotals = (view: LedgerView, date: string) => (
  <DayTotals totals={view.dayTotals.get(date) ?? []} />
);

/**
 * Renders the ledger: the grouped rows, paged as the user scrolls.
 *
 * @param props - The pages, the lists, the filters, the viewer and the controller.
 * @returns The grouped list.
 */
function Ledger({
  controller, viewer, ledger, onReachedEnd, accounts, categories, onEdit, stickyTop, filters,
}: LedgerProps) {
  const translator = useI18n();
  const { deleteFailure } = controller.state;
  const view = ledgerViewOf(ledger.pages);
  const context: RowContext = {
    controller,
    lookup: ledgerLookupOf(accounts, categories),
    viewer,
    failure: deleteFailure && translator.error(deleteFailure.code, deleteFailure.params),
    onEdit,
  };
  return (
    <GroupedList
      items={view.items}
      dateOf={(item) => item.date ?? ''}
      keyOf={rowKeyOf}
      renderItem={(item) => renderRow(item, context)}
      monthAside={(month) => browseText(translator, 'monthCount', {
        count: view.monthCounts.get(month) ?? 0,
      })}
      dayAside={(date) => renderDayTotals(view, date)}
      hasMore={ledger.hasMore}
      status={ledger.status}
      onReachedEnd={onReachedEnd}
      empty={<EmptyLedger filtered={activeFilterCount(filters) > 0} />}
      stickyTop={stickyTop}
    />
  );
}

/**
 * Renders the ledger card and the filter drawer.
 *
 * @param props - The ledger, the filters, the lists, the viewer and the Experience's handlers.
 * @returns The Flow.
 */
export function BrowseTransactionsFlow(props: BrowseTransactionsFlowProps) {
  const {
    filterOpen, onFilterClose, accounts, categories, selfUserId, role,
  } = props;
  const controller = useBrowseTransactions(props);
  const { state } = controller;
  return (
    <>
      <Card as="section" size="none">
        <LedgerHeader {...props} />
        <Ledger {...props} controller={controller} viewer={{ selfUserId, role }} />
      </Card>
      <FilterPanel
        open={filterOpen}
        onClose={onFilterClose}
        draft={state.draft}
        onDraftChange={controller.changeDraft}
        accounts={accounts}
        categories={categories}
        showRangeErrors={state.showRangeErrors}
        onApply={controller.apply}
        onClearAll={controller.clearDraft}
      />
    </>
  );
}
