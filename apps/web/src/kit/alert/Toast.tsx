import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../button/Button';
import { IconButton } from '../button/IconButton';
import { Icon } from '../icons/Icon';
import { LAYERS } from '../popover/overlay';
import {
  defaultDurationOf, roleOf, TONE_ACCENTS, TONE_ICONS, type AlertTone,
} from './tones';
import { useAutoDismiss } from './useAutoDismiss';

// The kit's toast (K25, OQ-141): a brief note after a save or an error, that
// floats over the page and goes away on its own. `ToastRegion` stacks them at
// the bottom-right on a desktop and across the bottom on a phone, above the
// floating Record button. AlertUtility (FU3) decides which toasts are shown;
// the kit only draws them and runs each one's timer.

/** A toast's one action, e.g. "Retry". */
export interface ToastAction {
  /** The button's text, already translated. */
  readonly label: string;
  /** Runs on a click; the toast then closes. */
  readonly onAction: () => void;
}

/** The toast's props. */
export interface ToastProps {
  readonly tone: AlertTone;
  /** What happened, already translated. */
  readonly message: string;
  /** Closes the toast: the close button, the action and the timer call it. */
  readonly onDismiss: () => void;
  /** The close button's name, already translated, e.g. "Dismiss". */
  readonly dismissLabel: string;
  readonly action?: ToastAction | undefined;
  /** In ms; `null` keeps it until closed. Defaults by tone (`defaultDurationOf`). */
  readonly duration?: number | null | undefined;
}

/** The toast region's props. */
export interface ToastRegionProps {
  /** The region's name for screen readers, already translated, e.g. "Notifications". */
  readonly label: string;
  /** The toasts, oldest first; the newest sits at the bottom. */
  readonly children?: ReactNode;
}

/**
 * Renders one toast: the tone's glyph, the message, the optional action and
 * a close button, on the floating panels' surface. Its timer pauses while it
 * is hovered or focused.
 *
 * @param props - The tone, the message, the action, how to close it and when.
 * @returns The toast.
 */
export function Toast({
  tone, message, onDismiss, dismissLabel, action, duration = defaultDurationOf(tone),
}: ToastProps) {
  const pauseHandlers = useAutoDismiss(duration, onDismiss);

  /** Runs the action, then closes the toast. */
  const runAction = () => {
    action?.onAction();
    onDismiss();
  };

  return (
    <div
      {...pauseHandlers}
      role={roleOf(tone)}
      className={[
        'pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl border border-line',
        'bg-raised py-2.5 pr-2 pl-3.5 text-ink shadow-overlay motion-safe:animate-toast-in',
      ].join(' ')}
    >
      <Icon name={TONE_ICONS[tone]} className={`size-5 shrink-0 ${TONE_ACCENTS[tone]}`} />
      <p className="min-w-0 flex-1 type-body-sm">{message}</p>
      {action && (
        <Button variant="secondary" size="sm" onClick={runAction}>{action.label}</Button>
      )}
      <IconButton icon="close" label={dismissLabel} size="xs" onClick={onDismiss} />
    </div>
  );
}

/**
 * Renders the fixed stack the toasts sit in, in a portal on `<body>`, so no
 * card or drawer clips it. It lets clicks through between its toasts.
 *
 * @param props - The region's name and its toasts.
 * @returns The region, portalled to `<body>`.
 */
export function ToastRegion({ label, children }: ToastRegionProps) {
  return createPortal(
    <section
      aria-label={label}
      className={[
        `pointer-events-none fixed inset-x-4 bottom-24 ${LAYERS.toast} flex flex-col gap-2`,
        'sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-90',
      ].join(' ')}
    >
      {children}
    </section>,
    document.body,
  );
}
