import {
  useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type RefObject,
} from 'react';
import useFormatter from '../../utilities/useFormatter';
import { useI18n } from '../../utilities/I18nProvider';
import { IconButton } from '../button/IconButton';
import { Icon } from '../icons/Icon';
import { Menu, type MenuTriggerProps } from '../menu/Menu';
import { NumberInput } from '../numberInput/NumberInput';
import { ProgressBar } from '../progressBar/ProgressBar';
import { ProgressRing } from '../progressRing/ProgressRing';
import { Tag } from '../tag/Tag';
import {
  WHOLE_PERCENT, addableGoals, allocatedTotal, isShareMissing, rowOf, segmentsOf,
  type AllocationGoal, type AllocationRow,
} from './allocation';

// The kit's allocation editor (K47, OQ-218): a Holding's split over Goals,
// in whole percents — the buy drawer's "Assign to Goals" (mockup 32) and
// Holding Maintenance's "Counts toward goals" (mockup 51), one component.
// Each Goal is a row with its percent box and a remove button; "Add goal"
// opens the Goals not yet in the split (or adds the last one directly); a
// thin bar sums it up. The total may pass 100% while typing and turns coral;
// the caller blocks the write (`isAllocationValid`) and owns the frame — the
// heading, Reset / Save. A completed Goal's share is shown, not edited.

export {
  allocatedTotal, isAllocationValid, type AllocationGoal, type AllocationRow,
} from './allocation';

/** The allocation editor's props. */
export interface AllocationEditorProps {
  /** The split, in display order. */
  readonly rows: readonly AllocationRow[];
  /** Every Goal that can take a share (active ones); those in `rows` are left out of "Add goal". */
  readonly goals: readonly AllocationGoal[];
  /** Gets the whole new split. */
  readonly onChange: (rows: AllocationRow[]) => void;
  /** Shows each empty or 0% share's error, e.g. once the user tried to save. */
  readonly showErrors?: boolean | undefined;
}

/**
 * Where focus goes after the split changed: a share's box, or the editor
 * after a removal. A new object each time, so the same target twice in a
 * row still moves focus.
 */
type FocusTarget = { readonly goalId: string } | { readonly editor: true } | null;

/** The dashed button that adds a Goal (mockups 32 and 51). */
const ADD_BUTTON = [
  'flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed',
  'border-line type-body-sm text-muted outline-none transition-colors duration-150',
  'hover:border-mint/50 hover:text-mint aria-expanded:border-mint/50 aria-expanded:text-mint',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint',
].join(' ');

/** The total's text beside the bar. */
const TOTAL_TEXT = 'type-caption tabular-nums';

/** One Goal's row: a raised strip. */
const ROW = 'flex items-center gap-3 rounded-xl bg-raised px-3 py-2';

/**
 * Builds the id of a share's percent box, so focus can be sent to it.
 *
 * @param editorId - The editor's own id.
 * @param goalId - The share's Goal.
 * @returns The box's id.
 */
export const boxIdOf = (editorId: string, goalId: string) => `${editorId}-${goalId}`;

/**
 * Sends focus where the last change asked, a frame later, so the box it
 * names exists and a closing menu has handed focus back first.
 *
 * @param target - Where focus goes, or `null` for nowhere.
 * @param editorId - The editor's id, which its boxes' ids start with.
 * @param editorRef - The editor's element, focused after a removal.
 */
