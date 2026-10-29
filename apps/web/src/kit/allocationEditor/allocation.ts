import type { ProgressSegment } from '../progressBar/ProgressBar';

// The allocation editor's sums and checks (K47, OQ-218), pure so they test
// without React. A split is a Holding's whole percents per Goal (OQ-87):
// together they may not pass 100% (FR-8.3) and each is at least 1% (the
// table's CHECK). The editor lets the total pass 100% while typing, so a
// share can be raised before another is lowered; the caller blocks the
// write with `isAllocationValid`. Only the shares the user can see are
// here — another member's personal Goals are counted by the server alone
// (OQ-178).

/** The fewest percent a Goal can hold; a share of 0 is removed instead. */
export const MIN_PERCENT = 1;

/** The whole: a Holding's shares add up to at most this. */
export const WHOLE_PERCENT = 100;

/** A Goal the Holding can be split to. */
export interface AllocationGoal {
  readonly id: string;
  /** The Goal's name, as the user wrote it. */
  readonly name: string;
  /** How far along the Goal is, in percent; draws its ring when given. */
  readonly progress?: number | undefined;
}

/** One Goal's share of the split. */
export interface AllocationRow {
  readonly goalId: string;
  readonly name: string;
  /** The whole percent, or `null` while the box is empty. */
  readonly percent: number | null;
  /** How far along the Goal is, in percent; draws its ring when given. */
  readonly progress?: number | undefined;
  /** A completed Goal's share can be kept or removed, never changed (FR-8.9). */
  readonly completed?: boolean | undefined;
}

/**
 * Adds up the split's shares; an empty box counts as nothing.
 *
 * @param rows - The split.
 * @returns The total, in whole percent; it may pass 100.
 */
export const allocatedTotal = (rows: readonly AllocationRow[]) => rows.reduce(
  (total, row) => total + (row.percent ?? 0),
  0,
);

/**
 * Tells whether a share is missing or below the least a Goal can hold.
 *
 * @param row - One Goal's share.
 * @returns Whether its box needs a number from 1 up.
 */
export const isShareMissing = (row: AllocationRow) => (
  row.percent === null || row.percent < MIN_PERCENT
);

/**
 * Tells whether the split can be written: every share at least 1% and the
 * total at most 100%. An empty split is valid (allocation is optional).
 *
 * @param rows - The split.
 * @returns Whether the caller may send it.
 */
export const isAllocationValid = (rows: readonly AllocationRow[]) => (
  !rows.some(isShareMissing) && allocatedTotal(rows) <= WHOLE_PERCENT
);

/**
 * Lists the Goals not yet in the split, in the caller's order.
 *
 * @param goals - Every Goal that can take a share (active ones).
 * @param rows - The split.
 * @returns The Goals the user may still add.
 */
export const addableGoals = (
  goals: readonly AllocationGoal[],
  rows: readonly AllocationRow[],
) => {
  const taken = new Set(rows.map((row) => row.goalId));
  return goals.filter((goal) => !taken.has(goal.id));
};

/**
 * Builds the total bar's segments: one per Goal, in sky and its softer shade
 * by turns (mockup 32), an empty box drawing nothing.
 *
 * @param rows - The split.
 * @returns The thin bar's segments.
 */
export const segmentsOf = (rows: readonly AllocationRow[]): ProgressSegment[] => rows.map(
  (row, index) => ({ value: row.percent ?? 0, tone: index % 2 === 0 ? 'sky' : 'skysoft' }),
);

/**
 * Turns a Goal into a new, empty share of the split.
 *
 * @param goal - The Goal picked.
 * @returns Its row, with no percent yet.
 */
export const rowOf = (goal: AllocationGoal): AllocationRow => ({
  goalId: goal.id, name: goal.name, percent: null, progress: goal.progress,
});
