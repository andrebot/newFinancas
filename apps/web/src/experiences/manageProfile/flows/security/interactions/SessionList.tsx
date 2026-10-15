import type { ReactNode } from 'react';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { Button } from '../../../../../kit/button/Button';
import { Card } from '../../../../../kit/card/Card';
import type { IconName } from '../../../../../kit/icons/Icon';
import { ListRow, ListRows } from '../../../../../kit/listRow/ListRow';
import { ListRowIcon } from '../../../../../kit/listRow/ListRowIcon';
import { SectionHeader } from '../../../../../kit/sectionHeader/SectionHeader';
import { SkeletonRows } from '../../../../../kit/skeleton/Skeleton';
import { Tag } from '../../../../../kit/tag/Tag';
import type { Translator } from '../../../../../utilities/i18n';
import { useI18n } from '../../../../../utilities/I18nProvider';
import {
  describeUserAgent, type DeviceDescription, type DeviceKind,
} from '../../../../../utilities/userAgent';
import type { SecuritySession, SessionsView } from '../securityState';

// Session List (Security, mockup 70): the devices signed in to the account,
// this one first and tagged, each other with its Revoke (FR-1.3). The device
// is named from its User-Agent ("Chrome on macOS") and marked by its kind.
// While the list loads it shows skeleton rows; when it fails, a banner with
// a retry. The header's action (Sign Out All Others) and its confirm come
// from the Flow. Revoking one row needs no confirm (OQ-154).

/** Session List's props. */
export interface SessionListProps {
  readonly sessions: SessionsView;
  /** The session whose revoke is out: its button spins. */
  readonly revokingId?: string | undefined;
  /** A revoke is out: every Revoke waits. */
  readonly revokeLocked: boolean;
  /** The last revoke's failure, already translated. */
  readonly alert?: string | undefined;
  /** The header's action: the "Sign out all others" button, when there are others. */
  readonly headerAction?: ReactNode;
  /** The "sign out all others" confirm, under the header while it's open. */
  readonly confirm?: ReactNode;
  readonly onRevoke: (sessionId: string) => void;
  readonly onRetry: () => void;
}

const GLYPHS: Record<DeviceKind, IconName> = {
  laptop: 'laptop-mac-outline',
  desktop: 'desktop-windows-outline',
  phone: 'smartphone-outline',
  tablet: 'devices-outline',
  unknown: 'devices-outline',
};

/**
 * Names a device in the current locale: "Chrome on macOS", or the one brand
 * known, or "Unknown device".
 *
 * @param device - What the User-Agent said.
 * @param translator - The current locale's translator.
 * @returns The name.
 */
export const deviceName = ({ browser, system }: DeviceDescription, translator: Translator) => {
  if (browser && system) return translator.text('security', 'sessions.device', { browser, system });
  return browser ?? system ?? translator.text('security', 'sessions.unknownDevice');
};

/**
 * Says when a session signed in and when it was last used ("Active now" for
 * this device).
 *
 * @param session - The session.
 * @param translator - The current locale's translator.
 * @returns The meta line.
 */
export const sessionMeta = (session: SecuritySession, translator: Translator) => {
  const signedIn = new Date(session.createdAt);
  return session.current
    ? translator.text('security', 'sessions.current', { signedIn })
    : translator.text('security', 'sessions.other', {
      signedIn, lastUsed: new Date(session.lastUsedAt),
    });
};

/** One row's props. */
interface SessionRowProps {
  readonly session: SecuritySession;
  readonly revoking: boolean;
  readonly locked: boolean;
  readonly onRevoke: (sessionId: string) => void;
}

/**
 * Renders one session: its device mark, name (tagged when it is this one),
 * dates and, for the others, the Revoke button.
 *
 * @param props - The session, its revoke state and the handler.
 * @returns The row.
 */
function SessionRow({
  session, revoking, locked, onRevoke,
}: SessionRowProps) {
  const translator = useI18n();
  const device = describeUserAgent(session.deviceInfo);
  const name = deviceName(device, translator);

  return (
    <ListRow
      leading={(
        <ListRowIcon icon={GLYPHS[device.kind]} tone={session.current ? 'mint' : 'neutral'} />
      )}
      title={(
        <>
          {name}
          {session.current && (
            <Tag tone="mint" className="ml-1.5 align-middle">
              {translator.text('security', 'sessions.thisDevice')}
            </Tag>
          )}
        </>
      )}
      meta={<span className="num">{sessionMeta(session, translator)}</span>}
      trailing={!session.current && (
        <Button
          variant="danger-ghost"
          size="sm"
          busy={revoking}
          disabled={locked && !revoking}
          aria-label={translator.text('security', 'sessions.revokeLabel', { device: name })}
          onClick={() => onRevoke(session.id)}
        >
          {translator.text('security', 'sessions.revoke')}
        </Button>
      )}
    />
  );
}

/** The body's props: what the panel holds and its handlers. */
type SessionsBodyProps = Pick<
  SessionListProps, 'sessions' | 'revokingId' | 'revokeLocked' | 'onRevoke' | 'onRetry'
>;

/**
 * Renders what the panel holds: the skeleton rows, the failure with its
 * retry, or the list.
 *
 * @param props - The sessions, the revoke state and the handlers.
 * @returns The body.
 */
function SessionsBody({
  sessions, revokingId, revokeLocked, onRevoke, onRetry,
}: SessionsBodyProps) {
  const translator = useI18n();
  if (sessions.status === 'loading') {
    return <SkeletonRows label={translator.text('security', 'sessions.loading')} count={3} />;
  }
  if (sessions.status === 'failed') {
    return (
      <InlineBanner
        tone="error"
        message={translator.error(sessions.error.code, sessions.error.params)}
        action={(
          <Button variant="ghost" size="sm" onClick={onRetry}>
            {translator.text('security', 'sessions.retry')}
          </Button>
        )}
      />
    );
  }
  return (
    <ListRows>
      {sessions.sessions.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          revoking={revokingId === session.id}
          locked={revokeLocked}
          onRevoke={onRevoke}
        />
      ))}
    </ListRows>
  );
}

/**
 * Renders the sessions panel: the heading with its action, the open confirm,
 * the last revoke failure and the body.
 *
 * @param props - The sessions, the revoke state, the Flow's slots and handlers.
 * @returns The panel.
 */
export function SessionList({
  sessions, revokingId, revokeLocked, alert, headerAction, confirm, onRevoke, onRetry,
}: SessionListProps) {
  const translator = useI18n();

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeader title={translator.text('security', 'sessions.title')} actions={headerAction} />
      {confirm}
      {alert && <InlineBanner tone="error" message={alert} />}
      <SessionsBody
        sessions={sessions}
        revokingId={revokingId}
        revokeLocked={revokeLocked}
        onRevoke={onRevoke}
        onRetry={onRetry}
      />
    </Card>
  );
}
