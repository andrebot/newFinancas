import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Button } from '../../../src/kit/button/Button';
import { Dialog, type DialogProps } from '../../../src/kit/dialog/Dialog';
import { TextField } from '../../../src/kit/textField/TextField';

// The dialog (K21, OQ-241). The caller holds the open state, so each story
// keeps it and opens it from a button; `onClose` shows each close request
// (Esc, the scrim, the ✕) in the actions panel. Narrow the viewport below
// `md` to see the full-screen sheet.

/**
 * Builds Cancel / Download CSV, as mockup 24 has them; both close the dialog.
 *
 * @param close - Closes the dialog.
 * @returns The actions.
 */
const actions = (close: () => void) => (
  <>
    <Button variant="ghost" onClick={close}>Cancel</Button>
    <Button variant="primary" onClick={close}>Download CSV</Button>
  </>
);

/**
 * Renders a button that opens the dialog, holding its open state. A `footer`
 * arg turns on the actions row, whose buttons close it.
 *
 * @param props - The story's args: the heading, badge, body, footer and close handler.
 * @returns The opener and the dialog.
 */
function Interactive({
  open: initial, onClose, footer, ...rest
}: DialogProps) {
  const [open, setOpen] = useState(initial);
  const close = () => setOpen(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      <Dialog
        {...rest}
        open={open}
        footer={footer ? actions(close) : undefined}
        onClose={() => {
          close();
          onClose();
        }}
      />
    </>
  );
}

/**
 * The date range from mockup 24, to fill the body.
 *
 * @returns The fields and the note.
 */
function RangeFields() {
  const [from, setFrom] = useState('03/07/2026');
  const [to, setTo] = useState('01/10/2026');
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="From" value={from} onChange={setFrom} />
        <TextField label="To" value={to} onChange={setTo} />
      </div>
      <p className="type-caption text-faint">
        Who did what and when — actor, action, entity type and ID. No amounts or personal details.
      </p>
    </div>
  );
}

const meta = {
  title: 'Kit/Dialog',
  component: Dialog,
  render: (args) => <Interactive {...args} />,
  args: {
    open: true,
    title: 'Export audit log',
    subtitle: 'The Doe Household · CSV',
    icon: 'download',
    children: <RangeFields />,
    footer: true,
    onClose: fn(),
  },
} satisfies Meta<DialogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The audit-log export (mockup 24). */
export const AuditExport: Story = {};

/** A long body scrolls; the card never grows past the viewport. */
export const LongBody: Story = {
  args: {
    children: (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 30 }, (_, line) => <p key={line}>{`Line ${line + 1}`}</p>)}
      </div>
    ),
  },
};

/** No badge, subtitle or footer. */
export const Plain: Story = {
  args: {
    icon: undefined, subtitle: undefined, footer: undefined, title: 'About this export',
  },
};
