import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  MfaCodeEntry, type MfaCodeEntryProps,
} from '../../../../../../../src/experiences/authenticate/flows/signIn/interactions/MfaCodeEntry';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator render; only the Flow's handlers are stand-ins.

/**
 * Renders the entry with stand-in handlers, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handlers and the render result.
 */
const renderEntry = (props: Partial<MfaCodeEntryProps> = {}) => {
  const handlers = { onSubmit: vi.fn(), onUseBackupCode: vi.fn(), onBack: vi.fn() };
  const view = renderInLocale(<MfaCodeEntry busy={false} {...handlers} {...props} />);
  return { ...handlers, view };
};

const codeInput = () => screen.getByLabelText<HTMLInputElement>('Verification code');
const verify = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Verify' });

/**
 * Types digits into the code.
 *
 * @param digits - What to type.
 */
const typeCode = (digits: string) => fireEvent.change(codeInput(), { target: { value: digits } });

describe('MfaCodeEntry', () => {
  it("renders mockup 08's heading and focuses the code, Verify off until it is whole", () => {
    renderEntry();

    expect(screen.getByRole('heading', { level: 1, name: 'Two-factor verification' }))
      .toBeTruthy();
    expect(document.activeElement).toBe(codeInput());
    expect(verify().disabled).toBe(true);

    typeCode('48219');
    expect(verify().disabled).toBe(true);
  });

  it('submits by itself on the last digit', () => {
    const { onSubmit } = renderEntry();

    typeCode('482193');

    expect(onSubmit).toHaveBeenCalledWith('482193');
  });

  it('holds the code while a request is out, then Verify sends it', () => {
    const { onSubmit, view } = renderEntry({ busy: true });
    typeCode('482193');
    fireEvent.click(verify());
    expect(onSubmit).not.toHaveBeenCalled();

    view.rerenderInLocale(
      <MfaCodeEntry busy={false} onSubmit={onSubmit} onUseBackupCode={vi.fn()} onBack={vi.fn()} />,
    );
    fireEvent.click(verify());

    expect(onSubmit).toHaveBeenCalledWith('482193');
  });

  it('never submits a partial code', () => {
    const { onSubmit } = renderEntry();
    typeCode('482');

    fireEvent.submit(verify().closest('form') as HTMLFormElement);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the last failure in an error banner', () => {
    renderEntry({ alert: 'Invalid verification code.' });

    expect(screen.getByRole('alert').textContent).toContain('Invalid verification code.');
  });

  it('emits the switch to a backup code and the way back', () => {
    const { onUseBackupCode, onBack } = renderEntry();

    fireEvent.click(screen.getByRole('button', { name: 'Use a backup code' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onUseBackupCode).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
