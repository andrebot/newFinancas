import { useEffect, useRef, type ReactNode } from 'react';
import { ratesMaintenance as settings } from '../../../../../config/constants';
import { Button } from '../../../../../kit/button/Button';
import { Card } from '../../../../../kit/card/Card';
import { chartPointsOf, type HistoryEntry } from '../../../../../kit/historyEditor/historyModel';
import { LineChart, type LineTone } from '../../../../../kit/lineChart/LineChart';
import { Tag } from '../../../../../kit/tag/Tag';
import { useI18n } from '../../../../../utilities/I18nProvider';
import useFormatter from '../../../../../utilities/useFormatter';
import { chartWindowOf, latestChangeOf } from '../ratesMaintenance';

// Rate Card (FL20; mockup 53; FR-11.6, OQ-235): one index — its name and what
// it measures, its latest value with its unit, the day it is for and the
// change it made, its last months as a line with their range, and the
// Holdings it is projected into. Update opens the caller's form in the
// buttons' place; History asks for the drawer ("View history" where it only
// reads). An index with no value yet says so. Display only: the caller holds
// which form is open and runs every request.

/** A Holding an index is projected into, as its chip names it. */
export interface UsedHolding {
  readonly id: string;
  /** Its ticker or identifier, e.g. "Tesouro Selic 2029". */
  readonly name: string;
}

/** Rate Card's props. */
export interface RateCardProps {
  /** The index's name, e.g. "Selic". */
  readonly name: string;
  /** What it measures, e.g. "Brazil's policy rate". */
  readonly about: string;
  /** Its unit after the value, already translated, e.g. "a year". */
  readonly unit: string;
  readonly tone: LineTone;
  /** Its saved values, newest first, as the API sends them. */
  readonly entries: readonly HistoryEntry[];
  /** The Holdings it is projected into; unknown while they load. */
  readonly usedBy: readonly UsedHolding[] | undefined;
  /** Whether Update shows: anyone but a Viewer (OQ-178). */
  readonly mayRecord: boolean;
  /** Whether the drawer only reads: History reads "View history". */
  readonly historyReadOnly: boolean;
  /** The open Update form, in the buttons' place; none while closed. */
  readonly updateForm?: ReactNode;
  readonly onUpdate: () => void;
  readonly onOpenHistory: () => void;
}

/** The index's dot, by its colour (static, so Tailwind keeps them). */
const DOTS: Record<LineTone, string> = {
  sky: 'bg-sky', mint: 'bg-mint', sun: 'bg-sun', lilac: 'bg-lilac',
};

/**
 * Tells whether nothing holds the focus: the element that held it was removed,
 * as the form's own buttons are when it closes.
 *
 * @returns `true` when the focus fell back to the page.
 */
const isFocusLost = () => (
  document.activeElement === null || document.activeElement === document.body
);

/**
 * Writes the line under the value: the day it is for and the change it
 * made, "as of 09/30/2026 · +0.18 pp vs Aug".
 *
 * @param props - The values, newest first.
 * @returns The line.
 */
function LatestLine({ entries }: { readonly entries: readonly HistoryEntry[] }) {
  const translator = useI18n();
  const formatter = useFormatter();
  const [latest] = entries;
  if (!latest) return null;
  const change = latestChangeOf(entries);
  const parts = [
    translator.text('ratesMaintenance', 'asOf', { date: formatter.date(latest.date) }),
  ];
  if (change?.points === 0) parts.push(translator.text('ratesMaintenance', 'unchanged'));
  else if (change) {
    parts.push(translator.text('ratesMaintenance', 'change', {
      points: formatter.ratePoints(change.points),
      when: formatter.date(change.previousDate, change.style),
    }));
  }
  return <p className="type-caption text-muted tabular-nums">{parts.join(' · ')}</p>;
}

/**
 * Draws the card's heading: the dot, the name and what it measures, then
 * the latest value with its unit and its line.
 *
 * @param props - The card's texts, colour and values.
 * @returns The header.
 */
function RateHeader({
  name, about, unit, tone, entries,
}: Pick<RateCardProps, 'name' | 'about' | 'unit' | 'tone' | 'entries'>) {
  const translator = useI18n();
  const formatter = useFormatter();
  const [latest] = entries;
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="flex items-center gap-2 type-heading-sm">
          <span aria-hidden="true" className={`size-2.5 rounded-full ${DOTS[tone]}`} />
          {name}
        </h2>
        <p className="type-caption text-muted">{about}</p>
      </div>
      <div className="flex flex-col items-end gap-0.5 text-right">
        {latest ? (
          <p className="flex items-baseline gap-1.5">
            <span className="type-heading-lg tabular-nums">{formatter.rate(latest.value)}</span>
            <span className="type-body-sm text-muted">{unit}</span>
          </p>
        ) : (
          <p className="type-body-sm text-muted">{translator.text('ratesMaintenance', 'none')}</p>
        )}
        <LatestLine entries={entries} />
      </div>
    </header>
  );
}

/**
 * Lists the Holdings the index is projected into, or that none is.
 *
 * @param props - The Holdings; two contracts of one title are two chips.
 * @returns The row.
 */
function UsedBy({ holdings }: { readonly holdings: readonly UsedHolding[] }) {
  const translator = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="type-label text-muted">{translator.text('ratesMaintenance', 'usedBy')}</span>
      {holdings.length === 0 ? (
        <span className="type-caption text-muted">
          {translator.text('ratesMaintenance', 'unused')}
        </span>
      ) : (
        <ul className="contents">
          {holdings.map((holding) => (
            <li key={holding.id}><Tag size="sm">{holding.name}</Tag></li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Renders one index's card.
 *
 * @param props - The index's texts, colour, values and Holdings, what the
 *   viewer may do, the open form and the handlers.
 * @returns The card.
 */
export function RateCard({
  name, about, unit, tone, entries, usedBy, mayRecord, historyReadOnly, updateForm, onUpdate,
  onOpenHistory,
}: RateCardProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  const updateRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const formOpen = updateForm !== undefined;
  const shown = chartWindowOf(entries, settings.chartMonths);

  useEffect(() => {
    // A closed form hands focus back to Update, which takes its place again —
    // only when the focus went with it, not when another card's form took it.
    if (wasOpen.current && !formOpen && isFocusLost()) updateRef.current?.focus();
    wasOpen.current = formOpen;
  }, [formOpen]);

  return (
    <Card as="article" className="@container flex min-w-0 flex-col gap-4">
      <RateHeader
        name={name}
        about={about}
        unit={unit}
        tone={tone}
        entries={entries}
      />
      {shown.length > 0 && (
        <LineChart
          points={chartPointsOf(shown, { kind: 'rate' }, formatter)}
          ariaLabel={translator.text('ratesMaintenance', 'chart', { index: name })}
          tone={tone}
          shape="history"
          showRange
          grid
          heightPx={settings.chartHeightPx}
        />
      )}
      {usedBy && <UsedBy holdings={usedBy} />}
      {updateForm ?? (
        <div className="flex flex-wrap gap-2">
          {mayRecord && (
            <Button
              ref={updateRef}
              variant="tonal"
              size="sm"
              leadingIcon="edit-outline"
              onClick={onUpdate}
            >
              {translator.text('ratesMaintenance', 'update')}
            </Button>
          )}
          <Button variant="secondary" size="sm" leadingIcon="history" onClick={onOpenHistory}>
            {translator.text('ratesMaintenance', historyReadOnly ? 'viewHistory' : 'history')}
          </Button>
        </div>
      )}
    </Card>
  );
}
