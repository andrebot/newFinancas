import { captureLogs } from '@financas/logging';
import type { Mock } from 'vitest';
import {
  describe, expect, it, onTestFinished,
} from 'vitest';
import type { Account } from '../../../../src/accessors/accountAccessor';
import type { AccountTransaction } from '../../../../src/accessors/accountTransactionAccessor';
import type { CardTransaction } from '../../../../src/accessors/cardTransactionAccessor';
import type { Role } from '../../../../src/db/schema/values';
import type { SignedInContext } from '../../../../src/managers/requestContext';
import { createTransactionManager } from '../../../../src/managers/transaction';
import type { TransactionCreate } from '../../../../src/managers/transaction/record';
import { decide, type AccessRequest } from '../../../../src/utilities/authorization';
import { isDomainError } from '../../../../src/utilities/domainError';
import {
  ANA_ID, CARD, CARD_ROW, CHECKING, HOUSEHOLD_ID, ROW, fakeDeps,
} from './fakes';

// The seam between TransactionManager and AuthorizationUtility, across every
// use case (I3, OQ-223): recording asks to create on the Account it lands on;
// an edit or delete asks on the row's recorder when its Account is shared and
// on the Account's owner when it is personal; a bill payment's card and a
// transfer's other side ask to record there too. A refused caller stops the use
// case before anything but the reads that decide access — no write, no
// transaction, no log. A row that isn't there asks only the membership check.

const BEA_ID = '0199c5a0-0000-7000-8000-000000000002';
const CAIO_ID = '0199c5a0-0000-7000-8000-000000000003';

const NOT_FOUND = { code: 'household.not_found' };
const FORBIDDEN = { code: 'auth.forbidden' };

/** What TransactionManager returns besides its use cases: the bus handler (`events.ts`). */
const EVENT_HANDLERS = ['postScheduledEntry'];

const CONTEXT: SignedInContext = {
  correlationId: 'corr-1', actor: { userId: ANA_ID, sessionId: 's1', systemRole: 'USER' },
};

type Manager = ReturnType<typeof createTransactionManager>;
type Visibility = 'personal' | 'shared';
type Fakes = ReturnType<typeof fakeDeps>;

const SAVINGS: Account = {
  ...CHECKING, id: '0199c5a0-0000-7000-8000-0000000000a3', name: 'Poupança', type: 'savings',
};

/** Caio's withdrawal from checking. */
const CASH: AccountTransaction = { ...ROW, accountId: CHECKING.id, createdByUserId: CAIO_ID };

/** Caio's charge on the checking Account's card. */
const CHARGE: CardTransaction = { ...CARD_ROW, createdByUserId: CAIO_ID };

/** Caio's payment of that card's bill from savings. */
const BILL: AccountTransaction = {
  ...CASH,
  id: '0199c5a0-0000-7000-8000-0000000000t5',
  accountId: SAVINGS.id,
  kind: 'credit_card_bill_payment',
  effect: 'bill_payment',
  creditCardId: CARD.id,
};

/** The sent side of Caio's transfer from checking to savings. */
const SENT: AccountTransaction = {
  ...CASH,
  id: '0199c5a0-0000-7000-8000-0000000000s1',
  kind: 'transfer_sent',
  effect: 'transfer',
  transferId: '0199c5a0-0000-7000-8000-0000000000s1',
  pair: {
    id: '0199c5a0-0000-7000-8000-0000000000s2',
    accountId: SAVINGS.id,
    amount: 5_000,
    currency: 'BRL',
  },
};

/** Its received side. */
const RECEIVED: AccountTransaction = {
  ...SENT,
  id: '0199c5a0-0000-7000-8000-0000000000s2',
  accountId: SAVINGS.id,
  kind: 'transfer_received',
  pair: {
    id: SENT.id, accountId: CHECKING.id, amount: 5_000, currency: 'BRL',
  },
};

const ACCOUNT_ROWS = [CASH, BILL, SENT, RECEIVED];

const WITHDRAWAL = {
  kind: 'withdrawal', date: '2026-10-13', amount: 5_000, currency: 'BRL', accountId: CHECKING.id,
} as TransactionCreate;
const CARD_CHARGE = {
  kind: 'charge', date: '2026-10-13', amount: 5_000, currency: 'BRL', creditCardId: CARD.id,
} as TransactionCreate;
const BILL_PAYMENT = {
  ...WITHDRAWAL, kind: 'credit_card_bill_payment', accountId: SAVINGS.id, creditCardId: CARD.id,
} as TransactionCreate;
const TRANSFER = {
  ...WITHDRAWAL, kind: 'transfer_sent', toAccountId: SAVINGS.id,
} as TransactionCreate;
const EDIT = { description: 'Rent' };

