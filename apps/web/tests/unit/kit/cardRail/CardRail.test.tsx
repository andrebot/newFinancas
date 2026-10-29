import { act, fireEvent, screen } from '@testing-library/react';
import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import { cardRail } from '../../../../src/config/constants';
import { CardRail, handOffFocus } from '../../../../src/kit/cardRail/CardRail';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit component (BDT: Interaction tier → unit): the translator and the hook
// run for real. jsdom lays nothing out, so a test sets the track's and the
// cards' geometry itself, and stands in for the browser's own `scrollTo` and
// ResizeObserver.

/** A track's geometry, as the browser would report it. */
interface Geometry {
  readonly scrollLeft: number;
  readonly clientWidth?: number;
  readonly scrollWidth?: number;
}

/**
 * Takes the rail's scroll region.
 *
 * @param name - The rail's title.
 * @returns The track.
 */
const trackNamed = (name = 'Balances') => screen.getByRole('region', { name });

/**
 * Gives the track a geometry and lets the rail read it, as a scroll does.
 *
 * @param track - The scroll region.
 * @param geometry - Where it is scrolled to, its visible and full widths.
 */
const scrollTrack = (
  track: HTMLElement,
  { scrollLeft, clientWidth = 600, scrollWidth = 1200 }: Geometry,
) => {
  Object.defineProperty(track, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(track, 'scrollWidth', { configurable: true, value: scrollWidth });
  fireEvent.scroll(track, { target: { scrollLeft } });
};

/** The stand-in cards: 272px wide with a 12px gap, a new one every 284px. */
const CARD_WIDTH = 272;
const CARD_STEP = 284;

/**
 * Places the track's cards side by side, as the browser would lay them out.
 *
 * @param track - The scroll region.
 */
const layCards = (track: HTMLElement) => {
  Array.from(track.children).forEach((card, index) => {
    Object.defineProperty(card, 'offsetLeft', { configurable: true, value: index * CARD_STEP });
    Object.defineProperty(card, 'offsetWidth', { configurable: true, value: CARD_WIDTH });
  });
};

/**
 * Replaces ResizeObserver with one the test can fire.
 *
 * @returns The observers made, each with its callback and spies.
 */
const stubResizeObserver = () => {
  const observers: {
    callback: () => void;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  /**
   * Makes an observer and records it (called with `new`, so not an arrow).
   *
   * @param callback - What a resize calls.
   * @returns The observer.
   */
  function FakeResizeObserver(callback: () => void) {
    const observer = { callback, observe: vi.fn(), disconnect: vi.fn() };
    observers.push(observer);
    return { ...observer, unobserve: vi.fn() };
  }
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  return observers;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Renders a rail of three cards.
 *
 * @param period - The rail's period chip, if any.
 * @returns The render result.
 */
const renderRail = (period?: string) => renderInLocale(
  <CardRail title="Balances" period={period}>
    <article>Main Checking</article>
    <article>Emergency Fund</article>
    <article>Itaú Conta</article>
  </CardRail>,
);

/**
 * Finds a button by its name, if it is shown.
 *
 * @param name - The button's accessible name.
 * @returns The button, or `null`.
 */
const buttonNamed = (name: string) => screen.queryByRole<HTMLButtonElement>('button', { name });

/**
 * Finds the back arrow of the Balances rail.
 *
 * @returns The arrow, or `null` while it isn't shown.
 */
const back = () => buttonNamed('Scroll Balances left');

/**
 * Finds the forward arrow of the Balances rail.
 *
 * @returns The arrow, or `null` while it isn't shown.
 */
const forward = () => buttonNamed('Scroll Balances right');

describe('CardRail', () => {
  it('shows the title, the period and the cards in a focusable region named by the title', () => {
    renderRail('September/2026');

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('BalancesSeptember/2026');
    expect(trackNamed().getAttribute('tabindex')).toBe('0');
    expect(trackNamed().textContent).toBe('Main CheckingEmergency FundItaú Conta');
  });

  it('takes an h3 when asked', () => {
    renderInLocale(<CardRail title="Goals" as="h3" />);

    expect(screen.getByRole('heading', { level: 3, name: 'Goals' })).toBeTruthy();
  });

  it('drops the arrows and the fade once every card fits', () => {
    renderRail();
    scrollTrack(trackNamed(), { scrollLeft: 300 });
    expect(forward()).not.toBeNull();

    scrollTrack(trackNamed(), { scrollLeft: 0, scrollWidth: 600 });

    expect(back()).toBeNull();
    expect(forward()).toBeNull();
    expect(trackNamed().style.getPropertyValue('--rail-fade')).toBe('');
  });

  it('offers only the forward arrow at the start, and fades the end', () => {
    renderRail();
    scrollTrack(trackNamed(), { scrollLeft: 0 });

    expect(back()?.disabled).toBe(true);
    expect(forward()?.disabled).toBe(false);
    expect(trackNamed().style.getPropertyValue('--rail-fade'))
      .toContain(`calc(100% - ${cardRail.fadePx}px)`);
  });

  it('offers both arrows in the middle', () => {
    renderRail();
    scrollTrack(trackNamed(), { scrollLeft: 300 });

    expect(back()?.disabled).toBe(false);
    expect(forward()?.disabled).toBe(false);
  });

  it('offers only the back arrow at the end', () => {
    renderRail();
    scrollTrack(trackNamed(), { scrollLeft: 600 });

    expect(back()?.disabled).toBe(false);
    expect(forward()?.disabled).toBe(true);
  });

  it('pages to a card snap position, clear of the fade, each way', () => {
    renderRail();
    const track = trackNamed();
    track.scrollTo = vi.fn();
    layCards(track);
    // The second card snapped: its start at the fade's inner edge.
    scrollTrack(track, { scrollLeft: CARD_STEP - cardRail.fadePx, scrollWidth: 840 });

    fireEvent.click(forward()!);
    fireEvent.click(back()!);

    expect(track.scrollTo).toHaveBeenNthCalledWith(1, { left: 2 * CARD_STEP - cardRail.fadePx });
    expect(track.scrollTo).toHaveBeenNthCalledWith(2, { left: -cardRail.fadePx });
  });

  it('pads the snap by the fade, so a snapped card starts clear of it', () => {
    renderRail();

    expect(trackNamed().style.scrollPaddingInlineStart).toBe(`${cardRail.fadePx}px`);
  });

  it('draws the keyboard ring on an unmasked frame around the track', () => {
    renderRail();

    expect(trackNamed().parentElement!.className).toContain('has-[>:focus-visible]:outline-mint');
    expect(trackNamed().className).toContain('outline-none');
  });

  // jsdom never blurs a disabled button, so this checks the hand-off itself,
  // not that it beats the browser's blur; that was checked in Chromium (PR #135).
  it('hands focus to the other arrow when the focused one reaches its end', () => {
    renderRail();
    const track = trackNamed();
    scrollTrack(track, { scrollLeft: 300 });

    forward()!.focus();
    scrollTrack(track, { scrollLeft: 600 });
    expect(document.activeElement).toBe(back());

    scrollTrack(track, { scrollLeft: 0 });
    expect(document.activeElement).toBe(forward());
  });

  it('keeps focus on an arrow while the rail just scrolls', () => {
    renderRail();
    const track = trackNamed();
    scrollTrack(track, { scrollLeft: 200 });

    forward()!.focus();
    scrollTrack(track, { scrollLeft: 300 });

    expect(document.activeElement).toBe(forward());
  });

  it('hands focus to the track when the arrows go while one holds it', () => {
    renderRail();
    const track = trackNamed();
    scrollTrack(track, { scrollLeft: 300 });

    forward()!.focus();
    scrollTrack(track, { scrollLeft: 0, scrollWidth: 600 });

    expect(forward()).toBeNull();
    expect(document.activeElement).toBe(track);
  });

  it('leaves focus alone when the arrows go without it', () => {
    renderRail();
    const track = trackNamed();
    scrollTrack(track, { scrollLeft: 300 });

    scrollTrack(track, { scrollLeft: 0, scrollWidth: 600 });

    expect(document.activeElement).toBe(document.body);
  });

  it('re-reads the edges when the track changes size', () => {
    const observers = stubResizeObserver();
    renderRail();
    const track = trackNamed();
    scrollTrack(track, { scrollLeft: 0 });
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 1200 });

    act(() => observers[0]!.callback());

    expect(observers[0]!.observe).toHaveBeenCalledWith(track);
    expect(forward()).toBeNull();
  });

  it('stops observing the track it observed once gone', () => {
    const observers = stubResizeObserver();
    const { unmount } = renderRail();

    unmount();

    expect(observers).toHaveLength(1);
    expect(observers[0]!.disconnect).toHaveBeenCalledOnce();
  });

  it('observes the track that replaces the placeholders', () => {
    const observers = stubResizeObserver();
    const { rerenderInLocale } = renderInLocale(<CardRail title="Balances" loading />);
    expect(observers).toHaveLength(0);

    rerenderInLocale(<CardRail title="Balances"><article>Main Checking</article></CardRail>);

    expect(observers[0]!.observe).toHaveBeenCalledWith(trackNamed());
  });

  it('stands placeholder cards in while loading, announced once, with no arrows', () => {
    renderInLocale(
      <CardRail title="Budgets" loading placeholderClassName="h-22 w-68">
        <article>Fun Money</article>
      </CardRail>,
    );
    const status = screen.getByRole('status', { name: 'Loading Budgets' });

    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.children).toHaveLength(cardRail.placeholderCards);
    expect(status.firstElementChild?.className).toMatch(/shrink-0 .*h-22 w-68/);
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByText('Fun Money')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws plain placeholders when no size is given', () => {
    renderInLocale(<CardRail title="Budgets" loading />);

    const placeholder = screen.getByRole('status').firstElementChild;
    expect(placeholder?.className).toMatch(/rounded-2xl.*shrink-0/);
  });

  it('names its parts in pt-BR', () => {
    renderInLocale(
      <CardRail title="Saldos"><article>Conta</article></CardRail>,
      'pt-BR',
    );
    scrollTrack(trackNamed('Saldos'), { scrollLeft: 300 });

    expect(buttonNamed('Rolar Saldos para a esquerda')?.disabled).toBe(false);
    expect(buttonNamed('Rolar Saldos para a direita')?.disabled).toBe(false);
  });
});

