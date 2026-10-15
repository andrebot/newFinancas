import {
  useEffect, useRef, useState, type FormEvent,
} from 'react';
import { Button } from '../../../../../kit/button/Button';
import { TextField } from '../../../../../kit/textField/TextField';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { nonBlank } from '../../../../../utilities/validation';
import { StepAlert, StepHeading, TextAction } from '../../../../interactions/stepParts';
import { useHouseholdSetupText } from './householdSetupText';

// Household Name Entry (Household Setup, mockup 10, without its "Ideas"
// chips — OQ-150): the house tile, the heading, one name field and Continue;
// "Cancel" under it only when the Flow is given a way out. It holds what is
// typed, starting empty, and emits it trimmed once it isn't blank (the API
// trims it too).

/** Household Name Entry's props. */
export interface HouseholdNameEntryProps {
  /** A request is out: the button spins and ignores submits. */
  readonly busy: boolean;
  /** The last failure, already translated. */
  readonly alert?: string | undefined;
  /** Gets the name, trimmed, once it isn't blank. */
  readonly onSubmit: (name: string) => void;
  /** Leaves without creating one; when absent, "Cancel" isn't shown. */
  readonly onCancel?: (() => void) | undefined;
}

/**
 * Renders the household-name step: heading, banner, the name field, the
 * submit button and, when given, the way out. Focuses the field on mount.
 *
 * @param props - The busy state, the failure and the event handlers.
 * @returns The entry.
 */
export function HouseholdNameEntry({
  busy, alert, onSubmit, onCancel,
}: HouseholdNameEntryProps) {
  const translator = useI18n();
  const text = useHouseholdSetupText();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  /**
   * Keeps the new name and drops its error.
   *
   * @param value - What is typed.
   */
  const change = (value: string) => {
    setName(value);
    setError(undefined);
  };

  /**
   * Checks the name and emits it trimmed when it isn't blank, unless a
   * request is out.
   *
   * @param event - The form's submit.
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const found = nonBlank(name);
    setError(found && translator.field(found.code, found.params));
    if (!found) onSubmit(name.trim());
  };

  return (
    <>
      <StepHeading icon="home-outline" title={text('title')} subtitle={text('subtitle')} />
      <StepAlert message={alert} />
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <TextField
          ref={nameRef}
          autoComplete="off"
          label={text('name')}
          value={name}
          onChange={change}
          error={error}
        />
        <Button type="submit" variant="primary" size="xl" elevated busy={busy}>
          {text('submit')}
        </Button>
      </form>
      {onCancel && (
        <p className="text-center type-body-sm">
          <TextAction onClick={onCancel} className="font-semibold">
            {text('cancel')}
          </TextAction>
        </p>
      )}
    </>
  );
}
