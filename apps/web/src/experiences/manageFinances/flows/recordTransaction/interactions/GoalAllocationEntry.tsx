import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { AllocationEditor } from '../../../../../kit/allocationEditor/AllocationEditor';
import type { AllocationGoal, AllocationRow } from '../../../../../kit/allocationEditor/allocation';
import { Button } from '../../../../../kit/button/Button';
import { Skeleton } from '../../../../../kit/skeleton/Skeleton';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { Load } from '../recordTransactionState';
import { recordText } from '../recordText';

// Goal Allocation Entry (FL15, mockup 32; FR-8.2, OQ-54, OQ-206, OQ-218): how
// much of a trade counts toward each Goal, in whole percents, at most 100% in
// all. A buy splits its purchase; a sell or redemption carries its Holding's
// split, pre-filled once read and editable — left as read, the server keeps it.
// The rows and the total are the allocation editor's (K47); this frames it
// with mockup 32's heading and note. It renders and emits; the Flow holds the split.

/** GoalAllocationEntry's props. */
export interface GoalAllocationEntryProps {
  /** A buy's split is its own; a sell's or redemption's its Holding's. */
  readonly source: 'purchase' | 'holding';
  readonly rows: readonly AllocationRow[];
  /** The active Goals, which may take a share. */
  readonly goals: readonly AllocationGoal[];
  /** A sell's split read: the editor shows once it is loaded. */
  readonly load?: Load<null> | undefined;
  /** Shows each empty share's error, once Record was tried. */
  readonly showErrors: boolean;
  /** The split's refusal, already translated. */
  readonly error?: string | undefined;
  readonly onChange: (rows: AllocationRow[]) => void;
  /** Asks for the Holding's split again after a failed read. */
  readonly onRetry: () => void;
}

/**
 * Renders the split itself: the editor, or — while a Holding's split is read —
 * a placeholder, or its failure with Try again.
 *
 * @param props - The read, the rows, the Goals, whether errors show and the handlers.
 * @returns The split's body.
 */
function SplitBody({
  load, rows, goals, showErrors, onChange, onRetry,
}: Omit<GoalAllocationEntryProps, 'source' | 'error'>) {
  const translator = useI18n();
  if (load?.status === 'loading') return <Skeleton className="h-14 w-full rounded-2xl" />;
  if (load?.status === 'failed') {
    return (
      <InlineBanner
        tone="error"
        message={recordText(translator, 'goals.failed')}
        action={(
          <Button variant="ghost" onClick={onRetry}>
            {recordText(translator, 'retry')}
          </Button>
        )}
      />
    );
  }
  return <AllocationEditor rows={rows} goals={goals} onChange={onChange} showErrors={showErrors} />;
}

/**
 * Tells whether the split section has nothing to show: no Goal could take a
 * share, and no read is under way or offering Try again.
 *
 * @param body - The rows, the Goals and the read.
 * @returns Whether to leave the section out.
 */
const isEmptySplit = ({
  goals, rows, load,
}: Pick<GoalAllocationEntryProps, 'goals' | 'rows' | 'load'>) => {
  const reading = load?.status === 'loading' || load?.status === 'failed';
  return goals.length === 0 && rows.length === 0 && !reading;
};

/**
 * Renders the split under its heading and note, with its refusal below.
 *
 * @param props - Where the split comes from, its rows, the Goals, the read,
 *   the errors and the handlers.
 * @returns The section, or nothing when no Goal could take a share — unless
 *   the split is being read, or its read failed and offers Try again.
 */
export function GoalAllocationEntry({ source, error, ...body }: GoalAllocationEntryProps) {
  const translator = useI18n();
  if (isEmptySplit(body)) return null;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <span className="type-caption font-semibold text-muted">
          {recordText(translator, 'goals.title')}
          {' '}
          <span className="font-normal">{recordText(translator, 'goals.optional')}</span>
        </span>
        <p className="type-caption text-muted">
          {recordText(translator, `goals.hint.${source}`)}
        </p>
      </div>
      <SplitBody {...body} />
      {error && <span className="type-caption font-medium text-coral">{error}</span>}
    </section>
  );
}
