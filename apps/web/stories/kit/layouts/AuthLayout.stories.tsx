import type { Meta, StoryObj } from '@storybook/react-vite';
import { AuthLayout, type AuthLayoutProps } from '../../../src/kit/layouts/AuthLayout';

// The kit's auth layout (K34, OQ-135), with mockup 01's sign-in heading in
// place of the form (K5 and K4 aren't built yet). The brand panel follows
// the toolbar's locale; narrow the canvas below `lg` to see it give way.

const meta = {
  title: 'Kit/Layouts/AuthLayout',
  component: AuthLayout,
  args: {
    children: (
      <div>
        <h1 className="type-display-md">Welcome back</h1>
        <p className="mt-1.5 text-muted">Sign in to your household&apos;s finances.</p>
      </div>
    ),
  },
} satisfies Meta<AuthLayoutProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The sign-in page's frame. */
export const SignIn: Story = {};