/** An access request, given the visibility of the Accounts the use case loads. */
type Expected = (visibility: Visibility) => AccessRequest;

/**
 * The access request for an action on an Account Bea owns — every Account in
 * this suite, so the request is seen to carry the Account's own owner.
 *
 * @param action - The data action.
 * @returns The request for the Account's visibility.
 */
const beas = (action: 'data.view' | 'data.create'): Expected => (visibility) => ({
  action, visibility, ownerUserId: BEA_ID,
});

/**
 * The access request for an edit or delete of a row Caio recorded on Bea's
 * Account: his on a shared Account, still hers on a personal one.
 *
 * @param action - `data.edit` or `data.delete`.
 * @returns The request for the Account's visibility.
 */
const caios = (action: 'data.edit' | 'data.delete'): Expected => (visibility) => ({
  action, visibility, ownerUserId: visibility === 'shared' ? CAIO_ID : BEA_ID,
});

/** The membership check alone: a list, or data that isn't there. */
const MEMBER_ONLY: AccessRequest = { action: 'data.view', visibility: 'shared', ownerUserId: null };

/** What each kind of use case reads to decide access (a card on its Account). */
const READS = {
  none: [],
  account: ['accounts.findById'],
  card: ['creditCards.findById', 'accounts.findById'],
  row: [
    'accountTransactions.findById', 'cardTransactions.findById',
    'creditCards.findById', 'accounts.findById',
  ],
};

/** A use case as the matrix runs it. */
interface GuardedUseCase {
  readonly name: string;
  readonly useCase: keyof Manager;
  /** The access it asks for, in order — a second Account's after the first. */
  readonly requests: readonly Expected[];
  /** The reads that decide its first access — all a refused run may make. */
  readonly reads: readonly string[];
  /** Its own 404 at the first check for data the caller may not see; none for a list. */
  readonly hidden: string | null;
  /** The answer when the second Account isn't visible; none with one check. */
  readonly secondHidden: string | null;
  readonly run: (manager: Manager) => Promise<unknown>;
}

const GUARDED: readonly GuardedUseCase[] = [
  {
    name: 'record a withdrawal',
    useCase: 'recordTransaction',
    requests: [beas('data.create')],
    reads: READS.account,
    hidden: 'account.not_found',
    secondHidden: null,
    run: (manager) => manager.recordTransaction(CONTEXT, HOUSEHOLD_ID, WITHDRAWAL),
  },
  {
    name: 'record a card charge',
    useCase: 'recordTransaction',
    requests: [beas('data.create')],
    reads: READS.card,
    hidden: 'credit_card.not_found',
    secondHidden: null,
    run: (manager) => manager.recordTransaction(CONTEXT, HOUSEHOLD_ID, CARD_CHARGE),
  },
  {
    name: 'record a bill payment',
    useCase: 'recordTransaction',
    requests: [beas('data.create'), beas('data.create')],
    reads: READS.account,
    hidden: 'account.not_found',
    secondHidden: 'credit_card.not_found',
    run: (manager) => manager.recordTransaction(CONTEXT, HOUSEHOLD_ID, BILL_PAYMENT),
  },
  {
    name: 'record a transfer between own accounts',
    useCase: 'recordTransaction',
    requests: [beas('data.create'), beas('data.create')],
    reads: READS.account,
    hidden: 'account.not_found',
    secondHidden: 'account.not_found',
    run: (manager) => manager.recordTransaction(CONTEXT, HOUSEHOLD_ID, TRANSFER),
  },
  ...(['edit', 'delete'] as const).flatMap((verb): GuardedUseCase[] => {
    const action = verb === 'edit' ? 'data.edit' : 'data.delete';
    const run = (id: string) => (manager: Manager) => (verb === 'edit'
      ? manager.editTransaction(CONTEXT, HOUSEHOLD_ID, id, EDIT)
      : manager.deleteTransaction(CONTEXT, HOUSEHOLD_ID, id));
    const useCase = verb === 'edit' ? 'editTransaction' : 'deleteTransaction';
    const common = {
      useCase, reads: READS.row, hidden: 'transaction.not_found',
    } as const;
    return [
      {
        ...common,
        name: `${verb} a cash row`,
        requests: [caios(action)],
        secondHidden: null,
        run: run(CASH.id),
      },
      {
        ...common,
        name: `${verb} a card charge`,
        requests: [caios(action)],
        secondHidden: null,
        run: run(CHARGE.id),
      },
      {
        ...common,
        name: `${verb} a bill payment`,
        requests: [caios(action), beas('data.create')],
        secondHidden: 'credit_card.not_found',
        run: run(BILL.id),
      },
      {
        ...common,
        name: `${verb} a transfer between own accounts`,
        requests: [caios(action), beas('data.create')],
        secondHidden: 'auth.forbidden',
        run: run(SENT.id),
      },
    ];
  }),
  {
    name: 'get an Account-ledger row',
    useCase: 'getTransaction',
    requests: [beas('data.view')],
    reads: READS.row,
    hidden: 'transaction.not_found',
    secondHidden: null,
    run: (manager) => manager.getTransaction(CONTEXT, HOUSEHOLD_ID, CASH.id),
  },
  {
    name: 'get a card charge',
    useCase: 'getTransaction',
    requests: [beas('data.view')],
    reads: READS.row,
    hidden: 'transaction.not_found',
    secondHidden: null,
    run: (manager) => manager.getTransaction(CONTEXT, HOUSEHOLD_ID, CHARGE.id),
  },
  {
    name: 'list transactions',
    useCase: 'listTransactions',
    requests: [() => MEMBER_ONLY],
    reads: READS.none,
    hidden: null,
    secondHidden: null,
    run: (manager) => manager.listTransactions(CONTEXT, HOUSEHOLD_ID, {}, undefined, 50),
  },
];

