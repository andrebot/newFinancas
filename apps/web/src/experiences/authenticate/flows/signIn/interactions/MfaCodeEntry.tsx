import {
  useEffect, useRef, useState, type FormEvent,
} from 'react';
import { mfa } from '../../../../../config/constants';
import { Button } from '../../../../../kit/button/Button';
import { CodeInput } from '../../../../../kit/codeInput/CodeInput';
import {
  BackButton, StepAlert, StepHeading, TextAction, useSignInText,
} from './stepParts';

// MFA Code Entry (Sign In, mockup 08): the six authenticator digits. The
// code submits by itself on its last digit, or with Verify. "Use a backup
// code" is emitted up — the Flow decides what shows next. The Flow remounts
// it after a wrong code, so the boxes start empty.

/** MFA Code Entry's props. */
export interface MfaCodeEntryProps {
  /** A request is out: the button spins and the code isn't submitted again. */
  readonly busy: boolean;
  /** The last failure, already translated. */
  readonly alert?: string | undefined;
  /** Gets the six digits. */
  readonly onSubmit: (code: string) => void;
  readonly onUseBackupCode: () => void;
  readonly onBack: () => void;
}

/**
 * Renders the code step: back arrow, heading, banner, the code boxes,
 * Verify and the switch to a backup code. Focuses the code on mount.
 *
 * @param props - The busy state, failure and event handlers.
 * @returns The entry.
 */
export function MfaCodeEntry({
  busy, alert, onSubmit, onUseBackupCode, onBack,
}: MfaCodeEntryProps) {
  const text = useSignInText();
  const [code, setCode] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);
  const complete = code.length === mfa.codeLength;

  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  /**
   * Emits a full code unless a request is already out.
   *
   * @param fullCode - The six digits.
   */
  const send = (fullCode: string) => {
    if (!busy) onSubmit(fullCode);
  };

  /**
   * Submits the code from Verify (or Enter).
   *
   * @param event - The form's submit.
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (complete) send(code);
  };

  return (
    <>
      <BackButton label={text('back')} onBack={onBack} />
      <StepHeading
        icon="verified-user-outline"
        title={text('code.title')}
        subtitle={text('code.subtitle')}
      />
      <StepAlert message={alert} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <CodeInput
          ref={codeRef}
          label={text('code.label')}
          labelHidden
          value={code}
          onChange={setCode}
          onComplete={send}
        />
        <Button type="submit" variant="primary" size="xl" elevated disabled={!complete} busy={busy}>
          {text('code.submit')}
        </Button>
      </form>
      <p className="text-center type-body-sm text-muted">
        {text('code.lostPhone')}
        {' '}
        <TextAction onClick={onUseBackupCode} className="font-semibold">
          {text('code.useBackupCode')}
        </TextAction>
      </p>
    </>
  );
}
