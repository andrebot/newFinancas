import type { Currency } from '@financas/api-types';
import type { PaletteToken } from '@financas/reference';
import { useI18n } from '../../utilities/I18nProvider';
import { formatMoney } from '../../utilities/formatting';
import { Amount } from '../amount/Amount';
import { discStyle } from '../categoryChip/CategoryChip';
import { Icon, type IconName } from '../icons/Icon';
import { railCardClasses } from './RailCard';

// A balance's rail card (K36, OQ-215): an account's balance, or a credit
// card's outstanding under its caption, at the month's end (mockups 20, 30,
// 34). The icon sits on a tint of its palette colour, as a category's disc
// does (K50); which icon and colour stand for which account is the caller's
// call. The amount stays plain: a balance is not money in or out. A figure
// too wide for the card (R$ 100.000 and up on a phone) is cut off with an
// ellipsis, the whole of it in the tooltip, rather than spill into the next
// card (PR #138 review).

/** The balance card's props. */
export interface BalanceRailCardProps {
  /** The account's name, or the card's "Visa •••• 1111", already formatted. */
  readonly name: string;
  /** The account type's or the card's glyph. */
  readonly icon: IconName;
  /** The disc's palette colour. */
  readonly color: PaletteToken;
  /** The balance or the outstanding, in minor units. */
  readonly amount: number;
  readonly currency: Currency;
  /** A credit card's outstanding: the amount gets the "Outstanding" caption. */
  readonly outstanding?: boolean | undefined;
}

/**
 * Renders a balance's rail card.
 *
 * @param props - The name, icon, colour, amount, currency and whether it is an outstanding.
 * @returns The card.
 */
export function BalanceRailCard({
  name, icon, color, amount, currency, outstanding = false,
}: BalanceRailCardProps) {
  const translator = useI18n();
  return (
    <div className={railCardClasses('balance')}>
      <div className="flex min-w-0 items-center gap-2 type-body-sm text-muted">
        <span
          className="grid size-6 shrink-0 place-items-center rounded-full md:size-7"
          style={discStyle(color)}
        >
          <Icon name={icon} className="size-3.5 md:size-4" />
        </span>
        <span className="truncate">{name}</span>
      </div>
      <div className="flex min-w-0 flex-col" title={formatMoney(amount, currency)}>
        {outstanding && (
          <span className="type-micro text-muted md:type-label">
            {translator.text('railCard', 'outstanding')}
          </span>
        )}
        <Amount
          amount={amount}
          currency={currency}
          className="block truncate type-heading-sm md:type-display-xs"
        />
      </div>
    </div>
  );
}
