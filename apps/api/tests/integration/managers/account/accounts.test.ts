import { captureLogs, type LogEvent } from '@financas/logging';
import { describe, expect, it } from 'vitest';
import { createAccountManager } from '../../../../src/managers/account';
import { expectAudited } from '../audit';
import {
  ACCOUNT, accountBalance, ANA_ID, BEA_ID, CARD, cardBalance, CONTEXT, fakeDeps, HOUSEHOLD_ID,
  TODAY,
} from './fakes';

const ACCOUNT_ID = ACCOUNT.id;
const CARD_ID = CARD.id;
const OTHER_CARD_ID = '0199c5a0-0000-7000-8000-0000000000d9';
const NEW_CARD = {
  network: 'mastercard',
  last4: '1111',
  closingDay: 15,
  dueDay: 22,
  expirationMonth: 1,
  expirationYear: 2031,
};
const NEW_ACCOUNT = {
  name: 'Main', type: 'checking' as const, currency: 'BRL', visibility: 'shared' as const,
};
const HOUSEHOLD_NOT_FOUND = { apiError: { status: 404, code: 'household.not_found' } };
const FORBIDDEN = { apiError: { status: 403, code: 'auth.forbidden' } };
const ACCOUNT_NOT_FOUND = { apiError: { status: 404, code: 'account.not_found' } };
const CARD_NOT_FOUND = { apiError: { status: 404, code: 'credit_card.not_found' } };
const ARCHIVED = { apiError: { status: 409, code: 'account.archived' } };
const CARDS_NOT_ALLOWED = { apiError: { status: 422, code: 'account.cards_not_allowed' } };
const BLANK_NAME = {
  apiError: {
    status: 422,
    code: 'validation.failed',
    details: [{ field: 'name', code: 'string.min', params: { min: 1 } }],
  },
};
/** What AuthorizationUtility decides on when there is no Account to look at. */
const MEMBERS_ONLY = { action: 'data.view', visibility: 'shared', ownerUserId: null };
/** ACCOUNT as it is read today: its October balance and its card's current cycle. */
const ACCOUNT_VIEW = {
  ...ACCOUNT, currentBalance: 5000, cards: [{ ...CARD, outstandingBalance: 900 }],
};

/**
 * The audit entry an Account or card action leaves.
 *
 * @param action - The audited action.
 * @param entityType - `Account` or `CreditCard`.
 * @param entityId - The entity.
 * @returns The expected entry.
 */
