import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { IconButton } from '../../../src/kit/button/IconButton';
import {
  Menu, type MenuEntry, type MenuProps, type MenuRadioOption, type MenuTriggerProps,
} from '../../../src/kit/menu/Menu';
import { MenuPill } from '../../../src/kit/menu/MenuPill';

// The kit's menu (K23, OQ-140). It keeps its own open state; the caller holds
// a radio group's value, so the role story keeps it itself. Each pick shows
// in the actions panel. The data echoes the members list (mockup 60) and a
// row's actions (Edit / Archive / Delete), which no mockup draws yet.

type Role = 'admin' | 'member' | 'viewer';

const roleOptions: readonly MenuRadioOption<Role>[] = [
  {
    value: 'admin',
    label: 'Admin',
    icon: 'shield-person-outline',
    description: 'Manage members, roles, and all shared data',
  },
  {
    value: 'member',
    label: 'Member',
    icon: 'edit-note-outline',
    description: 'Record transactions and manage shared data they created',
  },
  {
    value: 'viewer',
    label: 'Viewer',
    icon: 'visibility-outline',
    description: 'Read-only access to shared data',
  },
];

/**
 * Builds the trigger of a member's role menu: the role pill showing the role.
 *
 * @param role - The current role's label.
 * @returns The trigger render prop.
 */
const rolePill = (role: string) => function RolePill(props: MenuTriggerProps) {
  return <MenuPill label={role} aria-label={`Sam Costa's role: ${role}`} {...props} />;
};

/** The role story's args: where each pick goes. */
interface RoleMenuArgs {
  readonly onChange: (role: Role) => void;
}

/**
 * Renders a member's role menu from the role pill, keeping the role locally
 * so picking changes it.
 *
 * @param props - The story's args.
 * @param props.onChange - Told of each pick.
 * @returns The role pill and its menu.
 */
function RoleMenu({ onChange }: RoleMenuArgs) {
  const [role, setRole] = useState<Role>('member');
  const current = roleOptions.find((option) => option.value === role)!;
  return (
    <Menu
      label="Sam Costa's role"
      width={300}
      trigger={rolePill(current.label)}
      entries={[{
        kind: 'radio',
        value: role,
        options: roleOptions,
        onChange: (next) => {
          setRole(next);
          onChange(next);
        },
      }]}
    />
  );
}

/**
 * Draws the round "more" button a row's actions open from.
 *
 * @param props - The ref and ARIA / click props the menu hands its trigger.
 * @returns The icon button.
 */
const moreButton = (props: MenuTriggerProps) => (
  <IconButton icon="more-horiz" label="Actions for Main Checking" {...props} />
);

const onEdit = fn();
const onArchive = fn();
const onDelete = fn();

const rowActions: readonly MenuEntry<string>[] = [
  {
    kind: 'action', id: 'edit', label: 'Edit', icon: 'edit-outline', onSelect: onEdit,
  },
  {
    kind: 'action', id: 'archive', label: 'Archive', icon: 'archive-outline', onSelect: onArchive,
  },
  { kind: 'separator' },
  {
    kind: 'action',
    id: 'delete',
    label: 'Delete',
    icon: 'delete-outline',
    tone: 'danger',
    onSelect: onDelete,
  },
];

const meta = {
  title: 'Kit/Menu',
  component: Menu,
  decorators: [(Story) => <div className="flex min-h-96 justify-end p-4"><Story /></div>],
  args: {
    label: 'Actions for Main Checking',
    trigger: moreButton,
    entries: rowActions,
  },
} satisfies Meta<MenuProps<string>>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A row's actions, opened from its "more" button; Delete is destructive. */
export const RowActions: Story = {};

/** An action that can't run says why, and the keyboard skips it. */
export const DisabledAction: Story = {
  args: {
    entries: [
      rowActions[0]!,
      {
        kind: 'action',
        id: 'archive',
        label: 'Archive',
        icon: 'archive-outline',
        disabledReason: 'Has a balance',
        onSelect: onArchive,
      },
    ],
  },
};

/** A member's role, picked from the role pill as in mockup 60 (click it). */
export const MemberRole: StoryObj<RoleMenuArgs> = {
  render: (args) => <RoleMenu {...args} />,
  args: { onChange: fn() },
};
