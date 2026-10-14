import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button, type ButtonProps } from '../../../src/kit/button/Button';

// The kit's text button (K4, OQ-136): the mockups' actions, from the auth
// CTA (01, `xl` primary, elevated) and Account Setup's "Add Account" (40,
// `lg`) to the members' "Remove" (60, `sm` danger ghost).

const VARIANTS = [
  'primary', 'tonal', 'secondary', 'ghost', 'danger', 'danger-ghost', 'danger-solid',
] as const;

const meta = {
  title: 'Kit/Button',
  component: Button,
  args: {
    children: 'Save', variant: 'primary', onClick: fn(),
  },
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'xl'] },
  },
} satisfies Meta<ButtonProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The main action. */
export const Primary: Story = {};

/** Every variant, at the default size and disabled. */
export const Variants: Story = {
  render: () => (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-3">
        {VARIANTS.map((variant) => <Button key={variant} variant={variant}>{variant}</Button>)}
      </div>
      <div className="flex flex-wrap gap-3">
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant} disabled>{variant}</Button>
        ))}
      </div>
    </div>
  ),
};

/** The four heights: 32, 36, 40 and 46px. */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" size="sm">Small</Button>
      <Button variant="primary">Medium</Button>
      <Button variant="primary" size="lg" leadingIcon="add">Add Account</Button>
      <Button variant="primary" size="xl" trailingIcon="arrow-forward">Sign in</Button>
    </div>
  ),
};

/** The auth CTA: full width, raised on its glow. */
export const AuthCta: Story = {
  args: {
    size: 'xl',
    elevated: true,
    trailingIcon: 'arrow-forward',
    children: 'Sign in',
    className: 'w-full',
  },
  decorators: [(StoryElement) => <div className="max-w-100">{StoryElement()}</div>],
};

/** Busy: the spinner covers the label, the width holds and clicks are ignored. */
export const Busy: Story = {
  args: { busy: true, children: 'Create account', size: 'lg' },
};

/** A row's destructive action, as on the members list. */
export const RowRemove: Story = {
  args: { variant: 'danger-ghost', size: 'sm', children: 'Remove' },
};
