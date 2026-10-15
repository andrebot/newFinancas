import {
  useLayoutEffect, useRef, useState, type RefObject,
} from 'react';

// The shared caret handling of every masked kit input (OQ-137, OQ-139): the
// backup code (K17) first, then money, rates, dates and the card number (K7,
// K8, K9, K48). A mask only changes what is on screen; the caller holds and
// gets the clean value. After each edit the caret is put back after the same
// number of clean characters it followed, so typing or deleting mid-text
// doesn't throw it to the end when the separators move.

/** How a masked input turns its clean value into text on screen, and back. */
export interface Mask {
  /** Clean value → the text shown, e.g. `7HJX21NA` → `7HJX-21NA`. */
  readonly format: (clean: string) => string;
  /**
   * Any typed text → the clean value: separators and rejected characters
   * dropped. It must read each character on its own, so a prefix of the text
   * parses to a prefix of the value, and `parse(format(clean))` is `clean`.
   */
  readonly parse: (text: string) => string;
}

/** An edit's outcome: the new clean value and how many clean characters precede the caret. */
export interface MaskedEdit {
  readonly clean: string;
  readonly cleanBeforeCaret: number;
}

/** What the hook needs: the clean value, where changes go and the mask. */
export interface MaskedInputInput {
  readonly value: string;
  readonly onChange: (clean: string) => void;
  readonly mask: Mask;
}

/** What the hook gives the input: its ref, the text shown and its change handler. */
export interface MaskedInputBinding {
  readonly ref: RefObject<HTMLInputElement | null>;
  readonly value: string;
  /** Takes the input's whole new text, as the kit's text field reports it. */
  readonly onChange: (typed: string) => void;
}

/**
 * Finds the position in a text just after its `count`-th clean character.
 *
 * @param parse - The mask's parser, which says which characters are clean.
 * @param text - The text shown.
 * @param count - How many clean characters the caret follows.
 * @returns The caret position: 0 for none, the text's end when it has fewer.
 */
export const positionAfterClean = (
  parse: Mask['parse'],
  text: string,
  count: number,
): number => {
  if (count <= 0) {
    return 0;
  }
  for (let position = 1; position < text.length; position += 1) {
    if (parse(text.slice(0, position)).length >= count) {
      return position;
    }
  }
  return text.length;
};

/**
 * Reads an edit to a masked input. When it only removed a separator (a
 * backspace over the dash), the clean character before it goes instead;
 * otherwise the separator would come straight back and the key would do nothing.
 *
 * @param mask - The input's mask.
 * @param shown - The text shown before the edit.
 * @param typed - The input's text after the edit.
 * @param caret - The caret position in `typed`.
 * @returns The new clean value and how many clean characters precede the caret.
 */
export const readMaskedEdit = (
  mask: Mask,
  shown: string,
  typed: string,
  caret: number,
): MaskedEdit => {
  const clean = mask.parse(typed);
  const cleanBeforeCaret = mask.parse(typed.slice(0, caret)).length;
  const removedSeparator = typed.length < shown.length && clean === mask.parse(shown);
  if (!removedSeparator || cleanBeforeCaret === 0) {
    return { clean, cleanBeforeCaret };
  }
  return {
    clean: clean.slice(0, cleanBeforeCaret - 1) + clean.slice(cleanBeforeCaret),
    cleanBeforeCaret: cleanBeforeCaret - 1,
  };
};

/**
 * Masks a controlled text input: it shows `mask.format(value)`, reports the
 * clean value of each edit and keeps the caret beside the character it was
 * next to. Spread the result onto the kit's `TextField` (`ref`, `value`,
 * `onChange`).
 *
 * @param input - The clean value, the change handler and the mask.
 * @returns The ref, shown text and change handler for the input.
 */
export function useMaskedInput({ value, onChange, mask }: MaskedInputInput): MaskedInputBinding {
  const ref = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  // Bumped on every edit, so the caret is placed even when the value doesn't
  // change (a rejected character) and React only restores the text.
  const [edits, setEdits] = useState(0);
  const shown = mask.format(value);

  useLayoutEffect(() => {
    const element = ref.current;
    if (pendingCaret.current === null || !element) {
      return;
    }
    const position = positionAfterClean(mask.parse, element.value, pendingCaret.current);
    element.setSelectionRange(position, position);
    pendingCaret.current = null;
  }, [edits, shown, mask]);

  const change = (typed: string) => {
    const caret = ref.current?.selectionStart ?? typed.length;
    const edit = readMaskedEdit(mask, shown, typed, caret);
    pendingCaret.current = edit.cleanBeforeCaret;
    setEdits((count) => count + 1);
    if (edit.clean !== value) {
      onChange(edit.clean);
    }
  };

  return { ref, value: shown, onChange: change };
}
