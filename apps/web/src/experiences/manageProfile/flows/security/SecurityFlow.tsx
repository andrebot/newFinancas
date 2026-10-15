import { useEffect, useState } from 'react';
import { useAlerts } from '../../../../utilities/AlertProvider';
import type { Translator } from '../../../../utilities/i18n';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';
import { PasswordChange, type PasswordChangeRequest } from './interactions/PasswordChange';
import { SessionList } from './interactions/SessionList';
import { SignOutOthersButton, SignOutOthersConfirm } from './interactions/SignOutOthers';
import {
  afterLoad, afterPasswordChange, afterRevoke, INITIAL_SECURITY, loadingSessions,
  othersConfirmCancelled, othersConfirmOpened, passwordSubmitting, revokeStarted,
  type RevokeTarget, type SecurityState, type SessionsOutcome,
} from './securityState';

// Security Flow (FL7, EBD; OQ-154): the profile's two security panels, side
// by side as mockup 70 draws them — change the password (FR-1.14) and the
// active sessions, revoked one at a time or all the others at once (FR-1.3).
// It fetches the sessions as it mounts, owns the list, what is out and each
// panel's last failure, and toasts what succeeded. It never calls the
// backend: each request goes up to the Manage Profile Experience, which
// answers an outcome. A done revoke or password change drops the sessions it
// ended from the list, as the API did.

/** What the Flow asks of the Experience. */
export interface SecurityFlowProps {
  /** Lists the user's sessions (`GET /users/me/sessions`). */
  readonly onLoadSessions: () => Promise<SessionsOutcome>;
  /** Signs one session out (`DELETE /users/me/sessions/:sessionId`). */
  readonly onRevokeSession: (sessionId: string) => Promise<RequestOutcome>;
  /** Signs every other session out (`DELETE /users/me/sessions`). */
  readonly onRevokeOthers: () => Promise<RequestOutcome>;
  /** Changes the password (`POST /auth/change-password`). */
  readonly onChangePassword: (change: PasswordChangeRequest) => Promise<RequestOutcome>;
}

/** Where a password change's failure shows: under a field, or in the banner. */
interface PasswordFailurePlaces {
  readonly currentError?: string | undefined;
  readonly passwordError?: string | undefined;
  readonly alert?: string | undefined;
}

// The server's objections that belong under a field rather than in the banner.
const FIELD_CODES: Readonly<Record<string, keyof PasswordFailurePlaces>> = {
  'password.current_incorrect': 'currentError',
  'password.too_short': 'passwordError',
};

/**
 * Splits a password change's failure between the field it concerns and the
 * banner.
 *
 * @param error - The last failure, if any.
 * @param translator - The current locale's translator.
 * @returns The translated message, under the place it shows.
 */
export const placePasswordFailure = (
  error: RequestFailure | undefined,
  translator: Translator,
): PasswordFailurePlaces => {
  if (!error) return {};
  const place = FIELD_CODES[error.code] ?? 'alert';
  return { [place]: translator.error(error.code, error.params) };
};

/**
 * Tells whether the loaded list has a session besides this one, so "sign out
 * all others" has something to do.
 *
 * @param state - The Flow's state.
 * @returns Whether another session is listed.
 */
const hasOthers = (state: SecurityState) => (
  state.sessions.status === 'loaded' && state.sessions.sessions.some((session) => !session.current)
);

/**
 * Renders the password and sessions panels and runs their requests.
 *
 * @param props - The Experience's requests.
 * @returns The two panels.
 */
export function SecurityFlow({
  onLoadSessions, onRevokeSession, onRevokeOthers, onChangePassword,
}: SecurityFlowProps) {
  const translator = useI18n();
  const alerts = useAlerts();
  const [state, setState] = useState<SecurityState>(INITIAL_SECURITY);
  const { revoking } = state;

  /** Fetches the sessions again (a retry) and applies the answer. */
  const reload = async () => {
    setState(loadingSessions);
    const outcome = await onLoadSessions();
    setState((current) => afterLoad(current, outcome));
  };

  // The list is fetched as the Flow mounts. The Experience passes a stable
  // request, so this runs once; an answer after unmounting is dropped.
  useEffect(() => {
    let mounted = true;
    onLoadSessions().then((outcome) => {
      if (mounted) setState((current) => afterLoad(current, outcome));
    });
    return () => {
      mounted = false;
    };
  }, [onLoadSessions]);

  /**
   * Sends a revoke and applies its outcome, toasting a success.
   *
   * @param target - What the revoke ends.
   * @param request - The Experience's request for it.
   * @param done - The toast's text key.
   */
  const revoke = async (
    target: RevokeTarget,
    request: () => Promise<RequestOutcome>,
    done: 'sessions.revoked' | 'others.done',
  ) => {
    setState((current) => revokeStarted(current, target));
    const outcome = await request();
    setState((current) => afterRevoke(current, outcome));
    if (outcome.ok) alerts.success(translator.text('security', done));
  };

  /**
   * Sends the password change and applies its outcome, toasting a success.
   *
   * @param change - The current and new passwords.
   */
  const changePassword = async (change: PasswordChangeRequest) => {
    setState(passwordSubmitting);
    const outcome = await onChangePassword(change);
    setState((current) => afterPasswordChange(current, outcome));
    if (outcome.ok) alerts.success(translator.text('security', 'password.changed'));
  };

  const othersOut = revoking?.scope === 'others';
  const failure = placePasswordFailure(state.passwordError, translator);
  const revokeAlert = state.revokeError
    && translator.error(state.revokeError.code, state.revokeError.params);

  return (
    <div className="grid items-stretch gap-6 lg:grid-cols-2">
      <PasswordChange
        key={state.passwordForm}
        busy={state.passwordBusy}
        alert={failure.alert}
        currentError={failure.currentError}
        passwordError={failure.passwordError}
        onSubmit={changePassword}
      />
      <SessionList
        sessions={state.sessions}
        revokingId={revoking?.scope === 'one' ? revoking.sessionId : undefined}
        revokeLocked={revoking !== undefined}
        alert={revokeAlert}
        headerAction={hasOthers(state) && (
          <SignOutOthersButton
            disabled={revoking !== undefined}
            onOpen={() => setState(othersConfirmOpened)}
          />
        )}
        confirm={state.confirmingOthers && (
          <SignOutOthersConfirm
            busy={othersOut}
            onConfirm={() => revoke({ scope: 'others' }, onRevokeOthers, 'others.done')}
            onCancel={() => setState(othersConfirmCancelled)}
          />
        )}
        onRevoke={(sessionId) => revoke(
          { scope: 'one', sessionId },
          () => onRevokeSession(sessionId),
          'sessions.revoked',
        )}
        onRetry={reload}
      />
    </div>
  );
}
