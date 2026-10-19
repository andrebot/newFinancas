import type { Meta, StoryObj } from '@storybook/react-vite';
import { PALETTE_TOKENS } from '@financas/reference';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  ColorSwatchPicker,
  type ColorSwatchPickerProps,
} from '../../../src/kit/colorSwatchPicker/ColorSwatchPicker';
import { useI18n } from '../../../src/utilities/I18nProvider';

// The kit's colour swatch picker (K19, OQ-186), as on mockup 41's "New
// category" card. It holds no state, so the story keeps the selection itself;
// the colour names come from the catalog in the toolbar's locale, and
// `onChange` also shows in the actions panel.

/** The story's args: the picker's, minus the namer the story supplies. */
type Props = Omit<ColorSwatchPickerProps, 'colorLabel'>;

/**
 * Renders the picker with the selection kept in local state, starting from
 * the `value` arg, and each colour named by the catalog.
 *
 * @param props - The story's args: the starting colour, the change handler and the label.
 * @returns The interactive picker.
 */
function Interactive({ value: initial, onChange, ...rest }: Props) {
  const [value, setValue] = useState(initial);
  const { text } = useI18n();
  return (
    <ColorSwatchPicker
      {...rest}
      value={value}
      colorLabel={(color) => text('paletteColors', color)}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const meta = {
  title: 'Kit/Colour swatch picker',
  component: Interactive,
  render: (args) => <Interactive key={args.value} {...args} />,
  args: { label: 'Colour', value: 'lilac', onChange: fn() },
  argTypes: {
    value: { control: 'select', options: [...PALETTE_TOKENS] },
  },
  decorators: [(Story) => <div className="max-w-80 rounded-card bg-card p-5"><Story /></div>],
} satisfies Meta<Props>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Lilac selected, as on the mockup, in a card-width column. */
export const OnACard: Story = {};
