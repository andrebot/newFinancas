import { useEffect, useRef, type ReactNode } from 'react';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { Avatar, avatarTone } from '../../../../../kit/avatar/Avatar';
import { Button } from '../../../../../kit/button/Button';
import { IconButton } from '../../../../../kit/button/IconButton';
import { Card } from '../../../../../kit/card/Card';
import { ListRow, ListRows } from '../../../../../kit/listRow/ListRow';
import { SectionHeader } from '../../../../../kit/sectionHeader/SectionHeader';
import { SkeletonRows } from '../../../../../kit/skeleton/Skeleton';
import { Tag } from '../../../../../kit/tag/Tag';
import { Tooltip } from '../../../../../kit/tooltip/Tooltip';
import { useI18n } from '../../../../../utilities/I18nProvider';
import {
  type AssignableRole, type HouseholdMember, type MembershipView,
} from '../membershipState';
import { fullName } from '../../../../../utilities/personName';
import { RoleMenu } from './RoleMenu';

// Member List (Membership Management, mockup 60): everyone in the household,
// the Owner first, each with their avatar, email, since when, role and
// actions. The signed-in user's row is tagged "You" and carries their own
// actions — transfer ownership (the Owner's), slotted in. An Owner/Admin may
// change anyone else's role but the Owner's and remove them (FR-1.11,
// FR-1.12); Remove names itself in a tooltip (K24). The open confirm
// (remove, transfer) comes from the Flow and takes the place of the row it is
// about (OQ-160). While the list loads it shows skeleton rows; when it fails,
// a banner with a retry.

/** The open confirm, and whose row it replaces. */
export interface RowConfirm {
  readonly userId: string;
  readonly element: ReactNode;
}

/** Member List's props. */
export interface MemberListProps {
  readonly view: MembershipView;
  readonly selfUserId: string;
  /** Whether the signed-in user manages members (Owner or Admin). */
  readonly canManage: boolean;
  /** A request is out: every control waits. */
  readonly locked: boolean;
  /** The last failure of a role change, remove or transfer, already translated. */
  readonly alert?: string | undefined;
  /** The open confirm (remove, transfer), in its member's row. */
  readonly confirm?: RowConfirm | undefined;
  /** On the signed-in user's row: transfer ownership. */
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
  const removeLabel = translator.text('membership', 'members.remove', { name });

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
              <Tooltip content={removeLabel} repeatsName>
                {(tip) => (
                  <IconButton
                    {...tip}
                    icon="person-remove-outline"
                    label={removeLabel}
                    data-remove-for={member.userId}
                    disabled={locked}
                    onClick={() => onRemove(member.userId)}
                  />
                )}
              </Tooltip>
            )}
          </div>
        </div>
      )}
    />
  );
}

/** The body's props: what the panel holds and its handlers. */
type MembersBodyProps = Omit<MemberListProps, 'alert'>;

/**
 * Renders what the panel holds: the skeleton rows, the failure with its
 * retry, or the members.
 *
 * @param props - The view, who is looking and the handlers.
 * @returns The body.
 */
function MembersBody({
  view, confirm, onRetry, ...rowProps
}: MembersBodyProps) {
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
      {view.members.map((member) => (confirm?.userId === member.userId
        ? <li key={member.userId}>{confirm.element}</li>
        : <MemberRow key={member.userId} member={member} {...rowProps} />
      ))}
    </ListRows>
  );
}

/**
 * Renders the members panel: the heading, the last failure and the body.
 * A confirm hands focus back to what held it, but a remove's button went with
 * its row; once that row is back, its button takes the focus again.
 *
 * @param props - The view, who is looking, the Flow's slots and handlers.
 * @returns The panel.
 */
export function MemberList({
  alert, ...bodyProps
}: MemberListProps) {
  const translator = useI18n();
  const bodyRef = useRef<HTMLDivElement>(null);
  const confirmedId = useRef<string>(undefined);
  const openId = bodyProps.confirm?.userId;

  useEffect(() => {
    const closedId = confirmedId.current;
    confirmedId.current = openId;
    if (openId !== undefined || closedId === undefined) return;
    if (document.activeElement !== document.body) return;
    bodyRef.current?.querySelector<HTMLElement>(`[data-remove-for="${closedId}"]`)?.focus();
  }, [openId]);

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeader title={translator.text('membership', 'members.title')} />
      {alert && <InlineBanner tone="error" message={alert} />}
      <div ref={bodyRef}>
        <MembersBody {...bodyProps} />
      </div>
    </Card>
  );
}
