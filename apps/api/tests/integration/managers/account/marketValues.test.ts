import { captureLogs, type LogEvent } from '@financas/logging';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import { createAccountManager } from '../../../../src/managers/account';
import { expectAudited } from '../audit';
import {
  ANA_ID, CONTEXT, fakeDeps, HOLDING, HOUSEHOLD_ID, NOW, SNAPSHOT,
} from './fakes';

const HOLDING_ID = HOLDING.id;
const SNAPSHOT_ID = SNAPSHOT.id;
const UNKNOWN_ID = '0199c5a0-0000-7000-8000-0000000000ff';
const AUTOMATIC = {
  ...SNAPSHOT, source: 'transaction' as const, accountTransactionId: UNKNOWN_ID,
};
const FORBIDDEN = { apiError: { status: 403, code: 'auth.forbidden' } };
const HOLDING_NOT_FOUND = { apiError: { status: 404, code: 'holding.not_found' } };
const SNAPSHOT_NOT_FOUND = { apiError: { status: 404, code: 'snapshot.not_found' } };
const NOT_EDITABLE = { apiError: { status: 409, code: 'snapshot.automatic_not_editable' } };
const NOT_MARKET_PRICED = { apiError: { status: 409, code: 'holding.not_market_priced' } };
const ARCHIVED = { apiError: { status: 409, code: 'holding.archived' } };
/** A date after today (2026-10-13) — refused (OQ-178). */
const TOMORROW_REFUSED = {
  apiError: {
    status: 422,
    code: 'validation.failed',
    details: [{ field: 'asOf', code: 'date.max', params: { max: '2026-10-13' } }],
  },
};

/**
 * The access request for an action on a Holding of the default (shared, Ana's) Account.
 *
 * @param action - The data action.
 * @returns What AuthorizationUtility decides on.
 */
const onAccount = (action: string) => ({ action, visibility: 'shared', ownerUserId: ANA_ID });

/**
 * The audit entry a market value action leaves.
 *
 * @param action - The audited action.
 * @returns The expected entry.
 */
const audit = (action: string) => ({
  action,
  actorId: ANA_ID,
  entityType: 'ValuationSnapshot',
  entityId: SNAPSHOT_ID,
  householdId: HOUSEHOLD_ID,
});

/**
 * The audit actions logged.
 *
 * @param events - The captured log events.
 * @returns Their messages, in order.
 */
const auditedActions = (events: readonly LogEvent[]) => (
  events.filter(({ level }) => level === 'audit').map(({ message }) => message)
);

/** The three writes, each run against the default Holding. */
const WRITES = {
  record: (manager: ReturnType<typeof createAccountManager>) => manager
    .recordMarketValue(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, { value: 1, asOf: '2026-10-01' }),
  edit: (manager: ReturnType<typeof createAccountManager>) => manager
    .editMarketValue(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, SNAPSHOT_ID, { value: 1 }),
  delete: (manager: ReturnType<typeof createAccountManager>) => manager
    .deleteMarketValue(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, SNAPSHOT_ID),
};

describe('AccountManager — a Holding\'s value history (FR-5.2/5.4)', () => {
  it('lists its snapshots within the range, checking data.view on its Account', async () => {
    const { deps, valuations, authorization } = fakeDeps();

    const listed = await createAccountManager(deps).listValuationSnapshots(
      CONTEXT,
      HOUSEHOLD_ID,
      HOLDING_ID,
      { from: '2026-01-01' },
    );

    expect(listed).toEqual([SNAPSHOT]);
    expect(valuations.list).toHaveBeenCalledWith(HOLDING_ID, { from: '2026-01-01' });
    expect(authorization.authorize).toHaveBeenCalledWith(
      ANA_ID,
      HOUSEHOLD_ID,
      onAccount('data.view'),
    );
  });

  it('answers a missing Holding 404 holding.not_found, reading nothing', async () => {
    const { deps, holdings, valuations } = fakeDeps();
    holdings.findById.mockResolvedValueOnce(undefined);

    await expect(createAccountManager(deps)
      .listValuationSnapshots(CONTEXT, HOUSEHOLD_ID, UNKNOWN_ID, {}))
      .rejects.toMatchObject(HOLDING_NOT_FOUND);
    expect(valuations.list).not.toHaveBeenCalled();
  });
});

describe('AccountManager — record a market value (uc-05, FR-5.2, OQ-56)', () => {
  it('records it as manual and audits it', async () => {
    const { deps, valuations, authorization } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    const recorded = await createAccountManager(deps).recordMarketValue(
      CONTEXT,
      HOUSEHOLD_ID,
      HOLDING_ID,
      { value: 0, asOf: '2026-10-13' },
    );

    expect(recorded).toEqual(SNAPSHOT);
    expect(authorization.authorize).toHaveBeenCalledWith(
      ANA_ID,
      HOUSEHOLD_ID,
      onAccount('data.edit'),
    );
    expect(valuations.insertManual).toHaveBeenCalledWith(HOLDING_ID, {
      valuation: 0, asOfDate: '2026-10-13',
    });
    expectAudited(logs.events, audit('RecordMarketValue'));
  });

  it('refuses a date after today 422 date.max', async () => {
    const { deps, valuations } = fakeDeps();

    await expect(createAccountManager(deps).recordMarketValue(
      CONTEXT,
      HOUSEHOLD_ID,
      HOLDING_ID,
      { value: 1, asOf: '2026-10-14' },
    )).rejects.toMatchObject(TOMORROW_REFUSED);
    expect(valuations.insertManual).not.toHaveBeenCalled();
  });
});

