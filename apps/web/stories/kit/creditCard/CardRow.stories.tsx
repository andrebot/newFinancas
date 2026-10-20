import type { Meta, StoryObj } from '@storybook/react-vite';
import { CARD_NETWORKS } from '@financas/reference';
import { fn } from 'storybook/test';
import { IconButton } from '../../../src/kit/button/IconButton';
import { CardRow, type CardRowProps } from '../../../src/kit/creditCard/CardRow';

// A saved credit card (K48, OQ-187), as listed under an account on mockups
// 11 and 40. The remove button is the caller's: here it only logs a click
// in the actions panel.

const remove = fn();

const meta = {
  title: 'Kit/Credit card/CardRow',
  component: CardRow,
  args: {
    network: 'visa',
    last4: '1111',
    networkName: 'Visa',
    meta: 'Closes 15 · Due 22 · Exp 09/2030',
  },
  argTypes: {
    network: { control: 'select', options: [...CARD_NETWORKS] },
  },
  decorators: [(Story) => <div className="max-w-[420px]"><Story /></div>],
} satisfies Meta<CardRowProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** In the add-account form, with its remove button (mockup 11). */
export const Removable: Story = {
  args: {
    trailing: <IconButton icon="close" label="Remove card" onClick={remove} className="ml-auto" />,
  },
};

/** On an account card (mockup 40): no action. */
export const OnAnAccount: Story = {
  args: {
    network: 'mastercard', last4: '4242', networkName: 'Mastercard', meta: 'Closes 5 · Due 12',
  },
};
