import type { Account } from '../../accessors/accountAccessor';
import type { CreditCard } from '../../accessors/creditCardAccessor';
import type { AccessRequest } from '../../utilities/authorization';
import { accessToOwned, requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import type { TransactionDeps } from './context';
import { cardAccountArchived, creditCardNotFound } from './errors';

// A bill payment's card (OQ-219): any open Account in the card's currency pays
// it, so the card's own Account — often a credit-card-only one — is decided on
// too, whenever the payment is recorded, edited or deleted: each moves the
// card's balance. Recording asks to record there — the money lands on it,
// whoever created it; an edit or delete asks what it asks on the payer, the
// payment's recorder deciding on a shared Account (OQ-223). The payer is
// decided on by its caller.

/** A paid card, with the Account it sits on. */
export interface PaidCard {
  readonly card: CreditCard;
  readonly account: Account;
}

/**
 * Loads the card a bill payment pays: the caller must be granted `access` on
 * its Account — to record there, unless an edit or delete says otherwise —
 * which must be open.
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param householdId - The household.
 * @param creditCardId - The card paid.
 * @param access - The request for the card's Account, once loaded.
 * @returns The card and its Account.
 * @throws {DomainError} `household.not_found` / `credit_card.not_found`;
 *   `auth.forbidden`; `credit_card.account_archived`.
 */
const requirePaidCard = async (
  deps: TransactionDeps,
  context: SignedInContext,
  householdId: string,
  creditCardId: string,
  access: (account: Account | undefined) => AccessRequest = (account) => (
    accessToOwned(account, 'data.create')
  ),
): Promise<PaidCard> => {
  const card = await deps.creditCards.findById(householdId, creditCardId);
  const account = card && await deps.accounts.findById(householdId, card.accountId);
  await requireAccess(
    deps.authorization,
    context.actor.userId,
    householdId,
    access(account),
    creditCardNotFound,
  );
  if (!card || !account) throw creditCardNotFound();
  if (account.archivedAt !== null) throw cardAccountArchived();
  return { card, account };
};

export default requirePaidCard;
