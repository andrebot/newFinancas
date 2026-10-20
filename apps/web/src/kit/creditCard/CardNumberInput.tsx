import { TextField, type TextFieldProps } from '../textField/TextField';
import { useMaskedInput } from '../maskedInput/useMaskedInput';
import { cardNumberMask } from './cardNumber';

// The card number input (K48, OQ-187): the kit's text field in mockup 11's
// monospaced look, grouping the number as its network writes it while it is
// typed or pasted. The caller holds and gets the digits alone; it detects the
// network from them for the preview and keeps only the last four.

/** The card number input's props: the text field's, without its text styling or ref. */
export type CardNumberInputProps = Omit<TextFieldProps, 'inputClassName' | 'ref'>;

/**
 * Renders a labelled card number input. It holds no state: `value` is the
 * digits and `onChange` gets the new ones.
 *
 * @param props - The digits, change handler, field texts and native props.
 * @returns The card number input.
 */
export function CardNumberInput({ value, onChange, ...rest }: CardNumberInputProps) {
  const { ref, value: shown, onChange: change } = useMaskedInput({
    value, onChange, mask: cardNumberMask,
  });

  return (
    <TextField
      inputMode="numeric"
      autoComplete="cc-number"
      autoCorrect="off"
      spellCheck={false}
      {...rest}
      ref={ref}
      value={shown}
      onChange={change}
      inputClassName="font-mono tracking-wider tabular-nums"
    />
  );
}
