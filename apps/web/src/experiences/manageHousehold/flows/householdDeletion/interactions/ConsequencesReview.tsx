import type { ReactNode } from 'react';
import { DangerZone } from '../../../../../kit/card/DangerZone';
import { useI18n } from '../../../../../utilities/I18nProvider';

// Consequences Review (FL10, OQ-146): mockup 60's danger zone at the foot of
// the household page (the kit's DangerZone, OQ-151) — what deleting costs
// (every member loses access, shared data is removed for good) and the
// "Delete Household" button. The button emits that the user read it and goes
// on; once they have, the Flow's type-to-confirm opens in the button's place.

/** Consequences Review's props. */
export interface ConsequencesReviewProps {
  /** The user went on: the type-to-confirm opens. */
  readonly onContinue: () => void;
  /** The type-to-confirm, once the user went on: it takes the button's place. */
  readonly confirm?: ReactNode;
  /** Back after a cancel: the button takes the focus as it shows again. */
  readonly returnFocus?: boolean | undefined;
}

/**
 * Renders the household's danger zone.
 *
 * @param props - The handler, the confirm in the button's place, the focus rule.
 * @returns The section.
 */
export function ConsequencesReview({ onContinue, confirm, returnFocus }: ConsequencesReviewProps) {
  const translator = useI18n();

  return (
    <DangerZone
      title={translator.text('householdDeletion', 'title')}
      description={translator.text('householdDeletion', 'consequences')}
      actionLabel={translator.text('householdDeletion', 'continue')}
      onAction={onContinue}
      confirm={confirm}
      returnFocus={returnFocus}
    />
  );
}
