import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { appWithMocks, errorOf } from '../support/app';

// Every protected operation needs an access token (N10 S7, OQ-249). The
// household-data routes get their guard from the `/households/*` middleware
// mounted before them (OQ-174), so a reordered or new router could open them
// silently. This walks every operation in `openapi.yaml` and calls it with no
// token: the contract's public ones (`security: []`) are the only ones that
// may answer anything but 401, and none of the rest may reach a Manager.

const SPEC = path.resolve(import.meta.dirname, '../../../../docs/architecture/api/openapi.yaml');
const PATH_LINE = /^ {2}(\/\S*):\s*$/;
const METHOD_LINE = /^ {4}(get|post|put|patch|delete):\s*$/;
const PUBLIC_LINE = /^ {6}security: \[\]\s*$/;
const ANY_ID = '00000000-0000-4000-8000-000000000000';

interface Operation {
  readonly method: string;
  readonly path: string;
  readonly isPublic: boolean;
}

/**
 * Reads the operations in the contract and whether each is public.
 *
 * @param yaml - The OpenAPI document.
 * @returns One entry per operation, in document order.
 */
const operationsOf = (yaml: string): Operation[] => {
  const operations: Operation[] = [];
  let currentPath = '';
  yaml.split('\n').forEach((line) => {
    const pathMatch = line.match(PATH_LINE);
    const methodMatch = line.match(METHOD_LINE);
    if (pathMatch) currentPath = pathMatch[1]!;
    else if (methodMatch && currentPath) {
      const method = methodMatch[1]!.toUpperCase();
      operations.push({ method, path: currentPath, isPublic: false });
    } else if (PUBLIC_LINE.test(line) && operations.length > 0) {
      operations[operations.length - 1] = { ...operations.at(-1)!, isPublic: true };
    }
  });
  return operations;
};

/**
 * Turns a contract path into a request URL, every parameter a UUID.
 *
 * @param contractPath - A path from the contract, e.g. `/households/{householdId}`.
 * @returns The URL under `/api/v1`.
 */
const urlOf = (contractPath: string): string => (
  `/api/v1${contractPath.replace(/\{[^}]+\}/g, ANY_ID)}`
);

/**
 * Tells whether any method of any mocked Manager was called.
 *
 * @param managers - The mocked Managers.
 * @returns `true` when a request reached one.
 */
const reachedAnyManager = (managers: readonly object[]): boolean => managers
  .flatMap((manager) => Object.values(manager) as { mock: { calls: unknown[] } }[])
  .some((method) => method.mock.calls.length > 0);

describe('route guards — every protected operation needs a token (OQ-249)', async () => {
  const operations = operationsOf(await readFile(SPEC, 'utf8'));
  const protectedOperations = operations.filter((operation) => !operation.isPublic);

  it('reads the whole contract, and only the sign-in steps are public', () => {
    expect(operations.length).toBeGreaterThan(80);
    expect(operations.filter((operation) => operation.isPublic).map((operation) => operation.path))
      .toEqual(expect.arrayContaining(['/auth/register', '/auth/login', '/auth/refresh']));
    expect(operations.filter((operation) => operation.isPublic)
      .every((operation) => operation.path.startsWith('/auth/'))).toBe(true);
  });

  it.each(protectedOperations.map((operation) => [operation.method, operation.path]))(
    '%s %s answers 401 auth.unauthenticated without reaching a Manager',
    async (method, contractPath) => {
      const {
        app, identity, account, transaction, insights,
      } = appWithMocks();

      const response = await app.request(urlOf(contractPath), {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'GET' ? {} : { body: '{}' }),
      });

      expect(response.status).toBe(401);
      expect((await errorOf(response)).code).toBe('auth.unauthenticated');
      expect(reachedAnyManager([identity, account, transaction, insights])).toBe(false);
    },
  );
});
