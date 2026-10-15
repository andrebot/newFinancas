import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Card } from '../../../src/kit/card/Card';
import {
  CONFIRM_RINGS, InlineConfirm, type InlineConfirmProps,
} from '../../../src/kit/confirm/InlineConfirm';

// The kit's inline confirm (K26, OQ-142): the "are you sure?" inside the card
// it is about. The texts echo mockups 41 (archive a category) and 43 (mark a
// goal completed).

const meta = {
  title: 'Kit/InlineConfirm',
  component: InlineConfirm,
  args: {
    tone: 'destructive',
    message: (
      <>
        Archive
        {' '}
        <b>Housing</b>
        {' '}
        and its 2 subcategories? Existing transactions and budgets keep their category.
      </>
    ),
    confirmLabel: 'Archive',
    cancelLabel: 'Cancel',
    onConfirm: fn(),
    onCancel: fn(),
  },
  decorators: [(Story) => <div className="max-w-sm"><Story /></div>],
} satisfies Meta<InlineConfirmProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A step that can't be undone: coral (mockup 41). */
export const Destructive: Story = {};

/** A step that can be undone: mint (mockup 43). */
export const Reversible: Story = {
  args: {
    tone: 'reversible',
    message: (
      <>
        Mark
        {' '}
        <b>House Down Payment</b>
        {' '}
        as completed? You can reopen it later from the Completed list.
      </>
    ),
    confirmLabel: 'Mark completed',
  },
};

/** While the request runs. */
export const Busy: Story = {
  args: { busy: true },
};

/** Inside its card, which takes the tone's ring while the confirm is open. */
export const InCard: Story = {
  render: (args) => (
    <Card as="article" size="sm" className={`flex flex-col gap-4 ${CONFIRM_RINGS[args.tone]}`}>
      <div className="font-semibold">Housing</div>
      <InlineConfirm {...args} />
    </Card>
  ),
};
