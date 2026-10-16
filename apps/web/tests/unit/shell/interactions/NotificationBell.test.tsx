import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { NotificationBell } from '../../../../src/shell/interactions/NotificationBell';
import type { NotificationAction } from '../../../../src/shell/notificationRouting';
import type { InboxPanelProps } from '../../../../src/shell/shellConfig';
import { renderInLocale } from '../../../support/renderInLocale';

// Interaction (BDT: unit). The inbox panel is Review Insights' — a stand-in
// here that shows what the bell hands it.

const ACTION: NotificationAction = {
  notificationId: 'n-1', type: 'holding.matured', action: 'archive', params: {},
};

/**
 * A stand-in inbox: one button that acts on a notification, one that closes.
 *
 * @param props - What the bell hands the panel.
 * @returns The stand-in.
 */
function FakeInbox({ close, onAction }: InboxPanelProps) {
  return (
    <div>
      <button type="button" onClick={() => onAction(ACTION)}>Archive holding</button>
      <button type="button" onClick={close}>Done</button>
    </div>
  );
}

describe('NotificationBell', () => {
  it('shows the unseen count in the bell name', () => {
    renderInLocale(<NotificationBell unseenCount={2} Panel={FakeInbox} onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Notifications 2 unseen' })).toBeTruthy();
  });

  it('has no badge with nothing unseen', () => {
    renderInLocale(<NotificationBell unseenCount={0} Panel={FakeInbox} onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy();
  });

  it('opens the inbox, routes its actions and lets it close itself', () => {
    const onAction = vi.fn(async () => 'done' as const);
    renderInLocale(<NotificationBell unseenCount={1} Panel={FakeInbox} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: /^Notifications/ }));
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Archive holding' }));
    expect(onAction).toHaveBeenCalledWith(ACTION);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('speaks pt-BR', () => {
    renderInLocale(
      <NotificationBell unseenCount={3} Panel={FakeInbox} onAction={vi.fn()} />,
      'pt-BR',
    );
    expect(screen.getByRole('button', { name: 'Notificações 3 não vistas' })).toBeTruthy();
  });
});
