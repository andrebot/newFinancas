import {
  useCallback, useLayoutEffect, useRef, type CSSProperties, type ReactNode,
} from 'react';
import { cardRail } from '../../config/constants';
import { useI18n } from '../../utilities/I18nProvider';
import { IconButton } from '../button/IconButton';
import { SectionHeader, type SectionHeadingLevel } from '../sectionHeader/SectionHeader';
import { Skeleton } from '../skeleton/Skeleton';
import {
  fadeMask, useRailScroll, type RailDirection, type RailEdges,
} from './railScroll';

// The kit's card rail (K35, OQ-212): a titled row of fixed-width cards that
// scrolls sideways — the balances, budgets and goals of the Dashboard and
// Transactions. Cards snap to the start, clear of the left fade; the side with
// more to see fades out. From `md` up, two arrows beside the title page
// through the cards, disabled at their end and gone when every card fits;
// below it the rail is swiped. The cards' widths are theirs (K36); the rail
// only lines them up. A `wrap` rail lays them out in rows instead, wrapping
// down as they need room — no scrolling, arrows or fade (OQ-222).

/** What either layout of the rail draws. */
type RailBody = Omit<CardRailProps, 'wrap'>;

/** The card rail's props. */
export interface CardRailProps {
  /** The rail's title, already translated; it also names the scroll region and the arrows. */
  readonly title: string;
  /** Defaults to `h2`. */
  readonly as?: SectionHeadingLevel | undefined;
  /** The period the cards show, already formatted, e.g. "September/2026". */
  readonly period?: string | undefined;
  /** Shows the period's chip only from `xl` (the section header's `periodFromXl`). */
  readonly periodFromXl?: boolean | undefined;
  /** While true, placeholder cards stand in for the children. */
  readonly loading?: boolean | undefined;
  /** One placeholder card's size, e.g. `h-31 w-49` — the size of the cards it stands in for. */
  readonly placeholderClassName?: string | undefined;
  /** The cards. */
  readonly children?: ReactNode;
  /** Wraps the cards onto new rows instead of scrolling them sideways. */
  readonly wrap?: boolean | undefined;
}

/** The rail arrows' props. */
interface RailArrowsProps {
  readonly title: string;
  readonly edges: RailEdges;
  readonly onScroll: (direction: RailDirection) => void;
  /** Called when the arrows go away while one of them holds focus. */
  readonly onFocusLost: () => void;
}

// The keyboard ring sits on this unmasked frame, so the fade never thins it.
const FRAME = [
  'rounded-2xl has-[>:focus-visible]:outline-2 has-[>:focus-visible]:outline-offset-2',
  'has-[>:focus-visible]:outline-mint',
].join(' ');

// The mask's two layers: the fade over the cards, and a solid strip along the
// bottom 8px (the padding the scrollbar sits under), so the scrollbar stays sharp.
const TRACK = [
  'relative flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 outline-none',
  'motion-safe:scroll-smooth',
  '[scrollbar-width:thin] [scrollbar-color:var(--color-line)_transparent]',
  '*:shrink-0 *:snap-start',
  '[mask-image:var(--rail-fade)] [mask-repeat:no-repeat] [mask-position:top,bottom]',
  '[mask-size:100%_calc(100%-8px),100%_8px]',
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
 * Renders the two rail arrows. When the rail stops overflowing they unmount;
 * if one held focus, `onFocusLost` gets to place it before they leave the page.
 *
 * @param props - The rail's title, its edges, the scroll and the focus hand-off.
 * @returns The arrows (shown from `md` up).
 */
function RailArrows({
  title, edges, onScroll, onFocusLost,
}: RailArrowsProps) {
  const translator = useI18n();
  const groupRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLButtonElement | null>(null);
  const forwardRef = useRef<HTMLButtonElement | null>(null);

  // A layout effect, so the hand-off lands before the browser moves focus off
  // the arrow it is about to disable.
  useLayoutEffect(() => {
    handOffFocus(edges.atStart, backRef.current, forwardRef.current);
    handOffFocus(edges.atEnd, forwardRef.current, backRef.current);
  }, [edges.atStart, edges.atEnd]);

  // A layout cleanup runs while the arrows are still in the page, so it can
  // still see which of them holds focus.
  useLayoutEffect(() => {
    const group = groupRef.current;
    return () => {
      if (group?.contains(document.activeElement)) {
        onFocusLost();
      }
    };
  }, [onFocusLost]);

  return (
    <div ref={groupRef} className="hidden gap-1 md:flex">
      <IconButton
        ref={backRef}
        icon="chevron-left"
        tone="outline"
        label={translator.text('cardRail', 'scrollBack', { title })}
        disabled={edges.atStart}
        onClick={() => onScroll('back')}
      />
      <IconButton
        ref={forwardRef}
        icon="chevron-right"
        tone="outline"
        label={translator.text('cardRail', 'scrollForward', { title })}
        disabled={edges.atEnd}
        onClick={() => onScroll('forward')}
      />
    </div>
  );
}

/**
 * Renders the loading rail: placeholder cards in one status region, so
 * assistive technology hears "loading" once.
 *
 * @param props - The announcement and one placeholder's size.
 * @returns The placeholder row.
 */
function RailPlaceholder({ label, className, wrap = false }: {
  label: string;
  className?: string | undefined;
  wrap?: boolean;
}) {
  const cards = Array.from({ length: cardRail.placeholderCards }, (_, index) => index);

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={`flex gap-3 pb-2 ${wrap ? 'flex-wrap' : 'overflow-hidden'}`}
    >
      {cards.map((index) => (
        <Skeleton key={index} shape="block" className={`shrink-0 ${className ?? ''}`} />
      ))}
    </div>
  );
}

