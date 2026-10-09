// Postgres error codes an Accessor turns into expected outcomes (OQ-103).
// Drivers wrap errors differently (Drizzle puts the driver's error in `cause`),
// so the code is looked up along the cause chain.

export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';

/**
 * Finds the Postgres SQLSTATE code of an error, looking through wrapped causes.
 *
 * @param error - Anything thrown by a query.
 * @returns The five-character code, or `undefined` when there is none.
 */
export const pgErrorCode = (error: unknown): string | undefined => {
  if (error === null || typeof error !== 'object') return undefined;
  const { code, cause } = error as { code?: unknown; cause?: unknown };
  if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  return pgErrorCode(cause);
};