/** The use cases that load data, which may be someone else's personal data or not there. */
const LOADING = GUARDED.filter(({ hidden }) => hidden !== null);

/** The use cases that load a transaction by id. */
const BY_ID = LOADING.filter(({ reads }) => reads === READS.row);

/** The use cases that decide on a second Account. */
const TWO_ACCOUNTS = GUARDED.filter(({ secondHidden }) => secondHidden !== null);

/**
 * Mocked dependencies whose Accounts belong to Bea and whose rows Caio recorded,
 * each found by its id.
 *
 * @param visibility - The visibility Bea's Accounts have.
 * @param rows - The Account-ledger rows there are.
 * @param charge - The card-ledger row there is.
 * @returns The mocks from `fakeDeps`, reprogrammed.
 */
const beasData = (
  visibility: Visibility,
  rows: readonly AccountTransaction[] = ACCOUNT_ROWS,
  charge: CardTransaction = CHARGE,
) => {
  const fakes = fakeDeps();
  const accounts = [CHECKING, SAVINGS].map((account) => ({
    ...account, visibility, ownerUserId: BEA_ID,
  }));
  fakes.accounts.findById.mockImplementation(async (_householdId: string, id: string) => (
    accounts.find((account) => account.id === id)
  ));
  fakes.accounts.list.mockResolvedValue(accounts);
  fakes.accountTransactions.findById.mockImplementation(
    async (_householdId: string, id: string) => rows.find((row) => row.id === id),
  );
  (fakes.cardTransactions.findById as Mock).mockImplementation(
    async (_householdId: string, id: string) => (id === charge.id ? charge : undefined),
  );
  return fakes;
};

/**
 * Mocked dependencies in which none of the data a use case loads is there.
 *
 * @returns The mocks from `fakeDeps`, every `findById` answering nothing.
 */
const missingData = () => {
  const fakes = fakeDeps();
  [fakes.accounts, fakes.creditCards, fakes.accountTransactions, fakes.cardTransactions]
    .forEach((accessor) => (accessor.findById as Mock).mockResolvedValue(undefined));
  return fakes;
};

/**
 * Every mocked call made to the tier below other than the access check and the
 * reads a use case decides it on — what a refused use case must not reach.
 *
 * @param fakes - The mocks from `fakeDeps`.
 * @param reads - The reads the use case may make, as `group.name`.
 * @returns The names of the other mocks that were called.
 */
const touchedBeyondAccess = (fakes: Fakes, reads: readonly string[]): string[] => {
  const groups = {
    accounts: fakes.accounts,
    accountTransactions: fakes.accountTransactions,
    cardTransactions: fakes.cardTransactions,
    creditCards: fakes.creditCards,
    categories: fakes.categories,
    budgets: fakes.budgets,
    goals: fakes.goals,
    holdings: fakes.holdings,
    valuations: fakes.valuations,
    investmentProducts: fakes.investmentProducts,
    unitOfWork: { inTransaction: fakes.inTransaction },
  };
  return Object.entries(groups).flatMap(([group, mocks]) => Object.entries(mocks)
    .filter(([, mock]) => (mock as Mock).mock.calls.length > 0)
    .map(([name]) => `${group}.${name}`)
    .filter((called) => !reads.includes(called)));
};

