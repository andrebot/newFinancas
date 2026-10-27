import type { Goal } from '@financas/api-types';
import { ABOVE_OPENER, OpenableCard } from '../../../../../kit/card/OpenableCard';
import { Icon } from '../../../../../kit/icons/Icon';
import { ProgressBar } from '../../../../../kit/progressBar/ProgressBar';
import { Tag } from '../../../../../kit/tag/Tag';
import type { Formatter } from '../../../../../utilities/formatting';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { Translator } from '../../../../../utilities/i18n';
import useFormatter from '../../../../../utilities/useFormatter';
import type { GoalEntry, ProgressStatus } from '../../../sharedLists';
import {
  dueInOf, pairKey, progressOf, type DueIn, type EnteredRates, type FundingRow,
  type ProgressSummary, type RatePair,
} from '../goalProgress';
import { RateField } from './RateField';

// A goal's card (FL14, mockup 43; FR-8, OQ-177, OQ-195) — the Goal Progress
// Card: its name with its visibility and currency tags, the target, the due
// date with how far off it is, the progress pill and the Holdings funding it.
// A goal funded in another currency shows each Holding's own amount, its
// estimate at the typed rate, and the rate calculator. For whoever may manage
// it the whole card opens its edit drawer, where Mark completed (or Reopen)
// and Delete live — as an account's and a budget's card do (OQ-194, OQ-195);
// the rate field sits above the card's hit area, so typing in it never opens
// the drawer. Without the progress read the card shows the definition alone.

/** How each visibility's tag looks: its tone, its icon and its label's key. */
const VISIBILITY_TAGS = {
  personal: { tone: 'neutral', icon: 'person-outline', label: 'visibility.personal' },
  shared: { tone: 'sky', icon: 'group-outline', label: 'visibility.shared' },
} as const;

/** How an active and a completed goal look: the disc, its glyph and the progress tone. */
const LOOKS = {
  active: {
    disc: 'bg-sky/15 text-sky', glyph: 'flag-outline', tone: 'sky', text: 'text-sky',
  },
  completed: {
    disc: 'bg-mint/15 text-mint', glyph: 'check-circle-outline', tone: 'mint', text: 'text-mint',
  },
} as const;

/** The disc around the card's flag. */
const DISC = 'grid size-10 shrink-0 place-items-center rounded-full';

/** One funding Holding's row. */
const FUNDING_ROW = 'flex items-center gap-2 rounded-lg bg-card px-3 py-2 type-body-sm';

/** The muted caption over each block, e.g. "Funded by". */
const BLOCK_LABEL = 'type-caption font-semibold text-muted';

/** The progress pill's two texts. */
interface ProgressTexts {
  /** Beside the "Progress" label, e.g. `32% · $6,800.00 to go`. */
  readonly headline: string;
  /** Inside the pill, e.g. `$3,200.00 / $10,000.00`. */
  readonly amounts: string;
}

/**
 * Tells how a goal looks: completed or active.
 *
 * @param goal - The goal.
 * @returns Its look.
 */
const lookOf = (goal: Goal) => (goal.completedAt === null ? LOOKS.active : LOOKS.completed);

/**
 * Writes how far off a goal is due (mockup 43): under a year in months, then
 * in years and months; this month; or overdue (a display state, OQ-177).
 *
 * @param dueIn - When the goal is due, relative to today.
 * @param translator - The texts.
 * @returns E.g. `in 5 months`, `in 2 yrs 9 mo`.
 */
export const dueTextOf = (dueIn: DueIn, translator: Translator): string => {
  if (dueIn.kind !== 'ahead') return translator.text('goalManagement', `due.${dueIn.kind}`);
  const key = dueIn.years === 0 ? 'due.months' : 'due.years';
  return translator.text('goalManagement', key, { years: dueIn.years, months: dueIn.months });
};

/**
 * Picks the headline's message: not funded yet, reached, an estimate (some of
 * it converted at a typed rate), or exact.
 *
 * @param summary - The goal's progress.
 * @returns The message's key.
 */
const headlineKeyOf = (summary: ProgressSummary) => {
  if (summary.rows.length === 0) return 'progress.unfunded';
  if (summary.toGo === 0) return 'progress.reached';
  return summary.estimate ? 'progress.toGoEstimate' : 'progress.toGo';
};

/**
 * Writes the progress pill's texts in the goal's currency.
 *
 * @param summary - The goal's progress.
 * @param goal - The goal: its target and currency.
 * @param translator - The texts.
 * @param formatter - The money's formatting.
 * @returns The headline and the amounts.
 */
export const progressTextsOf = (
  summary: ProgressSummary,
  goal: Goal,
  translator: Translator,
  formatter: Formatter,
): ProgressTexts => {
  const money = (amount: number) => formatter.money(amount, goal.targetCurrency);
  const amountsKey = summary.estimate ? 'progress.amountsEstimate' : 'progress.amounts';
  return {
    headline: translator.text('goalManagement', headlineKeyOf(summary), {
      percent: summary.percent, amount: money(summary.toGo),
    }),
    amounts: translator.text('goalManagement', amountsKey, {
      funded: money(summary.funded), target: money(goal.targetAmount),
    }),
  };
};

