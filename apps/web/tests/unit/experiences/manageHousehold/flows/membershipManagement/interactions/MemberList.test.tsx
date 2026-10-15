import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  MemberList, type MemberListProps,
} from '../../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/MemberList';
import type {
  HouseholdMember,
} from '../../../../../../../src/experiences/manageHousehold/flows/membershipManagement/membershipState';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit, role
// menu and translator; only the Flow's handlers and slots are stand-ins.

/**
 * Builds a member.
 *
 * @param userId - Their id.
 * @param firstName - Their first name.
 * @param role - Their role.
 * @returns The member.
 */
const member = (
  userId: string,
  firstName: string,
  role: HouseholdMember['role'],
): HouseholdMember => ({
  userId,
  firstName,
  lastName: 'Doe',
  email: `${userId}@example.com`,
  role,
  joinedAt: '2024-03-15T12:00:00Z',
});

const JANE = member('jane', 'Jane', 'Owner');
const ALEX = member('alex', 'Alex', 'Admin');
const SAM = member('sam', 'Sam', 'Member');
const LOADED: MemberListProps['view'] = {
  status: 'loaded', members: [JANE, ALEX, SAM], invitations: [],
};

/**
 * Renders the list with stand-in handlers, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handlers.
 */
const renderList = (props: Partial<MemberListProps> = {}) => {
  const handlers = { onRoleChange: vi.fn(), onRemove: vi.fn(), onRetry: vi.fn() };
  renderInLocale(
    <MemberList
      view={LOADED}
      selfUserId="alex"
      selfRole="Admin"
      canManage
      locked={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

describe('MemberList — the rows', () => {
  it("tags the user's own row, shows their role in the header and their own actions", () => {
    renderList({ selfActions: <button type="button">leave</button> });

    expect(screen.getByText("You're an Admin")).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('alex@example.com · since 03/2024')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'leave' })).toHaveLength(1);
  });

  it('lets a manager change and remove anyone but themselves and the Owner', async () => {
    const { onRoleChange, onRemove } = renderList();

    expect(screen.queryByRole('button', { name: 'Remove Jane Doe' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove Alex Doe' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Alex Doe's role/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Sam Doe' }));
    expect(onRemove).toHaveBeenCalledWith('sam');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Sam Doe's role: Member" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: /Admin/ }));
    });
    expect(onRoleChange).toHaveBeenCalledWith('sam', 'Admin');
  });

  it('shows a Member or Viewer the roles only', () => {
    renderList({ selfUserId: 'sam', selfRole: 'Member', canManage: false });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Admin')).toBeTruthy();
  });

  it('locks every control while a request is out', () => {
    renderList({ locked: true });
    const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });
    expect(button('Remove Sam Doe').disabled).toBe(true);
    expect(button("Sam Doe's role: Member").disabled).toBe(true);
  });

  it('shows the open confirm and the last failure under the header', () => {
    renderList({ confirm: <p>confirm here</p>, alert: 'Something failed' });
    expect(screen.getByText('confirm here')).toBeTruthy();
    expect(screen.getByText('Something failed')).toBeTruthy();
  });
});

describe('MemberList — loading and failing', () => {
  it('shows skeleton rows while the list loads, with no role yet', () => {
    renderList({ view: { status: 'loading' }, selfRole: undefined });
    expect(screen.getByLabelText('Loading members')).toBeTruthy();
    expect(screen.queryByText(/You're/)).toBeNull();
  });

  it('shows a failed load with a retry', () => {
    const { onRetry } = renderList({
      view: { status: 'failed', error: { code: 'network.unavailable' } },
    });
    expect(screen.getByText("Couldn't connect. Check your connection and try again.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('speaks pt-BR', () => {
    renderInLocale(
      <MemberList
        view={LOADED}
        selfUserId="jane"
        selfRole="Owner"
        canManage
        locked={false}
        onRoleChange={vi.fn()}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
      />,
      'pt-BR',
    );
    expect(screen.getByText('Você é o proprietário')).toBeTruthy();
    expect(screen.getByText('jane@example.com · desde 03/2024')).toBeTruthy();
  });
});
