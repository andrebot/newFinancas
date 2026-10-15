import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  BackupCodeEntry, type BackupCodeEntryProps,
} from '../../../../../../../src/experiences/authenticate/flows/signIn/interactions/BackupCodeEntry';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator render; only the Flow's handlers are stand-ins.

/**
 * Renders the entry with stand-in handlers, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handlers.
 */
const renderEntry = (props: Partial<BackupCodeEntryProps> = {}) => {
  const handlers = { onSubmit: vi.fn(), onUseApp: vi.fn(), onBack: vi.fn() };
  renderInLocale(<BackupCodeEntry busy={false} {...handlers} {...props} />);
  return handlers;
};

const codeInput = () => screen.getByLabelText<HTMLInputElement>('Backup code');
const verify = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Verify' });

describe('BackupCodeEntry', () => {
  it("renders mockup 09's heading and focuses the code, Verify off until it is whole", () => {
    renderEntry();

    expect(screen.getByRole('heading', { level: 1, name: 'Enter a backup code' })).toBeTruthy();
    expect(document.activeElement).toBe(codeInput());
    expect(verify().disabled).toBe(true);

    fireEvent.change(codeInput(), { target: { value: '7hjx-21na' } });
    expect(verify().disabled).toBe(true);
  });

  it('emits the clean code once it is whole', () => {
    const { onSubmit } = renderEntry();
    fireEvent.change(codeInput(), { target: { value: '7hjx-21na-q4kd-9wte' } });

    fireEvent.click(verify());

    expect(onSubmit).toHaveBeenCalledWith('7HJX21NAQ4KD9WTE');
  });

  it('emits nothing for a partial code or while a request is out', () => {
    const { onSubmit } = renderEntry({ busy: true });
    const form = verify().closest('form') as HTMLFormElement;

    fireEvent.submit(form);
    fireEvent.change(codeInput(), { target: { value: '7HJX21NAQ4KD9WTE' } });
    fireEvent.submit(form);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the last failure in an error banner', () => {
    renderEntry({ alert: 'Invalid verification code.' });

    expect(screen.getByRole('alert').textContent).toContain('Invalid verification code.');
  });

  it('emits the switch back to the app and the way back', () => {
    const { onUseApp, onBack } = renderEntry();

    fireEvent.click(screen.getByRole('button', { name: 'Use authenticator app instead' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onUseApp).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
