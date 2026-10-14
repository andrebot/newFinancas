import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from '../../../src/kit/card/Card';
import { WizardLayout, type WizardLayoutProps } from '../../../src/kit/layouts/WizardLayout';

// The kit's wizard layout (K34, OQ-135): mockup 10's centred question,
// 11's stepper beside the step card (the stepper is K49's; a stand-in here)
// and 14's wide summary.

const meta = {
  title: 'Kit/Layouts/WizardLayout',
  component: WizardLayout,
  args: { children: null },
  argTypes: {
    width: { control: 'inline-radio', options: ['narrow', 'wide'] },
  },
} satisfies Meta<WizardLayoutProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A single question, centred. */
export const Centred: Story = {
  args: {
    children: (
      <>
        <h1 className="type-display-lg">Name your household</h1>
        <p className="text-muted">Everyone you invite will see this name.</p>
      </>
    ),
  },
};

/** The stepper beside the step's card. */
export const WithStepper: Story = {
  args: {
    aside: <p className="type-label text-muted">Getting started · step 1 of 3</p>,
    children: (
      <Card size="lg" className="flex flex-col gap-5">
        <h1 className="type-heading-lg">Add your first account</h1>
        <p className="text-muted">
          Checking, savings, credit card, or investment — you can add more anytime.
        </p>
      </Card>
    ),
  },
};

/** The final summary's wider column. */
export const Wide: Story = {
  args: {
    width: 'wide',
    children: <h1 className="type-display-lg">The Doe Family is ready</h1>,
  },
};
