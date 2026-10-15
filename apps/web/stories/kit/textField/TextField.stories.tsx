import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { TextField, type TextFieldProps } from '../../../src/kit/textField/TextField';
import { Icon } from '../../../src/kit/icons/Icon';

// The kit's text field (K5, OQ-137). It holds no state, so each story keeps
// the text itself; `onChange` also shows in the actions panel.

/**
 * Renders the text field with its text kept locally, starting from the
 * `value` arg, so typing edits it.
 *
 * @param props - The story's args: the starting text, the change handler and the rest.
 * @returns The interactive text field.
 */
function Interactive({ value: initial, onChange, ...rest }: TextFieldProps) {
  const [value, setValue] = useState(initial);
  return (
    <TextField
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
  title: 'Kit/TextField',
  component: TextField,
  render: (args) => <Interactive key={args.value} {...args} />,
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
  args: {
    label: 'Household name',
    value: 'The Silva household',
    onChange: fn(),
  },
} satisfies Meta<TextFieldProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Filled in, as the setup wizard's first step. */
export const Filled: Story = {};

/** Empty, with a placeholder. */
export const Empty: Story = { args: { value: '', placeholder: 'e.g. The Silva household' } };

/** A quieter line under the field, as the investment buy drawer's ticker. */
export const WithHint: Story = {
  args: {
    label: 'Ticker / identifier',
    value: 'CDB Banco Inter 2028',
    hint: 'Matches an existing Holding in this account by identifier.',
  },
};

/** Invalid: the error takes the hint's place. */
export const Invalid: Story = {
  args: {
    label: 'Email',
    type: 'email',
    value: 'jane.doe@',
    hint: 'We’ll send the invitation here.',
    error: 'Enter a valid email address.',
  },
};

/** A link beside the label, as Sign in's password. */
export const WithLabelAction: Story = {
  args: {
    label: 'Password',
    type: 'password',
    value: 'correct horse battery',
    labelAction: <a href="#forgot" className="text-mint hover:underline">Forgot password?</a>,
  },
};

/** Slots inside the box: a search icon before, a suffix after. */
export const WithSlots: Story = {
  args: { label: 'Search holdings', value: '', placeholder: 'Ticker or name' },
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Interactive {...args} leading={<Icon name="search" />} />
      <Interactive
        {...args}
        label="New value (% a.a.)"
        value="10,25"
        inputClassName="tabular-nums"
        trailing="%"
      />
    </div>
  ),
};

/** Text styling on the input, as the backup code. */
export const Styled: Story = {
  args: {
    label: 'Backup code',
    value: '7HJX-21NA',
    inputClassName: 'font-mono tracking-[.2em] text-center tabular-nums',
  },
};

/**
 * A password, as Sign in's: the native `password` type masks it. The show /
 * hide button and the strength meter come with the password field (K6).
 */
export const Password: Story = {
  args: {
    label: 'Password',
    type: 'password',
    autoComplete: 'current-password',
    value: 'correct horse battery',
  },
};

/**
 * Small whole numbers with no mask, as the card's closing and due day: a text
 * input with the numeric keyboard and tabular figures, not `type="number"`,
 * which rejects pt-BR decimals and changes on scroll. Masked inputs (amounts,
 * rates, dates, codes, the card number) are their own components.
 */
export const Numeric: Story = {
  args: {
    label: 'Closing day',
    value: '5',
    inputMode: 'numeric',
    inputClassName: 'tabular-nums',
  },
  render: (args) => (
    <div className="grid grid-cols-2 gap-3">
      <Interactive {...args} />
      <Interactive {...args} label="Due day" value="12" />
    </div>
  ),
};

/** Disabled. */
export const Disabled: Story = { args: { disabled: true } };

/** Two side by side, as Create account's names. */
export const Pair: Story = {
  render: (args) => (
    <div className="grid grid-cols-2 gap-3">
      <Interactive {...args} label="First name" value="Jane" />
      <Interactive {...args} label="Last name" value="Doe" />
    </div>
  ),
};