/**
 * Builds a card's classes: wide while it mixes currencies (mockup 43).
 *
 * @param mixed - Whether the goal mixes currencies.
 * @returns The card's layout classes.
 */
export const cardClassesOf = (mixed: boolean) => (
  mixed ? 'flex flex-col gap-4 lg:col-span-2' : 'flex flex-col gap-4'
);

/** GoalCard's props. */
export interface GoalCardProps {
  readonly entry: GoalEntry;
  /** Today, `YYYY-MM-DD`: how far off the goal is due. */
  readonly today: string;
  /** The rates typed so far (FR-9.1). */
  readonly rates: EnteredRates;
  /** How the progress read went: the card shows the definition alone without it. */
  readonly progress: ProgressStatus;
  /** Opens its edit drawer; nothing when the actor may not manage it (OQ-177). */
  readonly onOpen?: (() => void) | undefined;
  /** Gets a rate typed for a pair, or `null` once cleared. */
  readonly onRate: (pair: RatePair, rate: number | null) => void;
}

/**
 * Renders the disc before the name: a flag, or a tick once completed.
 *
 * @param props - The goal.
 * @returns The disc.
 */
function Disc({ goal }: { readonly goal: Goal }) {
  const look = lookOf(goal);
  return (
    <span className={`${DISC} ${look.disc}`}>
      <Icon name={look.glyph} />
    </span>
  );
}

/**
 * Renders the tags beside the name: visibility, currency and, when it mixes
 * currencies, mockup 43's sun tag.
 *
 * @param props - The goal and whether it mixes currencies.
 * @returns The tags.
 */
function CardTags({ goal, mixed }: { readonly goal: Goal; readonly mixed: boolean }) {
  const translator = useI18n();
  const visibilityTag = VISIBILITY_TAGS[goal.visibility];
  return (
    <span className="flex shrink-0 flex-wrap justify-end gap-1.5 pt-1">
      <Tag size="sm" tone={visibilityTag.tone} icon={visibilityTag.icon}>
        {translator.text('goalManagement', visibilityTag.label)}
      </Tag>
      <Tag size="sm">{goal.targetCurrency}</Tag>
      {mixed && (
        <Tag size="sm" tone="sun" icon="currency-exchange">
          {translator.text('goalManagement', 'card.mixed')}
        </Tag>
      )}
    </span>
  );
}

/**
 * Renders the target and the due date with how far off it is.
 *
 * @param props - The goal and today.
 * @returns The two figures.
 */
function Figures({ goal, today }: { readonly goal: Goal; readonly today: string }) {
  const translator = useI18n();
  const formatter = useFormatter();
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col">
        <span className="type-caption text-muted">
          {translator.text('goalManagement', 'card.target')}
        </span>
        <span className="type-display-sm tabular-nums">
          {formatter.money(goal.targetAmount, goal.targetCurrency)}
        </span>
      </div>
      <div className="flex flex-col text-right">
        <span className="type-caption text-muted">
          {translator.text('goalManagement', 'card.due')}
        </span>
        <span className="type-body-sm font-semibold tabular-nums">
          {formatter.date(goal.dueDate)}
        </span>
        <span className="type-caption text-faint">
          {dueTextOf(dueInOf(goal.dueDate, today), translator)}
        </span>
      </div>
    </div>
  );
}

/**
 * Renders the progress pill under its label, and the estimate's note.
 *
 * @param props - The goal and its progress.
 * @returns The progress block.
 */
function ProgressBlock({ goal, summary }: {
  readonly goal: Goal;
  readonly summary: ProgressSummary;
}) {
  const translator = useI18n();
  const formatter = useFormatter();
  const texts = progressTextsOf(summary, goal, translator, formatter);
  const look = lookOf(goal);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-2 type-caption">
        <span className="font-semibold text-muted">
          {translator.text('goalManagement', 'card.progress')}
        </span>
        <span className={`font-semibold tabular-nums ${look.text}`}>{texts.headline}</span>
      </div>
      <ProgressBar
        value={summary.percent}
        label={texts.amounts}
        tone={look.tone}
        ariaLabel={translator.text('goalManagement', 'progress.label', { name: goal.name })}
      />
      {summary.estimate && (
        <span className="type-caption text-faint">
          {translator.text('goalManagement', 'estimate.note')}
        </span>
      )}
    </div>
  );
}

/**
 * Names a funding Holding: its ticker, or a stand-in for one with none or one
 * in an Account the viewer can't see (OQ-206).
 *
 * @param row - The funding row.
 * @param translator - The translator.
 * @returns The name to show.
 */