const audit = (action: string, entityType: string, entityId: string) => ({
  action, actorId: ANA_ID, entityType, entityId, householdId: HOUSEHOLD_ID,
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

describe('AccountManager — view Accounts (FR-2.3/2.4, OQ-175)', () => {
  it('lists the Accounts the caller can see, each with its balance and cards today', async () => {
    const {
      deps, accounts, creditCards, authorization,
    } = fakeDeps();

    const listed = await createAccountManager(deps)
      .listAccounts(CONTEXT, HOUSEHOLD_ID, { visibility: 'shared' });

    expect(listed).toEqual([ACCOUNT_VIEW]);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBERS_ONLY);
    expect(accounts.list).toHaveBeenCalledWith(HOUSEHOLD_ID, ANA_ID, { visibility: 'shared' });
    expect(accounts.balancesAsOf).toHaveBeenCalledWith([ACCOUNT_ID], { year: 2026, month: 10 });
    expect(creditCards.listByAccounts).toHaveBeenCalledWith([ACCOUNT_ID]);
    // Today, the 13th, is past the card's closing day (5th): November's cycle is open.
    expect(creditCards.balancesAsOf).toHaveBeenCalledWith([CARD_ID], { year: 2026, month: 11 });
  });

  it('gives each Account only its own cards, and 0 where no balance row is there', async () => {
    const { deps, accounts, creditCards } = fakeDeps();
    const savings = { ...ACCOUNT, id: '0199c5a0-0000-7000-8000-0000000000a2', name: 'Savings' };
    const secondCard = { ...CARD, id: OTHER_CARD_ID, closingDay: 20 };
    accounts.list.mockResolvedValueOnce([ACCOUNT, savings]);
    accounts.balancesAsOf.mockResolvedValueOnce([accountBalance(savings.id, 70)]);
    creditCards.listByAccounts.mockResolvedValueOnce([CARD, secondCard]);
    creditCards.balancesAsOf
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([cardBalance(OTHER_CARD_ID, 33)]);

    const listed = await createAccountManager(deps).listAccounts(CONTEXT, HOUSEHOLD_ID, {});

    expect(listed).toEqual([
      {
        ...ACCOUNT,
        currentBalance: 0,
        cards: [
          { ...CARD, outstandingBalance: 0 },
          { ...secondCard, outstandingBalance: 33 },
        ],
      },
      { ...savings, currentBalance: 70, cards: [] },
    ]);
    expect(creditCards.balancesAsOf).toHaveBeenCalledWith([OTHER_CARD_ID], {
      year: 2026, month: 10,
    });
  });

  it('answers a non-member 404 household.not_found, reading nothing', async () => {
    const { deps, accounts, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_member' });

    await expect(createAccountManager(deps).listAccounts(CONTEXT, HOUSEHOLD_ID, {}))
      .rejects.toMatchObject(HOUSEHOLD_NOT_FOUND);
    expect(accounts.list).not.toHaveBeenCalled();
  });

  it('tells any member whether the household has an Account in use (OQ-198)', async () => {
    const { deps, accounts, authorization } = fakeDeps();
    accounts.hasAccountInUse.mockResolvedValueOnce(false);

    await expect(createAccountManager(deps).getAccountStatus(CONTEXT, HOUSEHOLD_ID))
      .resolves.toEqual({ inUse: false });
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBERS_ONLY);
    expect(accounts.hasAccountInUse).toHaveBeenCalledWith(HOUSEHOLD_ID);
  });

  it('answers a non-member\'s status question 404 household.not_found', async () => {
    const { deps, accounts, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_member' });

    await expect(createAccountManager(deps).getAccountStatus(CONTEXT, HOUSEHOLD_ID))
      .rejects.toMatchObject(HOUSEHOLD_NOT_FOUND);
    expect(accounts.hasAccountInUse).not.toHaveBeenCalled();
  });

  it('gets one Account, checked against its own visibility and owner', async () => {
    const { deps, accounts, authorization } = fakeDeps();

    await expect(createAccountManager(deps).getAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID))
      .resolves.toEqual(ACCOUNT_VIEW);
    expect(accounts.findById).toHaveBeenCalledWith(HOUSEHOLD_ID, ACCOUNT_ID);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.view', visibility: 'shared', ownerUserId: ANA_ID,
    });
  });

  it('answers someone else\'s personal Account 404 account.not_found', async () => {
    const { deps, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_visible' });

    await expect(createAccountManager(deps).getAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID))
      .rejects.toMatchObject(ACCOUNT_NOT_FOUND);
  });

  it('answers a missing Account 404 account.not_found, after the membership check', async () => {
    const { deps, accounts, authorization } = fakeDeps();
    accounts.findById.mockResolvedValueOnce(undefined);

    await expect(createAccountManager(deps).getAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID))
      .rejects.toMatchObject(ACCOUNT_NOT_FOUND);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBERS_ONLY);
  });

  it('answers a non-member 404 household.not_found even for a missing Account', async () => {
    const { deps, accounts, authorization } = fakeDeps();
    accounts.findById.mockResolvedValueOnce(undefined);
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_member' });

    await expect(createAccountManager(deps).getAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID))
      .rejects.toMatchObject(HOUSEHOLD_NOT_FOUND);
  });
});

