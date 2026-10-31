import { describe, expect, it } from 'vitest';
import type { Role } from '../../../../src/db/schema/values';
import { createInsightsManager } from '../../../../src/managers/insights';
import type { SignedInContext } from '../../../../src/managers/requestContext';
import type { AccessRequest } from '../../../../src/utilities/authorization';
import {
  answerNothing, touchedBeyondAccess, withRole, type MockGroups,
} from '../seam';
import {
  ACCOUNT, ANA_ID, GOAL, HOLDING, HOUSEHOLD_ID, fakeDeps,
} from './fakes';

// The seam between InsightsManager and AuthorizationUtility, across every
// slice-3 use case (I4): a report and the Goal list ask only the membership
// check — every member reads them, each narrowed to what its viewer sees; one
// Goal asks to view it, an Account's Holdings and one Holding ask to view the
// Account. A refused caller stops the use case before anything but the reads
// that decide access — no Engine, no further read (the Manager has no logger).
// Data that isn't there asks only the membership check. Every request is
// `data.view`, which every role holds, so `forbidden` never comes back: the
// refusals are `not_member` and `not_visible`.

const BEA_ID = '0199c5a0-0000-7000-8000-000000000002';

const NOT_FOUND = { code: 'household.not_found' };

const ROLES: readonly Role[] = ['Owner', 'Admin', 'Member', 'Viewer'];

const CONTEXT: SignedInContext = {
  correlationId: 'corr-1', actor: { userId: ANA_ID, sessionId: 's1', systemRole: 'USER' },
};

type Manager = ReturnType<typeof createInsightsManager>;
type Visibility = 'personal' | 'shared';
type Fakes = ReturnType<typeof fakeDeps>;

/** The membership check alone: a list or report, or data that isn't there. */
const MEMBER_ONLY: AccessRequest = { action: 'data.view', visibility: 'shared', ownerUserId: null };

/** A use case as the matrix runs it. */
interface GuardedUseCase {
  readonly name: string;
  readonly useCase: keyof Manager;
  /** The access it asks for, given the visibility of the data it loads, owned by `owner`. */
  readonly request: (visibility: Visibility, owner: string) => AccessRequest;
  /** The reads that decide its access — all a refused run may make. */
  readonly reads: readonly string[];
  /** Its own 404 for data the caller may not see; none when it loads no such data. */
  readonly hidden: string | null;
  /** Its last call below, as `group.name` — made only once the caller is let through. */
  readonly reached: string;
  readonly run: (manager: Manager) => Promise<unknown>;
}

/**
 * The view request on the data a use case loads — its own owner and
 * visibility, never the caller's.
 *
 * @param visibility - The data's visibility.
 * @param owner - The data's owner.
 * @returns The request.
 */
const viewOf = (visibility: Visibility, owner: string): AccessRequest => ({
  action: 'data.view', visibility, ownerUserId: owner,
});

const GUARDED: readonly GuardedUseCase[] = [
  {
    name: 'read the Month Overview',
    useCase: 'report',
    request: () => MEMBER_ONLY,
    reads: [],
    hidden: null,
    reached: 'reporting.monthOverview',
    run: (manager) => manager.report(CONTEXT, HOUSEHOLD_ID, 'month-overview'),
  },
  {
    name: 'list Goal progress',
    useCase: 'goalProgressList',
    request: () => MEMBER_ONLY,
    reads: [],
    hidden: null,
    reached: 'reporting.goalProgress',
    run: (manager) => manager.goalProgressList(CONTEXT, HOUSEHOLD_ID, 'active'),
  },
  {
    name: 'read one Goal\'s progress',
    useCase: 'goalProgressFor',
    request: viewOf,
    reads: ['goals.findById'],
    hidden: 'goal.not_found',
    reached: 'reporting.goalProgress',
    run: (manager) => manager.goalProgressFor(CONTEXT, HOUSEHOLD_ID, GOAL.id),
  },
  {
    name: 'list an Account\'s Holdings',
    useCase: 'listHoldings',
    request: viewOf,
    reads: ['accounts.findById'],
    hidden: 'account.not_found',
    reached: 'investmentProducts.project',
    run: (manager) => manager.listHoldings(CONTEXT, HOUSEHOLD_ID, ACCOUNT.id, false),
  },
  {
    name: 'read one Holding',
    useCase: 'getHolding',
    request: viewOf,
    reads: ['holdings.findById', 'accounts.findById'],
    hidden: 'holding.not_found',
    reached: 'investmentProducts.project',
    run: (manager) => manager.getHolding(CONTEXT, HOUSEHOLD_ID, HOLDING.id),
  },
];