/**
 * Runs a use case to its end, letting through only the API errors its own
 * rules answer with after an allowed check — a broken row still fails.
 *
 * @param run - The use case, ready to run.
 * @returns Once it has answered.
 */
const runPastAccess = async (run: () => Promise<unknown>): Promise<void> => {
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
const refusedLogging = async (run: () => Promise<unknown>, answer: object): Promise<unknown[]> => {
  const logs = captureLogs(onTestFinished);
  await expect(run()).rejects.toMatchObject({ domainError: answer });
  return logs.events;
};

/**
 * Programs the access check to answer as the real policy would for a caller
 * holding a role — the table under test in AuthorizationUtility's own suite,
 * run here to show what the requests the Manager sends come to.
 *
 * @param fakes - The mocks from `fakeDeps`.
 * @param role - Ana's household role.
 * @returns The same mocks.
 */
const withRole = (fakes: Fakes, role: Role): Fakes => {
  fakes.authorization.authorize.mockImplementation((async (
    actorId: string,
    _householdId: string,
    request: AccessRequest,
  ) => {
    const decision = decide(role, actorId, request);
    return decision === 'allowed' ? { outcome: 'allowed', role } : { outcome: decision };
  }) as never);
  return fakes;
};

describe('TransactionManager ↔ AuthorizationUtility seam (I3, OQ-223)', () => {
  it('covers every use case TransactionManager has', () => {
    const useCases = Object.keys(createTransactionManager(fakeDeps().deps))
      .filter((name) => !EVENT_HANDLERS.includes(name));

    expect([...new Set(GUARDED.map(({ useCase }) => useCase))].sort()).toEqual(useCases.sort());
  });

  describe.each(['personal', 'shared'] as const)('on Bea\'s %s Accounts', (visibility) => {
    it.each(GUARDED)('$name asks for its own access on each Account', async ({ requests, run }) => {
      const fakes = beasData(visibility);

      // What follows an allowed check is each use case's own suite's to assert.
      await runPastAccess(() => run(createTransactionManager(fakes.deps)));

      expect(fakes.authorization.authorize).toHaveBeenCalledTimes(requests.length);
      requests.forEach((request, index) => {
        expect(fakes.authorization.authorize)
          .toHaveBeenNthCalledWith(index + 1, ANA_ID, HOUSEHOLD_ID, request(visibility));
      });
    });
  });

  it.each(LOADING)('$name asks only the membership check for data that isn\'t there, '
    + 'answering a non-member household.not_found', async ({ run, reads }) => {
    const fakes = missingData();
    fakes.authorization.authorize.mockResolvedValueOnce({ outcome: 'not_member' });

    const manager = createTransactionManager(fakes.deps);
    const events = await refusedLogging(() => run(manager), NOT_FOUND);

    expect(fakes.authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBER_ONLY);
    expect(touchedBeyondAccess(fakes, [...reads, ...READS.row])).toEqual([]);
    expect(events).toEqual([]);
  });

  it.each(BY_ID)('$name answers a member transaction.not_found for a missing row', async ({
    run,
  }) => {
    const fakes = missingData();

    await expect(run(createTransactionManager(fakes.deps)))
      .rejects.toMatchObject({ domainError: { code: 'transaction.not_found' } });
    expect(fakes.authorization.authorize).toHaveBeenCalledOnce();
  });

  describe.each([
    ['a non-member', 'not_member', GUARDED, () => NOT_FOUND],
    ['a member without the role', 'forbidden', GUARDED, () => FORBIDDEN],
    ['someone else\'s personal data', 'not_visible', LOADING,
      (hidden: string | null) => ({ code: hidden })],
  ] as const)('refusing %s', (_who, outcome, useCases, answer) => {
    it.each(useCases)('$name answers after only its access reads, logging nothing', async ({
      run,
      reads,
      hidden,
    }) => {
      const fakes = beasData('personal');
      fakes.authorization.authorize.mockResolvedValueOnce({ outcome });

      const events = await refusedLogging(
        () => run(createTransactionManager(fakes.deps)),
        answer(hidden),
      );

      expect(touchedBeyondAccess(fakes, reads)).toEqual([]);
      expect(events).toEqual([]);
    });
  });

  describe.each([
    ['without the role', 'forbidden', () => FORBIDDEN.code],
    ['that isn\'t visible', 'not_visible', (secondHidden: string | null) => secondHidden],
  ] as const)('refusing the second Account %s', (_why, outcome, answer) => {
    it.each(TWO_ACCOUNTS)('$name writes nothing and logs nothing', async ({
      run,
      secondHidden,
    }) => {
      const fakes = beasData('shared');
      fakes.authorization.authorize
        .mockResolvedValueOnce({ outcome: 'allowed', role: 'Owner' })
        .mockResolvedValueOnce({ outcome });

      const events = await refusedLogging(
        () => run(createTransactionManager(fakes.deps)),
        { code: answer(secondHidden) },
      );

      expect(fakes.inTransaction).not.toHaveBeenCalled();
      expect(events).toEqual([]);
    });
  });

  describe('under the real policy, on Bea\'s shared Accounts (FR-1.7, OQ-111)', () => {
    /** Ana's own rows on Bea's Accounts. */
    const anasRows = ACCOUNT_ROWS.map((row) => ({ ...row, createdByUserId: ANA_ID }));
    const anasCharge = { ...CHARGE, createdByUserId: ANA_ID };

    it.each([
      ['a withdrawal', WITHDRAWAL, 'accountTransactions.insert'],
      ['a card charge', CARD_CHARGE, 'cardTransactions.insert'],
      ['a bill payment of a card on Bea\'s Account', BILL_PAYMENT, 'accountTransactions.insert'],
      ['a transfer into Bea\'s Account', TRANSFER, 'accountTransactions.insertTransfer'],
    ] as const)('lets a Member record %s', async (_what, request, write) => {
      const fakes = withRole(beasData('shared'), 'Member');

      await createTransactionManager(fakes.deps).recordTransaction(CONTEXT, HOUSEHOLD_ID, request);

      expect(touchedBeyondAccess(fakes, [])).toContain(write);
    });

    it('refuses a Viewer recording', async () => {
      const fakes = withRole(beasData('shared'), 'Viewer');

      await expect(createTransactionManager(fakes.deps)
        .recordTransaction(CONTEXT, HOUSEHOLD_ID, WITHDRAWAL))
        .rejects.toMatchObject({ domainError: FORBIDDEN });
      expect(fakes.inTransaction).not.toHaveBeenCalled();
    });

    const BY_ID_WRITES = BY_ID.filter(({ useCase }) => useCase !== 'getTransaction');

    it.each(BY_ID_WRITES)('lets a Member $name they recorded', async ({ run }) => {
      const fakes = withRole(beasData('shared', anasRows, anasCharge), 'Member');

      await run(createTransactionManager(fakes.deps));

      expect(fakes.inTransaction).toHaveBeenCalled();
    });

    it.each(BY_ID_WRITES)('refuses a Member who would $name Caio recorded', async ({ run }) => {
      const fakes = withRole(beasData('shared'), 'Member');

      await expect(run(createTransactionManager(fakes.deps)))
        .rejects.toMatchObject({ domainError: FORBIDDEN });
      expect(fakes.inTransaction).not.toHaveBeenCalled();
    });

    it.each([
      ['refuses a Member', 'Member', false],
      ['lets an Admin', 'Admin', true],
    ] as const)('%s edit a schedule post, which no one recorded', async (_who, role, allowed) => {
      const posted = { ...CASH, source: 'schedule' as const, createdByUserId: null };
      const fakes = withRole(beasData('shared', [posted]), role);

      const edit = createTransactionManager(fakes.deps)
        .editTransaction(CONTEXT, HOUSEHOLD_ID, posted.id, EDIT);

      await (allowed ? expect(edit).resolves.toBeDefined() : expect(edit).rejects.toMatchObject({
        domainError: FORBIDDEN,
      }));
    });

    it('keeps a personal Account its owner\'s: Ana\'s old entry there isn\'t hers', async () => {
      const fakes = withRole(beasData('personal', anasRows), 'Member');

      await expect(createTransactionManager(fakes.deps)
        .editTransaction(CONTEXT, HOUSEHOLD_ID, CASH.id, EDIT))
        .rejects.toMatchObject({ domainError: { code: 'transaction.not_found' } });
      expect(fakes.inTransaction).not.toHaveBeenCalled();
    });
  });
});