describe('handOffFocus', () => {
  /**
   * Renders two buttons to pass focus between.
   *
   * @returns The two buttons.
   */
  const twoButtons = () => {
    renderInLocale(
      <>
        <button type="button">from</button>
        <button type="button">to</button>
      </>,
    );
    return [
      screen.getByRole<HTMLButtonElement>('button', { name: 'from' }),
      screen.getByRole<HTMLButtonElement>('button', { name: 'to' }),
    ] as const;
  };

  it('moves focus when the focused arrow reaches its end', () => {
    const [from, to] = twoButtons();
    from.focus();

    handOffFocus(true, from, to);

    expect(document.activeElement).toBe(to);
  });

  it('leaves focus while the end is not reached', () => {
    const [from, to] = twoButtons();
    from.focus();

    handOffFocus(false, from, to);

    expect(document.activeElement).toBe(from);
  });

  it('leaves focus that is elsewhere', () => {
    const [from, to] = twoButtons();
    to.focus();

    handOffFocus(true, from, null);

    expect(document.activeElement).toBe(to);
  });

  it('does nothing without an arrow', () => {
    const [, to] = twoButtons();

    handOffFocus(true, null, to);

    expect(document.activeElement).not.toBe(to);
  });

  it('survives a missing target', () => {
    const [from] = twoButtons();
    from.focus();

    handOffFocus(true, from, null);

    expect(document.activeElement).toBe(from);
  });
});
