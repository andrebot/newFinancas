import { useState, type CSSProperties } from 'react';
import type { Account, Category, MyHousehold } from '@financas/api-types';
import { useListAccountsQuery, useListCategoriesQuery } from '../../api/setupApi';
import { useHouseholds } from '../../api/identityApi';
import { monthOverview } from '../../config/constants';
import { Button } from '../../kit/button/Button';
import { IconButton } from '../../kit/button/IconButton';
import { CountBadge } from '../../kit/countBadge/CountBadge';
import { EmptyState } from '../../kit/emptyState/EmptyState';
import { PageHeader } from '../../kit/pageHeader/PageHeader';
import { SkeletonRows } from '../../kit/skeleton/Skeleton';
import { useActiveHousehold } from '../../shell/activeHousehold';
import type { ShellHousehold } from '../../shell/shellConfig';
import { useI18n } from '../../utilities/I18nProvider';
import { safeStorage } from '../../utilities/safeStorage';
import useChildHeight from '../../utilities/useChildHeight';
import { useListGoalsWithProgressQuery } from './api';
import { BrowseTransactionsFlow } from './flows/browseTransactions/BrowseTransactionsFlow';
import { activeFilterCount } from './flows/browseTransactions/ledgerFilters';
import { MonthOverviewFlow } from './flows/monthOverview/MonthOverviewFlow';
import { RecordTransactionFlow } from './flows/recordTransaction/RecordTransactionFlow';
import type { EditedTransaction } from './flows/recordTransaction/recordTransactionState';
import { splitGoalsOf } from './manageFinances';
import useLedger from './useLedger';
import useMonthOverview from './useMonthOverview';
import useRecordDrawer, { type RecordDrawer } from './useRecordDrawer';

// The Manage Finances Experience (X6, EBD; mockups 30–35; OQ-220..222): the
// Transactions page — Month Overview's period bar and rails around Browse
// Transactions' ledger, and Record Transaction's drawer for a new transaction
// or a row's edit. It is the only tier here that calls the backend: it holds
// the month and its report, the applied filters and the ledger's pages, and
// the open drawer, and answers the Flows' reads and writes. A write
// invalidates the ledger, the month and the Goals' progress by their cache
// tags, so neither Flow refreshes the other (EBD: no Flow talks to a
// sibling). The accounts and categories are read once for all three Flows,
// archived ones included. The page is keyed on the household, so a switch
// starts it afresh.
//
// The page grid places Month Overview's two regions and the ledger: stacked on
// a phone, the bar sticky under the App Shell's header and the ledger's month
// headers under the bar (mockup 34); from `xl` the bar spans the page and the
// rails sit beside the ledger (mockup 30). The header's Filter and Record
// Transaction show from `md`; a phone has Filter in the ledger's heading and
// a floating Record button.

/** Where the $ / R$ switch's last pick is remembered (OQ-221). */
const CURRENCY_MEMORY = safeStorage(() => window.localStorage, monthOverview.currencyStorageKey);

/** The phone's sticky period bar, measured for the month headers under it. */
const BAR_REGION = '[data-region="overview-bar"]';

const PAGE_GRID = [
  'grid items-start gap-6',
  "[grid-template-areas:'overview-bar'_'overview-rails'_'ledger']",
  'xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]',
  "xl:[grid-template-areas:'overview-bar_overview-bar'_'ledger_overview-rails']",
  'max-xl:[&>[data-region=overview-bar]]:sticky',
  'max-xl:[&>[data-region=overview-bar]]:top-(--spacing-shell-header)',
  'max-xl:[&>[data-region=overview-bar]]:z-10',
  'max-xl:[&>[data-region=overview-bar]]:bg-bg/95',
  'max-xl:[&>[data-region=overview-bar]]:backdrop-blur',
  'max-xl:[&>[data-region=overview-bar]]:pb-3',
  // The measured bar counts only while it sticks.
  '[--overview-bar-offset:var(--overview-bar-height)] xl:[--overview-bar-offset:0px]',
].join(' ');

/** Under the App Shell's header and, on a phone, the sticky bar. */
const LEDGER_STICKY_TOP = 'calc(var(--spacing-shell-header) + var(--overview-bar-offset, 0px))';