describe.each(Object.entries(WRITES))('AccountManager — %s a market value refused', (_, write) => {
  it('refuses a fixed-term Holding 409 holding.not_market_priced (OQ-51)', async () => {
    const { deps, holdings, valuations } = fakeDeps();
    holdings.findById.mockResolvedValueOnce({ ...HOLDING, assetType: 'cdb' });

    await expect(write(createAccountManager(deps))).rejects.toMatchObject(NOT_MARKET_PRICED);
    expect(valuations.insertManual).not.toHaveBeenCalled();
    expect(valuations.updateManual).not.toHaveBeenCalled();
    expect(valuations.deleteManual).not.toHaveBeenCalled();
  });

  it('refuses an archived Holding 409 holding.archived', async () => {
    const { deps, holdings } = fakeDeps();
    holdings.findById.mockResolvedValueOnce({ ...HOLDING, archivedAt: NOW, archivedBy: 'system' });

    await expect(write(createAccountManager(deps))).rejects.toMatchObject(ARCHIVED);
  });

  it('refuses a caller without the role 403', async () => {
    const { deps, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(write(createAccountManager(deps))).rejects.toMatchObject(FORBIDDEN);
  });
});

describe('AccountManager — edit a market value (uc-06, OQ-56)', () => {
  it('corrects the fields sent and audits it', async () => {
    const { deps, valuations } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    const edited = await createAccountManager(deps).editMarketValue(
      CONTEXT,
      HOUSEHOLD_ID,
      HOLDING_ID,
      SNAPSHOT_ID,
      { value: 330000, asOf: '2026-10-02' },
    );

    expect(edited).toEqual(SNAPSHOT);
    expect(valuations.updateManual).toHaveBeenCalledWith(HOLDING_ID, SNAPSHOT_ID, {
      valuation: 330000, asOfDate: '2026-10-02',
    });
    expectAudited(logs.events, audit('EditMarketValue'));
  });

  it('refuses a date after today 422 date.max', async () => {
    const { deps, valuations } = fakeDeps();

    await expect(createAccountManager(deps).editMarketValue(
      CONTEXT,
      HOUSEHOLD_ID,
      HOLDING_ID,
      SNAPSHOT_ID,
      { asOf: '2026-10-14' },
    )).rejects.toMatchObject(TOMORROW_REFUSED);
    expect(valuations.updateManual).not.toHaveBeenCalled();
  });

  it.each([
    ['not_found', SNAPSHOT_NOT_FOUND],
    ['automatic', NOT_EDITABLE],
  ])('answers ValuationSnapshotAccessor\'s %s as the API does', async (refusal, error) => {
    const { deps, valuations } = fakeDeps();
    valuations.updateManual.mockResolvedValueOnce(refusal);

    await expect(createAccountManager(deps).editMarketValue(
      CONTEXT,
      HOUSEHOLD_ID,
      HOLDING_ID,
      SNAPSHOT_ID,
      { value: 1 },
    )).rejects.toMatchObject(error);
  });

  it('reads a manual snapshot back for an empty edit, unaudited', async () => {
    const { deps, valuations } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    const read = await createAccountManager(deps)
      .editMarketValue(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, SNAPSHOT_ID, {});

    expect(read).toEqual(SNAPSHOT);
    expect(valuations.list).toHaveBeenCalledWith(HOLDING_ID);
    expect(valuations.updateManual).not.toHaveBeenCalled();
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('reads back the snapshot asked for among several', async () => {
    const { deps, valuations } = fakeDeps();
    const earlier = { ...SNAPSHOT, id: UNKNOWN_ID, valuation: 1 };
    valuations.list.mockResolvedValueOnce([earlier, SNAPSHOT]);

    await expect(createAccountManager(deps)
      .editMarketValue(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, SNAPSHOT_ID, {}))
      .resolves.toEqual(SNAPSHOT);
  });

  it.each([
    ['another Holding\'s snapshot', [], SNAPSHOT_NOT_FOUND],
    ['an automatic snapshot', [AUTOMATIC], NOT_EDITABLE],
  ])('answers an empty edit of %s as a write would', async (_, listed, error) => {
    const { deps, valuations } = fakeDeps();
    valuations.list.mockResolvedValueOnce(listed);

    await expect(createAccountManager(deps)
      .editMarketValue(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, SNAPSHOT_ID, {}))
      .rejects.toMatchObject(error);
  });
});

describe('AccountManager — delete a market value (uc-07, OQ-56)', () => {
  it('deletes it and audits it', async () => {
    const { deps, valuations } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    await createAccountManager(deps)
      .deleteMarketValue(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, SNAPSHOT_ID);

    expect(valuations.deleteManual).toHaveBeenCalledWith(HOLDING_ID, SNAPSHOT_ID);
    expectAudited(logs.events, audit('DeleteMarketValue'));
  });

  it.each([
    ['not_found', SNAPSHOT_NOT_FOUND],
    ['automatic', NOT_EDITABLE],
  ])('answers the Accessor\'s %s as the API does, unaudited', async (refusal, error) => {
    const { deps, valuations } = fakeDeps();
    valuations.deleteManual.mockResolvedValueOnce(refusal);
    const logs = captureLogs(onTestFinished);

    await expect(createAccountManager(deps)
      .deleteMarketValue(CONTEXT, HOUSEHOLD_ID, HOLDING_ID, SNAPSHOT_ID))
      .rejects.toMatchObject(error);

    expect(auditedActions(logs.events)).toEqual([]);
  });
});