describe('AccountManager — Create Account (financial-accounts/uc-01, FR-2.1/2.7)', () => {
  it('creates it with its cards in one transaction, owned by its creator, audited', async () => {
    const {
      deps, accounts, creditCards, authorization, inTransaction,
    } = fakeDeps();
    const logs = captureLogs();

    const created = await createAccountManager(deps).createAccount(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_ACCOUNT, name: ' Main ', openingBalance: 1500, cards: [NEW_CARD],
    });
    logs.stop();

    expect(created).toEqual({
      ...ACCOUNT, currentBalance: 1500, cards: [{ ...CARD, outstandingBalance: 0 }],
    });
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.create', visibility: 'shared', ownerUserId: ANA_ID,
    });
    expect(inTransaction).toHaveBeenCalledOnce();
    expect(accounts.insert).toHaveBeenCalledWith({
      ...NEW_ACCOUNT,
      householdId: HOUSEHOLD_ID,
      ownerUserId: ANA_ID,
      startingBalance: 1500,
      startingBalanceDate: TODAY,
    });
    expect(creditCards.insert).toHaveBeenCalledWith({ ...NEW_CARD, accountId: ACCOUNT_ID }, TODAY);
    expectAudited(logs.events, audit('CreateAccount', 'Account', ACCOUNT_ID));
    expectAudited(logs.events, audit('AttachCreditCard', 'CreditCard', CARD_ID));
  });

  it('opens at 0 with no cards when neither is sent', async () => {
    const { deps, accounts, creditCards } = fakeDeps();

    const created = await createAccountManager(deps)
      .createAccount(CONTEXT, HOUSEHOLD_ID, NEW_ACCOUNT);

    expect(created).toEqual({ ...ACCOUNT, currentBalance: 0, cards: [] });
    expect(accounts.insert).toHaveBeenCalledWith(expect.objectContaining({ startingBalance: 0 }));
    expect(creditCards.insert).not.toHaveBeenCalled();
  });

  it('refuses cards on an investment Account with 422, writing nothing (FR-2.7)', async () => {
    const { deps, inTransaction } = fakeDeps();

    await expect(createAccountManager(deps).createAccount(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_ACCOUNT, type: 'investment', cards: [NEW_CARD],
    })).rejects.toMatchObject(CARDS_NOT_ALLOWED);
    expect(inTransaction).not.toHaveBeenCalled();
  });

  it('refuses a blank name with 422, writing nothing', async () => {
    const { deps, inTransaction } = fakeDeps();

    await expect(createAccountManager(deps).createAccount(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_ACCOUNT, name: '  ',
    })).rejects.toMatchObject(BLANK_NAME);
    expect(inTransaction).not.toHaveBeenCalled();
  });

  it('answers a role that may not create 403, before validating', async () => {
    const { deps, authorization, inTransaction } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps).createAccount(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_ACCOUNT, name: ' ',
    })).rejects.toMatchObject(FORBIDDEN);
    expect(inTransaction).not.toHaveBeenCalled();
  });

  it('lets a failed card write fail the whole creation, unaudited', async () => {
    const { deps, creditCards } = fakeDeps();
    creditCards.insert.mockRejectedValueOnce(new Error('db down'));
    const logs = captureLogs();

    await expect(createAccountManager(deps).createAccount(CONTEXT, HOUSEHOLD_ID, {
      ...NEW_ACCOUNT, cards: [NEW_CARD],
    })).rejects.toThrow('db down');
    logs.stop();

    expect(auditedActions(logs.events)).toEqual([]);
  });
});

