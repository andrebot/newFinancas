import { useId, type FormEvent, type ReactNode } from 'react';
import { Button } from '../button/Button';
import { Icon } from '../icons/Icon';
import { TextField } from '../textField/TextField';
import { cancelOnEscape } from './InlineConfirm';
import { useConfirmFocus } from './useConfirmFocus';

// The kit's type-to-confirm (K27, OQ-143): the last step of Delete Account and
// Household Deletion, where the user types the item's name (the household's
// name, their own email) before the coral confirm unlocks. It wears the
// destructive inline confirm's box (OQ-142) with a text field inside. The kit
// holds no state: the Flow keeps the typed text, runs the request and shows
// any failure; where the box sits (a section, a dialog) is the Flow's too.

/** The type-to-confirm's props. */
export interface TypeToConfirmProps {
  /** The warning, already translated; may bold the item's name. */
  readonly message: ReactNode;
  /** What must be typed, e.g. the household's name. */
  readonly phrase: string;
  /** The typed text; the Flow holds it. */
  readonly value: string;
  /** Gets the new text. */
  readonly onChange: (value: string) => void;
  /** The field's label, already translated, e.g. 'Type "Casa Silva" to confirm'. */
  readonly label: string;
  /** The confirm button's label, e.g. "Delete household". */
  readonly confirmLabel: string;
  /** The cancel button's label, e.g. "Cancel". */
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** While the caller's request runs: a spinner on confirm, the rest disabled. */
  readonly busy?: boolean | undefined;
}

/**
 * Tells whether the typed text is the phrase: spaces around either are
 * ignored, everything else — case included — must be the same. An empty
 * phrase never matches.
 *
 * @param value - The typed text.
 * @param phrase - What must be typed.
 * @returns Whether the confirm may run.
 */
export const matchesPhrase = (value: string, phrase: string) => {
  const expected = phrase.trim();
  return expected !== '' && value.trim() === expected;
};

/**
 * Builds the submit handler: Enter in the field, or the confirm button, runs
 * the confirm only once the phrase matches and no request is running.
 *
 * @param ready - Whether the phrase matches and nothing is running.
 * @param confirm - What a confirm does.
 * @returns The form's submit handler.
 */
export const confirmOnSubmit = (ready: boolean, confirm: () => void) => (
  event: FormEvent<HTMLFormElement>,
) => {
  event.preventDefault();
  if (ready) confirm();
};

/**
 * Renders the type-to-confirm. It takes focus on the field when it opens, and
 * a cancel (the button or Escape) gives focus back to what held it before.
 *
 * @param props - The message, phrase, typed text, texts, handlers and busy state.
 * @returns The confirm box.
 */
export function TypeToConfirm({
  message, phrase, value, onChange, label, confirmLabel, cancelLabel,
  onConfirm, onCancel, busy = false,
}: TypeToConfirmProps) {
  const messageId = useId();
  const { focusRef, restoreFocus } = useConfirmFocus<HTMLInputElement>();
  const matches = matchesPhrase(value, phrase);
  const cancel = () => {
    onCancel();
    restoreFocus();
  };

  return (
    // The keys reach this form from its controls; it isn't itself interactive.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <form
      aria-labelledby={messageId}
      noValidate
      className="flex flex-col gap-3 rounded-2xl border border-coral/30 bg-coral/10 p-3"
      onKeyDown={cancelOnEscape(busy, cancel)}
      onSubmit={confirmOnSubmit(matches && !busy, onConfirm)}
    >
      <div className="flex items-start gap-2 type-body-sm text-ink">
        <Icon name="warning-outline" className="mt-px size-4.5 shrink-0 text-coral" />
        <p id={messageId}>{message}</p>
      </div>
      <TextField
        ref={focusRef}
        label={label}
        value={value}
        onChange={onChange}
        disabled={busy}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={cancel}>
          {cancelLabel}
        </Button>
        <Button type="submit" variant="danger-solid" size="sm" busy={busy} disabled={!matches}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}
