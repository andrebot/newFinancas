import { TextField, type TextFieldProps } from '../textField/TextField';
import { useMaskedInput } from '../maskedInput/useMaskedInput';
import { backupCodeMask } from './backupCode';

// The backup code input (K17, OQ-139): the kit's text field in the mockup's
// monospaced, centred look, showing the code in dashed groups as it is typed
// or pasted. The caller holds and gets the clean code (no dashes, upper case).

/** The backup code input's props: the text field's, without its text styling or ref. */
export type BackupCodeInputProps = Omit<TextFieldProps, 'inputClassName' | 'ref'>;

/**
 * Renders a labelled backup code input. It holds no state: `value` is the
 * clean code and `onChange` gets the new one.
 *
 * @param props - The clean code, change handler, field texts and native props.
 * @returns The backup code input.
 */
export function BackupCodeInput({ value, onChange, ...rest }: BackupCodeInputProps) {
  const { ref, value: shown, onChange: change } = useMaskedInput({
    value, onChange, mask: backupCodeMask,
  });

  return (
    <TextField
      autoComplete="one-time-code"
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck={false}
      {...rest}
      ref={ref}
      value={shown}
      onChange={change}
      inputClassName="font-mono tracking-[.2em] text-center"
    />
  );
}
