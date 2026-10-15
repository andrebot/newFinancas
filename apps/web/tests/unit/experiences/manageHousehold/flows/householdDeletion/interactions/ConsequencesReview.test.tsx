import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  ConsequencesReview, type ConsequencesReviewProps,
} from '../../../../../../../src/experiences/manageHousehold/flows/householdDeletion/interactions/ConsequencesReview';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator render; only the Flow's handler is a stand-in.

/**
 * Renders the review with a stand-in handler.
 *
 * @param props - The props to set or override.
 * @param locale - The locale; en-US by default.
 * @returns The handler and the render result.
 */
const renderReview = (
  props: Partial<ConsequencesReviewProps> = {},
  locale: 'en-US' | 'pt-BR' = 'en-US',
) => {
  const onContinue = vi.fn();
  const view = renderInLocale(<ConsequencesReview onContinue={onContinue} {...props} />, locale);
  return { onContinue, view };
};

const deleteButton = () => screen.queryByRole('button', { name: 'Delete Household' });

describe('ConsequencesReview', () => {
  it("renders mockup 60's danger zone, named by its title", () => {
    renderReview();

    expect(screen.getByRole('region', { name: 'Delete household' })).toBeTruthy();
    expect(screen.getByText(/Every member loses access/)).toBeTruthy();
    expect(deleteButton()).toBeTruthy();
  });

  it('emits onContinue from its button', () => {
    const { onContinue } = renderReview();

    fireEvent.click(deleteButton() as HTMLButtonElement);

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('shows the confirm in the button’s place once given', () => {
    renderReview({ confirm: <p>the confirm</p> });

    expect(screen.getByText('the confirm')).toBeTruthy();
    expect(deleteButton()).toBeNull();
  });

  it('leaves the focus alone on first show', () => {
    renderReview();

    expect(document.activeElement).toBe(document.body);
  });

  it('focuses its button when back after a cancel', () => {
    const { view } = renderReview({ confirm: <p>the confirm</p> });

    view.rerenderInLocale(<ConsequencesReview onContinue={vi.fn()} returnFocus />);

    expect(document.activeElement).toBe(deleteButton());
  });

  it('speaks pt-BR', () => {
    renderReview({}, 'pt-BR');

    expect(screen.getByRole('region', { name: 'Excluir casa' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Excluir casa' })).toBeTruthy();
  });
});