/**
 * Renders a titled row of cards that wraps onto new rows: nothing to scroll,
 * so no arrows, fade or scroll region.
 *
 * @param props - The title, heading level, period (and where it shows), loading
 *   state and the cards.
 * @returns The rail's section.
 */
function WrappingRail({
  title, as, period, periodFromXl, loading = false, placeholderClassName, children,
}: RailBody) {
  const translator = useI18n();
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <SectionHeader title={title} as={as} period={period} periodFromXl={periodFromXl} />
      {loading ? (
        <RailPlaceholder
          label={translator.text('cardRail', 'loading', { title })}
          className={placeholderClassName}
          wrap
        />
      ) : (
        <div className="flex flex-wrap gap-3">{children}</div>
      )}
    </section>
  );
}

/**
 * Renders a titled, sideways-scrolling row of cards.
 *
 * @param props - The title, heading level, period (and where it shows), loading
 *   state and the cards.
 * @returns The rail's section.
 */
function ScrollingRail({
  title, as, period, periodFromXl, loading = false, placeholderClassName, children,
}: RailBody) {
  const translator = useI18n();
  const {
    attachTrack, trackRef, edges, update, scrollPage,
  } = useRailScroll(cardRail.fadePx);
  const mask = fadeMask(edges, cardRail.fadePx);
  const focusTrack = useCallback(() => trackRef.current?.focus(), [trackRef]);
  const trackStyle = {
    // Through a variable: Tailwind writes the prefixed `-webkit-mask-image` too.
    '--rail-fade': mask,
    // A snapped card's start sits clear of the left fade.
    scrollPaddingInlineStart: cardRail.fadePx,
  } as CSSProperties;

  const arrows = !loading && mask !== undefined && (
    <RailArrows title={title} edges={edges} onScroll={scrollPage} onFocusLost={focusTrack} />
  );

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <SectionHeader
        title={title}
        as={as}
        period={period}
        periodFromXl={periodFromXl}
        actions={arrows}
      />
      {loading ? (
        <RailPlaceholder
          label={translator.text('cardRail', 'loading', { title })}
          className={placeholderClassName}
        />
      ) : (
        <div className={FRAME}>
          <div
            ref={attachTrack}
            role="region"
            aria-label={title}
            // Scrollable content must be reachable by keyboard (WCAG 2.1.1).
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            className={TRACK}
            style={trackStyle}
            onScroll={update}
          >
            {children}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Renders a titled row of cards: scrolling sideways, or wrapping onto new rows.
 *
 * @param props - The rail's props.
 * @returns The rail's section.
 */
export function CardRail({ wrap = false, ...rail }: CardRailProps) {
  // A wrapping rail has no scroll to follow, so it runs none of its hooks.
  return wrap ? <WrappingRail {...rail} /> : <ScrollingRail {...rail} />;
}
