import {
  useEffect, useRef, useState, type FormEvent,
} from 'react';
import { mfa } from '../../../../../config/constants';
import { Button } from '../../../../../kit/button/Button';
import { BackupCodeInput } from '../../../../../kit/codeInput/BackupCodeInput';
import {
  BackButton, StepAlert, StepHeading, TextAction,
} from '../../../interactions/stepParts';
import { useSignInText } from './signInText';

// Backup Code Entry (Sign In, mockup 09): one single-use recovery code, in
// place of the authenticator's. "Use authenticator app instead" is emitted
// up. The Flow remounts it after a wrong code, so the field starts empty.

/** Backup Code Entry's props. */
export interface BackupCodeEntryProps {
  /** A request is out: the button spins and ignores submits. */
  readonly busy: boolean;
  /** The last failure, already translated. */
  readonly alert?: string | undefined;
  /** Gets the clean code: no dashes, upper case. */
  readonly onSubmit: (code: string) => void;
  readonly onUseApp: () => void;
  readonly onBack: () => void;
}

/**
 * Renders the backup code step: back arrow, heading, banner, the code
 * field, Verify and the switch back to the app. Focuses the field on mount.
 *
 * @param props - The busy state, failure and event handlers.
 * @returns The entry.
 */
export function BackupCodeEntry({
  busy, alert, onSubmit, onUseApp, onBack,
}: BackupCodeEntryProps) {
  const text = useSignInText();
  const [code, setCode] = useState('');
  // The backup code input keeps its own ref (the mask's), so focus goes
  // through the form.
  const formRef = useRef<HTMLFormElement>(null);
  const complete = code.length === mfa.backupCode.length;

  useEffect(() => {
    formRef.current?.querySelector('input')?.focus();
  }, []);

  /**
   * Emits the code once it is whole, unless a request is out.
   *
   * @param event - The form's submit.
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (complete && !busy) onSubmit(code);
  };

  return (
    <>
      <BackButton label={text('back')} onBack={onBack} />
      <StepHeading
        icon="key-outline"
        title={text('backupCode.title')}
        subtitle={text('backupCode.subtitle')}
      />
      <StepAlert message={alert} />
      <form ref={formRef} noValidate onSubmit={submit} className="flex flex-col gap-6">
        <BackupCodeInput
          label={text('backupCode.label')}
          value={code}
          onChange={setCode}
        />
        <Button type="submit" variant="primary" size="xl" elevated disabled={!complete} busy={busy}>
          {text('backupCode.submit')}
        </Button>
      </form>
      <p className="text-center type-body-sm">
        <TextAction onClick={onUseApp} className="font-semibold">
          {text('backupCode.useApp')}
        </TextAction>
      </p>
    </>
  );
}
