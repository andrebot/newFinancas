import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, type CardProps } from '../../../src/kit/card/Card';
import { SectionHeader } from '../../../src/kit/sectionHeader/SectionHeader';

// The kit's card (K34, OQ-135): the panels of mockups 20, 60 and 70 (`md`),
// the nested contract / position panels of 51 (`sm`), the ledger's flush card
// of 30 (`none`) and the setup wizard's step card of 11–13 (`lg`).

const meta = {
  title: 'Kit/Card',
  component: Card,
  args: { children: 'Card content', className: 'flex flex-col gap-4' },
  argTypes: {
    size: { control: 'inline-radio', options: ['none', 'sm', 'md', 'lg'] },
    as: { control: 'inline-radio', options: ['section', 'article', 'div'] },
  },
} satisfies Meta<CardProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A page panel with its header. */
export const Panel: Story = {
  args: {
    children: (
      <>
        <SectionHeader title="Personal info" />
        <p className="text-muted">Email and password each have their own dedicated flow.</p>
      </>
    ),
  },
};

/** Every size, from the flush ledger card to the wizard's step. */
export const Sizes: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-4">
      <Card size="none">
        <p className="px-5 pt-4 pb-3 font-semibold">none — flush, e.g. the ledger</p>
        <p className="border-t border-line bg-raised px-5 py-2 text-muted">A full-bleed row</p>
      </Card>
      <Card size="sm">sm — a panel nested inside an expanded row</Card>
      <Card>md — a page panel</Card>
      <Card size="lg">lg — the setup wizard&apos;s step</Card>
    </div>
  ),
};
