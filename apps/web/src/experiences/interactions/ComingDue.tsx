import type { InvestmentHolding } from '@financas/api-types';
import { Amount } from '../../kit/amount/Amount';
import { Card } from '../../kit/card/Card';
import { SectionHeader } from '../../kit/sectionHeader/SectionHeader';
import { SkeletonRows } from '../../kit/skeleton/Skeleton';
import { useI18n } from '../../utilities/I18nProvider';
import useFormatter from '../../utilities/useFormatter';
import useToday from '../../utilities/useToday';
import {
  comingDueRowsOf, type ComingDueEntry, type ComingDueRow, type DueIn,
} from '../comingDue';
import { assetTypeName } from '../holdingNames';

// Coming Due (FL18, FL21; mockups 20, 50; FR-6.0, OQ-233): the fixed-term
// Holdings still open, soonest first — a date badge, the Holding's name, its
// type and either "Overdue" (in coral, past its date and not yet redeemed),
// "in n months" (in sun, when soon) or the year it is due, and the amount.
// Shared by the Investments overview and the Dashboard.
// Display only: the caller hands in the report's list and the Holdings.

/** Coming Due's props. */
export interface ComingDueProps {
  /** The report's fixed-term Holdings still open; unknown while it loads. */
  readonly entries: readonly ComingDueEntry[] | undefined;
  /** The household's Holdings, for each one's type. */
  readonly holdings: readonly InvestmentHolding[];
}

/** The date badge's look for each state: coral overdue, sun soon, plain later. */
const BADGE_TONES: Readonly<Record<DueIn['when'], string>> = {
  overdue: 'bg-coral/15 text-coral',
  soon: 'bg-sun/15 text-sun',
  later: 'bg-raised text-muted',
};

/**
 * Writes when a Holding is due: overdue, in months, or the year.
 *
 * @param props - When it is due.
 * @returns The text, coloured when it needs attention.
 */
function DueText({ dueIn }: { readonly dueIn: DueIn }) {
  const translator = useI18n();
  if (dueIn.when === 'overdue') {
    return <span className="text-coral">{translator.text('comingDue', 'overdue')}</span>;
  }
  if (dueIn.when === 'soon') {
    return (
      <span className="text-sun">
        {translator.text('comingDue', 'inMonths', { count: dueIn.months })}
      </span>
    );
  }
  return <>{dueIn.year}</>;
}

/**
 * Renders one Holding coming due.
 *
 * @param props - The row.
 * @returns The list item.
 */
function DueRow({ row }: { readonly row: ComingDueRow }) {
  const translator = useI18n();
  const formatter = useFormatter();
  const { entry, assetType, dueIn } = row;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        className={[
          'flex w-10 shrink-0 flex-col items-center rounded-lg py-1',
          BADGE_TONES[dueIn.when],
        ].join(' ')}
        aria-hidden="true"
      >
        <span className="type-micro uppercase">{formatter.date(entry.dueDate, 'monthShort')}</span>
        <span className="type-body font-bold text-ink">{Number(entry.dueDate.slice(8, 10))}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate type-body-sm font-semibold text-ink">{entry.name}</p>
        <p className="type-caption text-muted">
          <span className="sr-only">
            {translator.text('comingDue', 'due', {
              date: formatter.date(entry.dueDate, 'numeric'),
            })}
          </span>
          {assetTypeName(translator, assetType)}
          {' · '}
          <DueText dueIn={dueIn} />
        </p>
      </div>
      <Amount amount={entry.amount} currency={entry.currency} className="type-body-sm font-bold" />
    </li>
  );
}

/**
 * Renders the Coming Due panel.
 *
 * @param props - The report's list and the Holdings.
 * @returns The panel: its rows, placeholders while loading, or a line when nothing is due.
 */
export function ComingDue({ entries, holdings }: ComingDueProps) {
  const translator = useI18n();
  const today = useToday();
  return (
    <Card as="section" className="flex flex-col gap-2">
      <SectionHeader
        title={translator.text('comingDue', 'title')}
        hint={translator.text('comingDue', 'hint')}
      />
      {entries === undefined && (
        <SkeletonRows label={translator.text('comingDue', 'loading')} count={3} />
      )}
      {entries?.length === 0 && (
        <p className="py-2 type-body-sm text-muted">{translator.text('comingDue', 'empty')}</p>
      )}
      {entries !== undefined && entries.length > 0 && (
        <ul className="divide-y divide-line">
          {comingDueRowsOf(entries, holdings, today).map((row) => (
            <DueRow key={row.entry.holdingId} row={row} />
          ))}
        </ul>
      )}
    </Card>
  );
}
