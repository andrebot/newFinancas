import { useId, useState } from 'react';
import { IconButton } from '../button/IconButton';
import { joinIds, TextField, type TextFieldProps } from '../textField/TextField';
import type { PasswordStrength } from '../../utilities/passwordStrength';
import { StrengthMeter } from './StrengthMeter';

// The kit's password field (K6, OQ-144): the text field (K5) masked, with an
// eye button in its trailing slot that shows the password and hides it again,
// and, on register / reset / change password, the strength meter under the
// box. The button keeps one name ("Show password") and reports its state with
// `aria-pressed`; its icon shows what a press does. The field holds only that
// visibility: the value stays with the caller, as in every kit input.

/** The meter's reading and its caption, already worded by `strengthCaption`. */
export interface PasswordFieldStrength {
  readonly reading: PasswordStrength;
  readonly caption: string;
}

/** The password field's props: the text field's, without `type` and the trailing slot. */
export interface PasswordFieldProps
  extends Omit<TextFieldProps, 'type' | 'trailing' | 'footer'> {
  /** The eye button's name, already translated, e.g. "Show password". */
  readonly revealLabel: string;
  /** Shows the meter under the box; absent on Sign in and the current password. */
  readonly strength?: PasswordFieldStrength | undefined;
}

/**
 * Renders a masked password input with a show / hide button and, when given
 * a reading, the strength meter. The input never spell-checks, capitalises
 * or corrects, so a shown password isn't marked up or altered.
 *
 * @param props - The text field's props, the eye button's name and the strength.
 * @returns The password field.
 */
export function PasswordField({
  revealLabel, strength, disabled, 'aria-describedby': describedBy, ...textField
}: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const captionId = `${useId()}-strength`;

  return (
    <TextField
      spellCheck={false}
      autoCapitalize="none"
      autoCorrect="off"
      {...textField}
      type={revealed ? 'text' : 'password'}
      disabled={disabled}
      aria-describedby={joinIds(describedBy, strength && captionId)}
      trailing={(
        <IconButton
          type="button"
          size="xs"
          icon={revealed ? 'visibility-off-outline' : 'visibility-outline'}
          label={revealLabel}
          aria-pressed={revealed}
          disabled={disabled}
          onClick={() => setRevealed((shown) => !shown)}
        />
      )}
      footer={strength && (
        <StrengthMeter
          reading={strength.reading}
          caption={strength.caption}
          captionId={captionId}
        />
      )}
    />
  );
}
