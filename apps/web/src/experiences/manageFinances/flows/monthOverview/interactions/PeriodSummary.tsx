import type { Currency } from '@financas/api-types';
import type { ReactNode } from 'react';
import { money } from '../../../../../config/constants';
import { Amount } from '../../../../../kit/amount/Amount';
import { EMPTY_VALUE } from '../../../../../kit/keyValueList/KeyValueList';
import { SegmentedControl } from '../../../../../kit/segmentedControl/SegmentedControl';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { moneyConventions } from '../../../../../utilities/formatting';
import type { MonthFigures } from '../monthOverview';

// The period bar's summary (FL17, mockups 30, 34; FR-6.11): the month's
// money in, out and total in the one currency the $ / R$ switch picks —
// nothing is converted or summed across currencies (FR-9). In reads mint,
// Out coral, Total plain with its sign. Until the month loads, or when it
// failed, each figure is the kit's dash, heard as "not available" (busy while
// loading). The month's label shows only from `xl`: on a phone the bar's own
// arrows name it (mockup 34). Display only: it emits the currency picked.

/** The summary's props. */
export interface PeriodSummaryProps {
  /** The month, already formatted, e.g. "September/2026". */
  readonly period: string;
  readonly currency: Currency;
  readonly onCurrencyChange: (currency: Currency) => void;
  /** The month's figures in that currency; unknown while it loads or after it failed. */
  readonly figures: MonthFigures | undefined;
  /** The month is loading: the figures are busy. */
  readonly loading?: boolean | undefined;
}

/**
 * Renders one line of the summary: its label and its figure.
 *
 * @param props - The label, the figure and whether it is the total.
 * @returns The line.
 */
function Line({ label, total = false, children }: {
  readonly label: string;
  readonly total?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div
      className={[
        'flex justify-between gap-6 type-body-sm',
        total && 'border-t border-line pt-2',
      ].filter(Boolean).join(' ')}
    >
      <dt className={total ? 'font-semibold text-ink' : 'text-muted'}>{label}</dt>
      <dd className={total ? 'font-bold text-ink' : 'font-semibold'}>{children}</dd>
    </div>
  );
}

/**
 * Renders the month's summary and the currency switch.
 *
 * @param props - The month, the currency, its figures, whether they load and the switch's handler.
 * @returns The summary.
 */
export function PeriodSummary({
  period, currency, onCurrencyChange, figures, loading = false,
}: PeriodSummaryProps) {
  const translator = useI18n();
  const dash = (
    <>
      <span className="text-muted" aria-hidden="true">{EMPTY_VALUE}</span>
      <span className="sr-only">{translator.text('monthOverview', 'unavailable')}</span>
    </>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="hidden type-label text-muted xl:inline">{period}</span>
        <SegmentedControl
          size="xs"
          label={translator.text('monthOverview', 'currency')}
          options={money.currencies.map((value) => ({
            value, label: moneyConventions(value).symbol,
          }))}
          value={currency}
          onChange={onCurrencyChange}
        />
      </div>
      <dl className="flex flex-col gap-2" aria-busy={loading || undefined}>
        <Line label={translator.text('monthOverview', 'in')}>
          {figures ? <Amount amount={figures.in} currency={currency} tone="signed" /> : dash}
        </Line>
        <Line label={translator.text('monthOverview', 'out')}>
          {figures ? <Amount amount={0 - figures.out} currency={currency} tone="signed" /> : dash}
        </Line>
        <Line label={translator.text('monthOverview', 'total')} total>
          {figures ? <Amount amount={figures.net} currency={currency} sign="always" /> : dash}
        </Line>
      </dl>
    </div>
  );
}