/** The household a Transactions page works in. */
interface FinancesPageProps {
  readonly household: ShellHousehold;
  readonly userId: string;
  /** When the household was created, ISO: how far back the period bar reaches. */
  readonly createdAt: string;
  /** Whether the address's Holding filter is this household's (the one the page opened in). */
  readonly holdingFromAddress: boolean;
}

/** The lists every Flow reads, once loaded. */
interface PageLists {
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
}

/**
 * Renders the Filter button: the header's, with its label, or a phone's icon.
 *
 * @param props - How many filters are in use, the opener and whether it is the phone's.
 * @returns The button.
 */
function FilterButton({ count, onOpen, compact }: {
  readonly count: number;
  readonly onOpen: () => void;
  readonly compact: boolean;
}) {
  const translator = useI18n();
  const label = translator.text('manageFinances', 'filter');
  const badgeLabel = translator.text('manageFinances', 'filterCount', { count });
  if (compact) {
    return (
      <IconButton
        icon="filter-list"
        label={label}
        className="md:hidden"
        badge={<CountBadge count={count} label={badgeLabel} className="absolute top-1 right-1" />}
        onClick={onOpen}
      />
    );
  }
  return (
    <Button variant="secondary" leadingIcon="filter-list" onClick={onOpen}>
      {label}
      <CountBadge count={count} label={badgeLabel} />
    </Button>
  );
}

/**
 * Renders the open drawer once the Goals a trade's split names are read — a
 * failed read leaves the split without Goals to add. The Goals are read only
 * while it is open.
 *
 * @param props - The household, the lists, the open drawer and the Flow's requests.
 * @returns The drawer, or nothing while the Goals load.
 */
function OpenRecordDrawer({
  householdId, lists, transaction, requests,
}: {
  readonly householdId: string;
  readonly lists: PageLists;
  readonly transaction: EditedTransaction | undefined;
  readonly requests: RecordDrawer['requests'];
}) {
  const active = useListGoalsWithProgressQuery({ householdId, status: 'active' });
  const completed = useListGoalsWithProgressQuery({ householdId, status: 'completed' });
  if (active.isLoading || completed.isLoading) return null;
  return (
    <RecordTransactionFlow
      transaction={transaction}
      accounts={lists.accounts}
      categories={lists.categories}
      goals={splitGoalsOf(active.data ?? [], completed.data ?? [])}
      {...requests}
    />
  );
}

/**
 * Renders the Record Transaction drawer while it is open, a fresh one for
 * each opening — so a form never outlives the row it was opened on.
 *
 * @param props - The household, the lists and the drawer.
 * @returns The drawer, or nothing while it is closed.
 */
function RecordDrawerHost({ householdId, lists, record }: {
  readonly householdId: string;
  readonly lists: PageLists;
  readonly record: RecordDrawer;
}) {
  const { drawer } = record;
  if (!drawer.open) return null;
  return (
    <OpenRecordDrawer
      key={drawer.opening}
      householdId={householdId}
      lists={lists}
      transaction={drawer.transaction}
      requests={record.requests}
    />
  );
}

/**
 * Renders the Transactions page once its lists are in.
 *
 * @param props - The household, the user, its creation date and the lists.
 * @returns The page.
 */
