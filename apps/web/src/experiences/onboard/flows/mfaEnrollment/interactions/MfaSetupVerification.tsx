import { QRCodeSVG } from 'qrcode.react';
import {
  useEffect, useRef, useState, type FormEvent,
} from 'react';
import { mfa } from '../../../../../config/constants';
import { Button } from '../../../../../kit/button/Button';
import { IconButton } from '../../../../../kit/button/IconButton';
import { CodeInput } from '../../../../../kit/codeInput/CodeInput';
import useClipboardCopy from '../../../../../utilities/useClipboardCopy';
import { BackButton, StepAlert, StepHeading } from '../../../../interactions/stepParts';
import { useMfaEnrollmentText } from './mfaEnrollmentText';

// MFA Setup Verification (MFA Enrollment, mockup 06): the QR code of the
// enrollment's `otpauth://` URI, the setup key to type by hand (copyable),
// the account it is for, and the six digits that confirm the app holds it.
// The code submits by itself on its last digit, or with "Verify & continue".
// The Flow remounts it after a wrong code, so the boxes start empty. The QR
// stays black on white in both themes: scanners need the contrast.

const QR_DARK = '#000000';
const QR_LIGHT = '#ffffff';

/** MFA Setup Verification's props. */
export interface MfaSetupVerificationProps {
  /** The `otpauth://` URI the QR code encodes (from the API). */
  readonly otpauthUri: string;
  /** The base32 secret, for entering the key by hand. */
  readonly totpSecret: string;
  /** The account the authenticator app will show. */
  readonly accountEmail: string;
  /** A request is out: the button spins and the code isn't submitted again. */
  readonly busy: boolean;
  /** The last failure, already translated. */
  readonly alert?: string | undefined;
  /** Gets the six digits. */
  readonly onSubmit: (code: string) => void;
  readonly onBack: () => void;
}

/**
 * Splits the setup key into groups, as authenticator apps show it, so it is
 * easier to read and type.
 *
 * @param secret - The base32 secret.
 * @returns The key with a space between groups.
 */
export const groupSetupKey = (secret: string): string => (
  secret.match(new RegExp(`.{1,${mfa.setupKeyGroupSize}}`, 'g'))?.join(' ') ?? ''
);

/**
 * Renders the setup step: back arrow, heading, banner, the QR code beside the
 * setup key, the code boxes and "Verify & continue". Focuses the code on mount.
 *
 * @param props - The enrollment, the busy state, failure and event handlers.
 * @returns The entry.
 */
export function MfaSetupVerification({
  otpauthUri, totpSecret, accountEmail, busy, alert, onSubmit, onBack,
}: MfaSetupVerificationProps) {
  const text = useMfaEnrollmentText();
  const { copied, copy } = useClipboardCopy();
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
   * Submits the code from the button (or Enter).
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
      <StepHeading title={text('setup.title')} subtitle={text('setup.subtitle')} />
      <StepAlert message={alert} />
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <div className="shrink-0 rounded-2xl bg-white p-3">
          <QRCodeSVG
            value={otpauthUri}
            size={mfa.qrSizePx}
            fgColor={QR_DARK}
            bgColor={QR_LIGHT}
            title={text('setup.qr')}
            role="img"
            aria-label={text('setup.qr')}
          />
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2">
          <span className="type-caption font-medium text-muted">{text('setup.key')}</span>
          <div className="flex items-center gap-2 rounded-xl bg-raised py-1 pr-1 pl-3">
            <code className="min-w-0 flex-1 font-mono type-body-sm tracking-wider break-all">
              {groupSetupKey(totpSecret)}
            </code>
            <IconButton
              icon={copied ? 'check' : 'content-copy-outline'}
              label={text(copied ? 'setup.keyCopied' : 'setup.copyKey')}
              size="xs"
              onClick={() => copy(totpSecret)}
            />
          </div>
          <span className="type-caption text-faint break-all">
            {text('setup.account', { email: accountEmail })}
          </span>
        </div>
      </div>
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <CodeInput
          ref={codeRef}
          label={text('setup.code')}
          value={code}
          onChange={setCode}
          onComplete={send}
        />
        <Button type="submit" variant="primary" size="xl" elevated disabled={!complete} busy={busy}>
          {text('setup.submit')}
        </Button>
      </form>
    </>
  );
}