describe('AccountManager — Edit Account (financial-accounts/uc-02, FR-2.3/2.9, OQ-175)', () => {
  it('writes the Account and every card change in one transaction, each audited', async () => {
    const {
      deps, accounts, creditCards, authorization, inTransaction,
    } = fakeDeps();
    const added = { ...CARD, id: OTHER_CARD_ID };
    creditCards.insert.mockResolvedValueOnce(added);
    const logs = captureLogs();

    const edited = await createAccountManager(deps).editAccount(
      CONTEXT,
      HOUSEHOLD_ID,
      ACCOUNT_ID,
      {
        name: ' Daily ',
        cards: {
          add: [NEW_CARD], edit: [{ id: CARD_ID, closingDay: 10, dueDay: undefined }],
        },
      },
    );
    logs.stop();

    expect(edited).toEqual(ACCOUNT_VIEW);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.edit', visibility: 'shared', ownerUserId: ANA_ID,
    });
    expect(inTransaction).toHaveBeenCalledOnce();
    expect(accounts.update).toHaveBeenCalledWith(HOUSEHOLD_ID, ACCOUNT_ID, { name: 'Daily' });
    expect(creditCards.insert).toHaveBeenCalledWith({ ...NEW_CARD, accountId: ACCOUNT_ID }, TODAY);
    expect(creditCards.update).toHaveBeenCalledWith(ACCOUNT_ID, CARD_ID, { closingDay: 10 });
    expectAudited(logs.events, audit('EditAccount', 'Account', ACCOUNT_ID));
    expectAudited(logs.events, audit('AttachCreditCard', 'CreditCard', OTHER_CARD_ID));
    expectAudited(logs.events, audit('EditCreditCard', 'CreditCard', CARD_ID));
  });

  it('removes a card of the Account, audited, leaving the Account unaudited', async () => {
    const { deps, creditCards } = fakeDeps();
    const logs = captureLogs();

    await createAccountManager(deps).editAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID, {
      cards: { remove: [CARD_ID] },
    });
    logs.stop();

    expect(creditCards.remove).toHaveBeenCalledWith(ACCOUNT_ID, CARD_ID);
    expect(auditedActions(logs.events)).toEqual(['RemoveCreditCard']);
  });

  it('reads an empty edit back, unaudited', async () => {
    const { deps, accounts } = fakeDeps();
    const logs = captureLogs();

    await expect(createAccountManager(deps).editAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID, {}))
      .resolves.toEqual(ACCOUNT_VIEW);
    logs.stop();

    expect(accounts.update).toHaveBeenCalledWith(HOUSEHOLD_ID, ACCOUNT_ID, {});
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('refuses an archived Account with 409 account.archived, writing nothing', async () => {
    const { deps, accounts, inTransaction } = fakeDeps();
    accounts.findById.mockResolvedValueOnce({ ...ACCOUNT, archivedAt: new Date() });

    await expect(createAccountManager(deps).editAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID, {
      name: 'Old',
    })).rejects.toMatchObject(ARCHIVED);
    expect(inTransaction).not.toHaveBeenCalled();
  });

  it('lets only the creator change the visibility (FR-2.3)', async () => {
    const { deps, accounts, inTransaction } = fakeDeps();
    accounts.findById.mockResolvedValueOnce({ ...ACCOUNT, ownerUserId: BEA_ID });

    await expect(createAccountManager(deps).editAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID, {
      visibility: 'personal',
    })).rejects.toMatchObject(FORBIDDEN);
    expect(inTransaction).not.toHaveBeenCalled();
  });

  it('lets someone else send the visibility it already has', async () => {
    const { deps, accounts } = fakeDeps();
    accounts.findById.mockResolvedValueOnce({ ...ACCOUNT, ownerUserId: BEA_ID });

    await createAccountManager(deps).editAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID, {
      visibility: 'shared',
    });

    expect(accounts.update).toHaveBeenCalledWith(HOUSEHOLD_ID, ACCOUNT_ID, {
      visibility: 'shared',
    });
  });

  it('lets the creator make it personal', async () => {
    const { deps, accounts } = fakeDeps();

    await createAccountManager(deps).editAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID, {
      visibility: 'personal',
    });

    expect(accounts.update).toHaveBeenCalledWith(HOUSEHOLD_ID, ACCOUNT_ID, {
      visibility: 'personal',
    });
  });

  it('refuses a blank name with 422, writing nothing', async () => {
    const { deps, inTransaction } = fakeDeps();

    await expect(createAccountManager(deps).editAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID, {
      name: ' ',
    })).rejects.toMatchObject(BLANK_NAME);
    expect(inTransaction).not.toHaveBeenCalled();
  });

  it('refuses a new card on an investment Account with 422 (FR-2.7)', async () => {
    const { deps, accounts, inTransaction } = fakeDeps();
    accounts.findById.mockResolvedValueOnce({ ...ACCOUNT, type: 'investment' });

    await expect(createAccountManager(deps).editAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID, {
      cards: { add: [NEW_CARD] },
    })).rejects.toMatchObject(CARDS_NOT_ALLOWED);
    expect(inTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['edit', { edit: [{ id: OTHER_CARD_ID, dueDay: 1 }] }],
    ['remove', { remove: [OTHER_CARD_ID] }],
  ])('refuses to %s a card not on the Account with 404, writing nothing', async (_, cards) => {
    const { deps, creditCards, inTransaction } = fakeDeps();

    await expect(createAccountManager(deps).editAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID, {
      cards,
    })).rejects.toMatchObject(CARD_NOT_FOUND);
    expect(creditCards.listByAccounts).toHaveBeenCalledWith([ACCOUNT_ID]);
    expect(inTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['edited', 'update', { edit: [{ id: CARD_ID, dueDay: 1 }] }],
    ['removed', 'remove', { remove: [CARD_ID] }],
  ] as const)('fails the edit with 404 when a card goes before it is %s', async (
    _,
    write,
    cards,
  ) => {
    const { deps, creditCards } = fakeDeps();
    if (write === 'update') creditCards.update.mockResolvedValueOnce(undefined);
    else creditCards.remove.mockResolvedValueOnce(false);
    const logs = captureLogs();

    await expect(createAccountManager(deps).editAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID, {
      cards,
    })).rejects.toMatchObject(CARD_NOT_FOUND);
    logs.stop();

    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('fails the edit with 404 when the Account goes during it', async () => {
    const { deps, accounts, creditCards } = fakeDeps();
    accounts.update.mockResolvedValueOnce(undefined);

    await expect(createAccountManager(deps).editAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID, {
      name: 'Daily', cards: { add: [NEW_CARD] },
    })).rejects.toMatchObject(ACCOUNT_NOT_FOUND);
    expect(creditCards.insert).not.toHaveBeenCalled();
  });

  it('answers a member without the role 403 before validating', async () => {
    const { deps, authorization, inTransaction } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps).editAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID, {
      name: ' ',
    })).rejects.toMatchObject(FORBIDDEN);
    expect(inTransaction).not.toHaveBeenCalled();
  });
});

