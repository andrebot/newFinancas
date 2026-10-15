import type { ReactNode } from 'react';
import { DangerZone } from '../../../../../kit/card/DangerZone';
import { Tag } from '../../../../../kit/tag/Tag';
import { useI18n } from '../../../../../utilities/I18nProvider';

// Consequences Review (FL8, OQ-151): mockup 70's danger zone at the foot of
// the profile page (the kit's DangerZone) — what deleting the account costs
// and the "Delete Account" button. The ownership check is folded in: when the
// user owns households, a note says ownership passes on first (FR-1.18) and
// names them. Nothing blocks the deletion (`DELETE /users/me` is
// unconditional). The button emits that the user read it and goes on; the
// Flow's type-to-confirm then opens in its place.

/** Consequences Review's props. */
export interface ConsequencesReviewProps {
  /** The names of the households the user owns; empty when none. */
  readonly ownedHouseholds: readonly string[];
  /** The user went on: the type-to-confirm opens. */
  readonly onContinue: () => void;
  /** The type-to-confirm, once the user went on: it takes the button's place. */
  readonly confirm?: ReactNode;
  /** Back after a cancel: the button takes the focus as it shows again. */
  readonly returnFocus?: boolean | undefined;
}

/**
 * Renders the account's danger zone, with the ownership note when it applies.
 *
 * @param props - The owned households, the handler, the confirm, the focus rule.
 * @returns The section.
 */
export function ConsequencesReview({
  ownedHouseholds, onContinue, confirm, returnFocus,
}: ConsequencesReviewProps) {
  const translator = useI18n();
  const count = ownedHouseholds.length;

  return (
    <DangerZone
      title={translator.text('deleteAccount', 'title')}
      description={(
        <div className="flex flex-col gap-2">
          <p>{translator.text('deleteAccount', 'consequences')}</p>
          {count > 0 && (
            <>
              <p>{translator.text('deleteAccount', 'ownership', { count })}</p>
              <ul className="flex flex-wrap gap-1.5">
                {ownedHouseholds.map((name) => (
                  <li key={name}><Tag icon="home-outline">{name}</Tag></li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      actionLabel={translator.text('deleteAccount', 'continue')}
      onAction={onContinue}
      confirm={confirm}
      returnFocus={returnFocus}
    />
  );
}
