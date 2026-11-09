import { accounts as accountSettings } from '../../../../../config/constants';
import { Amount } from '../../../../../kit/amount/Amount';
import { Icon } from '../../../../../kit/icons/Icon';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { categoryColor, categoryTint } from '../../../../../utilities/theme';
import { pickByHash } from '../../../../../utilities/stableHash';
import type { AccountCard } from '../holdingMaintenance';

// Account Picker (FL19; mockup 51; OQ-234): one card per account holding an
// investment — its name and type glyph, today's value in its currency, and
// how many Holdings are open — the chosen one in mint. A row of toggle
// buttons that scrolls sideways when the cards don't fit. Emits the choice;
// holds nothing.

/** Account Picker's props. */
export interface AccountPickerProps {
  readonly cards: readonly AccountCard[];
  /** The account shown. */
  readonly selectedId: string;
  /** Emits the account the user chose. */
  readonly onSelect: (accountId: string) => void;
}

/** The chosen card's name: mint and bold (mockup 51). */
const SELECTED = 'font-semibold text-mint';

/** A card's name line: the glyph and the account's name. */
const NAME = 'flex items-center gap-2 type-body-sm';

/** The other cards' names. */
const UNSELECTED = 'text-muted';

/** A card's frame; the chosen one is edged in mint (mockup 51's `.acct`). */
const CARD = [
  'flex min-w-48 shrink-0 flex-col gap-1 rounded-2xl border bg-card px-4 py-3 text-left',
  'transition-colors hover:border-mint/50 focus-visible:outline-2 focus-visible:outline-mint',
].join(' ');

/**
 * Renders one account's card.
 *
 * @param props - The card, whether it's chosen and the handler.
 * @returns The toggle button.
 */
function PickerCard({ card, selected, onSelect }: {
  readonly card: AccountCard;
  readonly selected: boolean;
  readonly onSelect: (accountId: string) => void;
}) {
  const translator = useI18n();
  const { account } = card;
  const tone = pickByHash(account.id, accountSettings.balanceTones);
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`${CARD} ${selected ? 'border-mint' : 'border-line'}`}
      onClick={() => onSelect(account.id)}
    >
      <span className={`${NAME} ${selected ? SELECTED : UNSELECTED}`}>
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-full"
          style={{ background: categoryTint(tone), color: categoryColor(tone) }}
        >
          <Icon name={accountSettings.typeIcons[account.type]} className="size-3.5" />
        </span>
        <span className="truncate">{account.name}</span>
      </span>
      <Amount
        amount={card.value}
        currency={account.currency}
        className="type-heading-md"
      />
      <span className="type-caption text-muted">
        {translator.text('holdingMaintenance', 'account.holdings', {
          count: card.openHoldings, currency: account.currency,
        })}
      </span>
    </button>
  );
}

/**
 * Renders the account cards.
 *
 * @param props - The cards, the chosen account and the handler.
 * @returns The row of cards.
 */
export function AccountPicker({ cards, selectedId, onSelect }: AccountPickerProps) {
  const translator = useI18n();
  return (
    <div
      role="group"
      aria-label={translator.text('holdingMaintenance', 'accounts')}
      className="flex gap-3 overflow-x-auto pb-1"
    >
      {cards.map((card) => (
        <PickerCard
          key={card.account.id}
          card={card}
          selected={card.account.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
