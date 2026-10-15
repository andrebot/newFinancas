import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MenuPill, StaticPill, type MenuPillProps } from '../../../src/kit/menu/MenuPill';

// The menu's pill (K23, OQ-140): the role pill of the members list (mockup
// 60). `MenuPill` opens a Menu (see Kit/Menu › Member Role); `StaticPill` is
// the Owner's, which can't change, drawn so both line up in one column.

const meta = {
  title: 'Kit/MenuPill',
  component: MenuPill,
  args: { label: 'Admin', onClick: fn() },
} satisfies Meta<MenuPillProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Closed: the current role and a chevron. */
export const Closed: Story = {};

/** While its menu is open: ringed in mint, the chevron pointing up. */
export const Open: Story = {
  args: { label: 'Member', 'aria-expanded': true },
};

/** Can't be changed by this user. */
export const Disabled: Story = {
  args: { label: 'Viewer', disabled: true },
};

/** The Owner's pill beside the role pills, as the members list draws them. */
export const OwnerBesideRoles: Story = {
  render: () => (
    <div className="flex flex-col items-end gap-3">
      <StaticPill label="Owner" icon="crown-outline" />
      <MenuPill label="Admin" />
      <MenuPill label="Viewer" />
    </div>
  ),
};
