import { useState, type FormEvent } from 'react';
import { mfa } from '../../../../../config/constants';
import { Button } from '../../../../../kit/button/Button';
import type { IconName } from '../../../../../kit/icons/Icon';
import { OptionCardGroup } from '../../../../../kit/optionCard/OptionCardGroup';
import { StepHeading } from '../../../../interactions/stepParts';
import type { MfaMethod } from '../mfaEnrollmentState';
import { useMfaEnrollmentText, type MfaEnrollmentTextKey } from './mfaEnrollmentText';

// MFA Method Selection (MFA Enrollment, mockup 05): one option card per
// configured method (`mfa.methods` — the authenticator app in v1) and
// Continue, which emits the choice. No skip and no way back: MFA is
// mandatory (FR-1.15).

/** How each method's card reads and looks. */
const METHOD_CARD: Readonly<Record<MfaMethod, {
  readonly label: MfaEnrollmentTextKey;
  readonly description: MfaEnrollmentTextKey;
  readonly icon: IconName;
}>> = {
  authenticator: {
    label: 'method.authenticator',
    description: 'method.authenticator.description',
    icon: 'phone-iphone-outline',
  },
};

/** MFA Method Selection's props. */
export interface MfaMethodSelectionProps {
  /** The method selected when the step shows (the one chosen before going back). */
  readonly defaultMethod: MfaMethod;
  /** Gets the method chosen. */
  readonly onChoose: (method: MfaMethod) => void;
}

/**
 * Renders the method step: heading, the method cards and Continue.
 *
 * @param props - The method selected first and the choice handler.
 * @returns The selection.
 */
export function MfaMethodSelection({ defaultMethod, onChoose }: MfaMethodSelectionProps) {
  const text = useMfaEnrollmentText();
  const [method, setMethod] = useState<MfaMethod>(defaultMethod);
  const options = mfa.methods.map((value) => ({
    value,
    label: text(METHOD_CARD[value].label),
    description: text(METHOD_CARD[value].description),
    icon: METHOD_CARD[value].icon,
  }));

  /**
   * Emits the selected method.
   *
   * @param event - The form's submit.
   */
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onChoose(method);
  };

  return (
    <>
      <StepHeading
        icon="shield-lock-outline"
        title={text('method.title')}
        subtitle={text('method.subtitle')}
      />
      <form noValidate onSubmit={submit} className="flex flex-col gap-6">
        <OptionCardGroup
          label={text('method.label')}
          options={options}
          value={method}
          onChange={setMethod}
        />
        <Button type="submit" variant="primary" size="xl" elevated trailingIcon="arrow-forward">
          {text('method.continue')}
        </Button>
      </form>
    </>
  );
}
