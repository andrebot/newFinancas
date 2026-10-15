import { useState, type FormEvent } from 'react';
import { household } from '../../../../../config/constants';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { Button } from '../../../../../kit/button/Button';
import { Card } from '../../../../../kit/card/Card';
import { SectionHeader } from '../../../../../kit/sectionHeader/SectionHeader';
import { SegmentedControl } from '../../../../../kit/segmentedControl/SegmentedControl';
import { TextField } from '../../../../../kit/textField/TextField';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { email as emailRule, firstError, required } from '../../../../../utilities/validation';
import type { AssignableRole } from '../membershipState';

// Invite Member (Membership Management, mockup 60; FR-1.5, FR-1.19): an
// Owner/Admin invites a registered user by email, with the role they will
// join as — Member unless picked otherwise. It holds what is typed and checks
// the email before emitting; the server's objections to the invitee come
// back from the Flow under the field, anything else in the banner.

/** The invite the form emits, as the API takes it. */
export interface InviteRequest {
  /** Trimmed. */
  readonly email: string;
  readonly role: AssignableRole;
}

/** Invite Member's props. */
export interface InviteMemberProps {
  /** The invite is out: the button spins and ignores submits. */
  readonly busy: boolean;
  /** Another request is out: the button waits. */
  readonly disabled: boolean;
  /** The server's objection to the invitee, already translated. */
  readonly emailError?: string | undefined;
  /** Any other failure, already translated, for the banner. */
  readonly alert?: string | undefined;
  /** Gets the invite, once the email passes the checks. */
  readonly onSubmit: (invite: InviteRequest) => void;
}

const checkEmail = firstError(required, emailRule);

/**
 * Renders the invite panel: heading, banner, email, role and button.
 *
 * @param props - The busy state, the failures and the submit handler.
 * @returns The panel.
 */
export function InviteMember({
  busy, disabled, emailError, alert, onSubmit,
}: InviteMemberProps) {
  const translator = useI18n();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>(household.defaultInviteRole);
  const [error, setError] = useState<string>();

  /**
   * Keeps the typed email and drops its error.
   *
   * @param value - The new text.
   */
  const changeEmail = (value: string) => {
    setEmail(value);
    setError(undefined);
  };

  /**
   * Checks the email and emits the invite when it passes, unless one is out.
   *
   * @param event - The form's submit.
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || disabled) return;
    const found = checkEmail(email);
    setError(found && translator.field(found.code, found.params));
    if (!found) onSubmit({ email: email.trim(), role });
  };

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeader title={translator.text('membership', 'invite.title')} />
      {alert && <InlineBanner tone="error" message={alert} />}
      <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-4">
        <TextField
          type="email"
          autoComplete="off"
          label={translator.text('membership', 'invite.email')}
          hint={translator.text('membership', 'invite.hint')}
          value={email}
          onChange={changeEmail}
          error={error ?? emailError}
        />
        <SegmentedControl
          label={translator.text('membership', 'invite.role')}
          options={household.assignableRoles.map((value) => ({
            value, label: translator.text('membership', `role.${value}`),
          }))}
          value={role}
          onChange={setRole}
        />
        <Button
          type="submit"
          variant="primary"
          leadingIcon="send-outline"
          className="mt-auto"
          busy={busy}
          disabled={disabled && !busy}
        >
          {translator.text('membership', 'invite.submit')}
        </Button>
      </form>
    </Card>
  );
}
