import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  RegistrationFlow, type RegistrationFlowProps,
} from '../../../../../../src/experiences/onboard/flows/registration/RegistrationFlow';
import type { Registration } from '../../../../../../src/experiences/onboard/flows/registration/interactions/RegistrationFormEntry';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';
import { renderInLocale } from '../../../../../support/renderInLocale';

// Flow (BDT: unit, the Interaction beneath mocked): the form is a stub that
// shows the props it got and emits its events from plain buttons. The
// Experience is represented by a stub request answering outcomes.

const REGISTRATION: Registration = {
  firstName: 'Ana', lastName: 'Silva', email: 'ana@example.com', password: 'velvet-orbit-cactus-71',
};

vi.mock('../../../../../../src/experiences/onboard/flows/registration/interactions/RegistrationFormEntry', () => ({
  /**
   * Registration Form Entry's stand-in: the props as data attributes.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  RegistrationFormEntry: ({
    busy, alert, emailError, passwordError, onSubmit, onSignIn,
  }: {
    busy: boolean;
    alert?: string;
    emailError?: string;
    passwordError?: string;
    onSubmit: (registration: Registration) => void;
    onSignIn: () => void;
  }) => (
    <div
      data-testid="form"
      data-busy={String(busy)}
      data-alert={alert ?? ''}
      data-email-error={emailError ?? ''}
      data-password-error={passwordError ?? ''}
    >
      <button type="button" onClick={() => onSubmit(REGISTRATION)}>submit</button>
      <button type="button" onClick={onSignIn}>signIn</button>
    </div>
  ),
}));

const OK: RequestOutcome = { ok: true };

/**
 * A failed outcome.
 *
 * @param code - The error code.
 * @param params - Its ICU params.
 * @returns The outcome.
 */
const failed = (code: string, params?: Record<string, number>): RequestOutcome => (
  { ok: false, error: { code, params } }
);

/**
 * Renders the Flow with a stub request answering `OK` unless overridden.
 *
 * @param props - The request or way out to override.
 * @returns The stubs.
 */
const renderFlow = (props: Partial<RegistrationFlowProps> = {}) => {
  const stubs = {
    onRegister: vi.fn(async () => OK),
    onSignIn: vi.fn(),
    ...props,
  };
  renderInLocale(<RegistrationFlow {...stubs} />);
  return stubs;
};

const form = () => screen.getByTestId('form');

/**
 * Clicks one of the stub's buttons and lets the outcome land.
 *
 * @param action - The button.
 */
const press = async (action: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: action }));
  });
};

describe('RegistrationFlow', () => {
  it('opens idle, with no failure anywhere', () => {
    renderFlow();

    expect(form().dataset).toMatchObject({
      busy: 'false', alert: '', emailError: '', passwordError: '',
    });
  });

  it('sends the registration up and stays busy once it is created', async () => {
    const { onRegister } = renderFlow();

    await press('submit');

    expect(onRegister).toHaveBeenCalledWith(REGISTRATION);
    expect(form().dataset.busy).toBe('true');
  });

  it('is busy while the request is out', async () => {
    let answer: (outcome: RequestOutcome) => void = () => {};
    renderFlow({
      onRegister: () => new Promise((resolve) => {
        answer = resolve;
      }),
    });

    await press('submit');
    expect(form().dataset.busy).toBe('true');

    await act(async () => answer(failed('network.unavailable')));
    expect(form().dataset.busy).toBe('false');
  });

  it('shows user.email_taken under the email', async () => {
    renderFlow({ onRegister: vi.fn(async () => failed('user.email_taken')) });

    await press('submit');

    expect(form().dataset).toMatchObject({
      alert: '', emailError: 'An account with this email already exists.', passwordError: '',
    });
  });

  it('shows password.too_short under the password', async () => {
    renderFlow({ onRegister: vi.fn(async () => failed('password.too_short', { min: 12 })) });

    await press('submit');

    expect(form().dataset).toMatchObject({
      alert: '', emailError: '', passwordError: 'Password must be at least 12 characters.',
    });
  });

  it('shows any other failure in the banner', async () => {
    renderFlow({ onRegister: vi.fn(async () => failed('network.unavailable')) });

    await press('submit');

    expect(form().dataset).toMatchObject({
      alert: "Couldn't connect. Check your connection and try again.",
      emailError: '',
      passwordError: '',
    });
  });

  it('clears the last failure when the form is sent again', async () => {
    const onRegister = vi.fn()
      .mockResolvedValueOnce(failed('user.email_taken'))
      .mockReturnValueOnce(new Promise(() => {}));
    renderFlow({ onRegister });

    await press('submit');
    await press('submit');

    expect(form().dataset).toMatchObject({ busy: 'true', emailError: '' });
  });

  it('goes to sign in instead', async () => {
    const { onSignIn } = renderFlow();

    await press('signIn');

    expect(onSignIn).toHaveBeenCalledTimes(1);
  });
});
