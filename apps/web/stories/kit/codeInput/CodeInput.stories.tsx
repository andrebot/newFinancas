import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { CodeInput, type CodeInputProps } from '../../../src/kit/codeInput/CodeInput';

// The authenticator code input (K17, OQ-139). It holds no state, so each
// story keeps the digits itself; `onChange` and `onComplete` also show in the
// actions panel. Click the boxes and type, or paste "482 193".

/**
 * Renders the code input with its digits kept locally, starting from the
 * `value` arg, so typing edits them.
 *
 * @param props - The story's args: the starting digits, the change handler and the rest.
 * @returns The interactive code input.
 */
function Interactive({ value: initial, onChange, ...rest }: CodeInputProps) {
  const [value, setValue] = useState(initial);
  return (
    <CodeInput
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
  title: 'Kit/CodeInput',
  component: CodeInput,
  render: (args) => <Interactive key={args.value} {...args} />,
  decorators: [(Story) => <div className="max-w-[400px]"><Story /></div>],
  args: {
    label: 'Enter the 6-digit code from the app',
    value: '482',
    onChange: fn(),
    onComplete: fn(),
  },
} satisfies Meta<CodeInputProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Partly typed, as MFA setup: the next box lights up once focused. */
export const Partial: Story = { args: { autoFocus: true } };

/** Empty. */
export const Empty: Story = { args: { value: '' } };

/** Full: the last box stays lit while focused. */
export const Full: Story = { args: { value: '482193' } };

/** The MFA challenge: the heading says what to type, so the label is for screen readers only. */
export const LabelHidden: Story = {
  args: { label: 'Authentication code', labelHidden: true, value: '4821' },
};

/** Invalid: every box turns coral and the error shows below. */
export const Invalid: Story = {
  args: { value: '482193', error: 'That code didn’t work. Check the app and try again.' },
};

/** Disabled, while the code is being checked. */
export const Disabled: Story = { args: { value: '482193', disabled: true } };
