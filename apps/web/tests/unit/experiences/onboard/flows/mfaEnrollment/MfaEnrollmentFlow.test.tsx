import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  MfaEnrollmentFlow, type MfaEnrollmentFlowProps,
} from '../../../../../../src/experiences/onboard/flows/mfaEnrollment/MfaEnrollmentFlow';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';
import { renderInLocale } from '../../../../../support/renderInLocale';

// Flow (BDT: unit, the Interactions beneath mocked): each step is a stub that
// shows the props it got and emits its events from plain buttons. The
// Experience is represented by a stub request answering outcomes.

vi.mock('../../../../../../src/experiences/onboard/flows/mfaEnrollment/interactions/MfaMethodSelection', () => ({
  /**
   * MFA Method Selection's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  MfaMethodSelection: ({ defaultMethod, onChoose }: {
    defaultMethod: string; onChoose: (method: string) => void;
  }) => (
    <div data-testid="method" data-method={defaultMethod}>
      <button type="button" onClick={() => onChoose('authenticator')}>choose</button>
    </div>
  ),
}));

vi.mock('../../../../../../src/experiences/onboard/flows/mfaEnrollment/interactions/MfaSetupVerification', () => ({
  /**
   * MFA Setup Verification's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  MfaSetupVerification: ({
    otpauthUri, totpSecret, accountEmail, busy, alert, onSubmit, onBack,
  }: {
    otpauthUri: string;
    totpSecret: string;
    accountEmail: string;
    busy: boolean;
    alert?: string;
    onSubmit: (code: string) => void;
    onBack: () => void;
  }) => (
    <div
      data-testid="setup"
      data-uri={otpauthUri}
      data-secret={totpSecret}
      data-email={accountEmail}
      data-busy={String(busy)}
      data-alert={alert ?? ''}
    >
      <button type="button" onClick={() => onSubmit('482193')}>code</button>
      <button type="button" onClick={onBack}>back</button>
    </div>
  ),
}));

vi.mock('../../../../../../src/experiences/onboard/flows/mfaEnrollment/interactions/BackupCodesAcknowledgement', () => ({
  /**
   * Backup Codes Acknowledgement's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  BackupCodesAcknowledgement: ({ recoveryCodes, accountEmail, onAcknowledge }: {
    recoveryCodes: readonly string[]; accountEmail: string; onAcknowledge: () => void;
  }) => (
    <div data-testid="codes" data-codes={recoveryCodes.join(',')} data-email={accountEmail}>
      <button type="button" onClick={onAcknowledge}>saved</button>
    </div>
  ),
}));

const ENROLLMENT = {
  otpauthUri: 'otpauth://totp/x',
  totpSecret: 'JBSWY3DPEHPK3PXP',
  recoveryCodes: ['AAAA-BBBB', 'CCCC-DDDD'],
  accountEmail: 'ana@example.com',
};
const OK: RequestOutcome = { ok: true };

/**
 * Renders the Flow with a stub request answering `OK` unless overridden.
 *
 * @param props - The request or way out to override.
 * @returns The stubs.
 */
const renderFlow = (props: Partial<MfaEnrollmentFlowProps> = {}) => {
  const stubs = {
    onConfirm: vi.fn(async (_code: string) => OK),
    onComplete: vi.fn(),
    ...props,
  };
  renderInLocale(<MfaEnrollmentFlow enrollment={ENROLLMENT} {...stubs} />);
  return stubs;
};

/**
 * Clicks one of the stubs' buttons and lets any outcome land.
 *
 * @param action - The button.
 */
const press = async (action: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: action }));
  });
};

describe('MfaEnrollmentFlow', () => {
  it('opens on the method step with the first method; no skip anywhere', () => {
    renderFlow();

    expect(screen.getByTestId('method').dataset.method).toBe('authenticator');
    expect(screen.queryByRole('button', { name: /skip/i })).toBeNull();
  });

  it('shows the enrollment to scan once the method is chosen', async () => {
    renderFlow();

    await press('choose');

    expect(screen.getByTestId('setup').dataset).toMatchObject({
      uri: ENROLLMENT.otpauthUri,
      secret: ENROLLMENT.totpSecret,
      email: 'ana@example.com',
      busy: 'false',
      alert: '',
    });
  });

  it('goes back to the method step', async () => {
    renderFlow();

    await press('choose');
    await press('back');

    expect(screen.getByTestId('method')).toBeTruthy();
  });

  it('is busy while the confirmation is out', async () => {
    renderFlow({ onConfirm: () => new Promise(() => {}) });

    await press('choose');
    await press('code');

    expect(screen.getByTestId('setup').dataset.busy).toBe('true');
  });

  it('retries a wrong code with the reason, then shows the codes on success', async () => {
    const onConfirm = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { code: 'auth.mfa_invalid' } })
      .mockResolvedValueOnce(OK);
    renderFlow({ onConfirm });

    await press('choose');
    await press('code');
    expect(screen.getByTestId('setup').dataset)
      .toMatchObject({ busy: 'false', alert: 'Invalid verification code.' });

    await press('code');
    expect(onConfirm).toHaveBeenNthCalledWith(2, '482193');
    expect(screen.getByTestId('codes').dataset)
      .toMatchObject({ codes: 'AAAA-BBBB,CCCC-DDDD', email: 'ana@example.com' });
  });

  it('completes once the codes are acknowledged', async () => {
    const { onComplete } = renderFlow();

    await press('choose');
    await press('code');
    await press('saved');

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