describe('AccountManager — Archive Account (financial-accounts/uc-03, FR-2.4)', () => {
  it('archives it, audited, checking data.delete on the Account', async () => {
    const { deps, accounts, authorization } = fakeDeps();
    const logs = captureLogs();

    await createAccountManager(deps).archiveAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID);
    logs.stop();

    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.delete', visibility: 'shared', ownerUserId: ANA_ID,
    });
    expect(accounts.archive).toHaveBeenCalledWith(HOUSEHOLD_ID, ACCOUNT_ID);
    expectAudited(logs.events, audit('ArchiveAccount', 'Account', ACCOUNT_ID));
  });

  it('leaves an archived Account as it is, unaudited', async () => {
    const { deps, accounts } = fakeDeps();
    accounts.findById.mockResolvedValueOnce({ ...ACCOUNT, archivedAt: new Date() });
    const logs = captureLogs();

    await createAccountManager(deps).archiveAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID);
    logs.stop();

    expect(accounts.archive).not.toHaveBeenCalled();
    expect(auditedActions(logs.events)).toEqual([]);
  });

  it('answers 404 when the Account goes before the write', async () => {
    const { deps, accounts } = fakeDeps();
    accounts.archive.mockResolvedValueOnce(false);

    await expect(createAccountManager(deps).archiveAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID))
      .rejects.toMatchObject(ACCOUNT_NOT_FOUND);
  });

  it('answers a member without the role 403, writing nothing', async () => {
    const { deps, accounts, authorization } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'forbidden' });

    await expect(createAccountManager(deps).archiveAccount(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID))
      .rejects.toMatchObject(FORBIDDEN);
    expect(accounts.archive).not.toHaveBeenCalled();
  });
});

