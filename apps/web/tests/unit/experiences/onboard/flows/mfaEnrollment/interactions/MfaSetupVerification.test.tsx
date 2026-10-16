import { act, fireEvent, screen } from '@testing-library/react';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  groupSetupKey, MfaSetupVerification, type MfaSetupVerificationProps,
} from '../../../../../../../src/experiences/onboard/flows/mfaEnrollment/interactions/MfaSetupVerification';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit,
// translator and QR encoder render; only the Flow's handlers and the
// browser's clipboard (the external sink) are stand-ins.

const SECRET = 'JBSWY3DPEHPK3PXP';
const URI = `otpauth://totp/Finance%20APP:ana%40example.com?secret=${SECRET}&issuer=Finance%20APP`;
const writeText = vi.fn(async (_text: string) => undefined);

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

/**
 * Renders the step with stand-in handlers, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handlers and the render result.
 */
const renderStep = (props: Partial<MfaSetupVerificationProps> = {}) => {
  const handlers = { onSubmit: vi.fn(), onBack: vi.fn() };
  const view = renderInLocale(
    <MfaSetupVerification
      otpauthUri={URI}
      totpSecret={SECRET}
      accountEmail="ana@example.com"
      busy={false}
      {...handlers}
      {...props}
    />,
  );
  return { ...handlers, view };
};

const codeInput = () => screen.getByLabelText<HTMLInputElement>(
  'Enter the 6-digit code from the app',
);
const verify = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Verify & continue' });

/**
 * Types digits into the code.
 *
 * @param digits - What to type.
 */
const typeCode = (digits: string) => fireEvent.change(codeInput(), { target: { value: digits } });

describe('groupSetupKey', () => {
  it('splits the key in groups of four', () => {
    expect(groupSetupKey(SECRET)).toBe('JBSW Y3DP EHPK 3PXP');
    expect(groupSetupKey('ABCDEF')).toBe('ABCD EF');
    expect(groupSetupKey('')).toBe('');
  });
});

describe('MfaSetupVerification', () => {
  it('renders mockup 06: the QR code, the key, the account; the code focused', () => {
    renderStep();

    expect(screen.getByRole('heading', { level: 1, name: 'Scan this QR code' })).toBeTruthy();
    const qr = screen.getByRole('img', { name: 'QR code for your authenticator app' });
    expect(qr.tagName.toLowerCase()).toBe('svg');
    expect(screen.getByText('JBSW Y3DP EHPK 3PXP')).toBeTruthy();
    expect(screen.getByText('Account: ana@example.com')).toBeTruthy();
    expect(document.activeElement).toBe(codeInput());
    expect(verify().disabled).toBe(true);
  });

  it('draws the QR code inside its own white quiet zone, four modules wide', () => {
    renderStep();

    const qr = screen.getByRole('img', { name: 'QR code for your authenticator app' });
    const [light, dark] = Array.from(qr.querySelectorAll('path'));
    expect(light?.getAttribute('fill')).toBe('#ffffff');
    expect(light?.getAttribute('d')).toMatch(/^M0,0 /);
    expect(dark?.getAttribute('fill')).toBe('#000000');
    expect(dark?.getAttribute('d')).toMatch(/^M4 4h/);
  });

  it('copies the key without spaces and says so', async () => {
    renderStep();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy key' }));
    });

    expect(writeText).toHaveBeenCalledWith(SECRET);
    expect(screen.getByRole('button', { name: 'Key copied' })).toBeTruthy();
  });

  it('submits by itself on the last digit', () => {
    const { onSubmit } = renderStep();

    typeCode('482193');

    expect(onSubmit).toHaveBeenCalledWith('482193');
  });

  it('holds the code while a request is out, then the button sends it', () => {
    const { onSubmit, view } = renderStep({ busy: true });
    typeCode('482193');
    fireEvent.click(verify());
    expect(onSubmit).not.toHaveBeenCalled();

    view.rerenderInLocale(
      <MfaSetupVerification
        otpauthUri={URI}
        totpSecret={SECRET}
        accountEmail="ana@example.com"
        busy={false}
        onSubmit={onSubmit}
        onBack={vi.fn()}
      />,
    );
    fireEvent.click(verify());
    expect(onSubmit).toHaveBeenCalledWith('482193');
  });

  it('ignores a submit before the code is whole', () => {
    const { onSubmit } = renderStep();

    typeCode('482');
    fireEvent.submit(verify().closest('form')!);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the failure in the banner and goes back', () => {
    const { onBack } = renderStep({ alert: 'Invalid verification code.' });

    expect(screen.getByText('Invalid verification code.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
