import type { Meta, StoryObj } from '@storybook/react-vite';
import { CARD_NETWORKS, detectCardNetwork } from '@financas/reference';
import { useState } from 'react';
import { CardNumberInput } from '../../../src/kit/creditCard/CardNumberInput';
import { CardPreview, type CardPreviewProps } from '../../../src/kit/creditCard/CardPreview';
import { useI18n } from '../../../src/utilities/I18nProvider';

// The live credit-card preview (K48, OQ-187), as in mockup 11's add-card
// form. `Live` wires it to the card number input the way the form
// will: the network is detected from the digits, and the caption names it
// from the catalog in the toolbar's locale. The other stories show it alone.

/**
 * Renders the card number input beside the preview, the network detected
 * from the digits as they are typed.
 *
 * @param props - The story's args: the starting digits and the texts on the card.
 * @returns The input and the live preview.
 */
function LiveWithInput({ digits: initial, billing, expiry }: CardPreviewProps) {
  const [digits, setDigits] = useState(initial);
  const { text } = useI18n();
  const network = detectCardNetwork(digits);
  const caption = network === 'other'
    ? undefined
    : text('creditCard', 'detected', { network: text('cardNetworks', network) });
  return (
    <div className="grid grid-cols-[250px_1fr] gap-5">
      <CardPreview
        network={network}
        digits={digits}
        billing={billing}
        expiry={expiry}
        caption={caption}
      />
      <CardNumberInput label={text('creditCard', 'number')} value={digits} onChange={setDigits} />
    </div>
  );
}

const meta = {
  title: 'Kit/Credit card/CardPreview',
  component: CardPreview,
  args: {
    network: 'mastercard',
    digits: '550209424242',
    billing: 'Closes 05 · Due 12',
    expiry: '03/28',
    caption: 'Mastercard detected from the number',
  },
  argTypes: {
    network: { control: 'select', options: [...CARD_NETWORKS] },
  },
  decorators: [(Story) => <div className="max-w-[640px] rounded-2xl bg-bg p-4"><Story /></div>],
} satisfies Meta<CardPreviewProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Typing a number: the network, its colour and the groups follow the digits. */
export const Live: Story = {
  render: (args) => <LiveWithInput key={args.digits} {...args} />,
};

/** Part of a Mastercard number, as on mockup 11. */
export const Typing: Story = {
  decorators: [(Story) => <div className="w-[250px]"><Story /></div>],
};

/** An Amex number, grouped 4-6-5. */
export const Amex: Story = {
  args: {
    network: 'amex',
    digits: '378282246310005',
    caption: 'American Express detected from the number',
  },
  decorators: [(Story) => <div className="w-[250px]"><Story /></div>],
};

/** Editing a saved card: no number typed, only its last four digits. */
export const Saved: Story = {
  args: {
    network: 'visa',
    digits: '',
    last4: '1111',
    billing: 'Closes 15 · Due 22',
    expiry: '09/30',
    caption: undefined,
  },
  decorators: [(Story) => <div className="w-[250px]"><Story /></div>],
};

/** Nothing typed yet: an unknown network on the neutral card. */
export const Empty: Story = {
  args: {
    network: 'other', digits: '', billing: undefined, expiry: undefined, caption: undefined,
  },
  decorators: [(Story) => <div className="w-[250px]"><Story /></div>],
};
