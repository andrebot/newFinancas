import { describe, expect, it } from 'vitest';
import {
  actionOf, entriesOf, noticeOf, unseenIdsOf,
} from '../../../../src/experiences/reviewInsights/inbox';
import {
  INBOX, INVITATION, INVITED, MATURED, maturedWith, SEEN_OTHER, without,
} from './dashboardFixtures';

// What the Notification Inbox shows (BDT: unit, pure — nothing to mock).

describe('noticeOf (OQ-82, OQ-243)', () => {
  it('names a waiting invitation from the invitations', () => {
    expect(noticeOf(INVITED, [INVITATION])).toEqual({
      kind: 'invitation',
      inviterName: 'Alex Rivera',
      householdName: 'The Rivera Household',
      role: 'Member',
    });
  });

  it('leaves the inviter unnamed when their account is gone', () => {
    const orphan = { ...INVITATION, inviterFirstName: null, inviterLastName: null };
    expect(noticeOf(INVITED, [orphan])).toEqual(expect.objectContaining({
      inviterName: undefined,
    }));
  });

  it('names an inviter with only a first name', () => {
    const single = { ...INVITATION, inviterLastName: null };
    expect(noticeOf(INVITED, [single])).toEqual(expect.objectContaining({ inviterName: 'Alex' }));
  });

  it('calls an invitation no longer waiting stale', () => {
    expect(noticeOf(INVITED, [])).toEqual({ kind: 'staleInvitation' });
  });

  it('reads a matured Holding from its params', () => {
    expect(noticeOf(MATURED, [])).toEqual({
      kind: 'matured',
      holdingId: 'cdb-1',
      ticker: 'CDB Banco Inter 2026',
      assetType: 'cdb',
      dueDate: '2026-09-30',
    });
  });

  it('reads a matured Holding with no ticker or type', () => {
    const bare = maturedWith({ holdingId: 'cdb-1', ticker: 7, dueDate: '2026-09-30' });
    expect(noticeOf(bare, [])).toEqual({
      kind: 'matured',
      holdingId: 'cdb-1',
      ticker: null,
      assetType: undefined,
      dueDate: '2026-09-30',
    });
  });

  it('shows a matured notice without its Holding or date, and an unknown type, generically', () => {
    expect(noticeOf(maturedWith({ dueDate: '2026-09-30' }), [])).toEqual({ kind: 'other' });
    expect(noticeOf(maturedWith({ holdingId: 'cdb-1' }), [])).toEqual({ kind: 'other' });
    expect(noticeOf(SEEN_OTHER, [])).toEqual({ kind: 'other' });
  });
});

describe('unseenIdsOf', () => {
  it('lists the unseen ones, in the inbox\'s order', () => {
    expect(unseenIdsOf(INBOX)).toEqual(['n-matured', 'n-invite']);
  });

  it('leaves out a notification without an id', () => {
    expect(unseenIdsOf([without(MATURED, 'id')])).toEqual([]);
  });
});

describe('entriesOf', () => {
  it('builds a row per notification, new when unseen as the inbox opened or still', () => {
    // The matured notice was marked seen since the inbox opened; the invitation
    // arrived after the last poll, so it wasn't among those it opened with.
    const marked = { ...MATURED, seenAt: '2026-10-13T12:00:00Z' };
    expect(entriesOf([marked, INVITED, SEEN_OTHER], [INVITATION], ['n-matured'])).toEqual([
      {
        id: 'n-matured',
        createdAt: MATURED.createdAt,
        fresh: true,
        notice: expect.objectContaining({ kind: 'matured' }),
      },
      {
        id: 'n-invite',
        createdAt: INVITED.createdAt,
        fresh: true,
        notice: expect.objectContaining({ kind: 'invitation' }),
      },
      {
        id: 'n-other', createdAt: SEEN_OTHER.createdAt, fresh: false, notice: { kind: 'other' },
      },
    ]);
  });

  it('leaves out a notification without an id, and keeps one without a time', () => {
    const entries = entriesOf(
      [without(MATURED, 'id'), without(INVITED, 'createdAt')],
      [],
      [],
    );
    expect(entries).toEqual([
      {
        id: 'n-invite', createdAt: '', fresh: true, notice: { kind: 'staleInvitation' },
      },
    ]);
  });
});

describe('actionOf', () => {
  it('builds the action the shell routes, with the notification\'s params', () => {
    expect(actionOf(INVITED, 'accept')).toEqual({
      notificationId: 'n-invite',
      type: 'invitation.received',
      action: 'accept',
      params: INVITED.params,
    });
  });

  it('takes a notification without an id as an empty one', () => {
    expect(actionOf(without(MATURED, 'id'), 'archive').notificationId).toBe('');
  });
});
