import type { Meta, StoryObj } from '@storybook/react-vite';
import { CardRail } from '../../../src/kit/cardRail/CardRail';
import { BalanceRailCard } from '../../../src/kit/railCard/BalanceRailCard';
import { BudgetRailCard } from '../../../src/kit/railCard/BudgetRailCard';
import { GoalRailCard } from '../../../src/kit/railCard/GoalRailCard';
import { RAIL_CARD_PLACEHOLDERS } from '../../../src/kit/railCard/railCard';

// The kit's rail cards (K36, OQ-215): balances, budgets and goals as the
// Dashboard and Transactions line them up on their card rails (K35) —
// mockups 20 and 30; narrow the viewport for mockup 34's phone widths.

const meta = {
  title: 'Kit/RailCards',
  component: CardRail,
  args: { title: 'Balances', period: 'September/2026' },
} satisfies Meta<typeof CardRail>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Each account's balance and each card's outstanding. */
export const Balances: Story = {
  args: {
    children: [
      <BalanceRailCard
        key="checking"
        name="Main Checking"
        icon="account-balance-outline"
        color="mint"
        amount={324050}
        currency="USD"
      />,
      <BalanceRailCard
        key="savings"
        name="Emergency Fund"
        icon="savings-outline"
        color="sky"
        amount={850000}
        currency="USD"
      />,
      <BalanceRailCard
        key="nubank"
        name="Nubank Cartão"
        icon="credit-card-outline"
        color="peach"
        amount={45000}
        currency="BRL"
        outstanding
      />,
      <BalanceRailCard
        key="visa"
        name="Visa •••• 1111"
        icon="credit-card-outline"
        color="lilac"
        amount={4599}
        currency="USD"
        outstanding
      />,
      <BalanceRailCard
        key="itau"
        name="Itaú Conta"
        icon="account-balance-outline"
        color="sun"
        amount={218035}
        currency="BRL"
      />,
      <BalanceRailCard
        key="xp"
        name="XP Investimentos"
        icon="trending-up"
        color="mint"
        amount={1240000}
        currency="BRL"
      />,
    ],
  },
};

/** Over budget first (FR-4.3), then near the limit, on track and used up exactly. */
export const Budgets: Story = {
  args: {
    title: 'Budgets',
    children: [
      <BudgetRailCard
        key="essentials"
        name="Household Essentials"
        spend={425000}
        target={400000}
        currency="BRL"
      />,
      <BudgetRailCard key="dining" name="Dining Out" spend={31200} target={40000} currency="BRL" />,
      <BudgetRailCard key="fun" name="Fun Money" spend={14550} target={30000} currency="USD" />,
      <BudgetRailCard
        key="transport"
        name="Transport"
        spend={20000}
        target={20000}
        currency="USD"
      />,
    ],
  },
};

/** On the way, reached, needing a rate and not funded yet. */
export const Goals: Story = {
  args: {
    title: 'Goals',
    children: [
      <GoalRailCard
        key="house"
        name="House Down Payment"
        funded={8500000}
        target={15000000}
        currency="BRL"
      />,
      <GoalRailCard
        key="emergency"
        name="Emergency Fund"
        funded={320000}
        target={1000000}
        currency="USD"
      />,
      <GoalRailCard
        key="trip"
        name="Japan Trip"
        funded={1100000}
        target={1000000}
        currency="USD"
      />,
      <GoalRailCard
        key="retirement"
        name="Retirement"
        funded={4000000}
        target={50000000}
        currency="BRL"
        needsRate
      />,
      <GoalRailCard
        key="laptop"
        name="New Laptop Fund"
        funded={0}
        target={500000}
        currency="USD"
      />,
    ],
  },
};

/** While the month loads: placeholders the size of the cards they stand in for. */
export const Loading: Story = {
  args: { title: 'Budgets', loading: true, placeholderClassName: RAIL_CARD_PLACEHOLDERS.ring },
};
