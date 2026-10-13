import type { ClearableStorage } from '../../../src/utilities/safeStorage';

// Shared fakes for the API client's tests (FU7): the only sinks it touches are
// browser storage and `fetch`.

/** In-memory storage whose remembered value the test can read. */
export type MemoryStorage = ClearableStorage & { value: string | null };

/**
 * Storage held in memory, as the token store sees it.
 *
 * @param initial - The remembered value, if any.
 * @returns The storage, with its `value` exposed for assertions.
 */
export const memoryStorage = (initial: string | null = null): MemoryStorage => {
  const storage = {
    value: initial,
    read: () => storage.value,
    write: (value: string) => {
      storage.value = value;
    },
    remove: () => {
      storage.value = null;
    },
  };
  return storage;
};

/**
 * A JSON response, as the API sends it.
 *
 * @param status - The HTTP status.
 * @param body - The body, serialized as JSON; omitted for an empty body.
 * @returns The response.
 */
export const jsonResponse = (status: number, body?: unknown): Response => new Response(
  body === undefined ? null : JSON.stringify(body),
  { status, headers: { 'Content-Type': 'application/json' } },
);

/**
 * The API's error envelope (OQ-83).
 *
 * @param code - The error code.
 * @param extra - Other envelope fields (`params`, `details`, `message`).
 * @returns The envelope.
 */
export const envelope = (code: string, extra: Record<string, unknown> = {}) => ({
  error: {
    code, message: 'dev-only English', correlationId: 'server-cid', ...extra,
  },
});
