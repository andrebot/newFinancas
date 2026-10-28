import { Button } from '../../../../../kit/button/Button';
import FOCUS_RING from '../../../../../kit/focusRing';
import { Icon, type IconName } from '../../../../../kit/icons/Icon';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { SetupDestination, SetupSummary } from '../guidedSetupState';

// Setup Complete Summary (FL6, mockup 14): the household is ready. A mint
// check, what was set up — accounts and cards, categories, budgets — and the
// next steps: record a transaction, invite the household, create a goal, or
// go to the Dashboard. Each emits where to go; the Experience navigates.

/** One count tile: its label's key, what it counts, its icon and its tone. */
const TILES = [
  {
    key: 'complete.accounts',
    count: 'accounts',
    icon: 'account-balance-wallet-outline',
    tone: 'bg-mint/15 text-mint',
  },
  {
    key: 'complete.categories',
    count: 'categories',
    icon: 'category-outline',
    tone: 'bg-sun/15 text-sun',
  },
  {
    key: 'complete.budgets', count: 'budgets', icon: 'donut-large', tone: 'bg-sky/15 text-sky',
  },
] as const;

/** A next step's destination and its icon. */
interface NextStep {
  readonly destination: Exclude<SetupDestination, 'dashboard'>;
  readonly icon: IconName;
}

const NEXT_STEPS: readonly NextStep[] = [
  { destination: 'transactions', icon: 'add-circle-outline' },
  { destination: 'household', icon: 'person-add-outline' },
  { destination: 'goals', icon: 'flag-outline' },
];

/** The check's halo: two soft mint rings (mockup 14). */
const HALO = [
  'grid size-20 place-items-center rounded-full bg-mint text-onmint',
  // The inner ring 10px wide, the outer one from 10px to 22px out.
  'ring-10 ring-mint/12 outline-12 outline-offset-10 outline-mint/6',
].join(' ');

const TILE = 'flex items-center gap-3 rounded-2xl border border-line bg-card p-4';

const NEXT_STEP = [
  'flex items-start gap-3 rounded-2xl border border-line bg-card p-4 text-left',
  'hover:border-mint/50',
  FOCUS_RING,
].join(' ');

/** SetupCompleteSummary's props. */
export interface SetupCompleteSummaryProps {
  /** The household's name, for the title. */
  readonly householdName: string;
  readonly summary: SetupSummary;
  /** Leaves the wizard for a destination. */
  readonly onFinish: (destination: SetupDestination) => void;
}

/**
 * Renders the summary.
 *
 * @param props - The household's name, the counts and the way out.
 * @returns The summary.
 */
export function SetupCompleteSummary({
  householdName, summary, onFinish,
}: SetupCompleteSummaryProps) {
  const translator = useI18n();
  return (
    <>
      <span
        aria-hidden
        className={HALO}
      >
        <Icon name="check" className="size-11" />
      </span>
      <div>
        <h1 className="type-display-sm">
          {translator.text('guidedSetup', 'complete.title', { household: householdName })}
        </h1>
        <p className="mt-2 text-muted">{translator.text('guidedSetup', 'complete.subtitle')}</p>
      </div>
      <ul className="grid w-full gap-3 text-left sm:grid-cols-3">
        {TILES.map((tile) => (
          <li key={tile.key} className={TILE}>
            <span className={`grid size-10 shrink-0 place-items-center rounded-full ${tile.tone}`}>
              <Icon name={tile.icon} className="size-5" />
            </span>
            <div>
              <div className="type-heading-sm num">{summary[tile.count]}</div>
              <div className="type-caption text-muted">
                {translator.text('guidedSetup', tile.key, {
                  count: summary[tile.count], cards: summary.cards,
                })}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex w-full flex-col gap-2 text-left">
        <h2 className="type-caption font-semibold uppercase tracking-wider text-muted">
          {translator.text('guidedSetup', 'complete.next')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {NEXT_STEPS.map((step) => (
            <button
              key={step.destination}
              type="button"
              className={NEXT_STEP}
              onClick={() => onFinish(step.destination)}
            >
              <Icon name={step.icon} className="mt-0.5 size-5.5 shrink-0 text-mint" />
              <span className="flex flex-1 flex-col">
                <span className="type-body-sm font-semibold">
                  {translator.text('guidedSetup', `next.${step.destination}`)}
                </span>
                <span className="mt-0.5 type-caption text-muted">
                  {translator.text('guidedSetup', `next.${step.destination}.hint`)}
                </span>
              </span>
              <Icon name="arrow-forward" className="size-4.5 shrink-0 text-faint" />
            </button>
          ))}
        </div>
      </div>
      <Button
        variant="primary"
        size="xl"
        trailingIcon="arrow-forward"
        onClick={() => onFinish('dashboard')}
      >
        {translator.text('guidedSetup', 'complete.dashboard')}
      </Button>
    </>
  );
}
