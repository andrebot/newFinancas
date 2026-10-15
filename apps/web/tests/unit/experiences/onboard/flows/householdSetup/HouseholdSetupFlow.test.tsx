import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  HouseholdSetupFlow, type HouseholdSetupFlowProps,
} from '../../../../../../src/experiences/onboard/flows/householdSetup/HouseholdSetupFlow';
import type { RequestOutcome } from '../../../../../../src/utilities/requestOutcome';
import { renderInLocale } from '../../../../../support/renderInLocale';

// Flow (BDT: unit, the Interaction beneath mocked): the entry is a stub that
// shows the props it got and emits its events from plain buttons. The
// Experience is represented by a stub request answering outcomes.

vi.mock('../../../../../../src/experiences/onboard/flows/householdSetup/interactions/HouseholdNameEntry', () => ({
  /**
   * Household Name Entry's stand-in: the props as data attributes.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  HouseholdNameEntry: ({
    busy, alert, onSubmit, onCancel,
  }: {
    busy: boolean;
    alert?: string;
    onSubmit: (name: string) => void;
    onCancel?: () => void;
  }) => (
    <div data-testid="entry" data-busy={String(busy)} data-alert={alert ?? ''}>
      <button type="button" onClick={() => onSubmit('Casa da Praia')}>submit</button>
      {onCancel && <button type="button" onClick={onCancel}>cancel</button>}
    </div>
  ),
}));

const OK: RequestOutcome = { ok: true };

/**
 * A failed outcome.
 *
 * @param code - The error code.
 * @returns The outcome.
 */
const failed = (code: string): RequestOutcome => ({ ok: false, error: { code } });

/**
 * Renders the Flow with a stub request answering `OK` unless overridden.
 *
 * @param props - The request or way out to set or override.
 * @returns The stubs.
 */
const renderFlow = (props: Partial<HouseholdSetupFlowProps> = {}) => {
  const stubs = { onCreate: vi.fn(async () => OK), ...props };
  renderInLocale(<HouseholdSetupFlow {...stubs} />);
  return stubs;
};

const entry = () => screen.getByTestId('entry');

/**
 * Clicks one of the stub's buttons and lets the outcome land.
 *
 * @param action - The button.
 */
const press = async (action: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: action }));
  });
};

describe('HouseholdSetupFlow', () => {
  it('opens idle, with no failure', () => {
    renderFlow();

    expect(entry().dataset).toMatchObject({ busy: 'false', alert: '' });
  });

  it('sends the name up and stays busy once the household exists', async () => {
    const { onCreate } = renderFlow();

    await press('submit');

    expect(onCreate).toHaveBeenCalledWith('Casa da Praia');
    expect(entry().dataset.busy).toBe('true');
  });

  it('is busy while the request is out', async () => {
    let answer: (outcome: RequestOutcome) => void = () => {};
    renderFlow({
      onCreate: () => new Promise((resolve) => {
        answer = resolve;
      }),
    });

    await press('submit');
    expect(entry().dataset.busy).toBe('true');

    await act(async () => answer(failed('network.unavailable')));
    expect(entry().dataset.busy).toBe('false');
  });

  it('shows a failure in the banner', async () => {
    renderFlow({ onCreate: vi.fn(async () => failed('network.unavailable')) });

    await press('submit');

    expect(entry().dataset.alert).toBe("Couldn't connect. Check your connection and try again.");
  });

  it('clears the last failure when the name is sent again', async () => {
    const onCreate = vi.fn()
      .mockResolvedValueOnce(failed('network.unavailable'))
      .mockReturnValueOnce(new Promise(() => {}));
    renderFlow({ onCreate });

    await press('submit');
    await press('submit');

    expect(entry().dataset).toMatchObject({ busy: 'true', alert: '' });
  });

  it('offers no way out during onboarding', () => {
    renderFlow();

    expect(screen.queryByRole('button', { name: 'cancel' })).toBeNull();
  });

  it('leaves when the shell gave it a way out', async () => {
    const onCancel = vi.fn();
    renderFlow({ onCancel });

    await press('cancel');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
