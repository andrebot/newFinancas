import type { Account, MonthOverviewReport } from '@financas/api-types';
import { InlineBanner } from '../../../../kit/alert/InlineBanner';
import { Button } from '../../../../kit/button/Button';
import { PeriodBar } from '../../../../kit/periodBar/PeriodBar';
import type { Period } from '../../../../kit/periodBar/periodBar';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { PreferenceStorage } from '../../../../utilities/safeStorage';
import useFormatter from '../../../../utilities/useFormatter';
import { balanceCardsOf } from '../../../balanceCards';
import { MonthRails, periodLabelOf } from '../../../interactions/MonthRails';
import { PeriodSummary } from './interactions/PeriodSummary';
import {
  figuresOf, firstYearOf, stripOf,
} from './monthOverview';
import useSummaryCurrency from './useSummaryCurrency';

// The Month Overview Flow (FL17, mockups 30, 34; FR-6.11, FR-6.6, OQ-201,
// OQ-221): the period bar — the year's months with their in / out bars and
// the month's In / Out / Total in the $ / R$ switch's currency — and the
// month's Balance, Budget and Goal rails. The Experience holds the month (its
// query's argument) and the report; the Flow asks for another month and
// keeps the switch, which never reaches the backend. While a month loads the
// rails show placeholders; when it fails, a banner with Try again stands in
// for them — never the previous month's figures under this month's name.
//
// It renders two regions for the Experience's page grid: `overview-bar` and
// `overview-rails`. On a phone they stack over the ledger (mockup 34); from
// `xl` the bar spans the page and the rails sit beside the ledger (mockup 30).
// It never calls the backend.

/** The month's report, as the Experience's query holds it. */
export type MonthOverviewRead = | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'loaded'; readonly report: MonthOverviewReport };

/** What the Flow asks of the Experience. */
export interface MonthOverviewFlowProps {
  /** The month shown. */
  readonly period: Period;
  /** Asks for another month. */
  readonly onPeriodChange: (period: Period) => void;
  readonly overview: MonthOverviewRead;
  /** Asks for the month again after it failed. */
  readonly onRetry: () => void;
  /** The accounts the user can see, archived ones included, with their cards. */
  readonly accounts: readonly Account[];
  /** When the household was created, ISO: with the accounts, how far back the bar reaches. */
  readonly householdCreatedAt: string;
  /** Where the switch's last pick is remembered. */
  readonly currencyMemory: PreferenceStorage;
}

/**
 * Renders the failed month's banner, with Try again.
 *
 * @param props - The month's label and the retry.
 * @returns The banner.
 */
function FailedMonth({ period, onRetry }: {
  readonly period: string;
  readonly onRetry: () => void;
}) {
  const translator = useI18n();
  return (
    <InlineBanner
      tone="error"
      message={translator.text('monthOverview', 'failed', { period })}
      action={(
        <Button variant="ghost" onClick={onRetry}>
          {translator.text('monthOverview', 'retry')}
        </Button>
      )}
    />
  );
}

/**
 * Renders the period bar with its summary, and the month's rails.
 *
 * @param props - The month, the report, the accounts and the Experience's handlers.
 * @returns The Flow's two regions.
 */
export function MonthOverviewFlow({
  period, onPeriodChange, overview, onRetry, accounts, householdCreatedAt, currencyMemory,
}: MonthOverviewFlowProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  const { currency, changeCurrency } = useSummaryCurrency(currencyMemory);
  const label = periodLabelOf(translator, formatter, period);
  const report = overview.status === 'loaded' ? overview.report : undefined;
  return (
    <>
      <div className="min-w-0 [grid-area:overview-bar]">
        <PeriodBar
          period={period}
          periodLabel={label}
          months={report ? stripOf(report.yearStrip, currency) : []}
          currency={currency}
          firstYear={firstYearOf(accounts, householdCreatedAt)}
          onChange={onPeriodChange}
          summary={(
            <PeriodSummary
              period={label}
              currency={currency}
              onCurrencyChange={changeCurrency}
              figures={report && figuresOf(report.summary, currency)}
            />
          )}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-6 [grid-area:overview-rails]">
        {overview.status === 'failed' ? (
          <FailedMonth period={label} onRetry={onRetry} />
        ) : (
          <MonthRails
            period={label}
            content={report && {
              balances: balanceCardsOf(report.balances, accounts, translator),
              budgets: report.budgets,
              goals: report.goals,
            }}
          />
        )}
      </div>
    </>
  );
}
