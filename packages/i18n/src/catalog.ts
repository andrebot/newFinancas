import type ptBR from './catalogs/pt-BR';

type Source = typeof ptBR;
type EmailKey = keyof Source['emails'];

/** A complete catalog: same sections and keys as pt-BR, every value an ICU message. */
export type Catalog = {
  readonly [Section in keyof Source]: { readonly [Key in keyof Source[Section]]: string };
};

/** An error code the web client makes itself, never sent by the API (FU7). */
export type ClientErrorCode = 'network.unavailable';

/** An API error `code` the catalog translates — the only codes the API may emit. */
export type ErrorCode = Exclude<keyof Source['errors'], 'fallback' | ClientErrorCode>;

/** A field code the web client makes itself, never sent by the API. */
export type ClientFieldCode = 'password.mismatch' | 'date.before_start';

/** A field code the catalog translates: the API's and the web client's own. */
export type FieldCode = keyof Source['fields'];

/** A validation `details[].code` the API may send in a 422. */
export type ApiFieldCode = Exclude<FieldCode, ClientFieldCode>;

/** A notification `type` the catalog translates (always the full API union). */
export type NotificationType = Exclude<keyof Source['notifications'], 'fallback'>;

/** An email type with a subject and body in the catalog, e.g. `password.reset`. */
export type EmailType = EmailKey extends infer Key
  ? (Key extends `${infer Type}.subject` ? Type : never)
  : never;

type StrengthKey = keyof Source['passwordStrength'];

/** A password strength meter level the catalog labels, e.g. `fair`. */
export type PasswordStrengthLevel = StrengthKey extends infer Key
  ? (Key extends `level.${infer Level}` ? Level : never)
  : never;

/** A password strength hint the catalog phrases, e.g. `avoid_common`. */
export type PasswordStrengthHint = StrengthKey extends infer Key
  ? (Key extends `hint.${infer Hint}` ? Hint : never)
  : never;
