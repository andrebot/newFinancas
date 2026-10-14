import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { IconButton, type IconButtonProps } from '../../../src/kit/button/IconButton';

// The kit's icon-only button (K4, OQ-136): a drawer's close (31), the rails'
// arrows (20, `outline`), the app bar's menu and bell (20, `lg`) and the
// auth "back" (03, `lg` outline). The label is read out, never shown.

const meta = {
  title: 'Kit/IconButton',
  component: IconButton,
  args: { icon: 'close', label: 'Close', onClick: fn() },
  argTypes: {
    tone: { control: 'inline-radio', options: ['ghost', 'outline'] },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg'] },
  },
} satisfies Meta<IconButtonProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A drawer's close. */
export const Ghost: Story = {};

/** A rail's arrow. */
export const Outline: Story = {
  args: { icon: 'chevron-right', label: 'Next', tone: 'outline' },
};

/** Both tones at every size: 28, 32, 36 and 40px. */
export const Sizes: Story = {
  render: () => (
    <div className="grid gap-3">
      {(['ghost', 'outline'] as const).map((tone) => (
        <div key={tone} className="flex items-center gap-3">
          {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
            <IconButton key={size} icon="arrow-back" label="Back" tone={tone} size={size} />
          ))}
        </div>
      ))}
    </div>
  ),
};

/** Disabled, e.g. a rail's arrow at its end. */
export const Disabled: Story = {
  args: {
    icon: 'chevron-left', label: 'Previous', tone: 'outline', disabled: true,
  },
};
