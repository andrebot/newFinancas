import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  AllocationEditor, isAllocationValid, type AllocationGoal, type AllocationRow,
} from '../../../src/kit/allocationEditor/AllocationEditor';
import { Button } from '../../../src/kit/button/Button';
import { Icon } from '../../../src/kit/icons/Icon';

// The allocation editor (K47, OQ-218): a Holding's split over Goals, in
// whole percents. The frame is the caller's — here the buy drawer's "Assign
// to Goals" section (mockup 32, rings on) and Holding Maintenance's "Counts
// toward goals" card with Reset / Save (mockup 51, no rings), Save refused
// while the split can't be written.

const GOALS: readonly AllocationGoal[] = [
  { id: 'house', name: 'House Down Payment', progress: 57 },
  { id: 'fund', name: 'Emergency Fund', progress: 32 },
  { id: 'laptop', name: 'New Laptop Fund', progress: 100 },
  { id: 'car', name: 'New Car', progress: 8 },
];

const SPLIT: readonly AllocationRow[] = [
  {
    goalId: 'house', name: 'House Down Payment', percent: 60, progress: 57,
  },
  {
    goalId: 'fund', name: 'Emergency Fund', percent: 25, progress: 32,
  },
];

/** The story's props: where the split starts, which Goals can be added and the frame. */
interface SplitProps {
  readonly initial: readonly AllocationRow[];
  readonly goals: readonly AllocationGoal[];
  /** `drawer` (mockup 32) or `card` (mockup 51). */
  readonly frame: 'drawer' | 'card';
}

/**
 * Holds a split as Record Transaction or Holding Maintenance would.
 *
 * @param props - The first split, the Goals and the frame.
 * @returns The editor in its frame.
 */
function Split({ initial, goals, frame }: SplitProps) {
  const [rows, setRows] = useState(initial);
  const [tried, setTried] = useState(false);
  const shown = frame === 'card'
    ? rows.map(({ progress: _, ...row }) => row)
    : rows;
  const editor = (
    <AllocationEditor
      rows={shown}
      goals={frame === 'card' ? goals.map(({ progress: _, ...goal }) => goal) : goals}
      onChange={setRows}
      showErrors={tried}
    />
  );

  if (frame === 'drawer') {
    return (
      <section className="flex max-w-md flex-col gap-3 rounded-2xl border border-line p-4">
        <div>
          <h3 className="flex items-center gap-2 type-body-sm font-semibold">
            <Icon name="flag-outline" className="size-4.5 text-muted" />
            Assign to Goals
          </h3>
          <p className="mt-1 type-caption text-muted">
            How much of this purchase counts toward each goal. Can&apos;t exceed 100% in total.
          </p>
        </div>
        {editor}
      </section>
    );
  }
  return (
    <section className="flex max-w-md flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h3 className="flex items-center gap-2 type-body-sm font-semibold">
        <Icon name="flag-outline" className="size-4.5 text-muted" />
        Counts toward goals
      </h3>
      {editor}
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setRows(initial);
            setTried(false);
          }}
        >
          Reset
        </Button>
        <Button variant="primary" size="sm" onClick={() => setTried(!isAllocationValid(rows))}>
          Save
        </Button>
      </div>
    </section>
  );
}

const meta = {
  title: 'Kit/AllocationEditor',
  component: Split,
  args: { initial: SPLIT, goals: GOALS, frame: 'drawer' },
} satisfies Meta<SplitProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The buy drawer: rings on each row; "Add goal" opens the Goals left. */
export const BuyDrawer: Story = {};

/** One Goal left: the button names it and adds it directly. */
export const LastGoalLeft: Story = {
  args: { goals: GOALS.slice(0, 3) },
};

/** Holding Maintenance: no rings, Reset / Save; save with an empty share to see its error. */
export const HoldingCard: Story = {
  args: {
    frame: 'card',
    initial: [{ goalId: 'house', name: 'House Down Payment', percent: 45 }],
  },
};

/** Over 100% while typing: the total in coral. */
export const Over: Story = {
  args: {
    initial: [SPLIT[0]!, { ...SPLIT[1]!, percent: 50 }],
  },
};

/** A completed Goal's share: kept or removed, never changed. */
export const CompletedGoal: Story = {
  args: {
    frame: 'card',
    initial: [
      {
        goalId: 'trip', name: 'Trip to Japan', percent: 30, completed: true,
      },
      { goalId: 'house', name: 'House Down Payment', percent: 20 },
    ],
  },
};

/** No split yet: only "Add goal" and an empty total. */
export const Empty: Story = {
  args: { initial: [] },
};
