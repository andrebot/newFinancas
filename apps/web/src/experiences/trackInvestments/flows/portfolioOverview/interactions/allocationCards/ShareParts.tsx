import type { Currency } from '@financas/api-types';
import { useI18n } from '../../../../../../utilities/I18nProvider';
import { categoryColor } from '../../../../../../utilities/theme';
import useFormatter from '../../../../../../utilities/useFormatter';
import { shareTone, type Share } from '../../portfolioOverview';

// The pieces the allocation panels draw a currency's shares with (FL18,
// mockup 50; OQ-233): a donut, a stacked bar and the legend that carries every
// figure. The donut and the bar are decoration — hidden from assistive tech —
// so the legend is what a screen reader hears, and the donut's total is read
// from a hidden line (review round 1). Colours follow each share's
// place, largest first, and the theme.

/** The donut's radius in its 36-unit box: its circumference is 100, so a percent is a length. */
const RADIUS = 100 / (2 * Math.PI);

/**
 * Draws a currency's shares as a donut, its total in the middle.
 *
 * @param props - The shares, their total, its currency and the middle's caption.
 * @returns The donut.
 */
export function Donut({
  shares, total, currency, caption,
}: {
  readonly shares: readonly Share[];
  readonly total: number;
  readonly currency: Currency;
  readonly caption: string;
}) {
  const translator = useI18n();
  const formatter = useFormatter();
  // Each share's arc, and where it starts: the shares before it, in percent of the whole.
  const arcs = shares.map((share, index) => ({
    share,
    start: (shares.slice(0, index).reduce((sum, before) => sum + before.amount, 0) / total) * 100,
  }));
  return (
    <div className="relative size-28 shrink-0">
      <span className="sr-only">
        {translator.text('allocationCards', 'total', {
          currency, amount: formatter.money(total, currency),
        })}
      </span>
      <div aria-hidden="true">
        <svg viewBox="0 0 36 36" className="size-full -rotate-90">
          <circle cx="18" cy="18" r={RADIUS} fill="none" stroke="var(--c-track)" strokeWidth="5" />
          {arcs.map(({ share, start }, index) => (
            <circle
              key={share.key}
              cx="18"
              cy="18"
              r={RADIUS}
              fill="none"
              stroke={categoryColor(shareTone(index))}
              strokeWidth="5"
              strokeDasharray={`${(share.amount / total) * 100} 100`}
              strokeDashoffset={-start}
            />
          ))}
        </svg>
      </div>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        aria-hidden="true"
      >
        <span className="type-micro uppercase text-muted">{caption}</span>
        <span className="type-caption font-bold text-ink tabular-nums">
          {formatter.money(total, currency, { compact: true })}
        </span>
      </div>
    </div>
  );
}

/**
 * Draws a currency's shares as one stacked bar.
 *
 * @param props - The shares and their total.
 * @returns The bar.
 */
export function ShareBar({ shares, total }: {
  readonly shares: readonly Share[];
  readonly total: number;
}) {
  return (
    <div className="flex h-2 gap-px overflow-hidden rounded-full bg-track" aria-hidden="true">
      {shares.map((share, index) => (
        <span
          key={share.key}
          className="h-full"
          style={{
            width: `${(share.amount / total) * 100}%`,
            background: categoryColor(shareTone(index)),
          }}
        />
      ))}
    </div>
  );
}

/**
 * Lists a currency's shares: colour, name, percent and amount.
 *
 * @param props - The shares, their currency and whether to leave out the percent.
 * @returns The legend.
 */
export function ShareLegend({ shares, currency, percent = true }: {
  readonly shares: readonly Share[];
  readonly currency: Currency;
  readonly percent?: boolean | undefined;
}) {
  const formatter = useFormatter();
  return (
    <ul className="flex w-full min-w-0 flex-1 flex-col gap-1.5">
      {shares.map((share, index) => (
        <li key={share.key} className="flex items-center gap-2 type-caption">
          <span
            className="size-2.5 shrink-0 rounded-sm"
            style={{ background: categoryColor(shareTone(index)) }}
          />
          <span className="min-w-0 flex-1 truncate font-semibold text-ink">{share.label}</span>
          <span className="shrink-0 text-muted tabular-nums">
            {percent
              ? `${formatter.percent(share.percent)} · ${formatter.money(share.amount, currency)}`
              : formatter.money(share.amount, currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}
