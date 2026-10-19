import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stepper, type StepperProps } from '../../../src/kit/stepper/Stepper';

// The kit's stepper (K49, OQ-183): the guided setup's three steps, at each
// point of the way. Narrow the canvas below `lg` to see the row of dots. The
// text here is pre-translated and pre-formatted, as a caller passes it.

const meta = {
  title: 'Kit/Stepper',
  component: Stepper,
  decorators: [(Story) => <div className="max-w-[260px]"><Story /></div>],
  args: {
    steps: [
      { label: 'Add an account', hint: 'Where your money lives' },
      { label: 'Review categories', hint: 'What spending gets tagged with' },
      { label: 'Set a budget', hint: 'Optional monthly target' },
    ],
    current: 0,
    caption: 'Getting started · step 1 of 3',
    ariaLabel: 'Setup steps',
    completedLabel: 'completed',
  },
} satisfies Meta<StepperProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The first step: adding an account (mockup 11). */
export const FirstStep: Story = {};

/** The second step: one done, its connector mint (mockup 12). */
export const SecondStep: Story = {
  args: { current: 1, caption: 'Getting started · step 2 of 3' },
};

/** The last step: setting a budget (mockup 13). */
export const LastStep: Story = {
  args: { current: 2, caption: 'Getting started · step 3 of 3' },
};
