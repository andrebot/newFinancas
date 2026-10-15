import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { Button } from '../../../../../kit/button/Button';
import { Card } from '../../../../../kit/card/Card';
import { ListRow, ListRows } from '../../../../../kit/listRow/ListRow';
import { ListRowIcon } from '../../../../../kit/listRow/ListRowIcon';
import { SectionHeader } from '../../../../../kit/sectionHeader/SectionHeader';
import { Tag } from '../../../../../kit/tag/Tag';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { PendingInvitation } from '../membershipState';

// Pending Invitations (Membership Management, mockup 60; FR-1.10): the
// invitations nobody has answered yet, newest first, each with the role it
// offers, when it was sent and its Revoke. Revoking asks nothing — an
// invitation can simply be sent again (OQ-155).

/** Pending Invitations' props. */
export interface PendingInvitationsProps {
  readonly invitations: readonly PendingInvitation[];
  /** The invitation whose revoke is out: its button spins. */
  readonly revokingId?: string | undefined;
  /** A request is out: every Revoke waits. */
  readonly locked: boolean;
  /** The last revoke's failure, already translated. */
  readonly alert?: string | undefined;
  readonly onRevoke: (invitationId: string) => void;
}

/**
 * Renders the pending invitations panel: heading with the count, the last
 * failure and the rows, or a quiet note when there are none.
 *
 * @param props - The invitations, the revoke state and the handler.
 * @returns The panel.
 */
export function PendingInvitations({
  invitations, revokingId, locked, alert, onRevoke,
}: PendingInvitationsProps) {
  const translator = useI18n();
  const { length } = invitations;

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeader
        title={translator.text('membership', 'invitations.title')}
        actions={length > 0 && (
          <Tag>
            <span aria-hidden="true">{length}</span>
            <span className="sr-only">
              {translator.text('membership', 'invitations.count', { count: length })}
            </span>
          </Tag>
        )}
      />
      {alert && <InlineBanner tone="error" message={alert} />}
      {length === 0 ? (
        <p className="type-body-sm text-muted">
          {translator.text('membership', 'invitations.empty')}
        </p>
      ) : (
        <ListRows surface="raised">
          {invitations.map((invitation) => (
            <ListRow
              key={invitation.id}
              leading={<ListRowIcon icon="mail-outline" tone="neutral" />}
              title={invitation.email}
              titleWeight="regular"
              meta={(
                <span className="num">
                  {translator.text('membership', 'invitations.meta', {
                    role: translator.text('membership', `role.${invitation.role}`),
                    sentAt: new Date(invitation.createdAt),
                  })}
                </span>
              )}
              trailing={(
                <Button
                  variant="danger-ghost"
                  size="sm"
                  busy={revokingId === invitation.id}
                  disabled={locked && revokingId !== invitation.id}
                  aria-label={translator.text('membership', 'invitations.revokeLabel', {
                    email: invitation.email,
                  })}
                  onClick={() => onRevoke(invitation.id)}
                >
                  {translator.text('membership', 'invitations.revoke')}
                </Button>
              )}
            />
          ))}
        </ListRows>
      )}
    </Card>
  );
}