describe('AccountManager — balance histories (FR-5.4, FR-2.10)', () => {
  const RANGE = { from: { year: 2026, month: 1 } };

  it('lists an Account\'s month balances after checking it may be seen', async () => {
    const { deps, accounts, authorization } = fakeDeps();

    await expect(createAccountManager(deps)
      .getAccountBalances(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID, RANGE))
      .resolves.toEqual([accountBalance(ACCOUNT_ID, 5000)]);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.view', visibility: 'shared', ownerUserId: ANA_ID,
    });
    expect(accounts.listBalances).toHaveBeenCalledWith(ACCOUNT_ID, RANGE);
  });

  it('answers a missing Account\'s history 404 account.not_found', async () => {
    const { deps, accounts } = fakeDeps();
    accounts.findById.mockResolvedValueOnce(undefined);

    await expect(createAccountManager(deps)
      .getAccountBalances(CONTEXT, HOUSEHOLD_ID, ACCOUNT_ID, {}))
      .rejects.toMatchObject(ACCOUNT_NOT_FOUND);
    expect(accounts.listBalances).not.toHaveBeenCalled();
  });

  it('lists a card\'s cycle balances, checked through its Account', async () => {
    const {
      deps, accounts, creditCards, authorization,
    } = fakeDeps();

    await expect(createAccountManager(deps)
      .getCreditCardBalances(CONTEXT, HOUSEHOLD_ID, CARD_ID, RANGE))
      .resolves.toEqual([cardBalance(CARD_ID, 900)]);
    expect(creditCards.findById).toHaveBeenCalledWith(HOUSEHOLD_ID, CARD_ID);
    expect(accounts.findById).toHaveBeenCalledWith(HOUSEHOLD_ID, ACCOUNT_ID);
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, {
      action: 'data.view', visibility: 'shared', ownerUserId: ANA_ID,
    });
    expect(creditCards.listBalances).toHaveBeenCalledWith(CARD_ID, RANGE);
  });

  it('answers a card on someone else\'s personal Account 404 credit_card.not_found', async () => {
    const { deps, authorization, creditCards } = fakeDeps();
    authorization.authorize.mockResolvedValueOnce({ outcome: 'not_visible' });

    await expect(createAccountManager(deps)
      .getCreditCardBalances(CONTEXT, HOUSEHOLD_ID, CARD_ID, {}))
      .rejects.toMatchObject(CARD_NOT_FOUND);
    expect(creditCards.listBalances).not.toHaveBeenCalled();
  });

  it('answers a missing card 404 credit_card.not_found, after the membership check', async () => {
    const {
      deps, accounts, authorization, creditCards,
    } = fakeDeps();
    creditCards.findById.mockResolvedValueOnce(undefined);

    await expect(createAccountManager(deps)
      .getCreditCardBalances(CONTEXT, HOUSEHOLD_ID, CARD_ID, {}))
      .rejects.toMatchObject(CARD_NOT_FOUND);
    expect(accounts.findById).not.toHaveBeenCalled();
    expect(authorization.authorize).toHaveBeenCalledWith(ANA_ID, HOUSEHOLD_ID, MEMBERS_ONLY);
  });
});
