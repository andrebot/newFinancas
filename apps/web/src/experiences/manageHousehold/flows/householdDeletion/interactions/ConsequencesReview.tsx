import {
  useEffect, useId, useRef, type ReactNode,
} from 'react';
import { Button } from '../../../../../kit/button/Button';
import { Icon } from '../../../../../kit/icons/Icon';
import { useI18n } from '../../../../../utilities/I18nProvider';

// Consequences Review (FL10, OQ-146): the danger zone at the foot of the
// household page, drawn as mockup 60 draws it — a coral-ringed section with
// the warning tile, what deleting costs (every member loses access, shared
// data is removed for good) and the outline "Delete Household" button. The
// button emits that the user read it and goes on; once they have, the Flow's
// type-to-confirm opens inside the section, in the button's place.

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
 * Renders the danger zone: the consequences and, until the user goes on, the
 * button that opens the type-to-confirm.
 *
 * @param props - The handler, the confirm in the button's place, the focus rule.
 * @returns The section.
 */
export function ConsequencesReview({
  onContinue, confirm, returnFocus = false,
}: ConsequencesReviewProps) {
  const translator = useI18n();
  const titleId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (returnFocus) buttonRef.current?.focus();
  }, [returnFocus]);

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-card border border-coral/30 bg-coral/[.04] px-5 py-4"
    >
      <div className="flex items-center gap-4">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full bg-coral/15 text-coral"
        >
          <Icon name="warning-outline" className="size-5" />
        </span>
        <div className="flex-1">
          <h2 id={titleId} className="font-semibold">
            {translator.text('householdDeletion', 'title')}
          </h2>
          <p className="type-body-sm text-muted">
            {translator.text('householdDeletion', 'consequences')}
          </p>
        </div>
        {confirm === undefined && (
          <Button ref={buttonRef} variant="danger" size="lg" onClick={onContinue}>
            {translator.text('householdDeletion', 'continue')}
          </Button>
        )}
      </div>
      {confirm}
    </section>
  );
}
