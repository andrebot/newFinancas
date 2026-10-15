import type { ComponentType, ReactNode } from 'react';
import { IconButton } from '../../kit/button/IconButton';
import { CountBadge } from '../../kit/countBadge/CountBadge';
import { Popover, type PopoverTriggerProps } from '../../kit/popover/Popover';
import { useI18n } from '../../utilities/I18nProvider';
import type { NotificationAction, RoutingOutcome } from '../notificationRouting';
import type { InboxPanelProps } from '../shellConfig';

// The header's notification bell (S1, mockup 23): the unseen count in a coral
// badge, and Review Insights' Notification Inbox in a panel under it. The bell
// only hosts the inbox; what the inbox's actions do is the shell's routing.

/** The panel's width in px, from mockup 23; the viewport still caps it. */
const INBOX_WIDTH = 400;

/** The bell's props. */
export interface NotificationBellProps {
  readonly unseenCount: number;
  /** Review Insights' inbox panel. */
  readonly Panel: ComponentType<InboxPanelProps>;
  /** Routes an action from the inbox to the Experience that owns it. */
  readonly onAction: (action: NotificationAction) => Promise<RoutingOutcome>;
}

/**
 * Builds the bell button the popover opens from.
 *
 * @param label - The button's name, already translated.
 * @param badge - The unseen count's badge.
 * @returns The trigger renderer.
 */
const bellButton = (label: string, badge: ReactNode) => function BellButton(
  triggerProps: PopoverTriggerProps,
) {
  return (
    <IconButton
      {...triggerProps}
      icon="notifications-outline"
      label={label}
      size="lg"
      className="relative text-ink"
      badge={badge}
    />
  );
};

/**
 * Builds the panel's content: the inbox, with the popover's `close`.
 *
 * @param Panel - Review Insights' inbox panel.
 * @param onAction - The action router.
 * @returns The content renderer.
 */
const inboxContent = (
  Panel: ComponentType<InboxPanelProps>,
  onAction: NotificationBellProps['onAction'],
) => function InboxContent(close: () => void) {
  return <Panel close={close} onAction={onAction} />;
};

/**
 * Renders the bell and, while open, the inbox panel under it.
 *
 * @param props - The unseen count, the inbox panel and the action router.
 * @returns The bell.
 */
export function NotificationBell({ unseenCount, Panel, onAction }: NotificationBellProps) {
  const translator = useI18n();
  const label = translator.text('shell', 'header.notifications');
  const badge = (
    <CountBadge
      count={unseenCount}
      label={translator.text('shell', 'header.unseen', { count: unseenCount })}
      className="absolute top-1 right-1"
    />
  );

  return (
    <Popover label={label} width={INBOX_WIDTH} trigger={bellButton(label, badge)}>
      {inboxContent(Panel, onAction)}
    </Popover>
  );
}
