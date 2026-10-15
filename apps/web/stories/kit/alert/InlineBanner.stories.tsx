import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { InlineBanner, type InlineBannerProps } from '../../../src/kit/alert/InlineBanner';
import { Button } from '../../../src/kit/button/Button';

// The kit's inline banner (K25, OQ-141): a note that stays in the page where
// it applies, in the look of mockup 41's inline confirm box. No mockup draws
// one yet; the texts echo a failed save and a caution on a form.

const meta = {
  title: 'Kit/InlineBanner',
  component: InlineBanner,
  args: { tone: 'info', message: 'Balances are refreshed every night.' },
  decorators: [(Story) => <div className="max-w-md"><Story /></div>],
} satisfies Meta<InlineBannerProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A note, announced politely. */
export const Info: Story = {};

/** A save went through. */
export const Success: Story = {
  args: { tone: 'success', message: 'Your changes were saved.' },
};

/** A caution, with a title. */
export const Warning: Story = {
  args: {
    tone: 'warning',
    title: 'This account still has a balance',
    message: 'Archiving it hides it from new transactions; its history stays.',
  },
};

/** A failed save, announced at once, with a way forward. */
export const ErrorWithAction: Story = {
  args: {
    tone: 'error',
    title: "Couldn't save the transaction",
    message: 'Check your connection and try again.',
    action: <Button variant="danger" size="sm">Try again</Button>,
  },
};

/** One the user can close. */
export const Dismissible: Story = {
  args: { dismiss: { label: 'Dismiss', onDismiss: fn() } },
};
