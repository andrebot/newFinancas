import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  BackupCodeInput, type BackupCodeInputProps,
} from '../../../src/kit/codeInput/BackupCodeInput';

// The backup code input (K17, OQ-139). It holds no state, so each story keeps
// the clean code itself; `onChange` shows it in the actions panel. Type or
// paste in any case, with or without dashes: the groups follow.

/**
 * Renders the backup code input with its code kept locally, starting from the
 * `value` arg, so typing edits it.
 *
 * @param props - The story's args: the starting code, the change handler and the rest.
 * @returns The interactive backup code input.
 */
function Interactive({ value: initial, onChange, ...rest }: BackupCodeInputProps) {
  const [value, setValue] = useState(initial);
  return (
    <BackupCodeInput
      {...rest}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const meta = {
  title: 'Kit/BackupCodeInput',
  component: BackupCodeInput,
  render: (args) => <Interactive key={args.value} {...args} />,
  decorators: [(Story) => <div className="max-w-[400px]"><Story /></div>],
  args: {
    label: 'Backup code',
    value: '7HJX21NAQ4KD9WTE',
    onChange: fn(),
  },
} satisfies Meta<BackupCodeInputProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A whole code, as the Enter backup code screen. */
export const Filled: Story = {};

/** Empty, with the code's shape as the placeholder. */
export const Empty: Story = { args: { value: '', placeholder: 'XXXX-XXXX-XXXX-XXXX' } };

/** Invalid: the code was already used or is wrong. */
export const Invalid: Story = {
  args: { error: 'That backup code isn’t valid or was already used.' },
};
