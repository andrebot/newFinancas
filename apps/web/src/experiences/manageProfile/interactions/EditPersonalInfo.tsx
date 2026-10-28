import { useState, type FormEvent } from 'react';
import { InlineBanner } from '../../../kit/alert/InlineBanner';
import { Button } from '../../../kit/button/Button';
import { Card } from '../../../kit/card/Card';
import { Icon } from '../../../kit/icons/Icon';
import { SectionHeader } from '../../../kit/sectionHeader/SectionHeader';
import { TextField } from '../../../kit/textField/TextField';
import { useI18n } from '../../../utilities/I18nProvider';
import {
  nonBlank, validateFields, type FieldErrors, type FieldRules,
} from '../../../utilities/validation';

// Edit Personal Info (X3, OQ-159; mockup 70): the user's first and last name,
// and their email shown locked — email and password each have their own flow,
// and `PATCH /users/me` never touches either. It holds what is typed, checks
// neither name is blank and emits them trimmed. Save waits until a name
// differs from the saved one. The Experience keys it on the saved names, so a
// done save starts it again from them.

/** The names, as typed and as sent. */
export interface PersonalInfo {
  readonly firstName: string;
  readonly lastName: string;
}

/** Edit Personal Info's props. */
export interface EditPersonalInfoProps {
  /** The names as saved. */
  readonly saved: PersonalInfo;
  /** The user's email, shown locked. */
  readonly email: string;
  /** The save is out: the button spins and ignores submits. */
  readonly busy: boolean;
  /** The last failure, already translated, for the banner. */
  readonly alert?: string | undefined;
  /** Gets the names, trimmed, once both pass the checks. */
  readonly onSave: (info: PersonalInfo) => void;
}

const RULES: FieldRules<PersonalInfo> = { firstName: nonBlank, lastName: nonBlank };

/**
 * Trims what is typed, as it is sent.
 *
 * @param info - What is typed.
 * @returns The names, trimmed.
 */
export const trimmed = (info: PersonalInfo): PersonalInfo => ({
  firstName: info.firstName.trim(),
  lastName: info.lastName.trim(),
});

/**
 * Tells whether what is typed differs from what is saved, once trimmed.
 *
 * @param typed - What is typed.
 * @param saved - What is saved.
 * @returns Whether there is something to save.
 */
export const isChanged = (typed: PersonalInfo, saved: PersonalInfo) => {
  const sent = trimmed(typed);
  return sent.firstName !== saved.firstName || sent.lastName !== saved.lastName;
};

/**
 * Renders the personal info panel: the two names, the locked email with its
 * note, and Save.
 *
 * @param props - The saved names, the email, the busy state, the failure and
 *   the save handler.
 * @returns The panel.
 */
export function EditPersonalInfo({
  saved, email, busy, alert, onSave,
}: EditPersonalInfoProps) {
  const translator = useI18n();
  const [values, setValues] = useState<PersonalInfo>(saved);
  const [errors, setErrors] = useState<FieldErrors<PersonalInfo>>({});

  /**
   * Keeps a name's new value and drops its error.
   *
   * @param field - The name typed in.
   * @returns The field's change handler.
   */
  const change = (field: keyof PersonalInfo) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  /**
   * Checks the names and emits them when they pass, unless a save is out.
   *
   * @param event - The form's submit.
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const found = validateFields(values, RULES);
    setErrors(found);
    if (Object.keys(found).length === 0) onSave(trimmed(values));
  };

  /**
   * Translates a name's error, if it has one.
   *
   * @param field - The name.
   * @returns The message, or `undefined`.
   */
  const errorOf = (field: keyof PersonalInfo) => {
    const error = errors[field];
    return error && translator.field(error.code, error.params);
  };

  return (
    <Card className="flex flex-col gap-4">
      <SectionHeader title={translator.text('profile', 'personal.title')} />
      {alert && <InlineBanner tone="error" message={alert} />}
      <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            autoComplete="given-name"
            label={translator.text('profile', 'personal.firstName')}
            value={values.firstName}
            onChange={change('firstName')}
            error={errorOf('firstName')}
          />
          <TextField
            autoComplete="family-name"
            label={translator.text('profile', 'personal.lastName')}
            value={values.lastName}
            onChange={change('lastName')}
            error={errorOf('lastName')}
          />
        </div>
        <div>
          <div className="rounded-2xl bg-raised px-4 py-3">
            <p className="flex items-center gap-1 type-label text-muted">
              <Icon name="lock-outline" className="size-3" />
              {translator.text('profile', 'personal.email')}
            </p>
            <p className="mt-0.5 type-body break-all">{email}</p>
          </div>
          <p className="mt-2 type-caption text-muted">
            {translator.text('profile', 'personal.emailNote')}
          </p>
        </div>
        <div className="mt-auto flex justify-end">
          <Button
            type="submit"
            variant="primary"
            busy={busy}
            disabled={!isChanged(values, saved)}
          >
            {translator.text('profile', 'personal.save')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
