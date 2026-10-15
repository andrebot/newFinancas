import { fireEvent, screen, within } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  ConsequencesReview, type ConsequencesReviewProps,
} from '../../../../../../../src/experiences/manageProfile/flows/deleteAccount/interactions/ConsequencesReview';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator render; only the Flow's handler is a stand-in.

/**
 * Renders the review with a stand-in handler.
 *
 * @param props - The props to set or override.
 * @param locale - The locale; en-US by default.
 * @returns The handler.
 */
const renderReview = (
  props: Partial<ConsequencesReviewProps> = {},
  locale: 'en-US' | 'pt-BR' = 'en-US',
) => {
  const onContinue = vi.fn();
  renderInLocale(
    <ConsequencesReview ownedHouseholds={[]} onContinue={onContinue} {...props} />,
    locale,
  );
  return { onContinue };
};

const region = () => screen.getByRole('region', { name: 'Delete account' });

describe('ConsequencesReview (Delete Account)', () => {
  it("renders mockup 70's danger zone, with no ownership note when nothing is owned", () => {
    renderReview();

    expect(within(region()).getByText(/Your contributions to shared data are anonymized/))
      .toBeTruthy();
    expect(screen.queryByText(/You own/)).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('emits onContinue from its button', () => {
    const { onContinue } = renderReview();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('notes that ownership passes on for one owned household, and names it', () => {
    renderReview({ ownedHouseholds: ['Casa Silva'] });

    expect(screen.getByText(/You own this household\. Ownership passes to another member/))
      .toBeTruthy();
    expect(within(screen.getByRole('list')).getByText('Casa Silva')).toBeTruthy();
  });

  it('counts several owned households and names each', () => {
    renderReview({ ownedHouseholds: ['Casa Silva', 'Apt 4B'] });

    expect(screen.getByText(/You own these 2 households/)).toBeTruthy();
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2);
  });

  it("shows the confirm in the button's place once given", () => {
    renderReview({ confirm: <p>the confirm</p> });

    expect(screen.getByText('the confirm')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete Account' })).toBeNull();
  });

  it('speaks pt-BR', () => {
    renderReview({ ownedHouseholds: ['Casa Silva'] }, 'pt-BR');

    expect(screen.getByRole('region', { name: 'Excluir conta' })).toBeTruthy();
    expect(screen.getByText(/Você é proprietário desta casa/)).toBeTruthy();
  });
});
