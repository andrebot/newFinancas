import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  OptionCardGroup, type OptionCardGroupProps,
} from '../../../src/kit/optionCard/OptionCardGroup';

// The kit's option cards (K14, OQ-129). They hold no state, so each story
// keeps the selection itself; `onChange` also shows in the actions panel.

type Props = OptionCardGroupProps<string>;

/**
 * Renders the group with the selection kept in local state, starting from
 * the `value` arg, so clicking a card selects it.
 *
 * @param props - The story's args: the starting value, the change handler and the rest.
 * @returns The interactive group.
 */
function Interactive({ value: initial, onChange, ...rest }: Props) {
  const [value, setValue] = useState(initial);
  return (
    <OptionCardGroup
      {...rest}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

/**
 * A sample theme thumbnail, like the ones Profile will draw: a few bars in
 * the given surface and accent colours.
 *
 * @param props - The thumbnail's surface, accent and bar colours.
 * @returns The thumbnail.
 */
function ThemeThumb({ surface, accent, bar }: {
  readonly surface: string; readonly accent: string; readonly bar: string;
}) {
  return (
    <span
      className="flex h-16 flex-col gap-1.5 rounded-xl border border-line p-2"
      style={{ background: surface }}
    >
      <span className="h-2 w-1/2 rounded" style={{ background: accent }} />
      <span className="h-2 w-3/4 rounded" style={{ background: bar }} />
      <span className="h-2 w-2/3 rounded" style={{ background: bar }} />
    </span>
  );
}

const meta = {
  title: 'Kit/OptionCardGroup',
  component: OptionCardGroup,
  render: (args) => <Interactive key={args.value} {...args} />,
  decorators: [(Story) => <div className="max-w-xl"><Story /></div>],
  args: {
    label: 'Two-factor method',
    options: [
      {
        value: 'totp',
        label: 'Authenticator app',
        description: 'Google Authenticator, Authy, 1Password, or similar generate a new code '
          + 'every 30 seconds.',
        icon: 'phone-iphone-outline',
      },
    ],
    value: 'totp',
    onChange: fn(),
  },
  argTypes: {
    layout: { control: 'inline-radio', options: ['list', 'tiles'] },
  },
} satisfies Meta<Props>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A list row, as the MFA method step shows it. */
export const List: Story = {};

/** Several list rows, one selected. */
export const ListOfSeveral: Story = {
  args: {
    label: 'Account type',
    options: [
      {
        value: 'checking',
        label: 'Checking',
        description: 'Everyday account',
        icon: 'account-balance-outline',
      },
      {
        value: 'savings',
        label: 'Savings',
        description: 'Money set aside',
        icon: 'savings-outline',
      },
      { value: 'investment', label: 'Investment', description: 'Brokerage account' },
    ],
    value: 'savings',
  },
};

/** Tiles with the icon on top, as the account type picker. */
export const Tiles: Story = {
  args: {
    label: 'Account type',
    layout: 'tiles',
    options: [
      {
        value: 'checking',
        label: 'Checking',
        description: 'Everyday account',
        icon: 'account-balance-outline',
      },
      {
        value: 'savings',
        label: 'Savings',
        description: 'Money set aside',
        icon: 'savings-outline',
      },
      {
        value: 'credit_card',
        label: 'Credit card only',
        description: 'No bank account behind it',
        icon: 'credit-card-outline',
      },
      {
        value: 'investment',
        label: 'Investment',
        description: 'Brokerage account',
        icon: 'trending-up',
      },
    ],
    value: 'checking',
  },
};

/** Tiles with a preview on top, as Profile's theme picker. */
export const Previews: Story = {
  args: {
    label: 'Theme',
    layout: 'tiles',
    options: [
      {
        value: 'dark',
        label: 'Dark',
        icon: 'dark-mode-outline',
        preview: <ThemeThumb surface="#0C100F" accent="#5EE6B8" bar="#232C28" />,
      },
      {
        value: 'light',
        label: 'Light',
        icon: 'light-mode-outline',
        preview: <ThemeThumb surface="#F4F7F5" accent="#1F9E74" bar="#D9E1DC" />,
      },
      {
        value: 'system',
        label: 'System',
        icon: 'contrast',
        preview: (
          <span className="flex h-16 overflow-hidden rounded-xl border border-line">
            <span className="flex-1 bg-[#0C100F]" />
            <span className="flex-1 bg-[#F4F7F5]" />
          </span>
        ),
      },
    ],
    value: 'dark',
  },
};
