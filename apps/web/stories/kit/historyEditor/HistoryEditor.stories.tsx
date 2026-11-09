import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  HistoryEditor, type HistoryEditorProps, type HistoryEntry, type HistoryOutcome,
  type HistorySubmission,
} from '../../../src/kit/historyEditor/HistoryEditor';

// The History editor (K46, OQ-232): dated values with their chart, edited in
// place, deleted behind a confirm, a past value added. The caller holds the
// list and runs each request — here after a short wait, refused when the
// story says so. The frame is the caller's: here the value history drawer's
// body (mockup 52), 560px wide, or a phone's sheet.

const MARKET_VALUES: readonly HistoryEntry[] = [
  { key: 'aug', date: '2026-08-31', value: 11000000 },
  { key: 'jul', date: '2026-07-31', value: 11165000 },
  { key: 'jun', date: '2026-06-30', value: 10807000 },
  { key: 'may', date: '2026-05-31', value: 11055000 },
  {
    key: 'apr', date: '2026-04-30', value: 10890000, lockedReason: 'From a buy',
  },
];

const SELIC: readonly HistoryEntry[] = [
  { key: 'sep', date: '2026-09-30', value: 105000 },
  {
    key: 'jul', date: '2026-07-31', value: 107500, lockedReason: 'Added by Ana',
  },
  { key: 'may', date: '2026-05-31', value: 107500 },
  { key: 'mar', date: '2026-03-31', value: 105000 },
];

/** The frame's width, in px: the drawer of mockup 52, or a phone. */
const FRAME_WIDTHS_PX = { drawer: 560, phone: 375 } as const;

/** How long the stand-in request takes, in ms. */
const REQUEST_MS = 600;

/** The story's props: the editor's, without the list and requests it holds, and the outcome. */
type HistoryStoryProps = Omit<HistoryEditorProps, 'entries' | 'onSave' | 'onDelete'> & {
  readonly initial: readonly HistoryEntry[];
  /** Answers every request with a refusal. */
  readonly refuse: boolean;
  /** `drawer` (560px, mockup 52) or `phone` (a 375px sheet). */
  readonly width: 'drawer' | 'phone';
};

/**
 * Waits for the stand-in request.
 *
 * @returns A promise settled after `REQUEST_MS`.
 */
const wait = () => new Promise((resolve) => {
  setTimeout(resolve, REQUEST_MS);
});

/**
 * Puts a saved value in the list, newest first.
 *
 * @param entries - The list.
 * @param submission - The value saved.
 * @returns The new list.
 */
const withSaved = (
  entries: readonly HistoryEntry[],
  submission: HistorySubmission,
): HistoryEntry[] => {
  const key = submission.key ?? `new-${submission.date}-${submission.value}`;
  const kept = entries.filter((entry) => entry.key !== key);
  return [...kept, { key, date: submission.date, value: submission.value }]
    .sort((first, second) => second.date.localeCompare(first.date));
};

/**
 * Holds the list as FL19 or FL20 would, answering each request after a wait.
 *
 * @param props - The first list, the outcome, the width and the editor's props.
 * @returns The editor in its frame.
 */
function History({
  initial, refuse, width, ...editor
}: HistoryStoryProps) {
  const [entries, setEntries] = useState(initial);

  /**
   * Answers a request after the wait: refused, or applied to the list.
   *
   * @param apply - What the request changes.
   * @returns How it ended.
   */
  const answer = async (apply: () => void): Promise<HistoryOutcome> => {
    await wait();
    if (refuse) return 'refused';
    apply();
    return 'done';
  };

  return (
    <div className="rounded-2xl bg-card p-6" style={{ width: FRAME_WIDTHS_PX[width] }}>
      <HistoryEditor
        {...editor}
        entries={entries}
        onSave={(submission) => answer(() => setEntries((list) => withSaved(list, submission)))}
        onDelete={(key) => answer(() => setEntries(
          (list) => list.filter((entry) => entry.key !== key),
        ))}
      />
    </div>
  );
}

const meta = {
  title: 'Kit/HistoryEditor',
  component: History,
  args: {
    initial: MARKET_VALUES,
    refuse: false,
    width: 'drawer',
    valueKind: { kind: 'money', currency: 'BRL' },
    chartLabel: 'XPML11 market value history',
    tone: 'lilac',
    reference: { value: 11000000, label: 'invested R$110k' },
    impactHint: (fromDate: string) => (
      `Net worth from ${fromDate.slice(0, 7)} onward is recalculated.`
    ),
  },
} satisfies Meta<HistoryStoryProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Mockup 52: a Holding's market values; the oldest came from a buy and is locked. */
export const MarketValues: Story = {};

/** A rate's history (FL20): one value per day, changes in points, another Member's value locked. */
export const Rates: Story = {
  args: {
    initial: SELIC,
    valueKind: { kind: 'rate' },
    chartLabel: 'Selic history',
    tone: 'sky',
    reference: undefined,
    valueLabel: 'Value (% a.a.)',
    uniqueDays: true,
    impactHint: () => 'Re-projects payouts for 1 holding.',
  },
};

/** Every request refused: the form and the confirm stay open, as they would behind a toast. */
export const Refused: Story = { args: { refuse: true } };

/** A phone's sheet: the date sits over the value. */
export const Phone: Story = { args: { width: 'phone' } };

/** Nothing saved yet: no chart, only the button that adds a value. */
export const Empty: Story = { args: { initial: [] } };
