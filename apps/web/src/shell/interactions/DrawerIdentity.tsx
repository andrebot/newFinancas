import { Avatar, avatarTone } from '../../kit/avatar/Avatar';
import { Skeleton } from '../../kit/skeleton/Skeleton';
import { useI18n } from '../../utilities/I18nProvider';
import type { SourceState } from '../../utilities/sourceState';
import type { ShellIdentity } from '../shellConfig';

// The nav drawer's identity (S1, mockup 21): the signed-in user's avatar in
// their own mint, a greeting and their email. While the profile loads it
// shows placeholders; if it fails the drawer simply goes without it — nothing
// in the drawer depends on it.

/** The identity's props. */
export interface DrawerIdentityProps {
  readonly identity: SourceState<ShellIdentity>;
}

/**
 * Renders who is signed in.
 *
 * @param props - The signed-in user, as Manage Profile reports them.
 * @returns The identity row, its placeholders, or nothing after a failure.
 */
export function DrawerIdentity({ identity }: DrawerIdentityProps) {
  const translator = useI18n();

  if (identity.status === 'failed') {
    return null;
  }
  if (identity.status === 'loading') {
    return (
      <div role="status" className="flex items-center gap-3 px-2 pt-1">
        <span className="sr-only">{translator.text('shell', 'identity.loading')}</span>
        <Skeleton shape="circle" className="size-10" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="w-2/5" />
          <Skeleton className="w-3/5" />
        </div>
      </div>
    );
  }

  const user = identity.data;
  return (
    <div className="flex items-center gap-3 px-2 pt-1">
      <Avatar
        firstName={user.firstName}
        lastName={user.lastName}
        tone={avatarTone(user.id, true)}
      />
      <div className="min-w-0">
        <p className="type-body font-semibold">
          {translator.text('shell', 'identity.greeting', { firstName: user.firstName })}
        </p>
        <p className="truncate type-caption text-muted">{user.email}</p>
      </div>
    </div>
  );
}
