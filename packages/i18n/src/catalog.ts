import type ptBR from './catalogs/pt-BR';

type Source = typeof ptBR;
type EmailKey = keyof Source['emails'];

/** A complete catalog: same sections and keys as pt-BR, every value an ICU message. */
export type Catalog = {
  readonly [Section in keyof Source]: { readonly [Key in keyof Source[Section]]: string };
};

/** An API error `code` the catalog translates — the only codes the API may emit. */
export type ErrorCode = Exclude<keyof Source['errors'], 'fallback'>;

/** A validation `details[].code` the catalog translates. */
export type FieldCode = keyof Source['fields'];

/** A notification `type` the catalog translates (always the full API union). */
export type NotificationType = Exclude<keyof Source['notifications'], 'fallback'>;

/** An email type with a subject and body in the catalog, e.g. `password.reset`. */
export type EmailType = EmailKey extends infer Key
  ? (Key extends `${infer Type}.subject` ? Type : never)
  : never;
