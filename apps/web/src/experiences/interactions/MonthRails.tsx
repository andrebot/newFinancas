import type { GoalWithProgress, MonthOverviewReport } from '@financas/api-types';
import type { ReactNode } from 'react';
import { CardRail } from '../../kit/cardRail/CardRail';
import { BalanceRailCard } from '../../kit/railCard/BalanceRailCard';
import { BudgetRailCard } from '../../kit/railCard/BudgetRailCard';
import { GoalRailCard } from '../../kit/railCard/GoalRailCard';
import { RAIL_CARD_PLACEHOLDERS } from '../../kit/railCard/railCard';
import type { Period } from '../../kit/periodBar/periodBar';
import { useI18n } from '../../utilities/I18nProvider';
import type { Formatter } from '../../utilities/formatting';
import type { Translator } from '../../utilities/i18n';
import type { BalanceCard } from '../balanceCards';
import { ownFundingOf } from '../goalFunding';

// A month's Balance, Budget and Goal rails (FL17, mockups 20, 30, 34;
// OQ-201, OQ-221), shared by every page that shows them: Manage Finances'
// Month Overview and the Dashboard. Each rail is titled with the month it
// shows; a balance is an account's or a card's outstanding at the month's
// end, the budgets come over-budget first (the report's order), and a Goal
// shows what funds it in its own currency — a note when others fund it too.
// A rail with nothing to show keeps its title and says so in one line, so
// the column keeps its shape from month to month. On a phone the period
// chips are left out: the period bar above names the month (mockup 34).
// Display only.

/** A budget's month, as the report sends it. */
export type MonthBudget = MonthOverviewReport['budgets'][number];

/** What the rails show once the month has loaded. */
export interface MonthRailsContent {
  readonly balances: readonly BalanceCard[];
  readonly budgets: readonly MonthBudget[];
  readonly goals: readonly GoalWithProgress[];
}

/** The rails' props. */
export interface MonthRailsProps {
  /** The month shown, already formatted, e.g. "September/2026". */
  readonly period: string;
  /** The month's cards; until then, placeholder cards. */
  readonly content: MonthRailsContent | undefined;
}

/**
 * Writes a month the way the rails' period chip and the period bar name it:
 * "September/2026" · "setembro/2026".
 *
 * @param translator - The texts.
 * @param formatter - The interface language's formats, for the month's name.
 * @param period - The month.
 * @returns The label.
 */
export const periodLabelOf = (translator: Translator, formatter: Formatter, period: Period) => (
  translator.text('monthRails', 'period', {
    month: formatter.date(
      `${period.year}-${String(period.month).padStart(2, '0')}-01`,
      'monthLong',
    ),
    year: String(period.year),
  })
);

/**
 * Renders an empty rail's one line.
 *
 * @param props - The line, already translated.
 * @returns The line.
 */
function EmptyNote({ children }: { readonly children: ReactNode }) {
  return <p className="py-2 type-body-sm text-muted">{children}</p>;
}

/**
 * Renders the cards, or the empty rail's line when there are none.
 *
 * @param cards - The cards.
 * @param empty - The empty rail's line, already translated.
 * @returns The rail's children.
 */
const cardsOr = (cards: readonly ReactNode[], empty: string) => (
  cards.length > 0 ? cards : <EmptyNote>{empty}</EmptyNote>
);

/**
 * Renders the month's three rails.
 *
 * @param props - The month's label and its cards.
 * @returns The rails.
 */
export function MonthRails({ period, content }: MonthRailsProps) {
  const translator = useI18n();
  const loading = content === undefined;
  return (
    <>
      <CardRail
        title={translator.text('monthRails', 'balances')}
        period={period}
        periodFromXl
        loading={loading}
        placeholderClassName={RAIL_CARD_PLACEHOLDERS.balance}
      >
        {content && cardsOr(content.balances.map((card) => (
          <BalanceRailCard
            key={card.key}
            name={card.name}
            icon={card.icon}
            color={card.color}
            amount={card.amount}
            currency={card.currency}
            outstanding={card.outstanding}
          />
        )), translator.text('monthRails', 'balances.empty'))}
      </CardRail>
      <CardRail
        title={translator.text('monthRails', 'budgets')}
        period={period}
        periodFromXl
        loading={loading}
        placeholderClassName={RAIL_CARD_PLACEHOLDERS.ring}
      >
        {content && cardsOr(content.budgets.map((budget) => (
          <BudgetRailCard
            key={budget.budgetId}
            name={budget.name}
            spend={budget.spendAmount}
            target={budget.targetAmount}
            currency={budget.currency}
          />
        )), translator.text('monthRails', 'budgets.empty'))}
      </CardRail>
      <CardRail
        title={translator.text('monthRails', 'goals')}
        period={period}
        periodFromXl
        loading={loading}
        placeholderClassName={RAIL_CARD_PLACEHOLDERS.ring}
      >
        {content && cardsOr(content.goals.map((goal) => (
          <GoalRailCard
            key={goal.id}
            name={goal.name}
            target={goal.targetAmount}
            currency={goal.targetCurrency}
            {...ownFundingOf(goal)}
          />
        )), translator.text('monthRails', 'goals.empty'))}
      </CardRail>
    </>
  );
}
