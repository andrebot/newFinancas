import { useState } from 'react';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { RequestOutcome } from '../../../../utilities/requestOutcome';
import { afterCreate, initialHouseholdSetup, submitting } from './householdSetupState';
import { HouseholdNameEntry } from './interactions/HouseholdNameEntry';

// Household Setup Flow (FL5, EBD; OQ-150): create a household (FR-1.4). One
// field, one request: it never calls the backend — the name goes up to the
// Experience, which answers an outcome and, on `ok`, moves on. Onboard leaves
// `onCancel` out (a new user must create one); the shell passes it when the
// Flow is reached to add another household. Every failure shows in the
// banner: the only field-level objection, a blank name, is caught before
// sending.

/** What the Flow asks of the Experience, and the ways out it emits. */
export interface HouseholdSetupFlowProps {
  /** Creates the household: `ok` once it exists and the Experience has moved on. */
  readonly onCreate: (name: string) => Promise<RequestOutcome>;
  /** Leaves without creating one; when absent, there is no way out. */
  readonly onCancel?: (() => void) | undefined;
}

/**
 * Renders the household-name step and sends what it emits.
 *
 * @param props - The Experience's request and the optional way out.
 * @returns The entry.
 */
export function HouseholdSetupFlow({ onCreate, onCancel }: HouseholdSetupFlowProps) {
  const translator = useI18n();
  const [state, setState] = useState(initialHouseholdSetup);
  const alert = state.error && translator.error(state.error.code, state.error.params);

  /**
   * Sends the name and applies the outcome.
   *
   * @param name - The trimmed name the entry emitted.
   */
  const create = async (name: string) => {
    setState(submitting);
    const outcome = await onCreate(name);
    setState((current) => afterCreate(current, outcome));
  };

  return (
    <HouseholdNameEntry busy={state.busy} alert={alert} onSubmit={create} onCancel={onCancel} />
  );
}
