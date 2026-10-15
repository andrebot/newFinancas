import { useState, type FormEvent } from 'react';
import { Button } from '../../../../../kit/button/Button';
import { Checkbox } from '../../../../../kit/checkbox/Checkbox';
import downloadTextFile from '../../../../../utilities/downloadTextFile';
import useClipboardCopy from '../../../../../utilities/useClipboardCopy';
import { StepHeading } from '../../../../interactions/stepParts';
import { useMfaEnrollmentText } from './mfaEnrollmentText';

// Backup Codes Acknowledgement (MFA Enrollment, mockup 07): every recovery
// code the API issued — shown this once, never again (FR-1.15) — with
// Download and "Copy all", and Continue, enabled only once the user ticks
// that they saved them. No skip and no way back: the enrollment is confirmed.

const CODE_CELL = [
  'rounded-xl bg-raised px-2 py-2.5 text-center',
  'font-mono type-body-sm tracking-wide',
].join(' ');

/** Backup Codes Acknowledgement's props. */
export interface BackupCodesAcknowledgementProps {
  /** The single-use recovery codes, as the API formats them. */
  readonly recoveryCodes: readonly string[];
  /** The account they belong to, named in the downloaded file. */
  readonly accountEmail: string;
  /** Emitted once the user says the codes are saved. */
  readonly onAcknowledge: () => void;
}

/**
 * Renders the codes step: heading, the codes, Download, Copy all, the "saved"
 * tick and Continue.
 *
 * @param props - The codes, their account and the acknowledgement handler.
 * @returns The acknowledgement.
 */
export function BackupCodesAcknowledgement({
  recoveryCodes, accountEmail, onAcknowledge,
}: BackupCodesAcknowledgementProps) {
  const text = useMfaEnrollmentText();
  const { copied, copy } = useClipboardCopy();
  const [saved, setSaved] = useState(false);
  const allCodes = recoveryCodes.join('\n');

  /**
   * Emits the acknowledgement once the codes are ticked as saved.
   *
   * @param event - The form's submit.
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saved) onAcknowledge();
  };

  /** Saves the codes, under a line naming their account, as a text file. */
  const download = () => {
    const header = text('codes.fileHeader', { email: accountEmail });
    downloadTextFile(text('codes.fileName'), `${header}\n\n${allCodes}\n`);
  };

  return (
    <>
      <StepHeading
        icon="key-outline"
        title={text('codes.title')}
        subtitle={text('codes.subtitle')}
      />
      <ul
        aria-label={text('codes.list')}
        className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-bg p-3"
      >
        {recoveryCodes.map((code) => (
          <li key={code} className={CODE_CELL}>{code}</li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="md" leadingIcon="download" onClick={download}>
          {text('codes.download')}
        </Button>
        <Button
          variant="secondary"
          size="md"
          leadingIcon={copied ? 'check' : 'content-copy-outline'}
          onClick={() => copy(allCodes)}
        >
          {text(copied ? 'codes.copied' : 'codes.copy')}
        </Button>
      </div>
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <Checkbox checked={saved} onChange={setSaved} label={text('codes.saved')} />
        <Button type="submit" variant="primary" size="xl" elevated disabled={!saved}>
          {text('codes.continue')}
        </Button>
      </form>
    </>
  );
}