/** The use cases that load data, which may be someone else's personal data or not there. */
const LOADING = GUARDED.filter(({ hidden }) => hidden !== null);

/** The use cases every member runs, on no data of their own. */
const MEMBERS_ONLY = GUARDED.filter(({ hidden }) => hidden === null);

/**
 * Mocked dependencies whose Goal and Account — and so the Holding in it —
 * have one owner and visibility.
 *
 * @param visibility - Their visibility.
 * @param owner - Their owner (Bea, unless the test says).
 * @returns The mocks from `fakeDeps`, reprogrammed.
 */
const ownedData = (visibility: Visibility, owner: string = BEA_ID) => {
  const fakes = fakeDeps();
  fakes.goals.findById.mockResolvedValue({ ...GOAL, visibility, ownerUserId: owner });
  fakes.accounts.findById.mockResolvedValue({ ...ACCOUNT, visibility, ownerUserId: owner });
  return fakes;
};

/**
 * Mocked dependencies in which none of the data a use case loads is there.
 *
 * @returns The mocks from `fakeDeps`, every `findById` answering nothing.
 */
const missingData = () => {
  const fakes = fakeDeps();
  answerNothing([fakes.goals, fakes.accounts, fakes.holdings]);
  return fakes;
};

/**
 * The mocks of the tier below, by group — what `touchedBeyondAccess` looks at.
 *
 * @param fakes - The mocks from `fakeDeps`.
 * @returns Them, by group.
 */
const belowOf = (fakes: Fakes): MockGroups => ({
  reporting: fakes.reporting,
  investmentProducts: fakes.investmentProducts,
  goals: fakes.goals,
  accounts: fakes.accounts,
  holdings: fakes.holdings,
  accountTransactions: fakes.accountTransactions,
});

/**
 * Whether a use case went past its access check to its last call below.
 *
 * @param fakes - The mocks from `fakeDeps`.
 * @param reached - That call, as `group.name`.
 * @returns How many times it was made.
 */
const callsTo = (fakes: Fakes, reached: string): number => {
  const [group, name] = reached.split('.') as [string, string];
  const mocks = belowOf(fakes)[group] as Record<string, { mock: { calls: unknown[] } }>;
  return mocks[name]!.mock.calls.length;
};

