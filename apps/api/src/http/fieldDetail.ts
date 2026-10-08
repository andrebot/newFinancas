import type { core } from 'zod';
import type { FieldDetail } from './apiError';

type Issue = core.$ZodIssue;
type DetailBody = Omit<FieldDetail, 'field'>;

type SizeKind = 'number' | 'string' | 'array' | 'date' | 'value';

const SIZE_KINDS: Record<string, SizeKind> = {
  number: 'number',
  int: 'number',
  bigint: 'number',
  string: 'string',
  array: 'array',
  set: 'array',
  date: 'date',
};

/**
 * Renders an issue path the way clients address fields, e.g. `allocations[1].percentage`.
 *
 * @param path - The issue path (object keys and array indexes).
 * @returns The dotted path; an empty string for the request root.
 */
export const formatFieldPath = (
  path: readonly PropertyKey[],
): string => path.reduce<string>(
  (field, key) => {
    if (typeof key === 'number') return `${field}[${key}]`;
    return field === '' ? String(key) : `${field}.${String(key)}`;
  },
  '',
);

/**
 * Reads the raw request value an issue points at.
 *
 * @param input - The raw (unvalidated) request value.
 * @param path - The issue path.
 * @returns The value at `path`, or `undefined` when any step is missing.
 */
export const valueAt = (
  input: unknown,
  path: readonly PropertyKey[],
): unknown => path.reduce<unknown>(
  (value, key) => (value !== null && typeof value === 'object'
    ? (value as Record<PropertyKey, unknown>)[key]
    : undefined),
  input,
);

/**
 * Names the size family of a too_small/too_big issue.
 *
 * @param origin - Zod's `origin` (number, int, string, array, …).
 * @returns `number`, `string`, `array`, `date`, or `value` for anything else.
 */
const sizeKind = (origin: string): SizeKind => SIZE_KINDS[origin] ?? 'value';

type Describers = { [C in Issue['code']]?: (issue: Extract<Issue, { code: C }>) => DetailBody };

const DESCRIBE: Describers = {
  too_small: (issue) => ({
    code: `${sizeKind(issue.origin)}.min`, params: { min: Number(issue.minimum) },
  }),
  too_big: (issue) => ({
    code: `${sizeKind(issue.origin)}.max`, params: { max: Number(issue.maximum) },
  }),
  invalid_format: (issue) => ({ code: 'string.format', params: { format: issue.format } }),
  not_multiple_of: (issue) => ({
    code: 'number.multiple_of', params: { divisor: Number(issue.divisor) },
  }),
  invalid_value: (issue) => ({ code: 'field.invalid_option', params: { options: issue.values } }),
  unrecognized_keys: (issue) => ({ code: 'object.unknown_keys', params: { keys: issue.keys } }),
  invalid_type: (issue) => ({ code: 'field.invalid_type', params: { expected: issue.expected } }),
};

/**
 * Translates one Zod issue into the envelope's `{field, code, params}` detail.
 *
 * @param issue - A Zod validation issue.
 * @param input - The raw request value, used to tell "missing" from "wrong type".
 * @returns The field detail; unknown issue kinds become `field.invalid`. Every
 *   code it can produce is a `FieldCode`, so the catalog translates it.
 */
export const toFieldDetail = (issue: Issue, input: unknown): FieldDetail => {
  const field = formatFieldPath(issue.path);

  if (issue.code === 'invalid_type' && valueAt(input, issue.path) === undefined) {
    return { field, code: 'field.required' };
  }

  const describe = DESCRIBE[issue.code] as ((i: Issue) => DetailBody) | undefined;

  return { field, ...(describe ? describe(issue) : { code: 'field.invalid' }) };
};
