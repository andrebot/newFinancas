import { captureLogs } from '@financas/logging';
import type { Mock } from 'vitest';
import { expect, onTestFinished } from 'vitest';
import type { Role } from '../../../src/db/schema/values';
import { decide, type AccessRequest } from '../../../src/utilities/authorization';
import { isDomainError } from '../../../src/utilities/domainError';

// The permission-seam suites' shared matrix helpers (I2–I4): each suite hands
// in its own Manager's mocks; what a refused use case may touch, how it runs
// and how the real policy answers are the same for every Manager.

/** A suite's mocks of the tier below, by group — each group's functions by name. */
export type MockGroups = Readonly<Record<string, object>>;

/** The access check a suite's mocks carry. */
interface WithAuthorization {
  readonly authorization: { readonly authorize: Mock };
}

/**
 * Makes every given Accessor's `findById` answer nothing — the data a use case
 * loads isn't there.
 *
 * @param accessors - The mocked Accessors, each with a `findById`.
 */
export const answerNothing = (accessors: readonly object[]): void => {
  accessors.forEach((accessor) => {
    (accessor as { findById: Mock }).findById.mockResolvedValue(undefined);
  });
};

/**
 * Every mocked call made to the tier below beyond the access check and the
 * reads a use case decides it on — what a refused use case must not reach. Each
 * allowed read covers one call, so a read made again shows up too.
 *
 * @param groups - The mocks, by group.
 * @param reads - The reads the use case may make, as `group.name`, once per call.
 * @returns One `group.name` per call beyond them.
 */
export const touchedBeyondAccess = (groups: MockGroups, reads: readonly string[]): string[] => (
  Object.entries(groups).flatMap(([group, mocks]) => Object.entries(mocks)
    .flatMap(([name, mock]) => {
      const called = `${group}.${name}`;
      const allowed = reads.filter((read) => read === called).length;
      const beyond = (mock as Mock).mock.calls.length - allowed;
      return Array.from({ length: Math.max(beyond, 0) }, () => called);
    }))
);

/**
 * Runs a use case to its end, letting through only the API errors its own
 * rules answer with after an allowed check — a broken row still fails.
 *
 * @param run - The use case, ready to run.
 * @returns Once it has answered.
 */
export const runPastAccess = async (run: () => Promise<unknown>): Promise<void> => {
  await run().catch((error: unknown) => {
    if (!isDomainError(error)) throw error;
  });
};

/**
 * Runs a use case the caller is refused, capturing what it logs.
 *
 * @param run - The use case, ready to run.
 * @param answer - The API error it must answer with.
 * @returns What it logged.
 */
export const refusedLogging = async (
  run: () => Promise<unknown>,
  answer: object,
): Promise<unknown[]> => {
  const logs = captureLogs(onTestFinished);
  await expect(run()).rejects.toMatchObject({ domainError: answer });
  return logs.events;
};

/**
 * Programs the access check to answer as the real policy would for a caller
 * holding a role — the table under test in AuthorizationUtility's own suite,
 * run here to show what the requests a Manager sends come to.
 *
 * @param fakes - A suite's mocks.
 * @param role - The caller's household role.
 * @returns The same mocks.
 */
export const withRole = <Fakes extends WithAuthorization>(fakes: Fakes, role: Role): Fakes => {
  fakes.authorization.authorize.mockImplementation(async (
    actorId: string,
    _householdId: string,
    request: AccessRequest,
  ) => {
    const decision = decide(role, actorId, request);
    return decision === 'allowed' ? { outcome: 'allowed', role } : { outcome: decision };
  });
  return fakes;
};
