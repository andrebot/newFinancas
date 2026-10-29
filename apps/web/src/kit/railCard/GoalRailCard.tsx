import type { Currency } from '@financas/api-types';
import { useI18n } from '../../utilities/I18nProvider';
import useFormatter from '../../utilities/useFormatter';
import { ProgressFigures, RingRailCard, StatusLine } from './RailCard';
import { goalStatus, type GoalStatus } from './railCard';

// A goal's rail card (K36, OQ-215): its sky ring, name, "funded / target" in
// the goal's own currency and what is to go (mockups 20, 30, 34). A goal
// reached says so in mint; one no Holding funds reads "Not funded yet"
// (muted, not the mockups' faint — OQ-210); one other currencies fund too
// notes that they need a rate in place of "to go", which can't be told
// without them — the rate itself stays on the Goals page (OQ-201, FR-9). The
// caller passes `ownFundingOf(goal)` (experiences/goalFunding.ts), so the
// card reads as the Goals page does.

/** The goal card's props. */
export interface GoalRailCardProps {
  readonly name: string;
  /** What funds it in its own currency, in minor units. */
  readonly funded: number;
  /** Its target, in minor units. */
  readonly target: number;
  /** The goal's own currency. */
  readonly currency: Currency;
  /** No Holding funds it at all; funding still worth 0 is not unfunded. */
  readonly unfunded?: boolean | undefined;
  /** Holdings in other currencies fund it too, left out of `funded`. */
  readonly needsRate?: boolean | undefined;
}

/** The status line's props: the goal's state and what it reads from. */
interface GoalLineProps {
  readonly status: GoalStatus;
  readonly currency: Currency;
  readonly needsRate: boolean;
}

/**
 * Renders a goal card's last line: reached, the rate note, or what is to go.
 *
 * @param props - The goal's state, its currency and whether it needs a rate.
 * @returns The line.
 */
function GoalLine({ status, currency, needsRate }: GoalLineProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  if (status.reached) {
    return (
      <StatusLine tone="mint" icon="check-circle-outline">
        {translator.text('railCard', 'goal.reached')}
      </StatusLine>
    );
  }
  if (needsRate) {
    return (
      <StatusLine icon="info-outline">{translator.text('railCard', 'goal.needsRate')}</StatusLine>
    );
  }
  return (
    <StatusLine>
      {translator.text('railCard', 'goal.toGo', { amount: formatter.money(status.toGo, currency) })}
    </StatusLine>
  );
}

/**
 * Renders a goal's rail card.
 *
 * @param props - The name, what funds it and its target, their currency and the two flags.
 * @returns The card.
 */
export function GoalRailCard({
  name, funded, target, currency, unfunded = false, needsRate = false,
}: GoalRailCardProps) {
  const translator = useI18n();
  const status = goalStatus(funded, target);

  return (
    <RingRailCard name={name} percent={status.percent} tone="sky">
      {unfunded ? (
        <div className="type-caption text-muted italic md:type-body-sm">
          {translator.text('railCard', 'goal.unfunded')}
        </div>
      ) : (
        <>
          <ProgressFigures amount={funded} target={target} currency={currency} />
          <GoalLine status={status} currency={currency} needsRate={needsRate} />
        </>
      )}
    </RingRailCard>
  );
}