function FinancesPage({
  household, userId, createdAt, holdingFromAddress, lists,
}: FinancesPageProps & { readonly lists: PageLists }) {
  const translator = useI18n();
  const ledger = useLedger(household.id, holdingFromAddress);
  const month = useMonthOverview(household.id);
  const record = useRecordDrawer(household.id);
  const [gridRef, barHeight] = useChildHeight(BAR_REGION);
  const filterCount = activeFilterCount(ledger.filters);
  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-0">
      <div className="max-md:sr-only">
        <PageHeader
          title={translator.text('manageFinances', 'title')}
          description={translator.text('manageFinances', 'description')}
          actions={(
            <div className="flex items-center gap-3 max-md:hidden">
              <FilterButton count={filterCount} onOpen={ledger.onFilterOpen} compact={false} />
              <Button
                variant="primary"
                size="lg"
                elevated
                leadingIcon="add"
                onClick={record.openNew}
              >
                {translator.text('manageFinances', 'record')}
              </Button>
            </div>
          )}
        />
      </div>
      <div
        ref={gridRef}
        className={PAGE_GRID}
        style={{ '--overview-bar-height': `${barHeight}px` } as CSSProperties}
      >
        <MonthOverviewFlow
          {...month}
          accounts={lists.accounts}
          householdCreatedAt={createdAt}
          currencyMemory={CURRENCY_MEMORY}
        />
        <div className="min-w-0 [grid-area:ledger]">
          <BrowseTransactionsFlow
            {...ledger}
            accounts={lists.accounts}
            categories={lists.categories}
            selfUserId={userId}
            role={household.role}
            onEdit={record.openEdit}
            stickyTop={LEDGER_STICKY_TOP}
            filterAction={(
              <FilterButton count={filterCount} onOpen={ledger.onFilterOpen} compact />
            )}
          />
        </div>
      </div>
      <div className="fixed right-5 bottom-6 z-20 md:hidden">
        <Button
          variant="primary"
          size="xl"
          leadingIcon="add"
          elevated
          aria-label={translator.text('manageFinances', 'record')}
          onClick={record.openNew}
        >
          {translator.text('manageFinances', 'recordShort')}
        </Button>
      </div>
      <RecordDrawerHost householdId={household.id} lists={lists} record={record} />
    </div>
  );
}

/**
 * Reads the accounts and categories every Flow needs, and renders the page
 * once both are in: a skeleton until then, a retry when either fails.
 *
 * @param props - The household, the user and the household's creation date.
 * @returns The page, its skeleton or its retry.
 */
function FinancesLists(props: FinancesPageProps) {
  const { household } = props;
  const translator = useI18n();
  const accounts = useListAccountsQuery(household.id);
  const categories = useListCategoriesQuery(household.id);
  if (accounts.data !== undefined && categories.data !== undefined) {
    return (
      <FinancesPage
        {...props}
        lists={{ accounts: accounts.data, categories: categories.data }}
      />
    );
  }
  if (accounts.isError || categories.isError) {
    return (
      <EmptyState
        icon="error-outline"
        title={translator.text('manageFinances', 'failed')}
        action={(
          <Button onClick={() => [accounts, categories].forEach((query) => query.refetch())}>
            {translator.text('manageFinances', 'retry')}
          </Button>
        )}
      />
    );
  }
  return <SkeletonRows label={translator.text('manageFinances', 'loading')} />;
}

/**
 * Finds when a household was created.
 *
 * @param households - The user's households.
 * @param householdId - The household.
 * @returns Its creation time, ISO, if it is listed.
 */
const createdAtOf = (households: readonly MyHousehold[], householdId: string) => (
  households.find(({ id }) => id === householdId)?.createdAt
);

/**
 * Remembers the household the page opened in: a Holding filter in the address
 * belongs to it, not to one switched to later.
 *
 * @param householdId - The active household, once known.
 * @returns The household the page opened in, once known.
 */
const useOpenedIn = (householdId: string | undefined) => {
  const [openedIn, setOpenedIn] = useState<string>();
  // Adjusted while rendering, as React advises for state that follows a value.
  if (openedIn === undefined && householdId !== undefined) setOpenedIn(householdId);
  return openedIn ?? householdId;
};

/**
 * Renders the active household's Transactions page once the user and the
 * household are known: a skeleton until then, a retry if the user can't be
 * loaded.
 *
 * @returns The page.
 */
export default function ManageFinancesExperience() {
  const translator = useI18n();
  const active = useActiveHousehold();
  const households = useHouseholds();
  const openedIn = useOpenedIn(active.status === 'ready' ? active.data.household.id : undefined);

  if (active.status === 'failed') {
    return (
      <EmptyState
        icon="error-outline"
        title={translator.text('manageFinances', 'failed')}
        action={(
          <Button onClick={active.retry}>{translator.text('manageFinances', 'retry')}</Button>
        )}
      />
    );
  }
  const created = households.status === 'ready' && active.status === 'ready'
    ? createdAtOf(households.data, active.data.household.id)
    : undefined;
  if (active.status !== 'ready' || created === undefined) {
    return <SkeletonRows label={translator.text('manageFinances', 'loading')} />;
  }
  const { household, userId } = active.data;
  return (
    <FinancesLists
      key={household.id}
      household={household}
      userId={userId}
      createdAt={created}
      holdingFromAddress={household.id === openedIn}
    />
  );
}
