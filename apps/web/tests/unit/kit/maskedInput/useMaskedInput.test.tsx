import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  caretCount, caretPosition, positionAfterClean, positionBeforeClean, readMaskedEdit,
  useMaskedInput, type Mask,
} from '../../../../src/kit/maskedInput/useMaskedInput';

// Kit hook (BDT: Interaction tier → unit): nothing is mocked. A plain input
// and a small test mask (digits in dotted threes) stand in for the kit's
// masked inputs.

const digitsMask: Mask = {
  format: (clean) => clean.match(/.{1,3}/g)?.join('.') ?? '',
  parse: (text) => text.replace(/\D/g, ''),
};

// Cents that fill from the right, as the money input's do: `123` is `1,23`.
const centsMask: Mask = {
  format: (clean) => (clean ? clean.padStart(3, '0').replace(/(\d{2})$/, ',$1') : ''),
  parse: digitsMask.parse,
  anchor: 'end',
};

/**
 * Replaces an input's text and caret as the browser does mid-edit, then
 * fires the input event React reads.
 *
 * @param input - The input edited.
 * @param text - Its text after the edit.
 * @param caret - Where the caret ends up.
 */
const editTo = (input: HTMLInputElement, text: string, caret: number) => {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, text);
  input.setSelectionRange(caret, caret);
  fireEvent.input(input);
};

/**
 * A plain input masked by the hook, holding its clean value like a caller.
 *
 * @param props - The starting clean value and a spy for the reported values.
 * @returns The masked input.
 */
function Harness({ initial, onChange, mask = digitsMask }: {
  initial: string;
  onChange: (clean: string) => void;
  mask?: Mask | undefined;
}) {
  const [value, setValue] = useState(initial);
  const { ref, value: shown, onChange: change } = useMaskedInput({
    value,
    mask,
    onChange: (clean) => {
      // Padding zeros are dropped, as the money input drops them.
      setValue(clean.replace(/^0+/, ''));
      onChange(clean);
    },
  });
  return (
    <input
      aria-label="Número"
      ref={ref}
      value={shown}
      onChange={(event) => change(event.target.value)}
    />
  );
}

/**
 * Renders the harness and finds its input.
 *
 * @param initial - The starting clean value.
 * @param mask - The mask; the dotted digits by default.
 * @returns The input and the change spy.
 */
const renderHarness = (initial: string, mask?: Mask) => {
  const onChange = vi.fn();
  render(<Harness initial={initial} onChange={onChange} mask={mask} />);
  return { input: screen.getByRole<HTMLInputElement>('textbox'), onChange };
};

describe('positionAfterClean', () => {
  it('is the start when the caret follows no clean character', () => {
    expect(positionAfterClean(digitsMask.parse, '123.4', 0)).toBe(0);
  });

  it('stops right after the counted character, before a separator', () => {
    expect(positionAfterClean(digitsMask.parse, '123.4', 3)).toBe(3);
    expect(positionAfterClean(digitsMask.parse, '123.4', 4)).toBe(5);
  });

  it('is the end when the text has fewer clean characters', () => {
    expect(positionAfterClean(digitsMask.parse, '12', 5)).toBe(2);
  });
});

describe('positionBeforeClean', () => {
  it('is the end when no clean character follows the caret', () => {
    expect(positionBeforeClean(centsMask.parse, '1,23', 0)).toBe(4);
  });

  it('stops right before the counted character from the end', () => {
    expect(positionBeforeClean(centsMask.parse, '1,23', 2)).toBe(2);
    expect(positionBeforeClean(centsMask.parse, '1,23', 3)).toBe(0);
  });

  it('is the start when the text has fewer clean characters', () => {
    expect(positionBeforeClean(centsMask.parse, '0,23', 5)).toBe(0);
  });
});

describe('caretCount', () => {
  const edit = { clean: '0012', cleanBeforeCaret: 1 };

  it('counts the clean characters before the caret for a start mask', () => {
    expect(caretCount(digitsMask, edit)).toBe(1);
  });

  it('counts the clean characters after the caret for an end mask', () => {
    expect(caretCount(centsMask, edit)).toBe(3);
  });
});

