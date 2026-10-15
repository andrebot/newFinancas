import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { TypeToConfirm, type TypeToConfirmProps } from '../../../src/kit/confirm/TypeToConfirm';

// The kit's type-to-confirm (K27, OQ-143): the last step of Household Deletion
// and Delete Account. The texts echo mockups 60 and 70's delete rows.

/**
 * Holds the typed text the way a Flow would, so the story can be typed into.
 *
 * @param args - The story's props; its `value` is the starting text.
 * @returns The type-to-confirm with live text.
 */
function Controlled({ value: initial, ...args }: TypeToConfirmProps) {
  const [value, setValue] = useState(initial);
  return <TypeToConfirm {...args} value={value} onChange={setValue} />;
}

const meta = {
  title: 'Kit/TypeToConfirm',
  component: TypeToConfirm,
  args: {
    message: (
      <>
        Delete
        {' '}
        <b>Casa Silva</b>
        ? Every member loses access and shared household data is permanently removed.
      </>
    ),
    phrase: 'Casa Silva',
    value: '',
    onChange: fn(),
    label: 'Type "Casa Silva" to confirm',
    confirmLabel: 'Delete household',
    cancelLabel: 'Cancel',
    onConfirm: fn(),
    onCancel: fn(),
  },
  render: Controlled,
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
} satisfies Meta<TypeToConfirmProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Household Deletion: the confirm unlocks once the name is typed. */
export const DeleteHousehold: Story = {};

/** Delete Account: the user types their own email. */
export const DeleteAccount: Story = {
  args: {
    message: (
      <>
        Permanently delete your account? Your credentials, sessions and personal data are
        removed; your contributions to shared data are anonymized.
      </>
    ),
    phrase: 'ana@example.com',
    label: 'Type "ana@example.com" to confirm',
    confirmLabel: 'Delete account',
  },
};

/** The phrase typed, ready to confirm. */
export const Matched: Story = {
  args: { value: 'Casa Silva' },
};

/** While the request runs. */
export const Busy: Story = {
  args: { value: 'Casa Silva', busy: true },
};
