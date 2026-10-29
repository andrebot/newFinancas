import type { Currency } from '@financas/api-types';
import { useI18n } from '../../utilities/I18nProvider';
import useFormatter from '../../utilities/useFormatter';
import { ProgressFigures, RingRailCard, StatusLine } from './RailCard';
import { budgetStatus } from './railCard';

// A budget's rail card (K36, OQ-215): its ring, name, "spent / target" and
// what is left — or, once spend passes the target, "Over by" in coral with
// the card ringed in coral (mockups 20, 30, 34). The tone is the card's
// call (OQ-209): sun from `railCard.budgetNearPercent`, a budget used up
// exactly included; coral only once it is over.

/** The budget card's props. */
export interface BudgetRailCardProps {
  readonly name: string;
  /** Money out − money in across its categories that month, in minor units (OQ-201). */
  readonly spend: number;
  /** The month's target, in minor units. */
  readonly target: number;
  readonly currency: Currency;
}

/**
 * Renders a budget's rail card.
 *
 * @param props - The name, the month's spend and target, and their currency.
 * @returns The card.
 */
export function BudgetRailCard({
  name, spend, target, currency,
}: BudgetRailCardProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  const status = budgetStatus(spend, target);
  const amount = formatter.money(status.remainder, currency);

  return (
    <RingRailCard name={name} percent={status.percent} tone={status.tone} alert={status.over}>
      <ProgressFigures amount={spend} target={target} currency={currency} />
      {status.over ? (
        <StatusLine tone="coral" icon="warning-outline">
          {translator.text('railCard', 'budget.over', { amount })}
        </StatusLine>
      ) : (
        <StatusLine>{translator.text('railCard', 'budget.left', { amount })}</StatusLine>
      )}
    </RingRailCard>
  );
}
