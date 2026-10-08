import type { z } from 'zod';

type FieldKind = 'number' | 'boolean' | 'array' | 'other';
type QueryValue = string | string[] | undefined;
interface SchemaDef {
  type: string;
  innerType?: z.ZodType;
  shape?: Record<string, z.ZodType>;
}

const WRAPPERS = new Set(['optional', 'nullable', 'default', 'prefault']);
const KINDS = new Set<string>(['number', 'boolean', 'array']);
const BOOLEANS: Record<string, boolean> = { true: true, false: false };

const CONVERT: Record<FieldKind, (value: string) => unknown> = {
  array: (value) => [value],
  boolean: (value) => BOOLEANS[value] ?? value,
  number: (value) => (value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : value),
  other: (value) => value,
};

/**
 * Reads a schema's definition through Zod's public `def` accessor.
 *
 * @param schema - A Zod schema.
 * @returns Its kind, plus the wrapped schema or object shape when present.
 */
const defOf = (schema: z.ZodType): SchemaDef => schema.def;

/**
 * Finds what a query field's schema expects, looking through optional/default wrappers.
 *
 * @param schema - The field's Zod schema.
 * @returns `number`, `boolean`, `array`, or `other` (left as text).
 */
export const fieldKind = (schema: z.ZodType): FieldKind => {
  const def = defOf(schema);
  if (WRAPPERS.has(def.type) && def.innerType) return fieldKind(def.innerType);
  return KINDS.has(def.type) ? (def.type as FieldKind) : 'other';
};

/**
 * Converts one raw query value to what its schema expects. Values that do not
 * convert cleanly are left as they are, so validation reports them.
 *
 * @param kind - What the schema expects.
 * @param value - The raw value (a repeated parameter arrives as an array).
 * @returns The converted value.
 */
export const coerceValue = (kind: FieldKind, value: QueryValue): unknown => (
  typeof value === 'string' ? CONVERT[kind](value) : value
);

/**
 * Converts a raw query object using the generated schema's field types:
 * numbers, booleans and arrays are converted; everything else stays text.
 *
 * @param schema - The generated query schema (a Zod object).
 * @param query - Raw query values as Hono provides them.
 * @returns A new object ready for validation; non-objects are returned unchanged.
 */
export const coerceQuery = (schema: z.ZodType, query: unknown): unknown => {
  const { shape } = defOf(schema);
  if (!shape || query === null || typeof query !== 'object') return query;
  return Object.fromEntries(Object.entries(query as Record<string, QueryValue>).map(
    ([key, value]) => [key, shape[key] ? coerceValue(fieldKind(shape[key]), value) : value],
  ));
};
