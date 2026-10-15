import { act, fireEvent, screen } from '@testing-library/react';
import { useEffect } from 'react';
import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  SignInFlow, type SignInFlowProps,
} from '../../../../../../src/experiences/authenticate/flows/signIn/SignInFlow';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';
import { renderInLocale } from '../../../../../support/renderInLocale';

// Flow (BDT: unit, the Interactions beneath mocked): each entry is a stub that
// shows the props it got and emits its events from plain buttons. The
// Experience is represented by stub requests answering outcomes.

// Counts each stub's mounts, so a test can tell the Flow remounted it.
const mounts = vi.hoisted(() => ({ credentials: 0, code: 0, backupCode: 0 }));

/** Props every stub shows. */
interface StubState {
  readonly busy: boolean;
  readonly alert?: string | undefined;
}

/** A stub's buttons: a label and what it emits. */
type StubActions = Readonly<Record<string, () => void>>;

/**
 * Draws a stub: the shared props as data attributes, one button per event.
 *
 * @param props - Which stub, its state, its buttons and any extra attributes.
 * @param props.entry - Which stub.
 * @param props.state - The busy state and the failure.
 * @param props.actions - The buttons.
 * @param props.email - The starting email (Credential Entry only).
 * @returns The stub.
 */
function Stub({
  entry, state, actions, email,
}: {
  readonly entry: keyof typeof mounts;
  readonly state: StubState;
  readonly actions: StubActions;
  readonly email?: string;
}) {
  useEffect(() => {
    mounts[entry] += 1;
  }, [entry]);
  return (
    <div
      data-testid={entry}
      data-busy={String(state.busy)}
      data-alert={state.alert ?? ''}
      data-email={email}
    >
      {Object.entries(actions).map(([label, emit]) => (
        <button key={label} type="button" onClick={emit}>{label}</button>
      ))}
    </div>
  );
}

