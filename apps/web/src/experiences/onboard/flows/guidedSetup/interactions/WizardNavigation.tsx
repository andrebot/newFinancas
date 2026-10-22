import type { ReactNode } from 'react';
import { Button } from '../../../../../kit/button/Button';
import type { IconName } from '../../../../../kit/icons/Icon';
import { useI18n } from '../../../../../utilities/I18nProvider';

// Wizard Navigation (FL6, mockups 11–13): the step card's foot. Back on the
// left — or, on the first step, the note on why it can't be skipped — and the
// step's actions on the right: an optional secondary one ("Create budget")
// and the primary one that moves on. Anything to confirm first sits above it.
// It only renders and emits; the step decides what each action does.

/** One of the foot's buttons. */
export interface WizardAction {
  /** Already translated. */
  readonly label: string;
  readonly onClick: () => void;
  /** Its request is out: it spins. */
  readonly busy?: boolean | undefined;
  readonly disabled?: boolean | undefined;
  readonly trailingIcon?: IconName | undefined;
}

/** Wizard Navigation's props. */
export interface WizardNavigationProps {
  /** The step's way on. */
  readonly primary: WizardAction;
  /** A second action beside it, if the step has one. */
  readonly secondary?: WizardAction | undefined;
  /** Goes back a step; the first step has none. */
  readonly onBack?: (() => void) | undefined;
  /** Back waits too while a request is out. */
  readonly backDisabled?: boolean | undefined;
  /** A note on the left, where Back would be, already translated. */
  readonly note?: string | undefined;
  /** Something to settle before moving on, shown above the buttons. */
  readonly confirm?: ReactNode;
}

/**
 * Renders one of the foot's buttons.
 *
 * @param props - The action and the button's look.
 * @returns The button.
 */
function ActionButton({ action, variant }: {
  readonly action: WizardAction;
  readonly variant: 'primary' | 'secondary';
}) {
  return (
    <Button
      variant={variant}
      size="lg"
      busy={action.busy}
      disabled={action.disabled}
      trailingIcon={action.trailingIcon}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}

/**
 * Renders the step's foot.
 *
 * @param props - The actions, the way back or the note, and any confirm.
 * @returns The foot.
 */
export function WizardNavigation({
  primary, secondary, onBack, backDisabled, note, confirm,
}: WizardNavigationProps) {
  const translator = useI18n();
  return (
    <div className="flex flex-col gap-4 border-t border-line pt-4">
      {confirm}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {onBack ? (
          <Button variant="ghost" leadingIcon="arrow-back" disabled={backDisabled} onClick={onBack}>
            {translator.text('guidedSetup', 'back')}
          </Button>
        ) : (
          <span className="type-caption text-faint">{note}</span>
        )}
        <div className="flex flex-wrap gap-2">
          {secondary && <ActionButton action={secondary} variant="secondary" />}
          <ActionButton action={primary} variant="primary" />
        </div>
      </div>
    </div>
  );
}
