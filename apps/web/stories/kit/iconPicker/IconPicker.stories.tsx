import type { Meta, StoryObj } from '@storybook/react-vite';
import { CATEGORY_ICONS } from '@financas/reference';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { IconPicker, type IconPickerProps } from '../../../src/kit/iconPicker/IconPicker';
import { useI18n } from '../../../src/utilities/I18nProvider';

// The kit's icon picker (K18, OQ-185), as on mockup 41's "New category" card.
// It holds no state, so the story keeps the selection itself; the icon names
// come from the catalog in the toolbar's locale, and `onChange` also shows in
// the actions panel.

/** The story's args: the picker's, minus the namer the story supplies. */
type Props = Omit<IconPickerProps, 'iconLabel'>;

/**
 * Renders the picker with the selection kept in local state, starting from
 * the `value` arg, and each icon named by the catalog.
 *
 * @param props - The story's args: the starting icon, the change handler and the labels.
 * @returns The interactive picker.
 */
function Interactive({ value: initial, onChange, ...rest }: Props) {
  const [value, setValue] = useState(initial);
  const { text } = useI18n();
  return (
    <IconPicker
      {...rest}
      value={value}
      iconLabel={(icon) => text('categoryIcons', icon)}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const meta = {
  title: 'Kit/Icon picker',
  component: Interactive,
  render: (args) => <Interactive key={args.value} {...args} />,
  args: {
    label: 'Icon', moreLabel: 'More icons', value: 'pets', onChange: fn(),
  },
  argTypes: {
    value: { control: 'select', options: [...CATEGORY_ICONS] },
  },
} satisfies Meta<Props>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A quick pick selected, as on the mockup. */
export const QuickPick: Story = {};

/** An icon from "More icons" selected: it leads the row. */
export const FromMoreIcons: Story = { args: { value: 'bolt' } };
