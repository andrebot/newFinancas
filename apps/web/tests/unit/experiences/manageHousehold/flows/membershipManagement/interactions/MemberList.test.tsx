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
      canManage
      locked={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

describe('MemberList — the rows', () => {
  it("tags the user's own row and shows their own actions", () => {
    renderList({ selfActions: <button type="button">leave</button> });

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
    renderList({ selfUserId: 'sam', canManage: false });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Admin')).toBeTruthy();
  });

  it('names Remove in a tooltip on focus', async () => {
    renderList();

    await act(async () => screen.getByRole('button', { name: 'Remove Sam Doe' }).focus());

    expect(screen.getByText('Remove Sam Doe', { selector: '[aria-hidden]' })).toBeTruthy();
  });

  it('locks every control while a request is out', () => {
    renderList({ locked: true });
    const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });
    expect(button('Remove Sam Doe').disabled).toBe(true);
    expect(button("Sam Doe's role: Member").disabled).toBe(true);
  });

  it('shows the open confirm in place of its member’s row, and the last failure', () => {
    renderList({
      confirm: { userId: 'sam', element: <p>confirm here</p> },
      alert: 'Something failed',
    });
    expect(screen.getByText('confirm here').closest('li')).toBeTruthy();
    expect(screen.queryByText('Sam Doe')).toBeNull();
    expect(screen.getByText('Alex Doe')).toBeTruthy();
    expect(screen.getByText('Something failed')).toBeTruthy();
  });
});

/**
 * Renders the list as the Flow does with a confirm open on Sam's row.
 *
 * @param confirm - The open confirm, if any.
 * @returns The list.
 */
const listWith = (confirm?: MemberListProps['confirm']) => (
  <MemberList
    view={LOADED}
    selfUserId="alex"
    canManage
    locked={false}
    confirm={confirm}
    onRoleChange={vi.fn()}
    onRemove={vi.fn()}
    onRetry={vi.fn()}
  />
);

describe('MemberList — focus after a confirm', () => {
  const open = { userId: 'sam', element: <button type="button">cancel</button> };
  const removeSam = () => screen.getByRole('button', { name: 'Remove Sam Doe' });

  it('gives the row’s Remove button the focus once its confirm closes', () => {
    const { rerenderInLocale } = renderInLocale(listWith(open));
    screen.getByRole<HTMLButtonElement>('button', { name: 'cancel' }).focus();

    rerenderInLocale(listWith());

    expect(document.activeElement).toBe(removeSam());
  });

  it('leaves the focus alone when something still holds it', () => {
    const { rerenderInLocale } = renderInLocale(listWith(open));
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();

    rerenderInLocale(listWith());

    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('focuses nothing when the member went with the confirm', () => {
    const { rerenderInLocale } = renderInLocale(listWith(open));

    rerenderInLocale(
      <MemberList
        view={{ ...LOADED, members: [JANE, ALEX] }}
        selfUserId="alex"
        canManage
        locked={false}
        onRoleChange={vi.fn()}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(document.activeElement).toBe(document.body);
  });
});

describe('MemberList — loading and failing', () => {
  it('shows skeleton rows while the list loads', () => {
    renderList({ view: { status: 'loading' } });
    expect(screen.getByLabelText('Loading members')).toBeTruthy();
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
        canManage
        locked={false}
        onRoleChange={vi.fn()}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
      />,
      'pt-BR',
    );
    expect(screen.getByRole('heading', { name: 'Membros' })).toBeTruthy();
    expect(screen.getByText('jane@example.com · desde 03/2024')).toBeTruthy();
  });
});
