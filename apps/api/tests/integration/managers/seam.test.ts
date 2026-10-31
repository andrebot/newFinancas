import { createLogger } from '@financas/logging';
import {
  describe, expect, it, vi,
} from 'vitest';
import { createDomainError } from '../../../src/utilities/domainError';
import {
  answerNothing, refusedLogging, runPastAccess, touchedBeyondAccess, withRole,
} from './seam';

// The seam suites' shared helpers, checked on their own so a matrix that leans
// on them can't pass because of them.

const ANA_ID = '0199c5a0-0000-7000-8000-000000000001';
const BEA_ID = '0199c5a0-0000-7000-8000-000000000002';
const HOUSEHOLD_ID = '0199c5a0-0000-7000-8000-0000000000bb';

const NOT_FOUND = createDomainError({ code: 'household.not_found', message: 'not found' });

describe('answerNothing', () => {
  it('makes each Accessor\'s findById answer nothing', async () => {
    const goals = { findById: vi.fn(async () => ({ id: 'g1' })) };
    const accounts = { findById: vi.fn(async () => ({ id: 'a1' })) };

    answerNothing([goals, accounts]);

    expect(await goals.findById()).toBeUndefined();
    expect(await accounts.findById()).toBeUndefined();
  });
});

describe('touchedBeyondAccess', () => {
  it('names nothing when only the allowed reads were made', () => {
    const accounts = { findById: vi.fn(), list: vi.fn() };
    accounts.findById();

    expect(touchedBeyondAccess({ accounts }, ['accounts.findById'])).toEqual([]);
  });

  it('names each call beyond the allowed reads, a read made again included', () => {
    const accounts = { findById: vi.fn() };
    const reporting = { monthOverview: vi.fn() };
    accounts.findById();
    accounts.findById();
    reporting.monthOverview();

    expect(touchedBeyondAccess({ accounts, reporting }, ['accounts.findById']))
      .toEqual(['accounts.findById', 'reporting.monthOverview']);
  });

  it('lets a read listed twice be made twice', () => {
    const accounts = { findById: vi.fn() };
    accounts.findById();
    accounts.findById();

    expect(touchedBeyondAccess({ accounts }, ['accounts.findById', 'accounts.findById']))
      .toEqual([]);
  });
});

describe('runPastAccess', () => {
  it('lets through an API error the use case answers with', async () => {
    await expect(runPastAccess(() => Promise.reject(NOT_FOUND))).resolves.toBeUndefined();
  });

  it('rethrows anything else', async () => {
    const broken = new Error('broken row');

    await expect(runPastAccess(() => Promise.reject(broken))).rejects.toBe(broken);
  });
});

describe('refusedLogging', () => {
  it('answers what the refused use case logged', async () => {
    const events = await refusedLogging(async () => {
      createLogger({ component: 'seam' }).warn('refused');
      throw NOT_FOUND;
    }, { code: 'household.not_found' });

    expect(events).toEqual([expect.objectContaining({ message: 'refused' })]);
  });

  it('fails when the use case answers another error', async () => {
    await expect(refusedLogging(() => Promise.reject(NOT_FOUND), { code: 'auth.forbidden' }))
      .rejects.toThrow();
  });
});

describe('withRole', () => {
  it('answers as the real policy does for the role', async () => {
    const fakes = withRole({ authorization: { authorize: vi.fn() } }, 'Viewer');
    const { authorize } = fakes.authorization;

    expect(await authorize(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.view', visibility: 'shared', ownerUserId: BEA_ID,
    })).toEqual({ outcome: 'allowed', role: 'Viewer' });
    expect(await authorize(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.view', visibility: 'personal', ownerUserId: BEA_ID,
    })).toEqual({ outcome: 'not_visible' });
    expect(await authorize(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.create', visibility: 'shared', ownerUserId: null,
    })).toEqual({ outcome: 'forbidden' });
  });
});
