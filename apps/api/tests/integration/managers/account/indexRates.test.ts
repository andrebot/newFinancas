import { captureLogs, type LogEvent } from '@financas/logging';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import { createAccountManager } from '../../../../src/managers/account';
import { expectAudited } from '../audit';
import {
  ANA_ID, BEA_ID, CONTEXT, fakeDeps, HOUSEHOLD_ID, RATE,
} from './fakes';

const RATE_ID = RATE.id;
const UNKNOWN_ID = '0199c5a0-0000-7000-8000-0000000000ff';
const HOUSEHOLD_NOT_FOUND = { domainError: { code: 'household.not_found' } };
const FORBIDDEN = { domainError: { code: 'auth.forbidden' } };
const RATE_NOT_FOUND = { domainError: { code: 'index_rate.not_found' } };
const DUPLICATE_DAY = { domainError: { code: 'index_rate.duplicate_day' } };
/** What AuthorizationUtility decides on when there is no value to look at. */
const MEMBERS_ONLY = { action: 'data.view', visibility: 'shared', ownerUserId: null };
/** A date after today (2026-10-13) — refused, so `latest` is the highest date (OQ-172). */
const TOMORROW_REFUSED = {
  domainError: {
    code: 'validation.failed',
    details: [{ field: 'asOf', code: 'date.max', params: { max: '2026-10-13' } }],
  },
};

/**
 * The access request for an action on a value: shared data, its recorder as
 * creator (OQ-178).
 *
 * @param action - The data action.
 * @param ownerUserId - Its recorder.
 * @returns What AuthorizationUtility decides on.
 */
const onRate = (action: string, ownerUserId: string | null = ANA_ID) => (
  { action, visibility: 'shared', ownerUserId }
);

/**
 * The audit entry an index rate action leaves.
 *
 * @param action - The audited action.
 * @returns The expected entry.
 */
const audit = (action: string) => ({
  action, actorId: ANA_ID, entityType: 'IndexRate', entityId: RATE_ID, householdId: HOUSEHOLD_ID,
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

describe('AccountManager — the Rates tab (FR-11.6, OQ-172)', () => {
  it('lists every index with its history, checking membership only', async () => {
    const { deps, indexRates, authorization } = fakeDeps();

    const series = await createAccountManager(deps).listIndexRates(CONTEXT, HOUSEHOLD_ID);

    expect(series.map(({ index, values }) => [index, values])).toEqual([
      ['selic', [RATE]], ['cdi', []], ['ipca', []], ['igpm', []],
    ]);
    expect(indexRates.list).toHaveBeenCalledWith(HOUSEHOLD_ID);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBERS_ONLY);
  });

  it('answers a non-member 404 household.not_found, reading nothing', async () => {
    const { deps, indexRates, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_member' });

    await expect(createAccountManager(deps).listIndexRates(CONTEXT, HOUSEHOLD_ID))
      .rejects.toMatchObject(HOUSEHOLD_NOT_FOUND);
    expect(indexRates.list).not.toHaveBeenCalled();
  });
});

describe('AccountManager — record an index value (uc-08)', () => {
  it('records it as the caller\'s and audits it', async () => {
    const { deps, indexRates, authorization } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    const recorded = await createAccountManager(deps).recordIndexRate(
      CONTEXT,
      HOUSEHOLD_ID,
      'selic',
      { value: 105000, asOf: '2026-10-13' },
    );

    expect(recorded).toEqual(RATE);
    expect(authorization.authorize).toHaveBeenCalledWith(
      ANA_ID,
      HOUSEHOLD_ID,
      onRate('data.create'),
    );
    expect(indexRates.insert).toHaveBeenCalledWith(HOUSEHOLD_ID, {
      indexCode: 'selic', value: 105000, asOfDate: '2026-10-13',
    }, ANA_ID);
    expectAudited(logs.events, audit('RecordIndexRate'));
  });

  it('refuses a Viewer 403', async () => {
    const { deps, indexRates, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps).recordIndexRate(
      CONTEXT,
      HOUSEHOLD_ID,
      'selic',
      { value: 1, asOf: '2026-10-01' },
    )).rejects.toMatchObject(FORBIDDEN);
    expect(indexRates.insert).not.toHaveBeenCalled();
  });

  it('refuses a date after today 422 date.max', async () => {
    const { deps, indexRates } = fakeDeps();

    await expect(createAccountManager(deps).recordIndexRate(
      CONTEXT,
      HOUSEHOLD_ID,
      'selic',
      { value: 1, asOf: '2026-10-14' },
    )).rejects.toMatchObject(TOMORROW_REFUSED);
    expect(indexRates.insert).not.toHaveBeenCalled();
  });

  it('refuses a second value for the day 409 index_rate.duplicate_day, unaudited', async () => {
    const { deps, indexRates } = fakeDeps();
    indexRates.insert.mockResolvedValueOnce('duplicate_day');
    const logs = captureLogs(onTestFinished);

    await expect(createAccountManager(deps).recordIndexRate(
      CONTEXT,
      HOUSEHOLD_ID,
      'selic',
      { value: 1, asOf: '2026-10-01' },
    )).rejects.toMatchObject(DUPLICATE_DAY);

    expect(auditedActions(logs.events)).toEqual([]);
  });
});

describe('AccountManager — who may correct an index value (OQ-178)', () => {
  it('decides on its recorder as creator', async () => {
    const {
      deps, indexRates, authorization,
    } = fakeDeps();
    indexRates.findById.mockResolvedValueOnce({ ...RATE, createdByUserId: BEA_ID });

    await createAccountManager(deps).deleteIndexRate(CONTEXT, HOUSEHOLD_ID, 'selic', RATE_ID);

    expect(indexRates.findById).toHaveBeenCalledWith(HOUSEHOLD_ID, 'selic', RATE_ID);
    expect(authorization.authorize).toHaveBeenCalledWith(
      ANA_ID,
      HOUSEHOLD_ID,
      onRate('data.delete', BEA_ID),
    );
  });

  it('answers a missing value 404 index_rate.not_found, after the membership check', async () => {
    const { deps, indexRates, authorization } = fakeDeps();
    indexRates.findById.mockResolvedValueOnce(undefined);

    await expect(createAccountManager(deps)
      .editIndexRate(CONTEXT, HOUSEHOLD_ID, 'selic', UNKNOWN_ID, { value: 1 }))
      .rejects.toMatchObject(RATE_NOT_FOUND);
    expect(indexRates.update).not.toHaveBeenCalled();
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBERS_ONLY);
  });

  it('refuses a Member correcting someone else\'s value 403', async () => {
    const { deps, indexRates, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps)
      .editIndexRate(CONTEXT, HOUSEHOLD_ID, 'selic', RATE_ID, { value: 1 }))
      .rejects.toMatchObject(FORBIDDEN);
    expect(indexRates.update).not.toHaveBeenCalled();
  });
});

