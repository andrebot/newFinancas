import { captureLogs } from '@financas/logging';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import type { SignedInContext } from '../../../../src/managers/requestContext';
import type { BusMessage } from '../../../../src/utilities/serviceBus';
import type { CorrelationId } from '../../../../src/utilities/correlationId';
import createRecord from '../../../../src/managers/transaction/record';
import createEdit from '../../../../src/managers/transaction/edit';
import createDelete from '../../../../src/managers/transaction/delete';
import { createEventHandlers } from '../../../../src/managers/transaction/events';
import { expectAudited } from '../audit';
import {
  ACCOUNT, ANA_ID, CARD, CARD_ROW, HOUSEHOLD_ID, MARKET_HOLDING, NOW, ROW, fakeDeps,
} from './fakes';

// What TransactionManager's writes leave in the audit log (FR-7.1): the action,
// who, which row on which ledger, and where — checked whole, as every audited
// Manager is (slice 1, M5). An edit that changes nothing leaves no entry.

const context: SignedInContext = {
  correlationId: 'corr-1', actor: { userId: ANA_ID, sessionId: 's1', systemRole: 'USER' },
};

/**
 * The entry an action on a ledger row leaves.
 *
 * @param action - The audited action.
 * @param entityType - `AccountTransaction` or `CardTransaction`.
 * @param entityId - The row.
 * @returns The expected entry.
 */
const audit = (action: string, entityType: string, entityId: string) => ({
  action, actorId: ANA_ID, entityType, entityId, householdId: HOUSEHOLD_ID,
});

/**
 * The audit entries logged.
 *
 * @param events - The captured log events.
 * @returns Only the audit ones.
 */
const auditEntries = (events: readonly { level: string }[]) => (
  events.filter(({ level }) => level === 'audit')
);

describe('TransactionManager audit (FR-7.1)', () => {
  it('audits a recorded Account Transaction, labelled TransactionManager', async () => {
    const logs = captureLogs(onTestFinished);
    await createRecord(fakeDeps().deps).recordTransaction(context, HOUSEHOLD_ID, {
      kind: 'withdrawal', date: '2026-10-13', amount: 5_000, currency: 'BRL', accountId: ACCOUNT.id,
    });
    expectAudited(logs.events, audit('RecordTransaction', 'AccountTransaction', ROW.id));
    expect(auditEntries(logs.events)[0]).toMatchObject({
      label: 'TransactionManager', correlationId: 'corr-1',
    });
  });

  it('audits a recorded Card Transaction', async () => {
    const logs = captureLogs(onTestFinished);
    await createRecord(fakeDeps().deps).recordTransaction(context, HOUSEHOLD_ID, {
      kind: 'charge', date: '2026-10-13', amount: 5_000, currency: 'BRL', creditCardId: CARD.id,
    });
    expectAudited(logs.events, audit('RecordTransaction', 'CardTransaction', CARD_ROW.id));
  });

  it('audits an edited Account Transaction', async () => {
    const logs = captureLogs(onTestFinished);
    await createEdit(fakeDeps().deps).editTransaction(context, HOUSEHOLD_ID, ROW.id, {
      amount: 7_000,
    });
    expectAudited(logs.events, audit('EditTransaction', 'AccountTransaction', ROW.id));
  });

  it('audits an edited Card Transaction', async () => {
    const logs = captureLogs(onTestFinished);
    const fake = fakeDeps();
    fake.accountTransactions.findById.mockResolvedValue(undefined);
    await createEdit(fake.deps).editTransaction(context, HOUSEHOLD_ID, CARD_ROW.id, {
      amount: 6_000,
    });
    expectAudited(logs.events, audit('EditTransaction', 'CardTransaction', CARD_ROW.id));
  });

  it('writes and audits nothing for an edit that resends the stored values', async () => {
    const logs = captureLogs(onTestFinished);
    const fake = fakeDeps();
    const edited = await createEdit(fake.deps).editTransaction(context, HOUSEHOLD_ID, ROW.id, {
      date: ROW.date, amount: ROW.amount, categoryId: null, description: null,
    });
    expect(edited.transaction).toBe(ROW);
    expect(fake.accountTransactions.update).not.toHaveBeenCalled();
    expect(auditEntries(logs.events)).toEqual([]);
  });

  it('audits nothing for an empty edit', async () => {
    const logs = captureLogs(onTestFinished);
    await createEdit(fakeDeps().deps).editTransaction(context, HOUSEHOLD_ID, ROW.id, {});
    expect(auditEntries(logs.events)).toEqual([]);
  });

  it('audits a deleted Account Transaction', async () => {
    const logs = captureLogs(onTestFinished);
    await createDelete(fakeDeps().deps).deleteTransaction(context, HOUSEHOLD_ID, ROW.id);
    expectAudited(logs.events, audit('DeleteTransaction', 'AccountTransaction', ROW.id));
  });

  it('audits a deleted Card Transaction', async () => {
    const logs = captureLogs(onTestFinished);
    const fake = fakeDeps();
    fake.accountTransactions.findById.mockResolvedValue(undefined);
    await createDelete(fake.deps).deleteTransaction(context, HOUSEHOLD_ID, CARD_ROW.id);
    expectAudited(logs.events, audit('DeleteTransaction', 'CardTransaction', CARD_ROW.id));
  });

  it('logs a scheduled post as the system, with the bus message\'s correlation id', async () => {
    const logs = captureLogs(onTestFinished);
    const message: BusMessage<'transaction.import.requested'> = {
      topic: 'transaction.import.requested',
      payload: {
        scheduleEntryId: 'e1',
        householdId: HOUSEHOLD_ID,
        accountId: ACCOUNT.id,
        holdingId: MARKET_HOLDING.id,
        kind: 'investment_interest',
        amount: 500,
        date: '2026-10-13',
      },
      correlationId: 'corr-bus' as CorrelationId,
      publishedAt: NOW,
    };
    await createEventHandlers(fakeDeps().deps).postScheduledEntry(message);
    expect(logs.events).toContainEqual(expect.objectContaining({
      message: 'Schedule entry posted',
      label: 'TransactionManager',
      actor: 'system',
      correlationId: 'corr-bus',
    }));
  });
});
