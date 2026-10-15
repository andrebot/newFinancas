import { useEffect, useRef } from 'react';
import { Button } from '../../../../../kit/button/Button';
import { StepHeading } from '../../../interactions/stepParts';
import { useAccountRecoveryText } from './accountRecoveryText';

// Reset Complete (Account Recovery, OQ-147): the password is changed and
// every session is gone, so the way on is signing in again. No mockup draws
// it; it takes the other steps' layout — icon tile, heading, one button.

/** Reset Complete's props. */
export interface ResetCompleteProps {
  readonly onSignIn: () => void;
}

/**
 * Renders the done step: the check tile, heading and the sign-in button,
 * which takes the focus on mount.
 *
 * @param props - The sign-in handler.
 * @returns The step.
 */
export function ResetComplete({ onSignIn }: ResetCompleteProps) {
  const text = useAccountRecoveryText();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <>
      <StepHeading
        icon="check-circle-outline"
        title={text('done.title')}
        subtitle={text('done.subtitle')}
      />
      <Button
        ref={buttonRef}
        variant="primary"
        size="xl"
        elevated
        trailingIcon="arrow-forward"
        onClick={onSignIn}
      >
        {text('done.submit')}
      </Button>
    </>
  );
}
