import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Toast, ToastRegion, type ToastProps } from '../../../src/kit/alert/Toast';
import type { AlertTone } from '../../../src/kit/alert/tones';
import { Button } from '../../../src/kit/button/Button';

// The kit's toast (K25, OQ-141). The single stories hold each toast still
// (`duration: null`) so it can be inspected; Live Region pushes real ones
// into the fixed region, with their default timers, as AlertUtility (FU3)
// will. No mockup draws a toast; the texts echo a save and its failure.

const meta = {
  title: 'Kit/Toast',
  component: Toast,
  args: {
    tone: 'success',
    message: 'Transaction saved.',
    dismissLabel: 'Dismiss',
    onDismiss: fn(),
    duration: null,
  },
  decorators: [(Story) => <div className="max-w-90"><Story /></div>],
} satisfies Meta<ToastProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A save went through. */
export const Success: Story = {};

/** A note. */
export const Info: Story = {
  args: { tone: 'info', message: 'Rates are refreshed every morning.' },
};

/** A caution; it stays until closed. */
export const Warning: Story = {
  args: { tone: 'warning', message: 'This budget is over by R$250.00.' },
};

/** A failure with a way forward; it stays until closed. */
export const ErrorWithAction: Story = {
  args: {
    tone: 'error',
    message: "Couldn't save the transaction.",
    action: { label: 'Retry', onAction: fn() },
  },
};

/** A toast pushed into the region. */
interface PushedToast {
  readonly id: number;
  readonly tone: AlertTone;
}

const MESSAGES: Record<AlertTone, string> = {
  success: 'Transaction saved.',
  info: 'Rates are refreshed every morning.',
  warning: 'This budget is over by R$250.00.',
  error: "Couldn't save the transaction.",
};

/**
 * Renders buttons that push toasts of each tone into a live region, where
 * each one closes on its own timer or its close button.
 *
 * @returns The push buttons and the region.
 */
function LiveRegionDemo() {
  const [toasts, setToasts] = useState<readonly PushedToast[]>([]);
  const [nextId, setNextId] = useState(1);

  /**
   * Adds a toast of the given tone to the bottom of the stack.
   *
   * @param tone - The new toast's tone.
   */
  const push = (tone: AlertTone) => {
    setToasts((current) => [...current, { id: nextId, tone }]);
    setNextId((id) => id + 1);
  };

  /**
   * Removes a toast from the stack.
   *
   * @param id - The toast to remove.
   */
  const remove = (id: number) => {
    setToasts((current) => current.filter((pushed) => pushed.id !== id));
  };

  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(MESSAGES) as AlertTone[]).map((tone) => (
        <Button key={tone} size="sm" onClick={() => push(tone)}>{tone}</Button>
      ))}
      <ToastRegion label="Notifications">
        {toasts.map(({ id, tone }) => (
          <Toast
            key={id}
            tone={tone}
            message={MESSAGES[tone]}
            dismissLabel="Dismiss"
            onDismiss={() => remove(id)}
          />
        ))}
      </ToastRegion>
    </div>
  );
}

/** Push toasts; success and info fade after 5s, warnings and errors stay. */
export const LiveRegion: Story = {
  render: () => <LiveRegionDemo />,
};
