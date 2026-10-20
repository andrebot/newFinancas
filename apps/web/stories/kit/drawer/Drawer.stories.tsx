import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Button } from '../../../src/kit/button/Button';
import { Drawer, type DrawerProps } from '../../../src/kit/drawer/Drawer';
import { TextField } from '../../../src/kit/textField/TextField';

// The drawer (K20, OQ-191). The caller holds the open state, so each story
// keeps it and opens it from a button; `onClose` shows each close request
// (Esc, the scrim, the ✕) in the actions panel. Narrow the viewport below
// `md` to see the full-screen sheet.

/**
 * Renders a button that opens the drawer, holding its open state.
 *
 * @param props - The story's args: the heading, body, footer and close handler.
 * @returns The opener and the drawer.
 */
function Interactive({ open: initial, onClose, ...rest }: DrawerProps) {
  const [open, setOpen] = useState(initial);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open drawer</Button>
      <Drawer
        {...rest}
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
      />
    </>
  );
}

/**
 * The edit form from mockup 40, to fill the body.
 *
 * @returns The fields.
 */
function AccountFields() {
  const [name, setName] = useState('Main Checking');
  return (
    <div className="flex flex-col gap-5">
      <TextField label="Account name" value={name} onChange={setName} />
      <p className="type-body-sm text-muted">
        Type and currency can&apos;t be changed after an account is created.
      </p>
    </div>
  );
}

/** Cancel / Save, as the forms pin them. */
const footer = (
  <>
    <Button variant="ghost">Cancel</Button>
    <Button variant="primary">Save</Button>
  </>
);

const meta = {
  title: 'Kit/Drawer',
  component: Drawer,
  render: (args) => <Interactive {...args} />,
  args: {
    open: true,
    title: 'Main Checking',
    caption: 'Edit account',
    children: <AccountFields />,
    footer,
    onClose: fn(),
  },
} satisfies Meta<DrawerProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** An Edit form (mockup 40). */
export const EditForm: Story = {};

/** A long body scrolls between the pinned heading and footer. */
export const LongBody: Story = {
  args: {
    title: 'Record Transaction',
    caption: 'New',
    children: (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 30 }, (_, line) => <p key={line}>{`Line ${line + 1}`}</p>)}
      </div>
    ),
  },
};

/** No caption and no footer. */
export const Plain: Story = {
  args: { caption: undefined, footer: undefined, title: 'Value history' },
};
