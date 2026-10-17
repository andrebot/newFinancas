import { validationFailed, type FieldDetail } from '../http/apiError';
import { checkFields, type FieldRules } from '../utilities/validation';

// The ValidationUtility step every Manager takes (VBD, "② ValidationUtility"):
// the Utility only reports problems; turning them into the API's answer is the
// Manager's call (OQ-114), and always the same one for a failed field check.

/**
 * Refuses a request when ValidationUtility reported any problem.
 *
 * @param details - The problems, from `checkFields` / `checkItems`.
 * @throws {ApiError} 422 `validation.failed` with the problems as `details[]`.
 */
export const requireNoProblems = (details: readonly FieldDetail[]): void => {
  if (details.length > 0) throw validationFailed(details);
};

/**
 * Checks a request's fields and refuses it when any fails.
 *
 * @param values - The request, as the route validated it.
 * @param rules - ValidationUtility's rule for each field that has one.
 * @throws {ApiError} 422 `validation.failed`, one `details[]` entry per failing field.
 */
const requireValidFields = <Values extends object>(
  values: Values,
  rules: FieldRules<Values>,
): void => requireNoProblems(checkFields(values, rules));

export default requireValidFields;
