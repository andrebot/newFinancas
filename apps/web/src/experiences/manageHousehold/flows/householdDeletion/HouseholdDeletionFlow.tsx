import { useState } from 'react';
import { InlineBanner } from '../../../../kit/alert/InlineBanner';
import { TypeToConfirm } from '../../../../kit/confirm/TypeToConfirm';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { RequestOutcome } from '../../../../utilities/requestOutcome';
import {
  afterDelete, cancelled, continued, INITIAL_HOUSEHOLD_DELETION, submitting, typed,
  type HouseholdDeletionState,
} from './householdDeletionState';
import { ConsequencesReview } from './interactions/ConsequencesReview';

// Household Deletion Flow (FL10, EBD; OQ-146): the Owner dissolves the
// household (FR-1.7). First what it costs, then the household's name typed to
// unlock the confirm (K27, OQ-143). The Flow owns the step, the typed text and
// the last failure; it never calls the backend. The delete goes up to the
// Manage Household Experience, which mounts this Flow for the Owner only and,
// once the household is gone, has the App Shell switch households or start
// Onboard.

/** What the Flow needs from the Experience. */
export interface HouseholdDeletionFlowProps {
  /** The household's name: what the user must type. */
  readonly householdName: string;
  /** Deletes the household: `ok` once it's gone. */
  readonly onDelete: () => Promise<RequestOutcome>;
}

/**
 * Renders the danger zone and, once the user goes on, the type-to-confirm in
 * it, with the last failure under it.
 *
 * @param props - The household's name and the Experience's request.
 * @returns The section.
 */
export function HouseholdDeletionFlow({ householdName, onDelete }: HouseholdDeletionFlowProps) {
  const translator = useI18n();
  const [state, setState] = useState<HouseholdDeletionState>(INITIAL_HOUSEHOLD_DELETION);
  const { error, busy } = state;
  const params = { householdName };

  /** Sends the delete and applies its outcome. */
  const confirm = async () => {
    setState(submitting);
    const outcome = await onDelete();
    setState((current) => afterDelete(current, outcome));
  };

  const typeToConfirm = state.step === 'confirm' ? (
    <>
      <TypeToConfirm
        message={translator.text('householdDeletion', 'confirm.message', params)}
        phrase={householdName}
        value={state.confirmation}
        onChange={(confirmation) => setState((current) => typed(current, confirmation))}
        label={translator.text('householdDeletion', 'confirm.label', params)}
        confirmLabel={translator.text('householdDeletion', 'confirm.submit')}
        cancelLabel={translator.text('householdDeletion', 'confirm.cancel')}
        onConfirm={confirm}
        onCancel={() => setState(cancelled)}
        busy={busy}
      />
      {error && <InlineBanner tone="error" message={translator.error(error.code, error.params)} />}
    </>
  ) : undefined;

  return (
    <ConsequencesReview
      onContinue={() => setState(continued)}
      confirm={typeToConfirm}
      returnFocus={state.returning}
    />
  );
}
