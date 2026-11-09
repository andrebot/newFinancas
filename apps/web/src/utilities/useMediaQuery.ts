import { useCallback, useSyncExternalStore } from 'react';

// MediaQueryUtility: whether a CSS media query matches now, following the
// window as it resizes — for a layout that can't be written in CSS alone,
// e.g. a table whose columns are a prop (FL19's holdings table below `md`,
// OQ-234). No journey knowledge; the query is the caller's.

/** The window's part this reads: `matchMedia`, which an old browser or jsdom may lack. */
export type MediaWindow = Partial<Pick<Window, 'matchMedia'>>;

/**
 * Tells whether a query matches, and what to say when the window can't tell.
 *
 * @param page - The window.
 * @param query - The media query, e.g. `(min-width: 768px)`.
 * @param whenUnknown - The answer without `matchMedia`.
 * @returns Whether it matches.
 */
export const mediaMatches = (page: MediaWindow, query: string, whenUnknown: boolean) => (
  page.matchMedia ? page.matchMedia(query).matches : whenUnknown
);

/**
 * Listens for a query's changes.
 *
 * @param page - The window.
 * @param query - The media query.
 * @param onChange - Called when it starts or stops matching.
 * @returns What stops listening.
 */
export const watchMedia = (page: MediaWindow, query: string, onChange: () => void) => {
  if (!page.matchMedia) return () => undefined;
  const list = page.matchMedia(query);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
};

/**
 * Holds whether a media query matches, re-rendering when that changes.
 *
 * @param query - The media query, e.g. `(min-width: 768px)`.
 * @param whenUnknown - The answer where the window can't tell (no `matchMedia`).
 * @returns Whether it matches now.
 */
export default function useMediaQuery(query: string, whenUnknown: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => watchMedia(window, query, onChange),
    [query],
  );
  return useSyncExternalStore(subscribe, () => mediaMatches(window, query, whenUnknown));
}
