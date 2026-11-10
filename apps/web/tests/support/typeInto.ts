import { fireEvent, screen } from '@testing-library/react';

// Types into a masked field (K7, K8, K9) as the browser does: sets the text,
// puts the caret at its end and fires the input event React reads. Shared by
// the suites that fill the History editor's and its callers' forms.

/**
 * Types into a field as the browser does, then fires the input event React reads.
 *
 * @param name - The field's label.
 * @param text - Its text after the edit.
 */
const typeInto = (name: string, text: string) => {
  const input = screen.getByRole<HTMLInputElement>('textbox', { name });
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, text);
  input.setSelectionRange(text.length, text.length);
  fireEvent.input(input);
};

export default typeInto;
