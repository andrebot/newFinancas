import type { Currency, InvestmentHolding } from '@financas/api-types';
import { portfolio, money } from '../../config/constants';
import { InlineBanner } from '../../kit/alert/InlineBanner';
import { Amount } from '../../kit/amount/Amount';
import { Button } from '../../kit/button/Button';
import { Card } from '../../kit/card/Card';
import { MultiSelect, type MultiSelectPreset } from '../../kit/multiSelect/MultiSelect';
import { SectionHeader } from '../../kit/sectionHeader/SectionHeader';
import type { SelectEntry } from '../../kit/select/options';
import { SegmentedControl } from '../../kit/segmentedControl/SegmentedControl';
import { Skeleton } from '../../kit/skeleton/Skeleton';
import {
  StackedBarChart, seriesColors, type BarSeries,
} from '../../kit/stackedBarChart/StackedBarChart';
import { useI18n } from '../../utilities/I18nProvider';
import { moneyConventions } from '../../utilities/formatting';
import type { Translator } from '../../utilities/i18n';
import type { PreferenceStorage } from '../../utilities/safeStorage';
import useFormatter from '../../utilities/useFormatter';
import useToday from '../../utilities/useToday';
import { familyName, holdingIdOf } from '../holdingNames';
import {
  holdingGroupsOf, holdingNameOf, monthTotalOf, payoutSeriesOf, payoutsByHolding,
  type HoldingGroup, type HoldingPayout, type PayoutsRead, type PayoutThisMonthEntry,
} from '../payoutPanel';
import { monthOfDate, monthsEndingAt } from '../reportMonths';
import useRememberedCurrency from '../useRememberedCurrency';
import { periodLabelOf } from './MonthRails';

// The payout panel (FL18, FL21; mockups 20, 50; FR-5.9, OQ-230, OQ-233):
// "Payout over time" — the last 12 months of dividends and interest of the
// chosen Holdings, stacked by Holding in the $ / R$ switch's currency (K39),
// this month's total beside the switch, and the Holdings picked in K12 —
// grouped by family, each with its chart colour and this month's payout, a
// preset per family. The choice belongs to the Experience (it is the query's
// argument): the panel shows it and emits a new one. Only the chart waits on
// a new choice. The switch is the panel's own, remembered. Display only.

/** The payout panel's props. */
export interface PayoutPanelProps {
  /** The household's Holdings, archived ones included: what can be chosen. */
  readonly holdings: readonly InvestmentHolding[];
  /** The ids chosen, as the Experience resolved them. */
  readonly chosen: readonly string[];
  /** Emits the ids chosen in the selector. */
  readonly onChosenChange: (ids: readonly string[]) => void;
  /** The payouts report for the choice. */
  readonly payouts: PayoutsRead;
  /** Asks for the payouts again after they failed. */
  readonly onRetry: () => void;
  /** This month's dividend and interest transactions, for the selector; none to leave them out. */
  readonly thisMonth?: readonly PayoutThisMonthEntry[] | undefined;
  /** Where the switch's last pick is remembered. */
  readonly currencyMemory: PreferenceStorage;
}

/**
 * Draws a Holding's chart colour, or an empty swatch when it has none.
 *
 * @param props - The colour, if the chart draws the Holding.
 * @returns The swatch.
 */
function Swatch({ color }: { readonly color: string | undefined }) {
  return (
    <span
      className={`size-2.5 shrink-0 rounded-sm ${color ? '' : 'bg-track'}`}
      style={color ? { background: color } : undefined}
    />
  );
}

/**
 * Shows a Holding's payout this month, or a dash without one.
 *
 * @param props - The payout, if any.
 * @returns The amount, or the dash.
 */
function ThisMonth({ payout }: { readonly payout: HoldingPayout | undefined }) {
  return payout
    ? <Amount amount={payout.amount} currency={payout.currency} tone="inflow" sign="auto" />
    : <span className="text-muted" aria-hidden="true">—</span>;
}

/** What the selector's entries are built from. */
interface OptionSources {
  readonly groups: readonly HoldingGroup[];
  readonly colors: ReadonlyMap<string, string>;
  readonly paid: ReadonlyMap<string, HoldingPayout>;
  readonly translator: Translator;
}

/**
 * Builds the selector's entries: one group per family.
 *
 * @param sources - The groups, the chart's colours, this month's payouts and the texts.
 * @returns The entries.
 */
const optionsOf = ({
  groups, colors, paid, translator,
}: OptionSources): SelectEntry<string>[] => groups.map(({ family, holdings }) => ({
  group: familyName(translator, family),
  options: holdings.map((holding) => {
    const id = holdingIdOf(holding);
    return {
      value: id,
      label: holdingNameOf(holding),
      leading: <Swatch color={colors.get(id)} />,
      trailing: <ThisMonth payout={paid.get(id)} />,
      description: holding.archivedAt ? translator.text('payoutPanel', 'archived') : undefined,
    };
  }),
}));

