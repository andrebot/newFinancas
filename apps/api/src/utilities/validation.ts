import type { FieldDetail } from '../http/apiError';

// ValidationUtility (U3, VBD): generic, domain-agnostic field checks a Manager
// runs before it decides anything. The route has already checked the request's
// shape against the contract (OQ-93) — presence, types, enums, formats — so
// these rules cover only what a JSON schema can't say: text that is blank once
// trimmed, a length the Manager answers itself, bounds that depend on another
// field or on the request. Every rule lets `undefined` through: whether a field
// is required is the contract's call. A failure is the same `{field, code,
// params}` the route's 422 carries, so the web app renders both alike (OQ-119).
// Pure: no storage, no clock, no HTTP — the Manager turns failures into the
// 422 (`validationFailed`) and passes in anything time-dependent.

/** One field's problem, before it is tied to a field name. */
export type FieldProblem = Omit<FieldDetail, 'field'>;

/** Checks one value; `undefined` means it passed. */
export type Rule<Value> = (value: Value) => FieldProblem | undefined;

/** Optional inclusive bounds for a range rule. */
export interface Bounds<Bound> {
  readonly min?: Bound | undefined;
  readonly max?: Bound | undefined;
}

/**
 * Checks a value against optional inclusive bounds.
 *
 * @param value - The value to place.
 * @param bounds - The bounds; a missing side is open.
 * @param family - `number` or `date`, the field code's prefix.
 * @returns `<family>.min` / `<family>.max` with the bound as a param, or `undefined`.
 */
const checkBounds = <Bound extends number | string>(
  value: Bound,
  bounds: Bounds<Bound>,
  family: 'number' | 'date',
): FieldProblem | undefined => {
  if (bounds.min !== undefined && value < bounds.min) {
    return { code: `${family}.min`, params: { min: bounds.min } };
  }
  if (bounds.max !== undefined && value > bounds.max) {
    return { code: `${family}.max`, params: { max: bounds.max } };
  }
  return undefined;
};

/**
 * Builds a rule for text that must be at least `min` characters long, as sent.
 *
 * @param min - The shortest length accepted.
 * @returns A rule failing with `string.min` and `{min}`.
 */
export const minLength = (min: number): Rule<string | undefined> => (value) => (
  value === undefined || value.length >= min ? undefined : { code: 'string.min', params: { min } }
);

/**
 * Fails text that is empty or only whitespace — a name the Manager will trim.
 * Answered as `string.min` with `{min: 1}`, the code the contract's own
 * `minLength: 1` produces, so a blank name reads the same however it arrives.
 *
 * @param value - The text.
 * @returns `string.min` when nothing is left after trimming.
 */
export const nonBlank: Rule<string | undefined> = (value) => (
  minLength(1)(value?.trim())
);

/**
 * Builds a rule for an amount of money in minor units (the contract's `Money`,
 * already an integer), e.g. `{min: 1}` for "more than zero".
 *
 * @param bounds - Inclusive bounds in minor units; a missing side is open.
 * @returns A rule failing with `number.min` / `number.max`.
 */
export const moneyWithin = (bounds: Bounds<number>): Rule<number | undefined> => (value) => (
  value === undefined ? undefined : checkBounds(value, bounds, 'number')
);

/**
 * Builds a rule for a `YYYY-MM-DD` date (the contract's `format: date`, already
 * a real calendar day) within bounds — another field's date for a range, or
 * today as the Manager's clock sees it. Same-format ISO dates order as text.
 *
 * @param bounds - Inclusive `YYYY-MM-DD` bounds; a missing side is open.
 * @returns A rule failing with `date.min` / `date.max`.
 */
export const dateWithin = (bounds: Bounds<string>): Rule<string | undefined> => (value) => (
  value === undefined ? undefined : checkBounds(value, bounds, 'date')
);

/**
 * Combines rules for one field; the first failure is the one reported.
 *
 * @param rules - The rules, in the order they should be checked.
 * @returns A rule reporting the first failure, or `undefined` when all pass.
 */
export const firstProblem = <Value>(...rules: readonly Rule<Value>[]): Rule<Value> => (value) => (
  rules.reduce<FieldProblem | undefined>((found, rule) => found ?? rule(value), undefined)
);

/** One rule per checked field, keyed by field name. */
export type FieldRules<Values> = { readonly [Field in keyof Values]?: Rule<Values[Field]> };

/**
 * Checks a request's fields.
 *
 * @param values - The request, as the route validated it.
 * @param rules - The rule for each field that has one.
 * @returns One detail per failing field, in the order of `rules`; empty when
 *   everything passed.
 */
export const checkFields = <Values extends object>(
  values: Values,
  rules: FieldRules<Values>,
): readonly FieldDetail[] => (Object.keys(rules) as (keyof Values & string)[])
  .flatMap((field) => {
    const problem = rules[field]?.(values[field]);
    return problem === undefined ? [] : [{ field, ...problem }];
  });

/**
 * Checks every item of a list field, e.g. each Subcategory of a Category edit.
 * Problems are named by the item's path, as the route's contract check names
 * them (`subcategories[1].name`).
 *
 * @param field - The list field's name.
 * @param items - The items, as the route validated them.
 * @param rules - The rule for each item field that has one.
 * @returns One detail per failing item field, in item order; empty when all passed.
 */
export const checkItems = <Item extends object>(
  field: string,
  items: readonly Item[],
  rules: FieldRules<Item>,
): readonly FieldDetail[] => items.flatMap((item, index) => checkFields(item, rules)
  .map((detail) => ({ ...detail, field: `${field}[${index}].${detail.field}` })));
