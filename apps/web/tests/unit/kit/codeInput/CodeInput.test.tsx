import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  activeBoxOf, CodeInput, digitBoxClasses, digitsOf,
} from '../../../../src/kit/codeInput/CodeInput';
import { messageIdOf } from '../../../../src/kit/field/Field';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handlers are stand-ins; the real Field frames the input.

/**
 * Finds the code input by its accessible name.
 *
 * @returns The input.
 */
const codeInput = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Código' });

/**
 * Lists the six drawn digit boxes.
 *
 * @returns The boxes, in order.
 */
const boxesOf = () => Array.from(
  codeInput().parentElement?.querySelectorAll('span') ?? [],
);

describe('CodeInput', () => {
  it('is one numeric one-time-code input named by its label', () => {
    render(<CodeInput label="Código" value="" onChange={vi.fn()} />);

    const input = codeInput();
    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('numeric');
    expect(input.autocomplete).toBe('one-time-code');
    expect(input.getAttribute('pattern')).toBe('[0-9]*');
  });

  it('draws one box per digit, hidden from screen readers, holding the digits typed', () => {
    render(<CodeInput label="Código" value="482" onChange={vi.fn()} />);

    const boxes = boxesOf();
    expect(boxes.map((box) => box.textContent)).toEqual(['4', '8', '2', '', '', '']);
    expect(boxes.every((box) => box.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('lights the box the next digit goes in', () => {
    render(<CodeInput label="Código" value="482" onChange={vi.fn()} />);

    expect(boxesOf().map((box) => box.className)).toEqual([
      digitBoxClasses(false, false),
      digitBoxClasses(false, false),
      digitBoxClasses(false, false),
      digitBoxClasses(true, false),
      digitBoxClasses(false, false),
      digitBoxClasses(false, false),
    ]);
  });

  it('reports only the digits of what is pasted, leaving the state to the caller', () => {
    const onChange = vi.fn();
    render(<CodeInput label="Código" value="" onChange={onChange} />);

    fireEvent.change(codeInput(), { target: { value: '482 193' } });

    expect(onChange).toHaveBeenCalledExactlyOnceWith('482193');
    expect(codeInput().value).toBe('');
  });

  it('reports nothing when only a non-digit was typed', () => {
    const onChange = vi.fn();
    render(<CodeInput label="Código" value="48" onChange={onChange} />);

    fireEvent.change(codeInput(), { target: { value: '48a' } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('hands over the code once its last digit is typed', () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    const { rerender } = render(
      <CodeInput label="Código" value="4821" onChange={onChange} onComplete={onComplete} />,
    );

    fireEvent.change(codeInput(), { target: { value: '48219' } });
    expect(onComplete).not.toHaveBeenCalled();

    rerender(
      <CodeInput label="Código" value="48219" onChange={onChange} onComplete={onComplete} />,
    );
    fireEvent.change(codeInput(), { target: { value: '482193' } });
    expect(onComplete).toHaveBeenCalledExactlyOnceWith('482193');
  });

  it('works without a completion handler', () => {
    const onChange = vi.fn();
    render(<CodeInput label="Código" value="48219" onChange={onChange} />);

    fireEvent.change(codeInput(), { target: { value: '482193' } });

    expect(onChange).toHaveBeenCalledExactlyOnceWith('482193');
  });

  it('moves the caret back to the end of the digits', () => {
    render(<CodeInput label="Código" value="482" onChange={vi.fn()} />);
    const input = codeInput();

    input.setSelectionRange(1, 1);
    fireEvent.select(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([3, 3]);

    input.setSelectionRange(0, 3);
    fireEvent.select(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([3, 3]);
  });

  it('leaves a caret already at the end alone', () => {
    render(<CodeInput label="Código" value="482" onChange={vi.fn()} />);
    const input = codeInput();
    const setSelectionRange = vi.spyOn(input, 'setSelectionRange');

    input.selectionStart = 3;
    fireEvent.select(input);

    expect(setSelectionRange).not.toHaveBeenCalled();
  });

  it('shows the error in place of the hint, turns every box coral and is invalid', () => {
    render(
      <CodeInput label="Código" value="" onChange={vi.fn()} hint="Dica" error="Errado" id="mfa" />,
    );

    const input = codeInput();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(messageIdOf('mfa'));
    expect(screen.queryByText('Dica')).toBeNull();
    expect(boxesOf()[0]?.className).toBe(digitBoxClasses(true, true));
    expect(boxesOf()[1]?.className).toBe(digitBoxClasses(false, true));
  });

  it('can keep its label for screen readers only', () => {
    render(<CodeInput label="Código" labelHidden value="" onChange={vi.fn()} />);

    expect(screen.getByText('Código').className).toBe('sr-only');
    expect(codeInput()).toBeDefined();
  });

  it('uses the id it is given, else makes one', () => {
    const { rerender } = render(<CodeInput label="Código" value="" onChange={vi.fn()} id="mfa" />);
    expect(codeInput().id).toBe('mfa');

    rerender(<CodeInput label="Código" value="" onChange={vi.fn()} />);
    expect(codeInput().id).not.toBe('');
  });

  it('passes native props and its ref through, and puts layout on the field', () => {
    const ref = createRef<HTMLInputElement>();
    const { container } = render(
      <CodeInput
        label="Código"
        value=""
        onChange={vi.fn()}
        ref={ref}
        name="code"
        autoFocus
        className="w-[400px]"
      />,
    );

    const input = codeInput();
    expect(ref.current).toBe(input);
    expect(input.name).toBe('code');
    expect(document.activeElement).toBe(input);
    expect((container.firstChild as HTMLElement).className).toContain('w-[400px]');
  });

  it('can be disabled, dimming the boxes', () => {
    render(<CodeInput label="Código" value="" onChange={vi.fn()} disabled />);

    expect(codeInput().disabled).toBe(true);
    expect(codeInput().parentElement?.className).toContain('has-disabled:opacity-50');
  });
});

describe('digitsOf', () => {
  it('keeps the digits, at most a code long', () => {
    expect(digitsOf('48-21 93 77')).toBe('482193');
  });
});

describe('activeBoxOf', () => {
  it('is the first empty box, or the last once the code is full', () => {
    expect(activeBoxOf(0)).toBe(0);
    expect(activeBoxOf(4)).toBe(4);
    expect(activeBoxOf(6)).toBe(5);
  });
});

describe('digitBoxClasses', () => {
  it('draws a line border, with a mint focus halo on the active box', () => {
    expect(digitBoxClasses(false, false)).toContain('border-line');
    expect(digitBoxClasses(false, false)).not.toContain('ring');
    expect(digitBoxClasses(true, false)).toContain('group-focus-within:border-mint');
    expect(digitBoxClasses(true, false)).toContain('group-focus-within:ring-mint/15');
  });

  it('turns coral while invalid, with a coral halo on the active box', () => {
    expect(digitBoxClasses(false, true)).toContain('border-coral');
    expect(digitBoxClasses(true, true)).toContain('group-focus-within:ring-coral/15');
    expect(digitBoxClasses(true, true)).not.toContain('mint');
  });
});
