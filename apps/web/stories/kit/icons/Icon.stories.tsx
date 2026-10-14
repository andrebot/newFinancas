import { CATEGORY_ICONS } from '@financas/reference';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon, type IconName } from '../../../src/kit/icons/Icon';
import { GLYPHS } from '../../../src/kit/icons/generated/iconData';
import { IconGallery } from '../../support/IconGallery';

// The kit's icon (K3, OQ-126). It is 1em square in currentColor: a size or
// colour utility in `className` changes both.

const ALL_ICONS = Object.keys(GLYPHS) as IconName[];
const CATEGORY_ICON_NAMES: readonly IconName[] = CATEGORY_ICONS;
const UI_ICONS = ALL_ICONS.filter((name) => !CATEGORY_ICON_NAMES.includes(name));

const meta = {
  title: 'Kit/Icons/Icon',
  component: Icon,
  argTypes: {
    name: { control: 'select', options: ALL_ICONS },
  },
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

/** One icon; pick any name and try size or colour utilities. */
export const Playground: Story = {
  args: { name: 'savings-outline', className: 'size-8 text-mint' },
};

/** A labelled icon: it gets `role="img"` and the label as its name. */
export const Labelled: Story = {
  args: { name: 'notifications-outline', label: 'Notifications', className: 'size-8' },
};

/** The icons the app's own interface uses. */
export const UiIcons: StoryObj<typeof IconGallery> = {
  render: () => <IconGallery names={UI_ICONS} />,
};

/** The icons a user can pick for a category (OQ-126). */
export const CategoryIcons: StoryObj<typeof IconGallery> = {
  render: () => <IconGallery names={CATEGORY_ICON_NAMES} />,
};
