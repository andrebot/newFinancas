import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount everything rendered by a test so tests never share DOM state.
afterEach(cleanup);

/**
 * Stands in for ResizeObserver, which jsdom lacks (it lays nothing out, so
 * nothing ever resizes). A test that needs to drive one stubs its own.
 *
 * @returns An observer that watches nothing.
 */
function InertResizeObserver(): ResizeObserver {
  return {
    observe: () => {},
    unobserve: () => {},
    disconnect: () => {},
  };
}

globalThis.ResizeObserver ??= InertResizeObserver as unknown as typeof ResizeObserver;

/**
 * Stands in for IntersectionObserver, which jsdom lacks (nothing is ever in
 * view without layout). A test that needs to drive one stubs its own.
 *
 * @returns An observer that watches nothing.
 */
function InertIntersectionObserver(): IntersectionObserver {
  return {
    root: null,
    rootMargin: '',
    scrollMargin: '',
    thresholds: [],
    observe: () => {},
    unobserve: () => {},
    disconnect: () => {},
    takeRecords: () => [],
  };
}

globalThis.IntersectionObserver ??= (
  InertIntersectionObserver as unknown as typeof IntersectionObserver
);

// jsdom lacks element scrolling too (nothing overflows without layout); a
// test that checks where something scrolls spies on this.
Element.prototype.scrollTo ??= () => {};