export const fundingNameOf = (row: FundingRow, translator: Translator): string => {
  if (row.holdingId === null) return translator.text('goalManagement', 'fundedBy.personal');
  return row.name ?? translator.text('goalManagement', 'fundedBy.unnamed');
};

/** What the "Funded by" block needs. */
interface FundingBlockProps {
  readonly goal: Goal;
  readonly summary: ProgressSummary;
  readonly rates: EnteredRates;
  readonly onRate: GoalCardProps['onRate'];
}

/**
 * Renders the Holdings funding the goal — each one's own amount and, when
 * converted, its estimate — and one rate field per pair it needs, with a note
 * for each pair still without a rate.
 *
 * @param props - The goal, its progress, the rates and the rate handler.
 * @returns The "Funded by" block.
 */
function FundingBlock({
  goal, summary, rates, onRate,
}: FundingBlockProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  return (
    <div className="flex flex-col gap-2.5">
      <span className={BLOCK_LABEL}>{translator.text('goalManagement', 'card.fundedBy')}</span>
      {summary.rows.length === 0 && (
        <span className="type-body-sm text-faint">
          {translator.text('goalManagement', 'fundedBy.none')}
        </span>
      )}
      {summary.rows.map((row, index) => (
        <div key={row.holdingId ?? `hidden-${index}`} className={FUNDING_ROW}>
          <span className="min-w-0 flex-1 truncate">
            {`${fundingNameOf(row, translator)} · ${formatter.percent(row.percentage)}`}
          </span>
          {row.contribution && (
            <span className="font-semibold tabular-nums">
              {formatter.money(row.contribution.amount, row.contribution.currency)}
            </span>
          )}
          {row.converted !== undefined && (
            <span className="type-caption tabular-nums text-muted">
              {`≈ ${formatter.money(row.converted, goal.targetCurrency)}`}
            </span>
          )}
        </div>
      ))}
      {summary.pairs.map((pair) => (
        <div key={pairKey(pair)} className={ABOVE_OPENER}>
          <RateField
            pair={pair}
            value={rates[pairKey(pair)] ?? null}
            onChange={(rate) => onRate(pair, rate)}
          />
        </div>
      ))}
      {summary.missingPairs.map((pair) => (
        <span key={pairKey(pair)} className="type-caption text-sun">
          {translator.text('goalManagement', 'rate.missing', { ...pair })}
        </span>
      ))}
    </div>
  );
}

/**
 * Renders the card's body without the progress read: loading shows nothing
 * more; a failure says the progress is unavailable (OQ-195).
 *
 * @param props - How the progress read went.
 * @returns The note, if any.
 */
function NoProgress({ progress }: { readonly progress: ProgressStatus }) {
  const translator = useI18n();
  if (progress === 'loading') return null;
  return (
    <span className="flex items-center gap-1.5 type-caption text-faint">
      <Icon name="info-outline" />
      {translator.text('goalManagement', 'progress.unavailable')}
    </span>
  );
}

/**
 * Renders the card's body: the figures and the progress — beside the funding
 * on a wide, mixed-currency card — or the figures alone without progress.
 *
 * @param props - The goal, its progress if read, the read's state, the rates and the rate handler.
 * @returns The body.
 */
function CardBody({
  goal, summary, progress, rates, onRate, today,
}: Omit<FundingBlockProps, 'summary'> & {
  readonly summary?: ProgressSummary | undefined;
  readonly progress: ProgressStatus;
  readonly today: string;
}) {
  const wide = summary?.mixed ? 'lg:grid-cols-[1fr_1.1fr]' : '';
  return (
    <div className={`grid gap-6 ${wide}`}>
      <div className="flex flex-col gap-4">
        <Figures goal={goal} today={today} />
        {summary
          ? <ProgressBlock goal={goal} summary={summary} />
          : <NoProgress progress={progress} />}
      </div>
      {summary && <FundingBlock goal={goal} summary={summary} rates={rates} onRate={onRate} />}
    </div>
  );
}

/**
 * Renders a goal's card: the whole of it opens its edit drawer for whoever may
 * manage the goal (OQ-195) — a plain card for anyone else.
 *
 * @param props - The goal with its funding, today, the rates, the opener and the rate handler.
 * @returns The card.
 */
export function GoalCard({
  entry, today, rates, progress, onOpen, onRate,
}: GoalCardProps) {
  const { goal, funding } = entry;
  const summary = funding && progressOf({ ...goal, ...funding }, rates);
  const mixed = Boolean(summary?.mixed);

  return (
    <OpenableCard
      name={goal.name}
      nameClassName="font-semibold"
      leading={<Disc goal={goal} />}
      aside={<CardTags goal={goal} mixed={mixed} />}
      onOpen={onOpen}
      className={cardClassesOf(mixed)}
    >
      <CardBody
        goal={goal}
        summary={summary}
        progress={progress}
        rates={rates}
        onRate={onRate}
        today={today}
      />
    </OpenableCard>
  );
}
