import type { LogEvent } from '@financas/logging';
import { expect } from 'vitest';

// Audit entries are a requirement (FR-7.1), so a test checks the whole entry —
// action, who, what and where — not just that something with the action's name
// was logged.

/** The FR-7.1 fields an audited action must record. */
export interface ExpectedAudit {
  readonly action: string;
  /** The acting user's id. */
  readonly actorId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly householdId: string | null;
}

/**
 * Asserts that exactly one audit entry for the action was logged, with every
 * FR-7.1 field as expected.
 *
 * @param events - The captured log events.
 * @param expected - The entry the action must have produced.
 */
export const expectAudited = (events: readonly LogEvent[], expected: ExpectedAudit): void => {
  const entries = events.filter((event) => event.level === 'audit' && event.message === expected.action);

  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    actor: `user:${expected.actorId}`,
    entityType: expected.entityType,
    entityId: expected.entityId,
    householdId: expected.householdId,
  });
};
