import type { Account } from '@financas/api-types';
import { formatMoney } from '../../../../../utilities/formatting';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { Button } from '../../../../../kit/button/Button';
import { Card } from '../../../../../kit/card/Card';
import { CardRow } from '../../../../../kit/creditCard/CardRow';
import { SectionHeader } from '../../../../../kit/sectionHeader/SectionHeader';
import { Tag } from '../../../../../kit/tag/Tag';
import type { AccountsView } from '../accountManagementState';
import { splitAccounts } from '../accountManagementState';
import { expiryOf } from './CardFields';

// The household's accounts as mockup 40 draws them: a grid of cards — the
// name, its type · currency · visibility tags, its balance (or the outstanding
// on a credit-card account) and the cards attached to it, each as its saved
// card strip (K48) — with an Add button
// above and the archived ones in their own section below. A card is clickable
// only when the actor may edit that account; the Flow decides that per row.
// The whole card opens it: the name is its one button, its hit area stretched
// over the card, so a screen reader still hears a single button by the name.

/** How each visibility's tag looks: its tone, its icon and its label's key. */
const VISIBILITY_TAGS = {
  personal: { tone: 'neutral', icon: 'person-outline', label: 'visibility.personal' },
  shared: { tone: 'sky', icon: 'group-outline', label: 'visibility.shared' },
} as const;

/** The name button's hit area, stretched over its card while it opens one. */
const STRETCHED = "after:absolute after:inset-0 after:rounded-card after:content-['']";

/**
 * Builds the classes of an account's card: lifted on hover while it opens.
 *
 * @param editable - Whether the card opens the edit drawer.
 * @returns The card's layout classes.
 */
export const accountCardClasses = (editable: boolean) => [
  'relative flex flex-col gap-3',
  editable ? 'cursor-pointer transition-colors hover:border-muted' : '',
].filter(Boolean).join(' ');

/** The tags one account's card shows, already translated by the caller. */
interface AccountCardProps {
  readonly account: Account;
  /** Whether this actor may open it for editing. */
  readonly editable: boolean;
  /** Opens the edit drawer about it; nothing while it can't be opened. */
  readonly onEdit?: (() => void) | undefined;
}

/**
 * Sums a credit-card account's cards' outstanding balances, in minor units.
 *
 * @param account - The account.
 * @returns What its card shows under "Outstanding".
 */
export const outstandingOf = (account: Account): number => (
  account.cards.reduce((total, card) => total + card.outstandingBalance, 0)
);

/**
 * Renders one account's card.
 *
 * @param props - The account, whether it is editable and the edit handler.
 * @returns The card; a button when it opens for editing.
 */
function AccountCard({ account, editable, onEdit }: AccountCardProps) {
  const translator = useI18n();
  const typeLabel = translator.text('accountSetup', `type.${account.type}`);
  const visibilityTag = VISIBILITY_TAGS[account.visibility];
  const isCreditCard = account.type === 'credit_card_only';
  const amount = isCreditCard
    ? formatMoney(outstandingOf(account), account.currency)
    : formatMoney(account.currentBalance, account.currency);

  return (
    <Card className={accountCardClasses(editable)}>
      <button
        type="button"
        onClick={onEdit}
        disabled={!editable}
        className={`text-left ${editable ? `cursor-pointer ${STRETCHED}` : ''}`}
      >
        <span className="block text-base font-semibold">{account.name}</span>
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <Tag>{typeLabel}</Tag>
        <Tag>{account.currency}</Tag>
        <Tag tone={visibilityTag.tone} icon={visibilityTag.icon}>
          {translator.text('accountSetup', visibilityTag.label)}
        </Tag>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm text-muted">
          {translator.text('accountSetup', isCreditCard ? 'card.outstanding' : 'card.balance')}
        </span>
        <span className="text-lg font-semibold tabular-nums">{amount}</span>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        {account.cards.length === 0 && (
          <span className="text-muted">{translator.text('accountSetup', 'card.none')}</span>
        )}
        {account.cards.map((card) => (
          <CardRow
            key={card.id}
            network={card.network}
            last4={card.last4}
            networkName={translator.text('cardNetworks', card.network)}
            meta={[
              translator.text('creditCard', 'billing', {
                closingDay: card.closingDay, dueDay: card.dueDay,
              }),
              translator.text('creditCard', 'expires', {
                expiry: expiryOf(card.expirationMonth, card.expirationYear),
              }),
            ].join(' · ')}
          />
        ))}
      </div>
    </Card>
  );
}

/** AccountList's props. */
export interface AccountListProps {
  /** The panels' content. */
  readonly view: AccountsView;
  /** Whether this actor may create an account (everyone but a Viewer). */
  readonly canCreate: boolean;
  /** Tells whether one account is editable by the actor. */
  readonly isEditable: (account: Account) => boolean;
  /** Opens the create drawer. */
  readonly onAdd: () => void;
  /** Opens the edit drawer about an account. */
  readonly onEdit: (accountId: string) => void;
  /** Fetches the list again. */
  readonly onRetry: () => void;
}

/**
 * Renders the accounts panel: loading, a failure with its retry, or the grid
 * and the archived section.
 *
 * @param props - The view, the actor's rights and the handlers.
 * @returns The panel.
 */
export function AccountList({
  view, canCreate, isEditable, onAdd, onEdit, onRetry,
}: AccountListProps) {
  const translator = useI18n();

  if (view.status === 'loading') {
    return <div className="h-40 animate-pulse rounded-xl bg-card" aria-hidden />;
  }
  if (view.status === 'failed') {
    return (
      <Card className="flex flex-col items-center gap-3 py-12">
        <span className="text-muted">{translator.error(view.error.code, view.error.params)}</span>
        <Button variant="secondary" onClick={onRetry}>
          {translator.text('accountSetup', 'retry')}
        </Button>
      </Card>
    );
  }

  const { active, archived } = splitAccounts(view.accounts);

  return (
    <div className="flex flex-col gap-6">
      {canCreate && (
        <div className="flex items-center justify-between gap-4">
          <Button variant="primary" leadingIcon="add" onClick={onAdd}>
            {translator.text('accountSetup', 'add')}
          </Button>
          <span className="text-sm text-muted">{translator.text('accountSetup', 'add.hint')}</span>
        </div>
      )}
      {active.length === 0 ? (
        <Card className="py-12 text-center text-muted">
          {translator.text('accountSetup', 'list.empty')}
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {active.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              editable={isEditable(account)}
              onEdit={isEditable(account) ? () => onEdit(account.id) : undefined}
            />
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader
            title={translator.text('accountSetup', 'archived.title', { count: archived.length })}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {archived.map((account) => (
              <AccountCard key={account.id} account={account} editable={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
