import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Switch, type SwitchProps } from '../../../src/kit/switch/Switch';

// The kit's switch (K15, OQ-180). It holds no state, so each story keeps the
// on/off state itself; `onChange` also shows in the actions panel.

/**
 * Renders the switch with its state kept locally, starting from the
 * `checked` arg, so clicking it toggles.
 *
 * @param props - The story's args: the starting state, the change handler and the rest.
 * @returns The interactive switch.
 */
function Interactive({ checked: initial, onChange, ...rest }: SwitchProps) {
  const [checked, setChecked] = useState(initial);
  return (
    <Switch
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
  title: 'Kit/Switch',
  component: Switch,
  render: (args) => <Interactive key={String(args.checked)} {...args} />,
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
  args: {
    label: 'Incentivised',
    checked: true,
    onChange: fn(),
  },
} satisfies Meta<SwitchProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** On. */
export const On: Story = {};

/** Off. */
export const Off: Story = { args: { checked: false } };

/** A quieter line under the label, as the debenture's tax note. */
export const WithDescription: Story = {
  args: {
    description: 'Exempt from income tax for individuals.',
    checked: false,
  },
};

/** Disabled, on and off. */
export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <div className="flex flex-col gap-3">
      <Switch {...args} checked label="Disabled and on" />
      <Switch {...args} checked={false} label="Disabled and off" />
    </div>
  ),
};
