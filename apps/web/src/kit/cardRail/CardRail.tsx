import {
  useLayoutEffect, useRef, type CSSProperties, type ReactNode,
} from 'react';
import { cardRail } from '../../config/constants';
import { useI18n } from '../../utilities/I18nProvider';
import { IconButton } from '../button/IconButton';
import { SectionHeader, type SectionHeadingLevel } from '../sectionHeader/SectionHeader';
import { Skeleton } from '../skeleton/Skeleton';
import { fadeMask, useRailScroll } from './railScroll';

// The kit's card rail (K35, OQ-212): a titled row of fixed-width cards that
// scrolls sideways — the balances, budgets and goals of the Dashboard and
// Transactions. Cards snap to the start; the side with more to see fades out.
// From `md` up, two arrows beside the title scroll a page at a time, disabled
// at their end and gone when every card fits; below it the rail is swiped.
// The cards' widths are theirs (K36); the rail only lines them up.

/** The card rail's props. */
export interface CardRailProps {
  /** The rail's title, already translated; it also names the scroll region and the arrows. */
  readonly title: string;
  /** Defaults to `h2`. */
  readonly as?: SectionHeadingLevel | undefined;
  /** The period the cards show, already formatted, e.g. "September/2026". */
  readonly period?: string | undefined;
  /** While true, placeholder cards stand in for the children. */
  readonly loading?: boolean | undefined;
  /** One placeholder card's size, e.g. `h-31 w-49` — the size of the cards it stands in for. */
  readonly placeholderClassName?: string | undefined;
  /** The cards. */
  readonly children?: ReactNode;
}

const TRACK = [
  'flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 motion-safe:scroll-smooth',
  '[scrollbar-width:thin] [scrollbar-color:var(--color-line)_transparent]',
  '*:shrink-0 *:snap-start [mask-image:var(--rail-fade)]',
  'rounded-2xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint',
].join(' ');

/**
 * Moves focus off an arrow that has just reached its end and is being
 * disabled, onto the other arrow, so a keyboard user isn't dropped to the page.
 *
 * @param reached - Whether the arrow's end has been reached.
 * @param from - The arrow that reached its end.
 * @param to - The arrow that still scrolls.
 */
export const handOffFocus = (
  reached: boolean,
  from: HTMLButtonElement | null,
  to: HTMLButtonElement | null,
) => {
  if (reached && from !== null && from === document.activeElement) {
    to?.focus();
  }
};

/**
 * Renders the loading rail: placeholder cards in one status region, so
 * assistive technology hears "loading" once.
 *
 * @param props - The announcement and one placeholder's size.
 * @returns The placeholder row.
 */
function RailPlaceholder({ label, className }: { label: string; className?: string | undefined }) {
  const cards = Array.from({ length: cardRail.placeholderCards }, (_, index) => index);

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="flex gap-3 overflow-hidden pb-2"
    >
      {cards.map((index) => (
        <Skeleton key={index} shape="block" className={`shrink-0 ${className ?? ''}`} />
      ))}
    </div>
  );
}

/**
 * Renders a titled, sideways-scrolling row of cards.
 *
 * @param props - The title, heading level, period, loading state and the cards.
 * @returns The rail's section.
 */
export function CardRail({
  title, as, period, loading = false, placeholderClassName, children,
}: CardRailProps) {
  const translator = useI18n();
  const {
    trackRef, edges, update, scrollPage,
  } = useRailScroll();
  const backRef = useRef<HTMLButtonElement | null>(null);
  const forwardRef = useRef<HTMLButtonElement | null>(null);
  const mask = fadeMask(edges, cardRail.fadePx);
  const overflows = !loading && mask !== undefined;

  // Before the browser blurs the arrow it is about to disable.
  useLayoutEffect(() => {
    handOffFocus(edges.atStart, backRef.current, forwardRef.current);
    handOffFocus(edges.atEnd, forwardRef.current, backRef.current);
  }, [edges.atStart, edges.atEnd]);

  const arrows = overflows && (
    <div className="hidden gap-1 md:flex">
      <IconButton
        ref={backRef}
        icon="chevron-left"
        tone="outline"
        label={translator.text('cardRail', 'scrollBack', { title })}
        disabled={edges.atStart}
        onClick={() => scrollPage('back')}
      />
      <IconButton
        ref={forwardRef}
        icon="chevron-right"
        tone="outline"
        label={translator.text('cardRail', 'scrollForward', { title })}
        disabled={edges.atEnd}
        onClick={() => scrollPage('forward')}
      />
    </div>
  );

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <SectionHeader title={title} as={as} period={period} actions={arrows} />
      {loading ? (
        <RailPlaceholder
          label={translator.text('cardRail', 'loading', { title })}
          className={placeholderClassName}
        />
      ) : (
        <div
          ref={trackRef}
          role="region"
          aria-label={title}
          // Scrollable content must be reachable by keyboard (WCAG 2.1.1).
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className={TRACK}
          // Through a variable: Tailwind writes the prefixed `-webkit-mask-image` too.
          style={{ '--rail-fade': mask } as CSSProperties}
          onScroll={update}
        >
          {children}
        </div>
      )}
    </section>
  );
}