/**
 * Builds a preset per family.
 *
 * @param groups - The selector's groups.
 * @param translator - Names each family.
 * @returns The presets.
 */
const presetsOf = (
  groups: readonly HoldingGroup[],
  translator: Translator,
): MultiSelectPreset<string>[] => groups.map(({ family, holdings }) => ({
  label: familyName(translator, family),
  values: holdings.map(holdingIdOf),
}));

/** What the chart's area shows. */
interface ChartAreaProps {
  readonly chosen: number;
  readonly payouts: PayoutsRead;
  readonly onRetry: () => void;
  readonly months: readonly string[];
  readonly series: readonly BarSeries[] | undefined;
  readonly drawn: number;
  readonly currency: Currency;
}

/**
 * Renders the chart's area: the chart, or why there is none.
 *
 * @param props - The choice's size, the report, the months and the series.
 * @returns The chart, a placeholder, a failure banner or a note.
 */
function ChartArea({
  chosen, payouts, onRetry, months, series, drawn, currency,
}: ChartAreaProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  const note = (text: string) => <p className="py-6 text-center type-body-sm text-muted">{text}</p>;
  if (payouts.status === 'loading') {
    return (
      <div role="status" aria-busy="true" aria-label={translator.text('payoutPanel', 'loading')}>
        <Skeleton shape="block" className="h-[170px]" />
      </div>
    );
  }
  if (chosen === 0) return note(translator.text('payoutPanel', 'noneChosen'));
  if (payouts.status === 'failed' || series === undefined) {
    return (
      <InlineBanner
        tone="error"
        message={translator.text('payoutPanel', 'failed')}
        action={(
          <Button variant="ghost" onClick={onRetry}>
            {translator.text('payoutPanel', 'retry')}
          </Button>
        )}
      />
    );
  }
  if (drawn === 0) {
    const { symbol } = moneyConventions(currency);
    return note(translator.text('payoutPanel', 'empty', { symbol }));
  }
  return (
    <StackedBarChart
      months={months}
      series={series}
      ariaLabel={translator.text('payoutPanel', 'chart')}
      formatValue={(amount) => formatter.money(amount, currency)}
    />
  );
}

/**
 * Renders the payout panel.
 *
 * @param props - The Holdings, the choice, the report and the switch's memory.
 * @returns The panel.
 */
export function PayoutPanel({
  holdings, chosen, onChosenChange, payouts, onRetry, thisMonth, currencyMemory,
}: PayoutPanelProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  const today = useToday();
  const { currency, changeCurrency } = useRememberedCurrency(currencyMemory);
  const newest = monthOfDate(today);
  const months = monthsEndingAt(newest, portfolio.payoutMonths);
  const series = payouts.status === 'loaded' && chosen.length > 0
    ? payoutSeriesOf(
      payouts.report,
      currency,
      holdings,
      translator.text('holdingNames', 'unknown'),
    )
    : undefined;
  const colors = seriesColors(months, series ?? []);
  const groups = holdingGroupsOf(holdings);
  return (
    <Card as="section" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <SectionHeader
          title={translator.text('payoutPanel', 'title')}
          description={translator.text('payoutPanel', 'description', {
            count: portfolio.payoutMonths,
          })}
        />
        <div className="flex items-center gap-3">
          {series && (
            <div className="text-right">
              <p className="type-micro uppercase text-muted">
                {periodLabelOf(translator, formatter, {
                  year: Number(newest.slice(0, 4)), month: Number(newest.slice(5, 7)),
                })}
              </p>
              <Amount
                amount={monthTotalOf(series, newest)}
                currency={currency}
                className="type-heading-md font-bold text-mint"
              />
            </div>
          )}
          <SegmentedControl
            size="xs"
            label={translator.text('payoutPanel', 'currency')}
            options={money.currencies.map((value) => ({
              value, label: moneyConventions(value).symbol,
            }))}
            value={currency}
            onChange={changeCurrency}
          />
        </div>
      </div>
      <MultiSelect
        label={translator.text('payoutPanel', 'holdings')}
        labelHidden
        // Until the Holdings are read there is nothing to choose from (review round 1).
        disabled={holdings.length === 0}
        options={optionsOf({
          groups, colors, paid: payoutsByHolding(thisMonth ?? []), translator,
        })}
        value={chosen}
        onChange={onChosenChange}
        summary={(count, total) => translator.text('payoutPanel', 'summary', { count, total })}
        placeholder={translator.text('payoutPanel', 'placeholder')}
        presets={presetsOf(groups, translator)}
        search={{
          label: translator.text('payoutPanel', 'search'),
          placeholder: translator.text('payoutPanel', 'searchPlaceholder'),
          noResults: translator.text('payoutPanel', 'noResults'),
        }}
        note={translator.text('payoutPanel', 'note')}
      />
      <ChartArea
        chosen={chosen.length}
        payouts={payouts}
        onRetry={onRetry}
        months={months}
        series={series}
        drawn={colors.size}
        currency={currency}
      />
    </Card>
  );
}
