import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { Button, type ButtonVariant } from '../button/Button';
import { Icon, type IconName } from '../icons/Icon';
import { useConfirmFocus } from './useConfirmFocus';

// The kit's inline confirm (K26, OQ-142): the "are you sure?" that opens inside
// the card or row it is about — archive, delete, complete / reopen, revoke —
// as mockups 41 and 43 draw it. Coral when the step can't be undone, mint when
// it can. The kit only draws it; the caller opens it, runs the request and
// shows any failure.

/** Whether the step can be undone: coral when it can't, mint when it can. */
export type ConfirmTone = 'destructive' | 'reversible';

/** The tinted box's border and background, per tone. */
const SURFACES: Record<ConfirmTone, string> = {
  destructive: 'border-coral/30 bg-coral/10',
  reversible: 'border-mint/30 bg-mint/10',
};

/** The glyph shown before the message when the caller doesn't pick one. */
const ICONS: Record<ConfirmTone, IconName> = {
  destructive: 'warning-outline',
  reversible: 'check-circle-outline',
};

/** The glyph's colour, per tone. */
const ACCENTS: Record<ConfirmTone, string> = {
  destructive: 'text-coral',
  reversible: 'text-mint',
};

/** The confirm button's look, per tone. */
const CONFIRM_VARIANTS: Record<ConfirmTone, ButtonVariant> = {
  destructive: 'danger-solid',
  reversible: 'primary',
};

/** The ring the host card or row takes while its confirm is open, per tone. */
export const CONFIRM_RINGS: Record<ConfirmTone, string> = {
  destructive: 'ring-1 ring-coral/40',
  reversible: 'ring-1 ring-mint/40',
};

/** The inline confirm's props. */
export interface InlineConfirmProps {
  readonly tone: ConfirmTone;
  /** The question, already translated; may bold the item's name. */
  readonly message: ReactNode;
  /** The confirm button's label, e.g. "Archive". */
  readonly confirmLabel: string;
  /** The cancel button's label, e.g. "Cancel". */
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** While the caller's request runs: a spinner on confirm, cancel disabled. */
  readonly busy?: boolean | undefined;
  /** Another of the caller's requests runs: confirm waits, cancel still closes. */
  readonly disabled?: boolean | undefined;
  /** Replaces the tone's glyph, e.g. a revoke's own icon. */
  readonly icon?: IconName | undefined;
}

/**
 * Builds the key handler that cancels on Escape, unless a request is running.
 *
 * @param busy - Whether the caller's request is running.
 * @param cancel - What a cancel does.
 * @returns The confirm's key handler.
 */
export const cancelOnEscape = (busy: boolean, cancel: () => void) => (
  event: KeyboardEvent<HTMLElement>,
) => {
  if (event.key !== 'Escape' || busy) return;
  event.stopPropagation();
  cancel();
};

/**
 * Renders the inline confirm. It takes focus on Cancel when it opens, and a
 * cancel (the button or Escape) gives focus back to what held it before.
 *
 * @param props - The tone, the texts, the handlers, the busy and disabled states and the glyph.
 * @returns The confirm box.
 */
export function InlineConfirm({
  tone, message, confirmLabel, cancelLabel, onConfirm, onCancel, busy = false, disabled = false,
  icon,
}: InlineConfirmProps) {
  const messageId = useId();
  const { focusRef, restoreFocus } = useConfirmFocus<HTMLButtonElement>();
  const cancel = () => {
    onCancel();
    restoreFocus();
  };

  return (
    // The keys reach this group from its buttons; it isn't itself interactive.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="group"
      aria-labelledby={messageId}
      className={`flex flex-col gap-2.5 rounded-2xl border p-3 ${SURFACES[tone]}`}
      onKeyDown={cancelOnEscape(busy, cancel)}
    >
      <div className="flex items-start gap-2 type-body-sm text-ink">
        <Icon name={icon ?? ICONS[tone]} className={`mt-px size-4.5 shrink-0 ${ACCENTS[tone]}`} />
        <p id={messageId}>{message}</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button ref={focusRef} variant="ghost" size="sm" disabled={busy} onClick={cancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={CONFIRM_VARIANTS[tone]}
          size="sm"
          busy={busy}
          disabled={disabled && !busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