describe('caretPosition', () => {
  it('counts from the start or the end, as the mask is anchored', () => {
    expect(caretPosition(digitsMask, '123.4', 4)).toBe(5);
    expect(caretPosition(centsMask, '0,23', 2)).toBe(2);
  });
});

describe('readMaskedEdit', () => {
  it('reads the clean value and the clean characters before the caret', () => {
    expect(readMaskedEdit(digitsMask, '123.4', '1293.4', 3)).toEqual({
      clean: '12934',
      cleanBeforeCaret: 3,
    });
  });

  it('removes the character before a separator deleted alone', () => {
    expect(readMaskedEdit(digitsMask, '123.4', '1234', 3)).toEqual({
      clean: '124',
      cleanBeforeCaret: 2,
    });
  });

  it('reads a deleted digit as itself, not as a separator removal', () => {
    expect(readMaskedEdit(digitsMask, '123.4', '13.4', 1)).toEqual({
      clean: '134',
      cleanBeforeCaret: 1,
    });
  });

  it('reads a separator replaced by a rejected character as no removal', () => {
    expect(readMaskedEdit(digitsMask, '123.4', '123x4', 4)).toEqual({
      clean: '1234',
      cleanBeforeCaret: 3,
    });
  });

  it('leaves the value alone when a leading separator goes with nothing before it', () => {
    const leading: Mask = { format: (clean) => `.${clean}`, parse: digitsMask.parse };

    expect(readMaskedEdit(leading, '.12', '12', 0)).toEqual({ clean: '12', cleanBeforeCaret: 0 });
  });
});

describe('useMaskedInput', () => {
  it('shows the formatted value', () => {
    expect(renderHarness('1234').input.value).toBe('123.4');
  });

  it('reports the clean value and keeps the caret beside the typed character', () => {
    const { input, onChange } = renderHarness('1234');

    editTo(input, '1293.4', 3);

    expect(onChange).toHaveBeenCalledExactlyOnceWith('12934');
    expect(input.value).toBe('129.34');
    expect(input.selectionStart).toBe(3);
  });

  it('steps the caret over a separator that appears', () => {
    const { input } = renderHarness('123');

    editTo(input, '1234', 4);

    expect(input.value).toBe('123.4');
    expect(input.selectionStart).toBe(5);
  });

  it('deletes the character before a separator on backspace', () => {
    const { input, onChange } = renderHarness('1234');

    editTo(input, '1234', 3);

    expect(onChange).toHaveBeenCalledExactlyOnceWith('124');
    expect(input.value).toBe('124');
    expect(input.selectionStart).toBe(2);
  });

  it('keeps the caret in place when a rejected character changes nothing', () => {
    const { input, onChange } = renderHarness('1234');

    editTo(input, '1x23.4', 2);

    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('123.4');
    expect(input.selectionStart).toBe(1);

    // A second rejected character in a row is handled the same way.
    editTo(input, '12x3.4', 3);

    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('123.4');
    expect(input.selectionStart).toBe(2);
  });

  it('keeps an end mask\'s caret before the same digits when padding appears', () => {
    const { input, onChange } = renderHarness('123', centsMask);

    editTo(input, ',23', 0);

    expect(onChange).toHaveBeenCalledExactlyOnceWith('23');
    expect(input.value).toBe('0,23');
    expect(input.selectionStart).toBe(2);
  });

  it('falls back to the end of the text when the input has no caret', () => {
    const onChange = vi.fn();

    /**
     * A caller that never attaches the hook's ref.
     *
     * @returns An input the hook can't read the caret of.
     */
    function Unattached() {
      const masked = useMaskedInput({ value: '', mask: digitsMask, onChange });
      return (
        <input
          aria-label="Número"
          value={masked.value}
          onChange={(event) => masked.onChange(event.target.value)}
        />
      );
    }
    render(<Unattached />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12a' } });

    expect(onChange).toHaveBeenCalledExactlyOnceWith('12');
  });
});
