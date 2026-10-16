import type { ReceivedInvitation } from '@financas/api-types';
import { fireEvent, screen, within } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  inviterName, RespondToInvitation, type RespondToInvitationProps,
} from '../../../../../src/experiences/manageProfile/interactions/RespondToInvitation';
import { createTranslator } from '../../../../../src/utilities/i18n';
import { renderInLocale } from '../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator; only the Experience's handler is a stand-in.

const RIVERA: ReceivedInvitation = {
  id: 'inv-rivera',
  householdId: 'rivera',
  householdName: 'The Rivera Household',
  role: 'Member',
  invitedByUserId: 'alex',
  inviterFirstName: 'Alex',
  inviterLastName: 'Rivera',
  createdAt: '2026-10-01T12:00:00Z',
};

const GONE: ReceivedInvitation = {
  ...RIVERA,
  id: 'inv-gone',
  householdName: 'The Old Household',
  role: 'Viewer',
  invitedByUserId: null,
  inviterFirstName: null,
  inviterLastName: null,
};

/**
 * Renders the panel with a stand-in handler, in a locale.
 *
 * @param props - The props to set or override.
 * @param locale - The locale; en-US by default.
 * @returns The handler.
 */
const renderPanel = (
  props: Partial<RespondToInvitationProps> = {},
  locale: 'en-US' | 'pt-BR' = 'en-US',
) => {
  const onAnswer = vi.fn();
  renderInLocale(
    <RespondToInvitation invitations={[RIVERA, GONE]} onAnswer={onAnswer} {...props} />,
    locale,
  );
  return onAnswer;
};

/**
 * Finds a row's button by its accessible name.
 *
 * @param name - The button's label.
 * @returns The button.
 */
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });

describe('inviterName', () => {
  const translator = createTranslator('en-US');

  it('joins the inviter’s names', () => {
    expect(inviterName(RIVERA, translator)).toBe('Alex Rivera');
  });

  it('says "Someone" once the inviter’s account is gone', () => {
    expect(inviterName(GONE, translator)).toBe('Someone');
    expect(inviterName({ ...RIVERA, inviterLastName: null }, translator)).toBe('Someone');
  });
});

describe('RespondToInvitation', () => {
  it("renders mockup 70's panel: a count, then each household, inviter and role", () => {
    renderPanel();

    expect(screen.getByRole('heading', {
      level: 2, name: 'Invitations to other households',
    })).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    const rows = within(screen.getByRole('list', { name: 'Invitations to other households' }))
      .getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('The Rivera Household');
    expect(rows[0]?.textContent).toContain('Alex Rivera invited you as Member');
    expect(rows[1]?.textContent).toContain('Someone invited you as Viewer');
  });

  it('emits each answer with its invitation', () => {
    const onAnswer = renderPanel();

    fireEvent.click(button('Accept the invitation to The Rivera Household'));
    fireEvent.click(button('Decline the invitation to The Old Household'));

    expect(onAnswer).toHaveBeenNthCalledWith(1, 'inv-rivera', 'accept');
    expect(onAnswer).toHaveBeenNthCalledWith(2, 'inv-gone', 'decline');
  });

  it('spins the answer that is out and holds every other one', () => {
    renderPanel({ answering: { invitationId: 'inv-rivera', answer: 'decline' } });

    const decline = button('Decline the invitation to The Rivera Household');
    expect(decline.getAttribute('aria-busy')).toBe('true');
    expect(decline.disabled).toBe(false);
    expect(button('Accept the invitation to The Rivera Household').disabled).toBe(true);
    expect(button('Accept the invitation to The Old Household').disabled).toBe(true);
    expect(button('Decline the invitation to The Old Household').disabled).toBe(true);
  });

  it('spins an accept the same way', () => {
    renderPanel({ answering: { invitationId: 'inv-gone', answer: 'accept' } });

    expect(button('Accept the invitation to The Old Household').getAttribute('aria-busy'))
      .toBe('true');
    expect(button('Decline the invitation to The Old Household').disabled).toBe(true);
  });

  it('reads every text from the catalog (pt-BR)', () => {
    renderPanel({}, 'pt-BR');

    expect(screen.getByRole('heading', { name: 'Convites para outras casas' })).toBeTruthy();
    expect(screen.getByText(/Alex Rivera convidou você como/)).toBeTruthy();
    expect(screen.getByText('Membro')).toBeTruthy();
    expect(screen.getByText(/Alguém convidou você como/)).toBeTruthy();
    expect(button('Aceitar o convite para The Rivera Household')).toBeTruthy();
    expect(button('Recusar o convite para The Rivera Household')).toBeTruthy();
  });
});
