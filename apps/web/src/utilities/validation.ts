import type { FieldCode } from '@financas/i18n';
import { validation } from '../config/constants';
import type { MessageParams } from './i18n';

// ValidationUtility (FU1, EBD): field rules shared by every form. Pure — no
// React, no translation, no backend. A rule answers with the same
// `{code, params}` the API puts in a 422's `details[]`, so a client-side error
// and a server-side one render through the same catalog entry (NFR-I18N-3).
// The web app doesn't bundle the contract's Zod schemas, so the rules are
// written here — never stricter than the API's, or a valid value is blocked.
// Text parsing (money, dates) belongs to the inputs (K7, K9); rules check the
// typed values those inputs emit. Format rules let an empty value through, so
// an optional field works; combine them with `required` when it isn't.

/** One field's problem: a catalog `fields` code plus its ICU params. */
export interface FieldError {
  readonly code: FieldCode;
  /** The ICU params, ready for `translator.field`. */
  readonly params?: MessageParams;
}

/** Checks one value; `undefined` means it passed. */
export type Rule<Value> = (value: Value) => FieldError | undefined;

/** Optional inclusive bounds for a range rule. */
export interface Bounds<Bound> {
  readonly min?: Bound;
  readonly max?: Bound;
}

// The regular expression Zod's `z.email()` applies on the API, so the client
// accepts exactly what the server accepts.
const EMAIL = new RegExp(
  "^(?:[A-Za-z0-9_'+-]+\\.)*[A-Za-z0-9_'+-]*[A-Za-z0-9_+-]"
  + '@(?:[A-Za-z0-9][A-Za-z0-9-]*\\.)+[A-Za-z]{2,}$',
);

// A calendar date as the contract's `format: date` sends it.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Tells whether a value counts as "not filled in".
 *
 * @param value - Any field value.
 * @returns `true` for `undefined`, `null` and the empty string.
 */
const isEmpty = (value: unknown): value is undefined | null | '' => (
  value === undefined || value === null || value === ''
);

/**
 * Fails an empty field.
 *
 * @param value - Any field value.
 * @returns `field.required` when `value` is `undefined`, `null` or `''`.
 */
export const required: Rule<unknown> = (value) => (
  isEmpty(value) ? { code: 'field.required' } : undefined
);

/**
 * Fails a text field that is empty or only whitespace (the API trims names).
 *
 * @param value - The typed text.
 * @returns `field.required` when nothing is left after trimming.
 */
export const nonBlank: Rule<string | undefined> = (value) => (
  (value ?? '').trim() === '' ? { code: 'field.required' } : undefined
);

/**
 * Checks an email address the way the API does: trimmed, then Zod's pattern.
 *
 * @param value - The typed address.
 * @returns `string.format` with `{format: 'email'}` when malformed.
 */
export const email: Rule<string | undefined> = (value) => {
  if (isEmpty(value) || EMAIL.test(value.trim())) return undefined;

  return { code: 'string.format', params: { format: 'email' } };
};

/**
 * Checks a new password's length (FR-1.1). Strength is PasswordStrengthUtility's.
 *
 * @param value - The typed password.
 * @returns `string.min` with `{min}` when shorter than the minimum.
 */
export const password: Rule<string | undefined> = (value) => {
  const { minLength } = validation.password;

  if (isEmpty(value) || value.length >= minLength) return undefined;

  return { code: 'string.min', params: { min: minLength } };
};

/**
 * Builds the rule for a password's confirmation: it must repeat the password
 * exactly. Lets an empty value through, like every format rule.
 *
 * @param expected - The password the confirmation must repeat.
 * @returns A rule failing with `password.mismatch` when the two differ.
 */
export const matchesPassword = (expected: string): Rule<string | undefined> => (value) => (
  isEmpty(value) || value === expected ? undefined : { code: 'password.mismatch' }
);

/**
 * Checks a value against optional inclusive bounds.
 *
 * @param value - The value to place.
 * @param bounds - The bounds; a missing side is open.
 * @param family - `number` or `date`, the catalog code's prefix.
 * @returns `<family>.min` / `<family>.max` with the bound as a param, or `undefined`.
 */
