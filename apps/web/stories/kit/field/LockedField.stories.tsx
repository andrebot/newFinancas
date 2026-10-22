import type { Meta, StoryObj } from '@storybook/react-vite';
import { LockedField, type LockedFieldProps } from '../../../src/kit/field/LockedField';

// A field the actor can't change (FL11, FL13): an account's type and currency,
// a budget's currency and visibility once created (mockups 40, 42).

const meta = {
  title: 'Kit/LockedField',
  component: LockedField,
  args: { label: 'Currency', value: 'BRL' },
} satisfies Meta<LockedFieldProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A currency fixed at creation. */
export const Currency: Story = {};

/** Two side by side, as the edit drawers lay them out. */
export const Pair: Story = {
  render: () => (
    <div className="grid w-96 grid-cols-2 gap-4">
      <LockedField label="Currency" value="BRL" />
      <LockedField label="Visibility" value="Shared" />
    </div>
  ),
};
