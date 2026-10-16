import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../../src/kit/button/Button';
import { IconButton } from '../../../src/kit/button/IconButton';
import { Menu, type MenuTriggerProps } from '../../../src/kit/menu/Menu';
import {
  Tooltip, type TooltipProps, type TooltipTriggerProps,
} from '../../../src/kit/tooltip/Tooltip';

// The kit's tooltip (K24, OQ-160). Rest the pointer on a trigger, or tab to
// it: the chip names it. Touch never shows one.

/**
 * Draws the members list's remove button, named by its tooltip.
 *
 * @param props - The props the tooltip hands its trigger.
 * @returns The button.
 */
const removeButton = (props: TooltipTriggerProps) => (
  <IconButton {...props} icon="person-remove-outline" label="Remove Sam Costa" />
);

/**
 * Draws the Owner's swap button: a menu trigger with a tooltip.
 *
 * @param props - The props the menu hands its trigger.
 * @returns The button with its tooltip.
 */
const swapTrigger = (props: MenuTriggerProps) => (
  <Tooltip content="Transfer ownership" repeatsName triggerProps={props}>
    {(tip) => <IconButton {...tip} icon="swap-horiz" label="Transfer ownership" />}
  </Tooltip>
);

const meta = {
  title: 'Kit/Tooltip',
  component: Tooltip,
  decorators: [(Story) => <div className="grid min-h-48 place-items-center p-4"><Story /></div>],
  args: {
    content: 'Remove Sam Costa',
    repeatsName: true,
    children: removeButton,
  },
} satisfies Meta<TooltipProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** An icon button named by its tooltip, as in the members list. */
export const IconButtonName: Story = {};

/** Below the trigger instead; it flips by itself when out of room. */
export const Below: Story = {
  args: { placement: 'bottom' },
};

/** A disabled control, wrapped so the reason still shows on hover or focus. */
export const DisabledReason: Story = {
  render: () => (
    <Tooltip content="Groceries already has a budget this month">
      <Button disabled>Add budget</Button>
    </Tooltip>
  ),
};

/** On a menu's trigger: the tooltip on hover, the menu on click. */
export const OnAMenuTrigger: Story = {
  render: () => (
    <Menu
      label="Transfer ownership"
      entries={[
        {
          kind: 'action', id: 'alex', label: 'Alex Rivera', onSelect: () => {},
        },
        {
          kind: 'action', id: 'sam', label: 'Sam Costa', onSelect: () => {},
        },
      ]}
      trigger={swapTrigger}
    />
  ),
};
