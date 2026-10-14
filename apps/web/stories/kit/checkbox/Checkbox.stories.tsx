import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Checkbox, type CheckboxProps } from '../../../src/kit/checkbox/Checkbox';

// The kit's checkbox (K16, OQ-130). It holds no state, so each story keeps
// the checked state itself; `onChange` also shows in the actions panel.

/**
 * Renders the checkbox with its state kept locally, starting from the
 * `checked` arg, so clicking it toggles.
 *
 * @param props - The story's args: the starting state, the change handler and the rest.
 * @returns The interactive checkbox.
 */
function Interactive({ checked: initial, onChange, ...rest }: CheckboxProps) {
  const [checked, setChecked] = useState(initial);
  return (
    <Checkbox
      {...rest}
      checked={checked}
      onChange={(next) => {
        setChecked(next);
        onChange(next);
      }}
    />
  );
}

const meta = {
  title: 'Kit/Checkbox',
  component: Checkbox,
  render: (args) => <Interactive key={String(args.checked)} {...args} />,
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
  args: {
    label: 'I’ve saved these codes somewhere safe',
    checked: true,
    onChange: fn(),
  },
} satisfies Meta<CheckboxProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Ticked, as the backup codes step shows it. */
export const Checked: Story = {};

/** Not ticked yet. */
export const Unchecked: Story = { args: { checked: false } };

/** A label with links, as Create account's terms agreement. */
export const WithLinks: Story = {
  args: {
    label: (
      <>
        I agree to the
        {' '}
        <a href="#terms" className="text-mint">Terms</a>
        {' '}
        and
        {' '}
        <a href="#privacy" className="text-mint">Privacy Policy</a>
      </>
    ),
  },
};

/** A quieter line under the label. */
export const WithDescription: Story = {
  args: {
    label: 'Email me a weekly summary',
    description: 'Every Monday, with last week’s spending per category.',
    checked: false,
  },
};

/** Left unticked when it was required. */
export const Invalid: Story = {
  args: {
    label: 'I’ve saved these codes somewhere safe',
    error: 'Confirm you saved the codes to continue.',
    checked: false,
  },
};

/** Disabled, ticked and not. */
export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <Checkbox {...args} checked label="Disabled and ticked" />
      <Checkbox {...args} checked={false} label="Disabled and not ticked" />
    </div>
  ),
};

/** Several in a column, as the rows of a multi-select. */
export const Several: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      {['XPML11', 'HGLG11', 'KNRI11', 'BBAS3'].map((ticker, index) => (
        <Interactive key={ticker} {...args} label={ticker} checked={index < 3} />
      ))}
    </div>
  ),
};
