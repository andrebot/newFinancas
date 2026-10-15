import type { ReactNode } from 'react';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { Avatar, avatarTone } from '../../../../../kit/avatar/Avatar';
import { Button } from '../../../../../kit/button/Button';
import { IconButton } from '../../../../../kit/button/IconButton';
import { Card } from '../../../../../kit/card/Card';
import { ListRow, ListRows } from '../../../../../kit/listRow/ListRow';
import { SectionHeader } from '../../../../../kit/sectionHeader/SectionHeader';
import { SkeletonRows } from '../../../../../kit/skeleton/Skeleton';
import { Tag } from '../../../../../kit/tag/Tag';
import { useI18n } from '../../../../../utilities/I18nProvider';
import {
  fullName, type AssignableRole, type HouseholdMember, type MembershipView, type Role,
} from '../membershipState';
import { RoleMenu } from './RoleMenu';

// Member List (Membership Management, mockup 60): everyone in the household,
// the Owner first, each with their avatar, email, since when, role and
// actions. The signed-in user's row is tagged "You" and carries their own
// actions — transfer ownership (the Owner's) and leave, both slotted in. An
// Owner/Admin may change anyone else's role but the Owner's and remove them
// (FR-1.11, FR-1.12); the remove's confirm comes from the Flow, under the
// header. While the list loads it shows skeleton rows; when it fails, a
// banner with a retry.

/** Member List's props. */
export interface MemberListProps {
  readonly view: MembershipView;
  readonly selfUserId: string;
  /** The signed-in user's role, once the list is loaded. */
  readonly selfRole?: Role | undefined;
  /** Whether the signed-in user manages members (Owner or Admin). */
  readonly canManage: boolean;
  /** A request is out: every control waits. */
  readonly locked: boolean;
  /** The last failure of a role change, remove or transfer, already translated. */
  readonly alert?: string | undefined;
  /** The open confirm (remove, transfer), under the header. */
  readonly confirm?: ReactNode;
  /** On the signed-in user's row: transfer ownership and leave. */
  readonly selfActions?: ReactNode;
  readonly onRoleChange: (userId: string, role: AssignableRole) => void;
  readonly onRemove: (userId: string) => void;
  readonly onRetry: () => void;
}

/** One row's props. */
type MemberRowProps = Pick<
  MemberListProps,
  'selfUserId' | 'canManage' | 'locked' | 'selfActions' | 'onRoleChange' | 'onRemove'
> & { readonly member: HouseholdMember };

/**
 * Renders one member: avatar, name (tagged when it is the signed-in user),
 * email and since when, role, then their actions.
 *
 * @param props - The member, who is looking and the handlers.
 * @returns The row.
 */
function MemberRow({
  member, selfUserId, canManage, locked, selfActions, onRoleChange, onRemove,
}: MemberRowProps) {
  const translator = useI18n();
  const isSelf = member.userId === selfUserId;
  const name = fullName(member);
  const manageable = canManage && !isSelf && member.role !== 'Owner';

  return (
    <ListRow
      leading={(
        <Avatar
          firstName={member.firstName}
          lastName={member.lastName}
          tone={avatarTone(member.userId, isSelf)}
        />
      )}
      title={(
        <>
          {name}
          {isSelf && (
            <Tag tone="mint" className="ml-1.5 align-middle">
              {translator.text('membership', 'members.you')}
            </Tag>
          )}
        </>
      )}
      meta={(
        <span className="num">
          {translator.text('membership', 'members.meta', {
            email: member.email, joinedAt: new Date(member.joinedAt),
          })}
        </span>
      )}
      trailing={(
        <div className="flex items-center gap-2">
          <RoleMenu
            name={name}
            current={member.role}
            editable={manageable}
            disabled={locked}
            onChange={(role) => onRoleChange(member.userId, role)}
          />
          <div className="flex min-w-8 justify-end">
            {isSelf && selfActions}
            {manageable && (
              <IconButton
                icon="person-remove-outline"
                label={translator.text('membership', 'members.remove', { name })}
                disabled={locked}
                onClick={() => onRemove(member.userId)}
              />
            )}
          </div>
        </div>
      )}
    />
  );
}

/** The body's props: what the panel holds and its handlers. */
type MembersBodyProps = Omit<MemberListProps, 'selfRole' | 'alert' | 'confirm'>;

/**
 * Renders what the panel holds: the skeleton rows, the failure with its
 * retry, or the members.
 *
 * @param props - The view, who is looking and the handlers.
 * @returns The body.
 */
function MembersBody({ view, onRetry, ...rowProps }: MembersBodyProps) {
  const translator = useI18n();
  if (view.status === 'loading') {
    return <SkeletonRows label={translator.text('membership', 'members.loading')} count={4} />;
  }
  if (view.status === 'failed') {
    return (
      <InlineBanner
        tone="error"
        message={translator.error(view.error.code, view.error.params)}
        action={(
          <Button variant="ghost" size="sm" onClick={onRetry}>
            {translator.text('membership', 'members.retry')}
          </Button>
        )}
      />
    );
  }
  return (
    <ListRows>
      {view.members.map((member) => (
        <MemberRow key={member.userId} member={member} {...rowProps} />
      ))}
    </ListRows>
  );
}

/**
 * Renders the members panel: the heading with the user's own role, the open
 * confirm, the last failure and the body.
 *
 * @param props - The view, who is looking, the Flow's slots and handlers.
 * @returns The panel.
 */
export function MemberList({
  selfRole, alert, confirm, ...bodyProps
}: MemberListProps) {
  const translator = useI18n();

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeader
        title={translator.text('membership', 'members.title')}
        actions={selfRole && (
          <span className="type-caption text-muted">
            {translator.text('membership', 'members.yourRole', { role: selfRole })}
          </span>
        )}
      />
      {confirm}
      {alert && <InlineBanner tone="error" message={alert} />}
      <MembersBody {...bodyProps} />
    </Card>
  );
}
