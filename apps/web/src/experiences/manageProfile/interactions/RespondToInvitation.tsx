import type { ReceivedInvitation } from '@financas/api-types';
import { Button } from '../../../kit/button/Button';
import { Card } from '../../../kit/card/Card';
import { ListRow, ListRows } from '../../../kit/listRow/ListRow';
import { ListRowIcon } from '../../../kit/listRow/ListRowIcon';
import { SectionHeader } from '../../../kit/sectionHeader/SectionHeader';
import { Tag } from '../../../kit/tag/Tag';
import type { Translator } from '../../../utilities/i18n';
import { useI18n } from '../../../utilities/I18nProvider';
import type { InvitationAnswer } from '../respondToInvitation';

// Respond to Invitation (X3, OQ-159; FR-1.10, mockup 70): the invitations
// waiting for the user's answer, each with the household, who sent it and
// the role it offers, and Decline / Accept. It holds nothing: the answer goes
// up to the Experience, which says which invitation is being answered. While
// one is out, every other answer waits.

/** An answer that is out: which invitation, and what was answered. */
export interface Answering {
  readonly invitationId: string;
  readonly answer: InvitationAnswer;
}

/** Respond to Invitation's props. */
export interface RespondToInvitationProps {
  /** The pending invitations; the Experience leaves the panel out when none is. */
  readonly invitations: readonly ReceivedInvitation[];
  /** The invitation whose answer is out, if any, and what was answered. */
  readonly answering?: Answering | undefined;
  /** Gets the user's answer to one invitation. */
  readonly onAnswer: (invitationId: string, answer: InvitationAnswer) => void;
}

/**
 * Names who sent an invitation: "Someone" once their account is gone (OQ-82).
 *
 * @param invitation - The invitation.
 * @param translator - The current locale's translator.
 * @returns The inviter's name.
 */
export const inviterName = (invitation: ReceivedInvitation, translator: Translator) => (
  invitation.inviterFirstName === null || invitation.inviterLastName === null
    ? translator.text('profile', 'invitations.someone')
    : translator.text('profile', 'invitations.inviter', {
      firstName: invitation.inviterFirstName,
      lastName: invitation.inviterLastName,
    })
);

/**
 * Renders the invitations panel: a count, then one row per invitation.
 *
 * @param props - The invitations, the answer that is out and the handler.
 * @returns The panel.
 */
export function RespondToInvitation({
  invitations, answering, onAnswer,
}: RespondToInvitationProps) {
  const translator = useI18n();

  /**
   * Builds one row's buttons: the one answered spins, every other waits.
   *
   * @param invitation - The row's invitation.
   * @returns Decline and Accept.
   */
  const answers = (invitation: ReceivedInvitation) => {
    const household = { household: invitation.householdName };
    const busyWith = answering?.invitationId === invitation.id ? answering.answer : undefined;
    return (
      <div className="flex shrink-0 gap-2">
        <Button
          variant="ghost"
          size="sm"
          aria-label={translator.text('profile', 'invitations.declineLabel', household)}
          busy={busyWith === 'decline'}
          disabled={answering !== undefined && busyWith !== 'decline'}
          onClick={() => onAnswer(invitation.id, 'decline')}
        >
          {translator.text('profile', 'invitations.decline')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          aria-label={translator.text('profile', 'invitations.acceptLabel', household)}
          busy={busyWith === 'accept'}
          disabled={answering !== undefined && busyWith !== 'accept'}
          onClick={() => onAnswer(invitation.id, 'accept')}
        >
          {translator.text('profile', 'invitations.accept')}
        </Button>
      </div>
    );
  };

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeader
        title={translator.text('profile', 'invitations.title')}
        actions={<Tag>{invitations.length}</Tag>}
      />
      <ListRows surface="raised" label={translator.text('profile', 'invitations.title')}>
        {invitations.map((invitation) => (
          <ListRow
            key={invitation.id}
            leading={<ListRowIcon icon="groups-outline" tone="sky" />}
            title={invitation.householdName}
            meta={(
              <>
                {translator.text('profile', 'invitations.invitedBy', {
                  inviter: inviterName(invitation, translator),
                })}
                {' '}
                <b className="font-medium text-ink">
                  {translator.text('membership', `role.${invitation.role}`)}
                </b>
              </>
            )}
            trailing={answers(invitation)}
          />
        ))}
      </ListRows>
    </Card>
  );
}
