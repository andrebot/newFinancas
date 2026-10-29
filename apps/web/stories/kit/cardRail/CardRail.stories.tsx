import type { Meta, StoryObj } from '@storybook/react-vite';
import { CardRail, type CardRailProps } from '../../../src/kit/cardRail/CardRail';

// The kit's card rail (K35, OQ-212), with the mockups' rails (20, 30): a
// balances rail longer than the page, a rail whose cards all fit (no arrows,
// no fade) and the loading rail. The cards are stand-ins until the rail cards
// (K36) exist; widen and narrow the canvas to see the arrows come and go.

const ACCOUNTS = [
  ['Main Checking', '$3,240.50'],
  ['Emergency Fund', '$8,500.00'],
  ['Nubank Cartão', 'R$450.00'],
  ['Visa •••• 1111', '$45.99'],
  ['Itaú Conta', 'R$2,180.35'],
  ['XP Investimentos', 'R$12,400.00'],
  ['Joint Savings', '$1,950.00'],
] as const;

const CARD = 'flex w-49 flex-col gap-3 rounded-[20px] border border-line bg-card p-4';

/**
 * Draws stand-in balance cards at the mockups' 196px.
 *
 * @param count - How many of the sample accounts to show.
 * @returns The cards.
 */
const balanceCards = (count: number) => ACCOUNTS.slice(0, count).map(([name, balance]) => (
  <article key={name} className={CARD}>
    <p className="truncate type-body-sm text-muted">{name}</p>
    <p className="type-display-xs tabular-nums">{balance}</p>
  </article>
));

const meta = {
  title: 'Kit/CardRail',
  component: CardRail,
  args: {
    title: 'Balances',
    period: 'September/2026',
    children: balanceCards(ACCOUNTS.length),
  },
  argTypes: {
    as: { control: 'inline-radio', options: ['h2', 'h3'] },
  },
} satisfies Meta<CardRailProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** More cards than fit: the end fades and the forward arrow scrolls a page. */
export const Overflowing: Story = {};

/** Every card fits: no arrows and no fade. */
export const Fits: Story = {
  args: { children: balanceCards(2) },
};

/** Placeholder cards while the balances load. */
export const Loading: Story = {
  args: { loading: true, placeholderClassName: 'h-23 w-49' },
};
