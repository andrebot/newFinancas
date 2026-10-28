import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from '../../../src/kit/button/Button';
import { IconButton } from '../../../src/kit/button/IconButton';
import { Icon } from '../../../src/kit/icons/Icon';
import {
  Popover, type PopoverProps, type PopoverTriggerProps,
} from '../../../src/kit/popover/Popover';

// The kit's popover (K22, OQ-131). It keeps its own open state; `onOpenChange`
// shows each open and close in the actions panel. The content here mirrors
// the notification inbox mockup (23); the real inbox is its own Flow.

/**
 * Draws the round bell button the app bar opens the inbox from.
 *
 * @param props - The ref and ARIA / click props the popover hands its trigger.
 * @returns The bell button.
 */
const bell = (props: PopoverTriggerProps) => (
  <IconButton icon="notifications-outline" label="Notifications" size="lg" {...props} />
);

/** One inbox row's content. */
interface InboxRowProps {
  readonly icon: 'mail-outline' | 'event-available-outline' | 'group-add-outline';
  readonly text: string;
  readonly when: string;
}

/**
 * Draws one inbox row: an icon bubble, the text and when it happened.
 *
 * @param props - The row's icon, text and time.
 * @param props.icon - The bubble's icon.
 * @param props.text - What happened.
 * @param props.when - When it happened.
 * @returns The row.
 */
function InboxRow({ icon, text, when }: InboxRowProps) {
  return (
    <div className="flex gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sky/15 text-sky">
        <Icon name={icon} className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="type-body">{text}</div>
        <div className="type-caption text-muted">{when}</div>
      </div>
    </div>
  );
}

/** The inbox's content, as the mockup shows it. */
const inbox = (
  <>
    <div className="flex items-center justify-between border-b border-line px-4 py-3">
      <span className="font-display font-bold">Notifications</span>
      <span className="type-caption text-muted">2 new · marked seen</span>
    </div>
    <InboxRow
      icon="mail-outline"
      text="Alex Rivera invited you to The Rivera Household as Member"
      when="2 hours ago"
    />
    <InboxRow
      icon="event-available-outline"
      text="CDB Banco Inter 2026 reached its due date on 30/09/2026 but still has a position."
      when="Today · XP Investimentos"
    />
    <InboxRow
      icon="group-add-outline"
      text="Priya Shah accepted your invitation"
      when="Seen · 3 days ago"
    />
  </>
);

const meta = {
  title: 'Kit/Popover',
  component: Popover,
  decorators: [(Story) => <div className="flex min-h-96 justify-end p-4"><Story /></div>],
  args: {
    label: 'Notifications',
    trigger: bell,
    width: 400,
    children: inbox,
    onOpenChange: fn(),
  },
} satisfies Meta<PopoverProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The notification inbox, opened from the bell (click it). */
export const NotificationInbox: Story = {};

/** No width: the panel takes its content's width. */
export const ContentWidth: Story = {
  args: {
    width: undefined,
    children: <p className="px-4 py-3 type-body text-muted">You’re all caught up.</p>,
  },
};

/** Content that closes the panel itself, as "View holding" does after navigating. */
export const ClosesFromInside: Story = {
  args: {
    width: 280,
    children: (close: () => void) => (
      <div className="flex flex-col gap-3 p-4">
        <p className="type-body">Archive CDB Banco Inter 2026?</p>
        <Button variant="primary" size="sm" onClick={close}>Done</Button>
      </div>
    ),
  },
};

/** Opens from a trigger on the left, below and aligned to its start. */
export const StartAligned: Story = {
  decorators: [(Story) => <div className="flex min-h-96 justify-start p-4"><Story /></div>],
  args: { placement: 'bottom-start' },
};
