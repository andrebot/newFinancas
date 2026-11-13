import type { HoldingAllocation } from '@financas/api-types';
import { useRef, useState } from 'react';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { AllocationEditor } from '../../../../../kit/allocationEditor/AllocationEditor';
import { isAllocationValid, type AllocationRow } from '../../../../../kit/allocationEditor/allocation';
import { Button } from '../../../../../kit/button/Button';
import type { HistoryOutcome } from '../../../../../kit/historyEditor/historyModel';
import { SkeletonRows } from '../../../../../kit/skeleton/Skeleton';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { SourceState } from '../../../../../utilities/sourceState';
import useFocusFirstInvalid from '../../../../../utilities/useFocusFirstInvalid';
import useFormatter from '../../../../../utilities/useFormatter';
import {
  allocationRowsOf, allocationsOf, isSplitChanged, type HoldingGoal,
} from '../holdingMaintenance';
import { DetailCard } from './DetailCard';

// Goal Allocation Editor (FL19; mockup 51; FR-8.2, FR-8.3, FR-8.9, OQ-178,
// OQ-218, OQ-234): the Holding's split over the Goals this user can see, on
// K47 — whole percents, a completed Goal's share kept or removed, "Add goal"
// among the active ones — with Reset and Save. The edit is held here until
// the saved split comes back from the refetch, so the card doesn't flicker
// back to the old one; Save sends only a split K47 calls valid, else shows
// its errors. Read-only, it lists the shares. The caller runs the request.

/** Goal Allocation Editor's props. */
export interface GoalAllocationCardProps {
  /** The split over the Goals this user can see. */
  readonly read: SourceState<readonly HoldingAllocation[]>;
  /** The Goals the user can see, completed ones included. */
  readonly goals: readonly HoldingGoal[];
  /** No editing: an archived Holding, or a user who may not change it. */
  readonly readOnly: boolean;
  /** Saves the whole split. */
  readonly onSave: (allocations: HoldingAllocation[]) => Promise<HistoryOutcome>;
}

/** A line in place of the split. */
const NOTE = 'type-body-sm text-muted';

/** An edit, and the split it was made on: a new read ends it. */
interface Draft {
  readonly basis: readonly HoldingAllocation[];
  readonly rows: readonly AllocationRow[];
}

/**
 * Lists the shares, read-only.
 *
 * @param props - The split's rows.
 * @returns The list.
 */
function ShareList({ rows }: { readonly rows: readonly AllocationRow[] }) {
  const formatter = useFormatter();
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.goalId} className="flex items-center gap-3 rounded-xl bg-raised px-3 py-2">
          <span className="flex-1 truncate type-body-sm font-medium">{row.name}</span>
          <span className="type-body-sm tabular-nums text-muted">
            {formatter.percent(row.percent ?? 0)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Draws the editor with Reset and Save.
 *
 * @param props - The split as read, the Goals and the save.
 * @returns The editor.
 */
function SplitEditor({ data, goals, onSave }: Omit<GoalAllocationCardProps, 'read' | 'readOnly'> & {
  readonly data: readonly HoldingAllocation[];
}) {
  const translator = useI18n();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  // The split a save succeeded on: Save waits until the refetch replaces it,
  // so a second click can't resend it (review round 1).
  const [savedOn, setSavedOn] = useState<readonly HoldingAllocation[] | null>(null);
  // Problems show once Save was refused; each refusal moves the focus to the first (OQ-192).
  const [refusals, setRefusals] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  useFocusFirstInvalid(refusals, editorRef);
  const waiting = busy || savedOn === data;
  const saved = allocationRowsOf(data, goals);
  const rows = draft?.basis === data ? draft.rows : saved;
  const changed = isSplitChanged(rows, saved);

  /** Sends the split when K47 calls it valid; otherwise shows why not. */
  const save = async () => {
    if (!isAllocationValid(rows)) {
      setRefusals((count) => count + 1);
      return;
    }
    setBusy(true);
    const outcome = await onSave(allocationsOf(rows)).catch(() => 'refused');
    setBusy(false);
    if (outcome === 'done') {
      setRefusals(0);
      setSavedOn(data);
    }
  };

  return (
    <>
      {/* `contents`: the scope of the focus, adding no box to the card's layout. */}
      <div ref={editorRef} className="contents">
        <AllocationEditor
          rows={rows}
          goals={goals.filter((goal) => !goal.completed)}
          showErrors={refusals > 0}
          onChange={(next) => setDraft({ basis: data, rows: next })}
        />
      </div>
      <div className="mt-auto flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={!changed || waiting}
          onClick={() => {
            setDraft(null);
            setRefusals(0);
          }}
        >
          {translator.text('holdingMaintenance', 'goals.reset')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!changed}
          busy={waiting}
          onClick={() => {
            save();
          }}
        >
          {translator.text('holdingMaintenance', 'goals.save')}
        </Button>
      </div>
    </>
  );
}

/**
 * Draws the card's content for its read: placeholders, the failure, the
 * read-only list or the editor.
 *
 * @param props - The card's props.
 * @returns The content.
 */
function SplitContent({
  read, goals, readOnly, onSave,
}: GoalAllocationCardProps) {
  const translator = useI18n();
  const say = (key: 'goals.loading' | 'goals.none' | 'goals.empty') => (
    translator.text('holdingMaintenance', key)
  );
  if (read.status === 'loading') {
    return <SkeletonRows label={say('goals.loading')} count={2} />;
  }
  if (read.status === 'failed') {
    return (
      <InlineBanner
        tone="error"
        message={translator.text('holdingMaintenance', 'details.failed')}
        action={(
          <Button variant="ghost" onClick={read.retry}>
            {translator.text('holdingMaintenance', 'retry')}
          </Button>
        )}
      />
    );
  }
  if (readOnly) {
    const rows = allocationRowsOf(read.data, goals);
    if (rows.length === 0) return <p className={NOTE}>{say('goals.empty')}</p>;
    return <ShareList rows={rows} />;
  }
  if (goals.length === 0 && read.data.length === 0) {
    return <p className={NOTE}>{say('goals.none')}</p>;
  }
  return <SplitEditor data={read.data} goals={goals} onSave={onSave} />;
}

/**
 * Renders the Holding's split over the Goals.
 *
 * @param props - The split read, the Goals, whether it can change, and the save.
 * @returns The card.
 */
export function GoalAllocationCard({
  read, goals, readOnly, onSave,
}: GoalAllocationCardProps) {
  const translator = useI18n();
  return (
    <DetailCard
      icon="flag-outline"
      title={translator.text('holdingMaintenance', 'goals.title')}
      mode={readOnly ? 'readOnly' : 'editable'}
    >
      <SplitContent read={read} goals={goals} readOnly={readOnly} onSave={onSave} />
    </DetailCard>
  );
}
