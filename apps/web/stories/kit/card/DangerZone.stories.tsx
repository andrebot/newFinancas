import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { DangerZone, type DangerZoneProps } from '../../../src/kit/card/DangerZone';
import { TypeToConfirm } from '../../../src/kit/confirm/TypeToConfirm';

// The kit's danger zone (K34 family, OQ-151): the foot of mockups 60 (Delete
// household) and 70 (Delete account). The button opens the caller's confirm,
// which takes its place.

const meta = {
  title: 'Kit/DangerZone',
  component: DangerZone,
  args: {
    title: 'Delete account',
    description: 'Permanently deletes your credentials, sessions, and personal data. '
      + 'Your contributions to shared data are anonymized, not deleted.',
    actionLabel: 'Delete Account',
    onAction: fn(),
  },
  decorators: [(Story) => <div className="max-w-3xl"><Story /></div>],
} satisfies Meta<DangerZoneProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Delete Account, as mockup 70 draws it. */
export const DeleteAccount: Story = {};

/** Delete Household, as mockup 60 draws it. */
export const DeleteHousehold: Story = {
  args: {
    title: 'Delete household',
    description: 'Every member loses access and shared household data is permanently removed. '
      + 'Only the Owner can do this.',
    actionLabel: 'Delete Household',
  },
};

/** After the button: the type-to-confirm in its place. */
export const Confirming: Story = {
  args: {
    confirm: (
      <TypeToConfirm
        message="Permanently delete your account? This cannot be undone."
        phrase="ana@example.com"
        value=""
        onChange={fn()}
        label='Type "ana@example.com" to confirm'
        confirmLabel="Delete account"
        cancelLabel="Cancel"
        onConfirm={fn()}
        onCancel={fn()}
      />
    ),
  },
};
