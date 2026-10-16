import { useEffect, useRef, useState } from 'react';
import { InlineBanner } from '../../../kit/alert/InlineBanner';
import { Button } from '../../../kit/button/Button';
import { Card } from '../../../kit/card/Card';
import { InlineConfirm } from '../../../kit/confirm/InlineConfirm';
import { SectionHeader } from '../../../kit/sectionHeader/SectionHeader';
import { useI18n } from '../../../utilities/I18nProvider';
import type { LeaveConsequence } from './leaveConsequence';

// Leave Household (standalone, X4; FR-1.11, FR-1.18; OQ-160): any member ends
// their own membership. Its own card above the danger zone — mockup 60 has no
// place for it — saying what leaving does for this user: a Member loses
// access; the Owner hands the household to the successor named, or, alone,
// deletes it. "Leave household" opens an inline confirm in the button's
// place; Cancel (or Escape) brings the button back. The Interaction holds
// only whether the confirm is open; the request and its failure belong to
// the Experience.

/** Leave Household's props. */
export interface LeaveHouseholdProps {
  readonly householdName: string;
  /** What leaving does for this user. */
  readonly consequence: LeaveConsequence;
  /** The leave is out: the confirm waits. */
  readonly busy: boolean;
  /** The last failure, already translated. */
  readonly alert?: string | undefined;
  /** The user confirmed. */
  readonly onLeave: () => void;
}

/**
 * Picks the consequence's text key and its arguments.
 *
 * @param consequence - What leaving does.
 * @returns The `household` catalog key and its params.
 */
export const consequenceText = (consequence: LeaveConsequence) => {
  if (consequence.kind === 'successor') {
    return { key: 'leave.successor', params: { name: consequence.name } } as const;
  }
  return { key: `leave.${consequence.kind}`, params: {} } as const;
};

/**
 * Renders the card: what leaving does, then the button or its confirm.
 *
 * @param props - The household, the consequence, the busy state, the failure and the handler.
 * @returns The card.
 */
export function LeaveHousehold({
  householdName, consequence, busy, alert, onLeave,
}: LeaveHouseholdProps) {
  const translator = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [returning, setReturning] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { key, params } = consequenceText(consequence);

  // The confirm gives focus back to what held it before, but the button has
  // unmounted by then, so it takes the focus itself as it shows again.
  useEffect(() => {
    if (returning) buttonRef.current?.focus();
  }, [returning]);

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeader
        title={translator.text('household', 'leave.title')}
        description={translator.text('household', key, params)}
      />
      {confirming ? (
        <InlineConfirm
          tone="destructive"
          icon="logout"
          message={translator.text('household', 'leave.message', { householdName })}
          confirmLabel={translator.text('household', 'leave.confirm')}
          cancelLabel={translator.text('household', 'leave.cancel')}
          busy={busy}
          onConfirm={onLeave}
          onCancel={() => {
            setConfirming(false);
            setReturning(true);
          }}
        />
      ) : (
        <div className="flex justify-end">
          <Button
            ref={buttonRef}
            variant="danger-ghost"
            leadingIcon="logout"
            onClick={() => {
              setConfirming(true);
              setReturning(false);
            }}
          >
            {translator.text('household', 'leave.open')}
          </Button>
        </div>
      )}
      {alert && <InlineBanner tone="error" message={alert} />}
    </Card>
  );
}
