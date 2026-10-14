import { CARD_NETWORKS } from '@financas/reference';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CardNetworkLogo } from '../../../src/kit/icons/CardNetworkLogo';

// A card network's logo (K3, OQ-126): 1em tall, its own colours and
// proportions. `other` falls back to the generic card icon.

const meta = {
  title: 'Kit/Icons/CardNetworkLogo',
  component: CardNetworkLogo,
  argTypes: {
    network: { control: 'select', options: CARD_NETWORKS },
  },
} satisfies Meta<typeof CardNetworkLogo>;

export default meta;

type Story = StoryObj<typeof meta>;

/** One logo; pick any network and try height utilities. */
export const Playground: Story = {
  args: { network: 'visa', label: 'Visa', className: 'h-8' },
};

/** Every network, on a card surface as the app shows them. */
export const AllNetworks: Story = {
  args: { network: 'visa' },
  render: () => (
    <ul className="flex flex-wrap gap-3">
      {CARD_NETWORKS.map((network) => (
        <li
          key={network}
          className="flex flex-col items-center gap-2 rounded-xl border border-line bg-card p-4"
        >
          <CardNetworkLogo network={network} className="h-8" />
          <code className="font-mono type-caption text-muted">{network}</code>
        </li>
      ))}
    </ul>
  ),
};