const checkBounds = <Bound extends number | string>(
  value: Bound,
  bounds: Bounds<Bound>,
  family: 'number' | 'date',
): FieldError | undefined => {
  if (bounds.min !== undefined && value < bounds.min) {
    return { code: `${family}.min`, params: { min: bounds.min } };
  }
  if (bounds.max !== undefined && value > bounds.max) {
    return { code: `${family}.max`, params: { max: bounds.max } };
  }

  return undefined;
};

/**
 * Builds a rule for a whole number within bounds.
 *
 * @param bounds - Inclusive bounds; a missing side is open.
 * @returns A rule failing a non-integer (`field.invalid_type`) or an out-of-range value.
 */
const integerIn = (bounds: Bounds<number>): Rule<number | undefined> => (value) => {
  if (isEmpty(value)) return undefined;
  if (!Number.isSafeInteger(value)) {
    return { code: 'field.invalid_type', params: { expected: 'int' } };
  }

  return checkBounds(value, bounds, 'number');
};

/**
 * Builds a rule for an amount of money in minor units (cents), the contract's
 * `Money`. The Money input (K7) parses the typed text; this checks the result.
 *
 * @param bounds - Inclusive bounds in minor units, e.g. `{min: 1}` for "more than zero".
 * @returns The rule.
 */
export const money = (bounds: Bounds<number> = {}): Rule<number | undefined> => integerIn(bounds);

/**
 * Checks a whole percent (60 = 60%) within the contract's bounds (OQ-87).
 *
 * @param value - The percent.
 * @returns `field.invalid_type`, `number.min` or `number.max` on failure.
 */
export const wholePercent: Rule<number | undefined> = integerIn(validation.wholePercent);

/**
 * Tells whether `YYYY-MM-DD` text names a real calendar day (no 2026-02-30).
 *
 * @param value - The text.
 * @returns `true` for a well-formed, existing date.
 */
const isCalendarDate = (value: string): boolean => {
  const match = ISO_DATE.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

/**
 * Builds a rule for a `YYYY-MM-DD` date (the contract's `format: date`), as the
 * Date input (K9) emits it.
 *
 * @param bounds - Inclusive `YYYY-MM-DD` bounds; a missing side is open.
 * @returns A rule failing a malformed date (`string.format`, `{format: 'date'}`)
 *   or one outside the bounds (`date.min` / `date.max`).
 */
export const isoDate = (bounds: Bounds<string> = {}): Rule<string | undefined> => (value) => {
  if (isEmpty(value)) return undefined;
  if (!isCalendarDate(value)) return { code: 'string.format', params: { format: 'date' } };

  // Same-format ISO dates order correctly as text.
  return checkBounds(value, bounds, 'date');
};

/**
 * Combines rules for one field; the first failure is the one shown.
 *
 * @param rules - The rules, in the order they should be checked.
 * @returns A rule reporting the first failure, or `undefined` when all pass.
 */
export const firstError = <Value>(...rules: readonly Rule<Value>[]): Rule<Value> => (value) => (
  rules.reduce<FieldError | undefined>((found, rule) => found ?? rule(value), undefined)
);

/** One rule per form field, keyed by field name. */
export type FieldRules<Values> = { readonly [Field in keyof Values]?: Rule<Values[Field]> };

/** The failing fields of a form, keyed by field name. */
export type FieldErrors<Values> = Partial<Record<keyof Values, FieldError>>;

/**
 * Validates a whole form.
 *
 * @param values - The form's current values.
 * @param rules - The rule for each field that has one.
 * @returns Only the fields that failed; an empty object means the form is valid.
 */
export const validateFields = <Values extends object>(
  values: Values,
  rules: FieldRules<Values>,
): FieldErrors<Values> => {
  const fields = Object.keys(rules) as (keyof Values)[];

  return fields.reduce<FieldErrors<Values>>((errors, field) => {
    const error = rules[field]?.(values[field]);

    return error === undefined ? errors : { ...errors, [field]: error };
  }, {});
};
