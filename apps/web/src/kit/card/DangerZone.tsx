import {
  useEffect, useId, useRef, type ReactNode,
} from 'react';
import { Button } from '../button/Button';
import { Icon } from '../icons/Icon';

// The kit's danger zone (K34 family, OQ-151): the coral-ringed section at the
// foot of mockups 60 (Delete household) and 70 (Delete account) — the warning
// tile, a title, what the action costs and an outline `danger` button. The
// button only says the user read it and goes on; the caller then passes its
// confirm (e.g. the type-to-confirm, K27), which takes the button's place.

/** The danger zone's props. */
export interface DangerZoneProps {
  /** The section's title, which also names it; already translated. */
  readonly title: string;
  /** What the action costs, under the title. */
  readonly description: ReactNode;
  /** The button's label, already translated. */
  readonly actionLabel: string;
  /** The user went on: the caller opens its confirm. */
  readonly onAction: () => void;
  /** Another of the caller's requests runs: the button waits. */
  readonly disabled?: boolean | undefined;
  /** The caller's confirm, once the user went on: it takes the button's place. */
  readonly confirm?: ReactNode;
  /** Back after a cancel: the button takes the focus as it shows again. */
  readonly returnFocus?: boolean | undefined;
}

/**
 * Renders the danger zone: the warning tile, title and description and, until
 * the user goes on, the button; afterwards, the confirm below them.
 *
 * @param props - The texts, the handler, the disabled state, the confirm and the focus rule.
 * @returns The section.
 */
export function DangerZone({
  title, description, actionLabel, onAction, disabled = false, confirm, returnFocus = false,
}: DangerZoneProps) {
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
          <h2 id={titleId} className="font-semibold">{title}</h2>
          <div className="type-body-sm text-muted">{description}</div>
        </div>
        {confirm === undefined && (
          <Button
            ref={buttonRef}
            variant="danger"
            size="lg"
            disabled={disabled}
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        )}
      </div>
      {confirm}
    </section>
  );
}
