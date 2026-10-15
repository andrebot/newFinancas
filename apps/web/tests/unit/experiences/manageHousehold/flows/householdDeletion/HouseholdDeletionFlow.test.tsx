import { act, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  HouseholdDeletionFlow,
} from '../../../../../../src/experiences/manageHousehold/flows/householdDeletion/HouseholdDeletionFlow';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';
import { renderInLocale } from '../../../../../support/renderInLocale';

// Flow (BDT: unit, the Interaction beneath mocked): Consequences Review is a
// stub that shows the focus rule, emits from a plain button and renders the
// confirm it is given. The kit's type-to-confirm renders for real. The
// Experience is represented by a stub request answering outcomes.

vi.mock('../../../../../../src/experiences/manageHousehold/flows/householdDeletion/interactions/ConsequencesReview', () => ({
  /**
   * Consequences Review's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  ConsequencesReview: ({ onContinue, confirm, returnFocus }: {
    onContinue: () => void;
    confirm?: ReactNode;
    returnFocus?: boolean;
  }) => (
    <div data-testid="review" data-return-focus={String(returnFocus)}>
      <button type="button" onClick={onContinue}>continue</button>
      {confirm}
    </div>
  ),
}));

const NAME = 'Casa Silva';
const OK: RequestOutcome = { ok: true };

/**
 * Renders the Flow with a stub delete.
 *
 * @param onDelete - The Experience's request; answers `OK` by default.
 * @returns The stub.
 */
const renderFlow = (onDelete = vi.fn(async (): Promise<RequestOutcome> => OK)) => {
  renderInLocale(<HouseholdDeletionFlow householdName={NAME} onDelete={onDelete} />);
  return onDelete;
};

const LABEL = `Type "${NAME}" to confirm`;
const MESSAGE = `This permanently deletes ${NAME} for every member. This cannot be undone.`;
const FORBIDDEN: RequestOutcome = { ok: false, error: { code: 'auth.forbidden' } };

const field = () => screen.queryByLabelText<HTMLInputElement>(LABEL);
const confirmButton = () => screen.getByRole<HTMLButtonElement>(
  'button',
  { name: 'Delete household' },
);

/** Goes on from the consequences. */
const goOn = () => fireEvent.click(screen.getByRole('button', { name: 'continue' }));

/**
 * Types into the confirm's field.
 *
 * @param text - What to type.
 */
const type = (text: string) => fireEvent.change(
  field() as HTMLInputElement,
  { target: { value: text } },
);

/** Clicks the confirm and lets the outcome land. */
const confirm = async () => {
  await act(async () => {
    fireEvent.click(confirmButton());
  });
};

describe('HouseholdDeletionFlow — review → type-to-confirm', () => {
  it('opens on the consequences, no confirm yet', () => {
    renderFlow();

    expect(field()).toBeNull();
    expect(screen.getByTestId('review').dataset.returnFocus).toBe('false');
  });

  it('opens the confirm for the household’s name, locked until it matches', () => {
    renderFlow();

    goOn();

    expect(screen.getByText(MESSAGE)).toBeTruthy();
    expect(confirmButton().disabled).toBe(true);
    type('casa silva');
    expect(confirmButton().disabled).toBe(true);
    type(NAME);
    expect(confirmButton().disabled).toBe(false);
  });

  it('cancel closes the confirm, forgets the text and has the review refocus', () => {
    renderFlow();
    goOn();
    type('Casa');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(field()).toBeNull();
    expect(screen.getByTestId('review').dataset.returnFocus).toBe('true');
    goOn();
    expect(field()?.value).toBe('');
  });
});

describe('HouseholdDeletionFlow — the delete', () => {
  it('asks the Experience, spinning meanwhile, and stays busy once gone', async () => {
    let answer: (outcome: RequestOutcome) => void = () => {};
    const onDelete = renderFlow(vi.fn(() => new Promise<RequestOutcome>((resolve) => {
      answer = resolve;
    })));
    goOn();
    type(NAME);

    await confirm();
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(confirmButton().getAttribute('aria-busy')).toBe('true');

    await act(async () => answer(OK));
    expect(confirmButton().getAttribute('aria-busy')).toBe('true');
    expect(field()?.disabled).toBe(true);
  });

  it.each([
    ['auth.forbidden', "You don't have permission to do that."],
    ['household.not_found', 'Household not found.'],
  ])('shows %s translated, the name kept for another try', async (code, text) => {
    renderFlow(vi.fn(async (): Promise<RequestOutcome> => ({ ok: false, error: { code } })));
    goOn();
    type(NAME);

    await confirm();

    expect(screen.getByRole('alert').textContent).toContain(text);
    expect(field()?.value).toBe(NAME);
    expect(confirmButton().disabled).toBe(false);
  });

  it('drops the failure on a cancel', async () => {
    renderFlow(vi.fn(async () => FORBIDDEN));
    goOn();
    type(NAME);
    await confirm();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    goOn();

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
