import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  consequenceText, LeaveHousehold, type LeaveHouseholdProps,
} from '../../../../../src/experiences/manageHousehold/interactions/LeaveHousehold';
import { renderInLocale } from '../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator; only the Experience's handler is a stand-in.

/**
 * Renders the card with a stand-in handler, in a locale.
 *
 * @param props - The props to set or override.
 * @param locale - The locale; en-US by default.
 * @returns The handler.
 */
const renderCard = (
  props: Partial<LeaveHouseholdProps> = {},
  locale: 'en-US' | 'pt-BR' = 'en-US',
) => {
  const onLeave = vi.fn();
  renderInLocale(
    <LeaveHousehold
      householdName="The Doe Household"
      consequence={{ kind: 'member' }}
      busy={false}
      onLeave={onLeave}
      {...props}
    />,
    locale,
  );
  return onLeave;
};

const openButton = () => screen.getByRole('button', { name: 'Leave household' });

describe('consequenceText', () => {
  it('picks the text for each consequence', () => {
    expect(consequenceText({ kind: 'member' })).toEqual({ key: 'leave.member', params: {} });
    expect(consequenceText({ kind: 'last' })).toEqual({ key: 'leave.last', params: {} });
    expect(consequenceText({ kind: 'successor', name: 'Alex Rivera' }))
      .toEqual({ key: 'leave.successor', params: { name: 'Alex Rivera' } });
  });
});

describe('LeaveHousehold', () => {
  it('says what leaving costs a member, with the button', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Leave household' })).toBeTruthy();
    expect(screen.getByText(/You lose access to its shared accounts/)).toBeTruthy();
    expect((openButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('names the Owner’s successor, or warns that the household goes too', () => {
    renderCard({ consequence: { kind: 'successor', name: 'Alex Rivera' } });
    expect(screen.getByText(/Alex Rivera becomes the Owner when you leave/)).toBeTruthy();
  });

  it('warns an Owner who is alone that leaving deletes the household', () => {
    renderCard({ consequence: { kind: 'last' } });
    expect(screen.getByText(/leaving deletes the household/)).toBeTruthy();
  });

  it('asks first, then emits the leave', () => {
    const onLeave = renderCard();

    fireEvent.click(openButton());
    expect(screen.getByText('Leave The Doe Household?')).toBeTruthy();
    expect(onLeave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));

    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('brings the button back, focused, on Cancel', () => {
    const onLeave = renderCard();

    fireEvent.click(openButton());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Leave The Doe Household?')).toBeNull();
    expect(document.activeElement).toBe(openButton());
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('waits while the leave is out', () => {
    renderCard({ busy: true });

    fireEvent.click(openButton());

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Leave' }).getAttribute('aria-busy')).toBe('true');
  });

  it('shows the last failure under the card', () => {
    renderCard({ alert: 'The household changed. Please try again.' });

    expect(screen.getByRole('alert').textContent).toContain('The household changed.');
  });

  it('speaks pt-BR', () => {
    renderCard({}, 'pt-BR');

    fireEvent.click(screen.getByRole('button', { name: 'Sair da casa' }));

    expect(screen.getByText('Sair de The Doe Household?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy();
  });
});
