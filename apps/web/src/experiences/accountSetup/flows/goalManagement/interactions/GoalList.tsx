import type { Goal } from '@financas/api-types';
import { EmptyState } from '../../../../../kit/emptyState/EmptyState';
import { SegmentedControl } from '../../../../../kit/segmentedControl/SegmentedControl';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { GoalEntry, ProgressStatus } from '../../../sharedLists';
import type { GoalStatus } from '../goalManagementState';
import type { EnteredRates, RatePair } from '../goalProgress';
import { GoalCard } from './GoalCard';

// The household's goals as mockup 43 draws them: the Active / Completed switch
// with each list's count, then that list's cards (soonest due first, as the
// read orders them) or its empty state. A card the actor may manage opens its
// edit drawer (OQ-195). It renders display state and emits the cards' events
// up with their goal; the Flow decides.

const STATUSES: readonly GoalStatus[] = ['active', 'completed'];

/** GoalList's props. */
export interface GoalListProps {
  readonly status: GoalStatus;
  /** How many goals each status holds. */
  readonly counts: Readonly<Record<GoalStatus, number>>;
  /** The shown status's goals. */
  readonly entries: readonly GoalEntry[];
  readonly today: string;
  readonly rates: EnteredRates;
  readonly progress: ProgressStatus;
  /** Tells whether the actor may manage one goal (OQ-177). */
  readonly isManageable: (goal: Goal) => boolean;
  readonly onStatus: (status: GoalStatus) => void;
  /** Opens a goal's edit drawer. */
  readonly onEdit: (goalId: string) => void;
  readonly onRate: (pair: RatePair, rate: number | null) => void;
}

/**
 * Renders the status switch and the shown list's cards, or its empty state.
 *
 * @param props - The status, the counts, the goals, the shared card state and the handlers.
 * @returns The list.
 */
export function GoalList({
  status, counts, entries, today, rates, progress, isManageable, onStatus, onEdit, onRate,
}: GoalListProps) {
  const translator = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        size="sm"
        label={translator.text('goalManagement', 'status.label')}
        options={STATUSES.map((value) => ({
          value, label: translator.text('goalManagement', `status.${value}`), count: counts[value],
        }))}
        value={status}
        onChange={onStatus}
      />
      {entries.length === 0 ? (
        <EmptyState
          icon="flag-outline"
          title={translator.text('goalManagement', `list.empty.${status}`)}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {entries.map((entry) => (
            <GoalCard
              key={entry.goal.id}
              entry={entry}
              today={today}
              rates={rates}
              progress={progress}
              onOpen={isManageable(entry.goal) ? () => onEdit(entry.goal.id) : undefined}
              onRate={onRate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
