import { useState } from 'react';
import { InlineBanner } from '../../../../kit/alert/InlineBanner';
import { TypeToConfirm } from '../../../../kit/confirm/TypeToConfirm';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { RequestOutcome } from '../../../../utilities/requestOutcome';
import {
  afterDelete, cancelled, continued, INITIAL_DELETE_ACCOUNT, submitting, typed,
  type DeleteAccountState,
} from './deleteAccountState';
import { ConsequencesReview } from './interactions/ConsequencesReview';

// Delete Account Flow (FL8, EBD; OQ-151): the user erases their own account
// (FR-1.17). First what it costs — with the households they own, which pass
// to another member first (FR-1.18) — then their email typed to unlock the
// confirm (K27, OQ-143). Nothing blocks it: the API's delete is
// unconditional. The Flow owns the step, the typed text and the last
// failure; it never calls the backend. The delete goes up to the Manage
// Profile Experience, which has the App Shell sign out once it's done.

/** What the Flow needs from the Experience. */
export interface DeleteAccountFlowProps {
  /** The user's email: what they must type. */
  readonly email: string;
  /** The names of the households the user owns; empty when none. */
  readonly ownedHouseholds: readonly string[];
  /** Deletes the account: `ok` once it's gone. */
  readonly onDelete: () => Promise<RequestOutcome>;
}

/**
 * Renders the danger zone and, once the user goes on, the type-to-confirm in
 * it, with the last failure under it.
 *
 * @param props - The email, the owned households and the Experience's request.
 * @returns The section.
 */
export function DeleteAccountFlow({ email, ownedHouseholds, onDelete }: DeleteAccountFlowProps) {
  const translator = useI18n();
  const [state, setState] = useState<DeleteAccountState>(INITIAL_DELETE_ACCOUNT);
  const { error, busy } = state;

  /** Sends the delete and applies its outcome. */
  const confirm = async () => {
    setState(submitting);
    const outcome = await onDelete();
    setState((current) => afterDelete(current, outcome));
  };

  const typeToConfirm = state.step === 'confirm' ? (
    <>
      <TypeToConfirm
        message={translator.text('deleteAccount', 'confirm.message')}
        phrase={email}
        value={state.confirmation}
        onChange={(confirmation) => setState((current) => typed(current, confirmation))}
        label={translator.text('deleteAccount', 'confirm.label', { email })}
        confirmLabel={translator.text('deleteAccount', 'confirm.submit')}
        cancelLabel={translator.text('deleteAccount', 'confirm.cancel')}
        onConfirm={confirm}
        onCancel={() => setState(cancelled)}
        busy={busy}
      />
      {error && <InlineBanner tone="error" message={translator.error(error.code, error.params)} />}
    </>
  ) : undefined;

  return (
    <ConsequencesReview
      ownedHouseholds={ownedHouseholds}
      onContinue={() => setState(continued)}
      confirm={typeToConfirm}
      returnFocus={state.returning}
    />
  );
}