const useFocusAfterChange = (
  target: FocusTarget,
  editorId: string,
  editorRef: RefObject<HTMLElement | null>,
) => {
  useEffect(() => {
    if (target === null) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      const element = 'editor' in target
        ? editorRef.current
        : document.getElementById(boxIdOf(editorId, target.goalId));
      element?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [target, editorId, editorRef]);
};

/** A share row's props. */
interface ShareRowProps {
  readonly row: AllocationRow;
  readonly boxId: string;
  readonly showError: boolean;
  readonly onPercent: (percent: number | null) => void;
  readonly onRemove: () => void;
}

/**
 * Renders the share's percent: the box, or a completed Goal's fixed figure.
 *
 * @param props - The row, the box's id, whether it errs and the change handler.
 * @returns The box or the figure.
 */
function SharePercent({
  row, boxId, showError, onPercent,
}: Omit<ShareRowProps, 'onRemove'>) {
  const translator = useI18n();
  const formatter = useFormatter();
  if (row.completed) {
    return (
      <span className="type-body-sm font-medium tabular-nums">
        {formatter.percent(row.percent ?? 0)}
      </span>
    );
  }
  return (
    <NumberInput
      id={boxId}
      size="compact"
      kind="percent"
      label={translator.text('allocationEditor', 'percentOf', { goal: row.name })}
      value={row.percent}
      onChange={onPercent}
      aria-invalid={showError || undefined}
      aria-describedby={showError ? `${boxId}-error` : undefined}
    />
  );
}

/**
 * Renders one Goal's share: its ring (when the caller knows its progress),
 * its name — with "Completed" for a completed Goal — its percent and its
 * remove button; the share's error under the name.
 *
 * @param props - The row, the box's id, whether it errs and its handlers.
 * @returns The row.
 */
function ShareRow({
  row, boxId, showError, onPercent, onRemove,
}: ShareRowProps) {
  const translator = useI18n();

  return (
    <li className={ROW}>
      {row.progress !== undefined && (
        <ProgressRing
          value={row.progress}
          tone={row.progress >= WHOLE_PERCENT ? 'mint' : 'sky'}
          size="xs"
          ariaLabel={translator.text('allocationEditor', 'progressOf', { goal: row.name })}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate type-body-sm font-medium">{row.name}</span>
          {row.completed && (
            <Tag size="sm" tone="mint">{translator.text('allocationEditor', 'completed')}</Tag>
          )}
        </span>
        {showError && (
          <span id={`${boxId}-error`} className="type-caption text-coral">
            {translator.text('allocationEditor', 'percentMissing')}
          </span>
        )}
      </div>
      <SharePercent row={row} boxId={boxId} showError={showError} onPercent={onPercent} />
      <IconButton
        icon="close"
        size="sm"
        label={translator.text('allocationEditor', 'remove', { goal: row.name })}
        onClick={onRemove}
      />
    </li>
  );
}

/** The add button's props: what it says, plus the native ones a Menu spreads on it. */
type AddButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
  readonly text: string;
};

/**
 * Renders the dashed "Add goal" button.
 *
 * @param props - Its text and native props.
 * @returns The button.
 */
function AddButton({ text, ...native }: AddButtonProps) {
  return (
    <button type="button" {...native} className={ADD_BUTTON}>
      <Icon name="add" className="size-4 shrink-0" />
      <span className="truncate">{text}</span>
    </button>
  );
}

/**
 * Builds the trigger of the Goals menu: the dashed button.
 *
 * @param text - What it says, already translated.
 * @returns The trigger render prop.
 */
const addTrigger = (text: string) => function AddTrigger(props: MenuTriggerProps) {
  return <AddButton {...props} text={text} />;
};

/** The add control's props. */
interface AddGoalProps {
  /** The Goals not yet in the split. */
  readonly goals: readonly AllocationGoal[];
  readonly onAdd: (goal: AllocationGoal) => void;
}

/**
 * Renders the way to add a Goal: nothing when none is left, a button naming
 * the last one (mockup 32), or a button opening a menu of the rest.
 *
 * @param props - The Goals left and the add handler.
 * @returns The add control, or nothing.
 */
function AddGoal({ goals, onAdd }: AddGoalProps) {
  const translator = useI18n();
  const [only] = goals;
  if (only === undefined) {
    return null;
  }
  if (goals.length === 1) {
    return (
      <AddButton
        text={translator.text('allocationEditor', 'addNamed', { goal: only.name })}
        onClick={() => onAdd(only)}
      />
    );
  }
  return (
    <Menu
      label={translator.text('allocationEditor', 'goals')}
      placement="bottom-start"
      entries={goals.map((goal) => ({
        kind: 'action', id: goal.id, label: goal.name, onSelect: () => onAdd(goal),
      }))}
      trigger={addTrigger(translator.text('allocationEditor', 'add'))}
    />
  );
}

/**
 * Renders the total: the thin bar, one segment per Goal, and "85% allocated
 * · 15% free" beside it — coral, "· 10% over", once it passes 100%. The
 * text is a polite live region, so a screen reader hears the sum change.
 *
 * @param props - The split.
 * @returns The total line.
 */
function AllocationTotal({ rows }: { readonly rows: readonly AllocationRow[] }) {
  const translator = useI18n();
  const formatter = useFormatter();
  const total = allocatedTotal(rows);
  const over = total > WHOLE_PERCENT;
  const rest = formatter.percent(Math.abs(WHOLE_PERCENT - total));
  const tail = translator.text('allocationEditor', over ? 'over' : 'free', { percent: rest });

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <ProgressBar
          size="thin"
          segments={segmentsOf(rows)}
          ariaLabel={translator.text('allocationEditor', 'allocated')}
          ariaValueText={`${formatter.percent(total)} ${tail}`}
        />
      </div>
      <p aria-live="polite" className={over ? `${TOTAL_TEXT} text-coral` : TOTAL_TEXT}>
        <span className="font-semibold">{formatter.percent(total)}</span>
        {' '}
        <span className={over ? undefined : 'text-muted'}>{tail}</span>
      </p>
    </div>
  );
}

/**
 * Renders the allocation editor. The caller holds the split: each change
 * hands `onChange` the whole new one. Adding a Goal appends its share, empty,
 * and focuses its box; removing one sends focus to the editor.
 *
 * @param props - The split, the Goals, the change handler and whether errors show.
 * @returns The editor.
 */
export function AllocationEditor({
  rows, goals, onChange, showErrors = false,
}: AllocationEditorProps) {
  const editorId = useId();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
  useFocusAfterChange(focusTarget, editorId, editorRef);

  const replace = (goalId: string, percent: number | null) => onChange(
    rows.map((row) => (row.goalId === goalId ? { ...row, percent } : row)),
  );
  const remove = (goalId: string) => {
    setFocusTarget({ editor: true });
    onChange(rows.filter((row) => row.goalId !== goalId));
  };
  const add = (goal: AllocationGoal) => {
    setFocusTarget({ goalId: goal.id });
    onChange([...rows, rowOf(goal)]);
  };

  return (
    <div ref={editorRef} tabIndex={-1} className="flex flex-col gap-3 outline-none">
      <div className="flex flex-col gap-2">
        {rows.length > 0 && (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <ShareRow
                key={row.goalId}
                row={row}
                boxId={boxIdOf(editorId, row.goalId)}
                showError={showErrors && !row.completed && isShareMissing(row)}
                onPercent={(percent) => replace(row.goalId, percent)}
                onRemove={() => remove(row.goalId)}
              />
            ))}
          </ul>
        )}
        <AddGoal goals={addableGoals(goals, rows)} onAdd={add} />
      </div>
      <AllocationTotal rows={rows} />
    </div>
  );
}
