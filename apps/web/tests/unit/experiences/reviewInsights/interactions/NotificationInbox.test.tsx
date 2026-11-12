import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { entriesOf } from '../../../../../src/experiences/reviewInsights/inbox';
import {
  NotificationInbox, type NotificationInboxProps,
} from '../../../../../src/experiences/reviewInsights/interactions/NotificationInbox';
import { renderInLocale } from '../../../../support/renderInLocale';
import {
  INBOX, INVITATION, INVITED, maturedWith, without,
} from '../dashboardFixtures';

// The Notification Inbox (BDT: Interaction, unit): what it draws for each
// state and notice, and the events its buttons emit. Nothing to mock — the
// kit, the translator and the formatter stay real.

const NOW = new Date('2026-10-13T12:00:00Z');

/**
 * Renders the inbox, loaded with the fixtures' notifications by default.
 *
 * @param over - Props to change.
 * @param locale - The locale.
 * @returns The props.
 */
const renderInbox = (
  over: Partial<NotificationInboxProps> = {},
  locale: 'en-US' | 'pt-BR' = 'en-US',
) => {
  const props: NotificationInboxProps = {
    read: { status: 'loaded', entries: entriesOf(INBOX, [INVITATION], ['n-matured', 'n-invite']) },
    now: NOW,
    busyId: undefined,
    onRetry: vi.fn(),
    onAnswer: vi.fn(),
    onArchive: vi.fn(),
    onView: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  };
  renderInLocale(<NotificationInbox {...props} />, locale);
  return props;
};

/**
 * Finds a notification's row by its text.
 *
 * @param text - A piece of its line.
 * @returns The row.
 */
const rowOf = (text: string | RegExp) => screen.getByText(text).closest('li') as HTMLLIElement;

describe('NotificationInbox', () => {
  it('heads the panel with how many are new', () => {
    renderInbox();

    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeTruthy();
    expect(screen.getByText('2 new · marked seen')).toBeTruthy();
  });

  it('words an invitation and a matured Holding, with their times', () => {
    renderInbox();

    expect(screen.getByText('Alex Rivera invited you to The Rivera Household as a member.'))
      .toBeTruthy();
    expect(screen.getByText(
      'CDB Banco Inter 2026 reached its due date on 09/30/2026 but still has a position. '
      + 'Archive it?',
    )).toBeTruthy();
    expect(screen.getByText('2 hours ago')).toBeTruthy();
    expect(screen.getByText('1 hour ago')).toBeTruthy();
  });

  it('dims a notification seen before, with when, and words an unknown type generically', () => {
    renderInbox();

    const row = rowOf('You have a new notification.');
    expect(row.className).toContain('opacity-60');
    expect(row.textContent).toContain('Seen · 3 days ago');
    expect(rowOf(/^Alex Rivera/).className).not.toContain('opacity-60');
  });

  it('emits an invitation\'s answers and a matured Holding\'s actions', () => {
    const props = renderInbox();

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive holding' }));
    fireEvent.click(screen.getByRole('button', { name: 'View holding' }));

    expect(props.onAnswer).toHaveBeenNthCalledWith(1, 'n-invite', 'accept');
    expect(props.onAnswer).toHaveBeenNthCalledWith(2, 'n-invite', 'decline');
    expect(props.onArchive).toHaveBeenCalledWith('n-matured');
    expect(props.onView).toHaveBeenCalledWith('n-matured');
  });

  it('deletes any notification from its ✕', () => {
    const props = renderInbox();

    const deletes = screen.getAllByRole('button', { name: 'Delete notification' });
    expect(deletes).toHaveLength(3);
    fireEvent.click(deletes[2]!);

    expect(props.onDelete).toHaveBeenCalledWith('n-other');
  });

  it('disables only the busy row', () => {
    renderInbox({ busyId: 'n-invite' });

    const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });
    expect(button('Accept').disabled).toBe(true);
    expect(button('Archive holding').disabled).toBe(false);
  });

  it('shows a stale invitation with no answers, a Holding with no ticker by its type', () => {
    const entries = entriesOf(
      [INVITED, maturedWith({ holdingId: 'cdb-1', assetType: 'cdb', dueDate: '2026-09-30' })],
      [],
      [],
    );
    renderInbox({ read: { status: 'loaded', entries } });

    expect(screen.getByText('This invitation is no longer open.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    expect(screen.getByText(/^CDB reached its due date on 09\/30\/2026/)).toBeTruthy();
    expect(screen.queryByText(/marked seen/)).toBeNull();
  });

  it('calls an inviter whose account is gone "Someone", a row without a time timeless', () => {
    const orphan = { ...INVITATION, inviterFirstName: null, inviterLastName: null };
    const entries = entriesOf([without(INVITED, 'createdAt')], [orphan], ['n-invite']);
    renderInbox({ read: { status: 'loaded', entries } });

    const row = rowOf(/^Someone invited you/);
    expect(row.querySelectorAll('p')[1]?.textContent).toBe('');
  });

  it('says so when there is nothing', () => {
    renderInbox({ read: { status: 'loaded', entries: [] } });

    expect(screen.getByText('You\'re all caught up.')).toBeTruthy();
  });

  it('shows placeholders while it loads', () => {
    renderInbox({ read: { status: 'loading' } });

    expect(screen.getByLabelText('Loading your notifications')).toBeTruthy();
  });

  it('shows a failure with Try again', () => {
    const props = renderInbox({ read: { status: 'failed' } });

    expect(screen.getByText('Couldn\'t load your notifications.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(props.onRetry).toHaveBeenCalled();
  });

  it('speaks pt-BR', () => {
    renderInbox({}, 'pt-BR');

    expect(screen.getByText('2 novas · marcadas como vistas')).toBeTruthy();
    expect(screen.getByText(
      'CDB Banco Inter 2026 venceu em 30/09/2026, mas ainda tem posição. Arquivar?',
    )).toBeTruthy();
    expect(screen.getByText('há 2 horas')).toBeTruthy();
  });
});