describe('InsightsManager ↔ AuthorizationUtility seam (I4)', () => {
  it('covers every use case InsightsManager has', () => {
    const useCases = Object.keys(createInsightsManager(fakeDeps().deps));

    expect(GUARDED.map(({ useCase }) => useCase).sort()).toEqual(useCases.sort());
  });

  it.each(MEMBERS_ONLY)('$name asks once for the membership check', async ({ run }) => {
    const fakes = ownedData('personal');

    await run(createInsightsManager(fakes.deps));

    expect(fakes.authorization.authorize).toHaveBeenCalledOnce();
    expect(fakes.authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBER_ONLY);
  });

  describe.each(['personal', 'shared'] as const)('on Bea\'s %s data', (visibility) => {
    it.each(LOADING)('$name asks once for its own access', async ({ request, run }) => {
      const fakes = ownedData(visibility);

      await run(createInsightsManager(fakes.deps));

      expect(fakes.authorization.authorize).toHaveBeenCalledOnce();
      expect(fakes.authorization.authorize)
        .toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, request(visibility, BEA_ID));
    });
  });

  it.each(LOADING)('$name asks only the membership check for data that isn\'t there, '
    + 'answering a non-member household.not_found', async ({ run, reads }) => {
    const fakes = missingData();
    fakes.authorization.authorize.mockResolvedValueOnce({ outcome: 'not_member' });

    await expect(run(createInsightsManager(fakes.deps)))
      .rejects.toMatchObject({ domainError: NOT_FOUND });
    expect(fakes.authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBER_ONLY);
    expect(touchedBeyondAccess(belowOf(fakes), reads)).toEqual([]);
  });

  it.each(LOADING)('$name answers a member its own not-found for data that isn\'t there', async ({
    run,
    hidden,
  }) => {
    const fakes = missingData();

    await expect(run(createInsightsManager(fakes.deps)))
      .rejects.toMatchObject({ domainError: { code: hidden } });
    expect(fakes.authorization.authorize).toHaveBeenCalledOnce();
  });

  it('asks only the membership check for a Holding whose Account isn\'t there', async () => {
    const fakes = fakeDeps();
    fakes.accounts.findById.mockResolvedValue(undefined);

    await expect(createInsightsManager(fakes.deps).getHolding(CONTEXT, HOUSEHOLD_ID, HOLDING.id))
      .rejects.toMatchObject({ domainError: { code: 'holding.not_found' } });
    expect(fakes.authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBER_ONLY);
    expect(touchedBeyondAccess(belowOf(fakes), ['holdings.findById', 'accounts.findById']))
      .toEqual([]);
  });

  describe.each([
    ['a non-member', 'not_member', GUARDED, () => NOT_FOUND],
    ['someone else\'s personal data', 'not_visible', LOADING,
      (hidden: string | null) => ({ code: hidden })],
  ] as const)('refusing %s', (_who, outcome, useCases, answer) => {
    it.each(useCases)('$name answers after only its access reads', async ({
      run,
      reads,
      hidden,
    }) => {
      const fakes = ownedData('personal');
      fakes.authorization.authorize.mockResolvedValueOnce({ outcome });

      await expect(run(createInsightsManager(fakes.deps)))
        .rejects.toMatchObject({ domainError: answer(hidden) });
      expect(touchedBeyondAccess(belowOf(fakes), reads)).toEqual([]);
    });
  });

  describe('under the real policy (FR-1.7, FR-2.3/4.2/8.1, OQ-111)', () => {
    describe.each(ROLES)('lets a %s read Bea\'s shared data', (role) => {
      it.each(GUARDED)('$name reaching its data', async ({ run, reached }) => {
        const fakes = withRole(ownedData('shared'), role);

        await run(createInsightsManager(fakes.deps));

        expect(callsTo(fakes, reached)).toBe(1);
      });
    });

    describe.each(ROLES)('as %s', (role) => {
      it.each(LOADING)('hides Bea\'s personal data: $name answers its not-found', async ({
        run,
        reads,
        hidden,
      }) => {
        const fakes = withRole(ownedData('personal'), role);

        await expect(run(createInsightsManager(fakes.deps)))
          .rejects.toMatchObject({ domainError: { code: hidden } });
        expect(touchedBeyondAccess(belowOf(fakes), reads)).toEqual([]);
      });
    });

    it.each(LOADING)('lets a Viewer $name on her own personal data', async ({ run, reached }) => {
      const fakes = withRole(ownedData('personal', ANA_ID), 'Viewer');

      await run(createInsightsManager(fakes.deps));

      expect(callsTo(fakes, reached)).toBe(1);
    });
  });

  describe('narrowing what every member reads (OQ-206)', () => {
    const VIEWER = { householdId: HOUSEHOLD_ID, viewerUserId: ANA_ID };

    it('hands the Month Overview the caller as the viewer', async () => {
      const fakes = withRole(ownedData('shared'), 'Viewer');

      await createInsightsManager(fakes.deps).report(CONTEXT, HOUSEHOLD_ID, 'month-overview');

      expect(fakes.reporting.monthOverview).toHaveBeenCalledWith(VIEWER, expect.anything());
    });

    it('lists only the Goals the caller sees, handing the Engine the caller', async () => {
      const fakes = withRole(ownedData('shared'), 'Viewer');

      await createInsightsManager(fakes.deps).goalProgressList(CONTEXT, HOUSEHOLD_ID, 'completed');

      expect(fakes.goals.list).toHaveBeenCalledWith(HOUSEHOLD_ID, ANA_ID, 'completed');
      expect(fakes.reporting.goalProgress)
        .toHaveBeenCalledWith(VIEWER, expect.anything(), expect.anything());
    });
  });
});
