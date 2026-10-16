import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  PendingInvitations, type PendingInvitationsProps,
} from '../../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/PendingInvitations';
import type {
  PendingInvitation,
} from '../../../../../../../src/experiences/manageHousehold/flows/membershipManagement/membershipState';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator; only the Flow's handler is a stand-in.

const MORGAN: PendingInvitation = {
  id: 'morgan', email: 'morgan@example.com', role: 'Member', createdAt: '2026-10-12T12:00:00Z',
};
const LEE: PendingInvitation = {
  id: 'lee', email: 'lee@example.com', role: 'Viewer', createdAt: '2026-10-01T12:00:00Z',
};

/**
 * Renders the panel with a stand-in handler, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handler.
 */
const renderPanel = (props: Partial<PendingInvitationsProps> = {}) => {
  const onRevoke = vi.fn();
  renderInLocale(
    <PendingInvitations
      invitations={[MORGAN, LEE]}
      locked={false}
      onRevoke={onRevoke}
      {...props}
    />,
  );
  return onRevoke;
};

const revokeOf = (email: string) => screen.getByRole<HTMLButtonElement>(
  'button',
  { name: `Revoke the invitation to ${email}` },
);

describe('PendingInvitations', () => {
  it('lists each invitation with its role, date and count, and emits a revoke', () => {
    const onRevoke = renderPanel();

    expect(screen.getByText('2 pending invitations')).toBeTruthy();
    expect(screen.getByText('Member · sent 10/12/2026')).toBeTruthy();
    fireEvent.click(revokeOf('lee@example.com'));
    expect(onRevoke).toHaveBeenCalledWith('lee');
  });

  it('spins the revoke that is out and makes the others wait', () => {
    renderPanel({ revokingId: 'morgan', locked: true });
    expect(revokeOf('lee@example.com').disabled).toBe(true);
    expect(revokeOf('morgan@example.com').getAttribute('aria-busy')).toBe('true');
    // The busy one stays focusable (busy, not disabled) so focus isn't lost.
    expect(revokeOf('morgan@example.com').disabled).toBe(false);
  });

  it('shows the last failure and, when there are none, a quiet note without a count', () => {
    renderPanel({ invitations: [], alert: 'Something failed' });
    expect(screen.getByText('Something failed')).toBeTruthy();
    expect(screen.getByText('No pending invitations.')).toBeTruthy();
    expect(screen.queryByText(/^\d+ pending invitation/)).toBeNull();
  });

  it('speaks pt-BR', () => {
    renderInLocale(
      <PendingInvitations invitations={[MORGAN]} locked={false} onRevoke={vi.fn()} />,
      'pt-BR',
    );
    expect(screen.getByText('Membro · enviado em 12/10/2026')).toBeTruthy();
  });
});