vi.mock('../../../../../../src/experiences/authenticate/flows/signIn/interactions/CredentialEntry', () => ({
  /**
   * Credential Entry's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  CredentialEntry: ({
    defaultEmail, busy, alert, onSubmit, onForgotPassword, onCreateAccount,
  }: StubState & {
    defaultEmail: string;
    onSubmit: (credentials: { email: string; password: string }) => void;
    onForgotPassword: () => void;
    onCreateAccount: () => void;
  }) => (
    <Stub
      entry="credentials"
      state={{ busy, alert }}
      email={defaultEmail}
      actions={{
        submit: () => onSubmit({ email: 'ana@example.com', password: 'pw' }),
        forgot: onForgotPassword,
        create: onCreateAccount,
      }}
    />
  ),
}));

vi.mock('../../../../../../src/experiences/authenticate/flows/signIn/interactions/MfaCodeEntry', () => ({
  /**
   * MFA Code Entry's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  MfaCodeEntry: ({
    busy, alert, onSubmit, onUseBackupCode, onBack,
  }: StubState & {
    onSubmit: (code: string) => void;
    onUseBackupCode: () => void;
    onBack: () => void;
  }) => (
    <Stub
      entry="code"
      state={{ busy, alert }}
      actions={{ submit: () => onSubmit('123456'), backup: onUseBackupCode, back: onBack }}
    />
  ),
}));

vi.mock('../../../../../../src/experiences/authenticate/flows/signIn/interactions/BackupCodeEntry', () => ({
  /**
   * Backup Code Entry's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  BackupCodeEntry: ({
    busy, alert, onSubmit, onUseApp, onBack,
  }: StubState & {
    onSubmit: (code: string) => void;
    onUseApp: () => void;
    onBack: () => void;
  }) => (
    <Stub
      entry="backupCode"
      state={{ busy, alert }}
      actions={{ submit: () => onSubmit('7HJX21NAQ4KD9WTE'), app: onUseApp, back: onBack }}
    />
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
 * @param props - The requests or ways out to override.
 * @returns The stubs.
 */
const renderFlow = (props: Partial<SignInFlowProps> = {}) => {
  const stubs = {
    onSubmitCredentials: vi.fn(async () => OK),
    onSubmitCode: vi.fn(async () => OK),
    onSubmitBackupCode: vi.fn(async () => OK),
    onForgotPassword: vi.fn(),
    onCreateAccount: vi.fn(),
    ...props,
  };
  renderInLocale(<SignInFlow {...stubs} />);
  return stubs;
};

/**
 * Clicks a stub's button and lets the outcome land.
 *
 * @param entry - The stub showing.
 * @param name - The button.
 */
const press = async (entry: string, name: string) => {
  const button = Array.from(screen.getByTestId(entry).querySelectorAll('button'))
    .find((candidate) => candidate.textContent === name) as HTMLButtonElement;
  await act(async () => {
    fireEvent.click(button);
  });
};

const entry = (name: string) => screen.getByTestId(name);

/**
 * Signs past the password step.
 */
const passPassword = async () => press('credentials', 'submit');

beforeEach(() => {
  mounts.credentials = 0;
  mounts.code = 0;
  mounts.backupCode = 0;
});

describe('SignInFlow — the password step', () => {
  it('opens on the password step, nothing typed, no banner', () => {
    renderFlow();

    expect(entry('credentials').dataset).toMatchObject({ email: '', busy: 'false', alert: '' });
  });

  it('asks the Experience, spinning meanwhile, and shows the code step on ok', async () => {
    let answer: (outcome: RequestOutcome) => void = () => {};
    const onSubmitCredentials = vi.fn(() => new Promise<RequestOutcome>((resolve) => {
      answer = resolve;
    }));
    renderFlow({ onSubmitCredentials });

    await press('credentials', 'submit');
    expect(onSubmitCredentials).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'pw' });
    expect(entry('credentials').dataset.busy).toBe('true');

    await act(async () => answer(OK));
    expect(entry('code').dataset).toMatchObject({ busy: 'false', alert: '' });
  });

  it('stays with the failure translated, the entry remounted with the email kept', async () => {
    renderFlow({ onSubmitCredentials: vi.fn(async () => failed('auth.invalid_credentials')) });

    await passPassword();

    expect(entry('credentials').dataset).toMatchObject({
      email: 'ana@example.com', busy: 'false', alert: 'Invalid email or password.',
    });
    expect(mounts.credentials).toBe(2);
  });

  it('emits the ways out', async () => {
    const { onForgotPassword, onCreateAccount } = renderFlow();

    await press('credentials', 'forgot');
    await press('credentials', 'create');

    expect(onForgotPassword).toHaveBeenCalledTimes(1);
    expect(onCreateAccount).toHaveBeenCalledTimes(1);
  });
});

describe('SignInFlow — the code step (OQ-145)', () => {
  it('sends the code and stays busy once signed in: the Experience takes over', async () => {
    const { onSubmitCode } = renderFlow();
    await passPassword();

    await press('code', 'submit');

    expect(onSubmitCode).toHaveBeenCalledWith('123456');
    expect(entry('code').dataset.busy).toBe('true');
  });

  it('keeps the step after a wrong code, cleared for another try', async () => {
    renderFlow({ onSubmitCode: vi.fn(async () => failed('auth.mfa_invalid')) });
    await passPassword();

    await press('code', 'submit');

    expect(entry('code').dataset).toMatchObject({
      busy: 'false', alert: 'Invalid verification code.',
    });
    expect(mounts.code).toBe(2);
  });

  it('starts over from the password, email kept, when the challenge expired', async () => {
    renderFlow({ onSubmitCode: vi.fn(async () => failed('auth.challenge_expired')) });
    await passPassword();

    await press('code', 'submit');

    expect(entry('credentials').dataset).toMatchObject({
      email: 'ana@example.com',
      alert: 'Your sign-in took too long. Please enter your email and password again.',
    });
  });

  it('starts over when the address got locked, with the wait', async () => {
    const locked = failed('auth.too_many_attempts', { retryAfterMinutes: 15 });
    renderFlow({ onSubmitCode: vi.fn(async () => locked) });
    await passPassword();

    await press('code', 'submit');

    expect(entry('credentials').dataset.alert)
      .toBe('Too many sign-in attempts. Try again in 15 minutes.');
  });

  it('goes back to the password, email kept, no banner', async () => {
    renderFlow({ onSubmitCode: vi.fn(async () => failed('auth.mfa_invalid')) });
    await passPassword();
    await press('code', 'submit');

    await press('code', 'back');

    expect(entry('credentials').dataset).toMatchObject({ email: 'ana@example.com', alert: '' });
  });
});

describe('SignInFlow — the backup code step', () => {
  it('switches to a backup code and sends it', async () => {
    const { onSubmitBackupCode, onSubmitCode } = renderFlow();
    await passPassword();

    await press('code', 'backup');
    await press('backupCode', 'submit');

    expect(onSubmitBackupCode).toHaveBeenCalledWith('7HJX21NAQ4KD9WTE');
    expect(onSubmitCode).not.toHaveBeenCalled();
    expect(entry('backupCode').dataset.busy).toBe('true');
  });

  it('keeps the step after a wrong backup code', async () => {
    renderFlow({ onSubmitBackupCode: vi.fn(async () => failed('auth.mfa_invalid')) });
    await passPassword();
    await press('code', 'backup');

    await press('backupCode', 'submit');

    expect(entry('backupCode').dataset.alert).toBe('Invalid verification code.');
    expect(mounts.backupCode).toBe(2);
  });

  it.each(['app', 'back'])('returns to the code step with "%s"', async (name) => {
    renderFlow();
    await passPassword();
    await press('code', 'backup');

    await press('backupCode', name);

    expect(entry('code').dataset.alert).toBe('');
  });
});