describe('AccountManager — edit an index value (uc-09)', () => {
  it('corrects the fields sent and audits it', async () => {
    const { deps, indexRates, authorization } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    const edited = await createAccountManager(deps).editIndexRate(
      CONTEXT,
      HOUSEHOLD_ID,
      'selic',
      RATE_ID,
      { value: 110000, asOf: '2026-10-02' },
    );

    expect(edited).toEqual(RATE);
    expect(authorization.authorize).toHaveBeenCalledWith(
      ANA_ID,
      HOUSEHOLD_ID,
      onRate('data.edit'),
    );
    expect(indexRates.update).toHaveBeenCalledWith(HOUSEHOLD_ID, 'selic', RATE_ID, {
      value: 110000, asOfDate: '2026-10-02',
    });
    expectAudited(logs.events, audit('EditIndexRate'));
  });

  it('reads the value back for an empty edit, unaudited', async () => {
    const { deps, indexRates } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    const read = await createAccountManager(deps)
      .editIndexRate(CONTEXT, HOUSEHOLD_ID, 'selic', RATE_ID, {});

    expect(read).toEqual(RATE);
    expect(indexRates.update).not.toHaveBeenCalled();
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('refuses a date after today 422 date.max', async () => {
    const { deps, indexRates } = fakeDeps();

    await expect(createAccountManager(deps)
      .editIndexRate(CONTEXT, HOUSEHOLD_ID, 'selic', RATE_ID, { asOf: '2026-10-14' }))
      .rejects.toMatchObject(TOMORROW_REFUSED);
    expect(indexRates.update).not.toHaveBeenCalled();
  });

  it.each([
    ['not_found', RATE_NOT_FOUND],
    ['duplicate_day', DUPLICATE_DAY],
  ])('answers IndexRateAccessor\'s %s as the API does, unaudited', async (refusal, error) => {
    const { deps, indexRates } = fakeDeps();
    indexRates.update.mockResolvedValueOnce(refusal);
    const logs = captureLogs(onTestFinished);

    await expect(createAccountManager(deps)
      .editIndexRate(CONTEXT, HOUSEHOLD_ID, 'selic', RATE_ID, { asOf: '2026-09-01' }))
      .rejects.toMatchObject(error);

    expect(auditedActions(logs.events)).toEqual([]);
  });
});

describe('AccountManager — delete an index value (uc-10)', () => {
  it('deletes it and audits it', async () => {
    const { deps, indexRates } = fakeDeps();
    const logs = captureLogs(onTestFinished);

    await createAccountManager(deps).deleteIndexRate(CONTEXT, HOUSEHOLD_ID, 'selic', RATE_ID);

    expect(indexRates.remove).toHaveBeenCalledWith(HOUSEHOLD_ID, 'selic', RATE_ID);
    expectAudited(logs.events, audit('DeleteIndexRate'));
  });

  it('answers a value gone meanwhile 404 index_rate.not_found, unaudited', async () => {
    const { deps, indexRates } = fakeDeps();
    indexRates.remove.mockResolvedValueOnce('not_found');
    const logs = captureLogs(onTestFinished);

    await expect(createAccountManager(deps)
      .deleteIndexRate(CONTEXT, HOUSEHOLD_ID, 'selic', RATE_ID))
      .rejects.toMatchObject(RATE_NOT_FOUND);

    expect(auditedActions(logs.events)).toEqual([]);
  });
});
