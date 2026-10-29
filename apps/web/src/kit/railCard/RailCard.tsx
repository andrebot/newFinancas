import type { ReactNode } from 'react';
import type { Currency } from '@financas/api-types';
import { useI18n } from '../../utilities/I18nProvider';
import useFormatter from '../../utilities/useFormatter';
import { Amount } from '../amount/Amount';
import { Icon, type IconName } from '../icons/Icon';
import { ProgressRing, type RingTone } from '../progressRing/ProgressRing';

// The rail cards' shared parts (K36, OQ-215): the surface every card on a
// card rail (K35) sits on, at the mockups' fixed widths — narrower on a
// phone (mockup 34) — and the ring card a budget and a goal both draw: the
// ring, the name, "spent / target" and a status line. The rail lines the
// cards up; the cards only display.

/** Which card the surface is for: a balance or a ring card. */
export type RailCardKind = 'balance' | 'ring';

/** The status line's look: muted, mint (a goal reached) or coral (over budget). */
export type StatusTone = 'muted' | 'mint' | 'coral';

const KINDS: Record<RailCardKind, string> = {
  balance: 'flex w-37.5 flex-col gap-2 px-3.5 py-3 md:w-49 md:gap-3 md:p-4',
  ring: 'flex w-57.5 items-center gap-3 px-3.5 py-3 md:w-68 md:gap-3.5 md:px-4 md:py-3.5',
};

const STATUS_TONES: Record<StatusTone, string> = {
  muted: 'text-muted',
  mint: 'font-medium text-mint',
  coral: 'font-medium text-coral',
};

/**
 * Builds the classes of a rail card's surface.
 *
 * @param kind - A balance or a ring card; it sets the width and layout.
 * @param alert - Whether the card is ringed in coral (a budget over its limit).
 * @returns The surface's classes.
 */
export const railCardClasses = (kind: RailCardKind, alert = false) => [
  'rounded-card border border-line bg-card',
  KINDS[kind],
  alert && 'ring-1 ring-coral/50',
].filter(Boolean).join(' ');

/** The status line's props. */
export interface StatusLineProps {
  readonly children: ReactNode;
  /** Defaults to `muted`. */
  readonly tone?: StatusTone | undefined;
  /** A decorative glyph before the text; the text carries the meaning. */
  readonly icon?: IconName | undefined;
  /** Extra classes, e.g. `italic`. */
  readonly className?: string | undefined;
}

/**
 * Renders a ring card's last line: what is left, over or to go.
 *
 * @param props - The text, its tone, an optional icon and extra classes.
 * @returns The line.
 */
export function StatusLine({
  children, tone = 'muted', icon, className,
}: StatusLineProps) {
  return (
    <div
      className={[
        'inline-flex items-center gap-1 type-caption tabular-nums',
        STATUS_TONES[tone],
        className,
      ].filter(Boolean).join(' ')}
    >
      {icon && <Icon name={icon} className="size-3.25 shrink-0" />}
      <span className="truncate">{children}</span>
    </div>
  );
}

/** The "so far / target" line's props. */
export interface ProgressFiguresProps {
  /** Spent or funded so far, in minor units. */
  readonly amount: number;
  /** The target, in minor units. */
  readonly target: number;
  readonly currency: Currency;
}

/**
 * Renders "so far / target", the target muted, in tabular figures.
 *
 * @param props - The amount so far, the target and their currency.
 * @returns The line.
 */
export function ProgressFigures({ amount, target, currency }: ProgressFiguresProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  return (
    <div className="truncate type-caption md:type-body-sm">
      <Amount amount={amount} currency={currency} />
      {' '}
      <span className="text-muted tabular-nums">
        {translator.text('railCard', 'of', { amount: formatter.money(target, currency) })}
      </span>
    </div>
  );
}

/** The ring card's props. */
export interface RingRailCardProps {
  /** The budget's or goal's name; it also names the ring. */
  readonly name: string;
  /** The percent the ring fills to; the fill is held to 100. */
  readonly percent: number;
  readonly tone: RingTone;
  /** Ringed in coral, for a budget over its limit. */
  readonly alert?: boolean | undefined;
  /** The lines under the name: the figures and the status. */
  readonly children: ReactNode;
}

/**
 * Renders a ring card: the ring with its percent, then the name and the
 * caller's lines beside it.
 *
 * @param props - The name, the percent, the tone, the alert and the lines.
 * @returns The card.
 */
export function RingRailCard({
  name, percent, tone, alert = false, children,
}: RingRailCardProps) {
  const formatter = useFormatter();
  return (
    <div className={railCardClasses('ring', alert)}>
      <ProgressRing
        value={percent}
        label={formatter.percent(percent)}
        tone={tone}
        ariaLabel={name}
      />
      <div className="flex min-w-0 flex-col">
        <div className="truncate type-body font-semibold md:type-body-lg">{name}</div>
        {children}
      </div>
    </div>
  );
}
