import type { Catalog } from '@financas/i18n';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { MessageParams } from '../../../../../utilities/i18n';

// The MFA Enrollment steps' texts: the catalog's `mfaEnrollment` section.

/** A key of the catalog's `mfaEnrollment` section. */
export type MfaEnrollmentTextKey = keyof Catalog['mfaEnrollment'];

/**
 * The `mfaEnrollment` section of the current locale's catalog.
 *
 * @returns A function from an `mfaEnrollment` key (and its params) to its text.
 */
export const useMfaEnrollmentText = () => {
  const translator = useI18n();
  return (key: MfaEnrollmentTextKey, params?: MessageParams) => (
    translator.text('mfaEnrollment', key, params)
  );
};
