import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from '../../../src/kit/button/IconButton';
import { CountBadge, type CountBadgeProps } from '../../../src/kit/countBadge/CountBadge';

// The kit's count badge (K30, OQ-133), placed on the bell as the dashboard
// mockups (20, 21) show it. Past the cap it reads "9+".

/**
 * Renders the badge on the bell icon button, the way the top bar uses it.
 *
 * @param props - The story's args: the count and its spoken label.
 * @returns The bell with its badge.
 */
function OnBell(props: CountBadgeProps) {
  return (
    <IconButton
      icon="notifications-outline"
      label="Notifications"
      size="lg"
      badge={<CountBadge {...props} className="absolute top-1.5 right-1.5" />}
    />
  );
}

const meta = {
  title: 'Kit/CountBadge',
  component: CountBadge,
  render: OnBell,
  args: { count: 2, label: '2 unseen notifications' },
} satisfies Meta<CountBadgeProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Two unseen notifications, as on the dashboard. */
export const Default: Story = {};

/** More than the cap: the badge reads "9+". */
export const Capped: Story = { args: { count: 27, label: '27 unseen notifications' } };

/** Nothing unseen: no badge at all. */
export const Zero: Story = { args: { count: 0, label: 'No unseen notifications' } };
