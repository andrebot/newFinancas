import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  AccountRecoveryFlow, type AccountRecoveryFlowProps,
} from '../../../../../../src/experiences/authenticate/flows/accountRecovery/AccountRecoveryFlow';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';
import { renderInLocale } from '../../../../../support/renderInLocale';

// Flow (BDT: unit, the Interactions beneath mocked): each entry is a stub that
// shows the props it got and emits its events from plain buttons. The
// Experience is represented by stub requests answering outcomes.

/** A stub's shown props and its buttons. */
interface StubProps {
  readonly entry: string;
  readonly shown: Readonly<Record<string, string | undefined>>;
  readonly actions: Readonly<Record<string, () => void>>;
}

/**
 * Draws a stub: the props as data attributes, one button per event.
 *
 * @param props - Which stub, what it shows and its buttons.
 * @returns The stub.
 */
function Stub({ entry, shown, actions }: StubProps) {
  const attributes = Object.fromEntries(
    Object.entries(shown).map(([name, value]) => [`data-${name}`, value ?? '']),
  );
  return (
    <div data-testid={entry} {...attributes}>
      {Object.entries(actions).map(([label, emit]) => (
        <button key={label} type="button" onClick={emit}>{label}</button>
      ))}
    </div>
  );
}

vi.mock('../../../../../../src/experiences/authenticate/flows/accountRecovery/interactions/RecoveryRequest', () => ({
  /**
   * Recovery Request's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  RecoveryRequest: ({
    busy, linkRequested, alert, onSubmit, onBackToSignIn,
  }: {
    busy: boolean;
    linkRequested: boolean;
    alert?: string;
    onSubmit: (email: string) => void;
    onBackToSignIn: () => void;
  }) => (
    <Stub
      entry="request"
      shown={{ busy: String(busy), sent: String(linkRequested), alert }}
      actions={{ submit: () => onSubmit('ana@example.com'), back: onBackToSignIn }}
    />
  ),
}));

vi.mock('../../../../../../src/experiences/authenticate/flows/accountRecovery/interactions/NewPasswordEntry', () => ({
  /**
   * New Password Entry's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  NewPasswordEntry: ({
    busy, alert, passwordError, onSubmit,
  }: {
    busy: boolean;
    alert?: string;
    passwordError?: string;
    onSubmit: (password: string) => void;
  }) => (
    <Stub
      entry="newPassword"
      shown={{ busy: String(busy), alert, 'password-error': passwordError }}
      actions={{ submit: () => onSubmit('correct horse battery') }}
    />
  ),
}));

vi.mock('../../../../../../src/experiences/authenticate/flows/accountRecovery/interactions/ResetComplete', () => ({
  /**
   * Reset Complete's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  ResetComplete: ({ onSignIn }: { onSignIn: () => void }) => (
    <Stub entry="done" shown={{}} actions={{ signIn: onSignIn }} />
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
 * Renders the Flow with stub requests, each answering `OK` unless overridden.
 *
 * @param props - The token, requests or way out to override.
 * @returns The stubs.
 */
const renderFlow = (props: Partial<AccountRecoveryFlowProps> = {}) => {
  const stubs = {
    onRequestReset: vi.fn(async () => OK),
    onConfirmReset: vi.fn(async () => OK),
    onBackToSignIn: vi.fn(),
    ...props,
  };
  renderInLocale(<AccountRecoveryFlow {...stubs} />);
  return stubs;
};

const entry = (name: string) => screen.getByTestId(name);

/**
 * Clicks a stub's button and lets the outcome land.
 *
 * @param name - The stub showing.
 * @param action - The button.
 */
const press = async (name: string, action: string) => {
  const button = Array.from(entry(name).querySelectorAll('button'))
    .find((candidate) => candidate.textContent === action) as HTMLButtonElement;
  await act(async () => {
    fireEvent.click(button);
  });
};

describe('AccountRecoveryFlow — asking for a link', () => {
  it('opens on the request without a token, nothing sent, no banner', () => {
    renderFlow();

    expect(entry('request').dataset).toMatchObject({ busy: 'false', sent: 'false', alert: '' });
  });

  it('sends the address up and shows the inbox note on the answer', async () => {
    const { onRequestReset } = renderFlow();

    await press('request', 'submit');

    expect(onRequestReset).toHaveBeenCalledWith('ana@example.com');
    expect(entry('request').dataset).toMatchObject({ busy: 'false', sent: 'true', alert: '' });
  });

  it('is busy while the request is out', async () => {
    let answer: (outcome: RequestOutcome) => void = () => {};
    renderFlow({
      onRequestReset: () => new Promise((resolve) => {
        answer = resolve;
      }),
    });

    await press('request', 'submit');
    expect(entry('request').dataset.busy).toBe('true');

    await act(async () => answer(OK));
    expect(entry('request').dataset.busy).toBe('false');
  });

  it('shows a failure translated in the banner, without the inbox note', async () => {
    renderFlow({ onRequestReset: vi.fn(async () => failed('network.unavailable')) });

    await press('request', 'submit');

    expect(entry('request').dataset).toMatchObject({
      sent: 'false', alert: "Couldn't connect. Check your connection and try again.",
    });
  });

  it('goes back to sign in', async () => {
    const { onBackToSignIn } = renderFlow();

    await press('request', 'back');

    expect(onBackToSignIn).toHaveBeenCalledTimes(1);
  });
});

describe('AccountRecoveryFlow — the new password', () => {
  it('opens on the new password when given a token', () => {
    renderFlow({ token: 'reset-token' });

    expect(entry('newPassword').dataset)
      .toMatchObject({ busy: 'false', alert: '', passwordError: '' });
  });

  it('sends the token and the password up, then shows the done step', async () => {
    const { onConfirmReset, onBackToSignIn } = renderFlow({ token: 'reset-token' });

    await press('newPassword', 'submit');
    expect(onConfirmReset).toHaveBeenCalledWith('reset-token', 'correct horse battery');

    await press('done', 'signIn');
    expect(onBackToSignIn).toHaveBeenCalledTimes(1);
  });

  it('shows password.too_short under the field, not in the banner', async () => {
    renderFlow({
      token: 'reset-token',
      onConfirmReset: vi.fn(async () => failed('password.too_short', { min: 12 })),
    });

    await press('newPassword', 'submit');

    expect(entry('newPassword').dataset).toMatchObject({
      alert: '', passwordError: 'Password must be at least 12 characters.',
    });
  });

  it('shows any other failure in the banner and stays', async () => {
    renderFlow({
      token: 'reset-token',
      onConfirmReset: vi.fn(async () => failed('network.unavailable')),
    });

    await press('newPassword', 'submit');

    expect(entry('newPassword').dataset).toMatchObject({
      alert: "Couldn't connect. Check your connection and try again.", passwordError: '',
    });
  });

  it('goes back to asking for a link when the link is dead, with the reason', async () => {
    renderFlow({
      token: 'reset-token',
      onConfirmReset: vi.fn(async () => failed('password_reset.token_invalid')),
    });

    await press('newPassword', 'submit');

    expect(entry('request').dataset).toMatchObject({
      sent: 'false', alert: 'This reset link is invalid or has expired.',
    });
  });
});
