import { act, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  DeleteAccountFlow,
} from '../../../../../../src/experiences/manageProfile/flows/deleteAccount/DeleteAccountFlow';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';
import { renderInLocale } from '../../../../../support/renderInLocale';

// Flow (BDT: unit, the Interaction beneath mocked): Consequences Review is a
// stub that shows the owned households and the focus rule, emits from a plain
// button and renders the confirm it is given. The kit's type-to-confirm
// renders for real. The Experience is represented by a stub request.

vi.mock('../../../../../../src/experiences/manageProfile/flows/deleteAccount/interactions/ConsequencesReview', () => ({
  /**
   * Consequences Review's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  ConsequencesReview: ({
    ownedHouseholds, onContinue, confirm, returnFocus,
  }: {
    ownedHouseholds: readonly string[];
    onContinue: () => void;
    confirm?: ReactNode;
    returnFocus?: boolean;
  }) => (
    <div
      data-testid="review"
      data-owned={ownedHouseholds.join('|')}
      data-return-focus={String(returnFocus)}
    >
      <button type="button" onClick={onContinue}>continue</button>
      {confirm}
    </div>
  ),
}));

const EMAIL = 'ana@example.com';
const OK: RequestOutcome = { ok: true };
const UNAVAILABLE: RequestOutcome = { ok: false, error: { code: 'network.unavailable' } };

/**
 * Renders the Flow with a stub delete.
 *
 * @param onDelete - The Experience's request; answers `OK` by default.
 * @returns The stub.
 */
const renderFlow = (onDelete = vi.fn(async (): Promise<RequestOutcome> => OK)) => {
  renderInLocale(
    <DeleteAccountFlow email={EMAIL} ownedHouseholds={['Casa Silva']} onDelete={onDelete} />,
  );
  return onDelete;
};

const LABEL = `Type "${EMAIL}" to confirm`;

const field = () => screen.queryByLabelText<HTMLInputElement>(LABEL);
const confirmButton = () => screen.getByRole<HTMLButtonElement>(
  'button',
  { name: 'Delete account' },
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

describe('DeleteAccountFlow — review → type-to-confirm', () => {
  it('opens on the consequences with the owned households, no confirm yet', () => {
    renderFlow();

    expect(field()).toBeNull();
    expect(screen.getByTestId('review').dataset).toMatchObject({
      owned: 'Casa Silva', returnFocus: 'false',
    });
  });

  it('opens the confirm for the email, locked until it matches', () => {
    renderFlow();

    goOn();

    expect(screen.getByText('This permanently deletes your account. This cannot be undone.'))
      .toBeTruthy();
    expect(confirmButton().disabled).toBe(true);
    type('ANA@example.com');
    expect(confirmButton().disabled).toBe(true);
    type(EMAIL);
    expect(confirmButton().disabled).toBe(false);
  });

  it('cancel closes the confirm, forgets the text and has the review refocus', () => {
    renderFlow();
    goOn();
    type('ana@');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(field()).toBeNull();
    expect(screen.getByTestId('review').dataset.returnFocus).toBe('true');
    goOn();
    expect(field()?.value).toBe('');
  });
});

describe('DeleteAccountFlow — the delete', () => {
  it('asks the Experience, spinning meanwhile, and stays busy once gone', async () => {
    let answer: (outcome: RequestOutcome) => void = () => {};
    const onDelete = renderFlow(vi.fn(() => new Promise<RequestOutcome>((resolve) => {
      answer = resolve;
    })));
    goOn();
    type(EMAIL);

    await confirm();
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(confirmButton().getAttribute('aria-busy')).toBe('true');

    await act(async () => answer(OK));
    expect(confirmButton().getAttribute('aria-busy')).toBe('true');
    expect(field()?.disabled).toBe(true);
  });

  it('shows a failure translated, the email kept for another try', async () => {
    renderFlow(vi.fn(async () => UNAVAILABLE));
    goOn();
    type(EMAIL);

    await confirm();

    expect(screen.getByRole('alert').textContent)
      .toContain("Couldn't connect. Check your connection and try again.");
    expect(field()?.value).toBe(EMAIL);
    expect(confirmButton().disabled).toBe(false);
  });

  it('drops the failure on a cancel', async () => {
    renderFlow(vi.fn(async () => UNAVAILABLE));
    goOn();
    type(EMAIL);
    await confirm();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    goOn();

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
