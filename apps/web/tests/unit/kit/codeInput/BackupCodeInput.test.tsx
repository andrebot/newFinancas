import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { BackupCodeInput } from '../../../../src/kit/codeInput/BackupCodeInput';
import { inputClasses } from '../../../../src/kit/textField/TextField';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handler is a stand-in; the real text field and mask hook run.

/**
 * Finds the backup code input by its accessible name.
 *
 * @returns The input.
 */
const codeInput = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Código de backup' });

/**
 * A caller holding the clean code, as the Backup Code Entry Interaction will.
 *
 * @param props - The starting code and a spy for the reported codes.
 * @returns The backup code input.
 */
function Holder({ initial, onChange }: { initial: string; onChange: (code: string) => void }) {
  const [code, setCode] = useState(initial);
  return (
    <BackupCodeInput
      label="Código de backup"
      value={code}
      onChange={(next) => {
        setCode(next);
        onChange(next);
      }}
    />
  );
}

describe('BackupCodeInput', () => {
  it('shows the clean code it is given in dashed groups', () => {
    render(<BackupCodeInput label="Código de backup" value="7HJX21NA" onChange={vi.fn()} />);

    expect(codeInput().value).toBe('7HJX-21NA');
  });

  it('reports a pasted code clean, and shows it grouped', () => {
    const onChange = vi.fn();
    render(<Holder initial="" onChange={onChange} />);

    fireEvent.change(codeInput(), { target: { value: '7hjx 21na-q4kd 9wte' } });

    expect(onChange).toHaveBeenCalledExactlyOnceWith('7HJX21NAQ4KD9WTE');
    expect(codeInput().value).toBe('7HJX-21NA-Q4KD-9WTE');
  });

  it('is a monospaced, centred text field that the browser leaves uncorrected', () => {
    render(<BackupCodeInput label="Código de backup" value="" onChange={vi.fn()} hint="Dica" />);

    const input = codeInput();
    expect(input.className).toBe(inputClasses('font-mono tracking-[.2em] text-center'));
    expect(input.autocomplete).toBe('one-time-code');
    expect(input.getAttribute('autocapitalize')).toBe('characters');
    expect(input.getAttribute('autocorrect')).toBe('off');
    expect(input.getAttribute('spellcheck')).toBe('false');
    expect(screen.getByText('Dica')).toBeDefined();
  });

  it('lets the caller override the native defaults', () => {
    render(
      <BackupCodeInput label="Código de backup" value="" onChange={vi.fn()} autoComplete="off" />,
    );

    expect(codeInput().autocomplete).toBe('off');
  });
});
