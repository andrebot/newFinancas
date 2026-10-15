import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { MfaMethodSelection } from '../../../../../../../src/experiences/onboard/flows/mfaEnrollment/interactions/MfaMethodSelection';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator render; only the Flow's handler is a stand-in.

describe('MfaMethodSelection', () => {
  it("renders mockup 05: the heading and the app's card, selected", () => {
    renderInLocale(<MfaMethodSelection defaultMethod="authenticator" onChoose={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Secure your account' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Verification method' })).toBeTruthy();
    const app = screen.getByRole<HTMLInputElement>('radio', { name: 'Authenticator app' });
    expect(app.checked).toBe(true);
    expect(screen.getByText(/generate a new code every 30 seconds/)).toBeTruthy();
  });

  it('emits the method chosen on Continue', () => {
    const onChoose = vi.fn();
    renderInLocale(<MfaMethodSelection defaultMethod="authenticator" onChoose={onChoose} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Authenticator app' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onChoose).toHaveBeenCalledWith('authenticator');
  });
});
