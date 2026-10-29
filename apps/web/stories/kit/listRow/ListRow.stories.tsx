import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Avatar, avatarTone } from '../../../src/kit/avatar/Avatar';
import { Button } from '../../../src/kit/button/Button';
import { IconButton } from '../../../src/kit/button/IconButton';
import { ListRow, ListRows, type ListRowProps } from '../../../src/kit/listRow/ListRow';
import { ListRowIcon } from '../../../src/kit/listRow/ListRowIcon';
import { MenuPill, StaticPill } from '../../../src/kit/menu/MenuPill';
import { Tag } from '../../../src/kit/tag/Tag';

// The kit's list row (K45, OQ-153), as the mockups draw it: the household's
// members and pending invitations (60), the profile's sessions and
// invitations (70), the notification inbox (23) and coming due (20).

const meta = {
  title: 'Kit/ListRow',
  component: ListRow,
  args: {
    title: 'Alex Rivera',
    meta: 'alex@example.com · since 03/2024',
    titleWeight: 'semibold',
    dimmed: false,
  },
  argTypes: {
    titleWeight: { control: 'inline-radio', options: ['semibold', 'regular'] },
  },
  render: (args) => (
    <ListRows className="max-w-xl">
      <ListRow
        {...args}
        leading={<Avatar firstName="Alex" lastName="Rivera" tone="sky" />}
        trailing={(
          <IconButton icon="person-remove-outline" label="Remove Alex Rivera" onClick={fn()} />
        )}
      />
    </ListRows>
  ),
} satisfies Meta<ListRowProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** One row, its slots on the controls. */
export const Playground: Story = {};

/** The household's members: avatar, "You" tag, role pill and row actions. */
export const Members: Story = {
  render: () => (
    <ListRows className="max-w-2xl" label="Members">
      <ListRow
        leading={<Avatar firstName="Jane" lastName="Doe" tone={avatarTone('u-jane', true)} />}
        title={(
          <>
            {'Jane Doe '}
            <Tag size="sm">You</Tag>
          </>
        )}
        meta="jane@example.com · since 01/2024"
        trailing={(
          <>
            <StaticPill label="Owner" icon="crown-outline" />
            <IconButton icon="swap-horiz" label="Transfer ownership" />
            <IconButton icon="logout" label="Leave household" />
          </>
        )}
      />
      <ListRow
        leading={<Avatar firstName="Alex" lastName="Rivera" tone={avatarTone('u-alex', false)} />}
        title="Alex Rivera"
        meta="alex@example.com · since 03/2024"
        trailing={(
          <>
            <MenuPill label="Admin" />
            <IconButton icon="person-remove-outline" label="Remove Alex Rivera" />
          </>
        )}
      />
      <ListRow
        leading={<Avatar firstName="Priya" lastName="Shah" tone={avatarTone('u-priya', false)} />}
        title="Priya Shah"
        meta="priya@example.com · since 02/2026"
        trailing={(
          <>
            <MenuPill label="Viewer" />
            <IconButton icon="person-remove-outline" label="Remove Priya Shah" />
          </>
        )}
      />
    </ListRows>
  ),
};

/** The profile's active sessions: this device in mint, the others revocable. */
export const Sessions: Story = {
  render: () => (
    <ListRows className="max-w-xl" label="Active sessions">
      <ListRow
        leading={<ListRowIcon icon="laptop-mac-outline" tone="mint" />}
        title={(
          <>
            {'Chrome on macOS '}
            <Tag size="sm" tone="mint">This device</Tag>
          </>
        )}
        meta="Signed in 01/08/2026 · Active now"
      />
      <ListRow
        leading={<ListRowIcon icon="smartphone-outline" />}
        title="Safari on iPhone"
        meta="Signed in 15/07/2026 · Last used 20/09/2026"
        trailing={<Button variant="danger-ghost" size="sm">Revoke</Button>}
      />
      <ListRow
        leading={<ListRowIcon icon="desktop-windows-outline" />}
        title="Firefox on Windows"
        meta="Signed in 02/06/2026 · Last used 10/08/2026"
        trailing={<Button variant="danger-ghost" size="sm">Revoke</Button>}
      />
    </ListRows>
  ),
};

/** Raised rows: the household's pending invitations and the profile's invitations. */
export const Invitations: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-6">
      <ListRows surface="raised" label="Pending invitations">
        <ListRow
          leading={<ListRowIcon icon="mail-outline" size="sm" />}
          title="morgan@example.com"
          meta="Member · sent 3 days ago"
          trailing={<Button variant="danger-ghost" size="sm">Revoke</Button>}
        />
      </ListRows>
      <ListRows surface="raised" label="Invitations to other households">
        <ListRow
          leading={<ListRowIcon icon="groups-outline" tone="sky" />}
          title="The Rivera Household"
          meta="Alex Rivera invited you as Member"
          trailing={(
            <>
              <Button variant="ghost" size="sm">Decline</Button>
              <Button size="sm">Accept</Button>
            </>
          )}
        />
      </ListRows>
    </div>
  ),
};

/** The notification inbox: sentence titles, footer actions, a seen row dimmed. */
export const Notifications: Story = {
  render: () => (
    <ListRows className="max-w-sm" label="Notifications">
      <ListRow
        leading={<ListRowIcon icon="mail-outline" tone="sky" size="sm" />}
        titleWeight="regular"
        title={(
          <>
            <b>Alex Rivera</b>
            {' invited you to '}
            <b>The Rivera Household</b>
            {' as Member'}
          </>
        )}
        meta="2 hours ago"
        footer={(
          <>
            <Button size="sm">Accept</Button>
            <Button variant="ghost" size="sm">Decline</Button>
          </>
        )}
        trailing={<IconButton icon="close" label="Delete notification" size="xs" />}
      />
      <ListRow
        leading={<ListRowIcon icon="group-add-outline" size="sm" />}
        titleWeight="regular"
        title="Priya Shah accepted your invitation"
        meta="Seen · 3 days ago"
        dimmed
        trailing={<IconButton icon="close" label="Delete notification" size="xs" />}
      />
    </ListRows>
  ),
};

/** Coming due: the leading slot takes any mark — here the caller's date tile. */
export const ComingDue: Story = {
  render: () => (
    <ListRows className="max-w-md" label="Coming due">
      <ListRow
        leading={(
          <div className="flex w-12 flex-col items-center rounded-xl bg-sun/10 py-1 text-sun">
            <span className="type-micro">Dec</span>
            <span className="type-heading-sm leading-5 font-extrabold">15</span>
          </div>
        )}
        title="Used Car Savings CD"
        meta={(
          <>
            {'CDB · 15/12/2026 · '}
            <span className="font-medium text-sun">in 3 months</span>
          </>
        )}
        trailing={<span className="type-body font-semibold tabular-nums">$5,000.00</span>}
      />
    </ListRows>
  ),
};
