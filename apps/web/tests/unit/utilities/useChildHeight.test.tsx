import { act, render } from '@testing-library/react';
import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import useChildHeight from '../../../src/utilities/useChildHeight';

// LayoutUtility (BDT: unit — the browser's ResizeObserver is its one sink,
// stood in for here; jsdom lays nothing out, so the height is set by hand).

/** The resize callbacks observed, the latest last. */
let observed: (() => void)[] = [];
const disconnect = vi.fn();

/**
 * Stands in for the browser's ResizeObserver, keeping its callback.
 *
 * @param callback - What a resize calls.
 * @returns The observer.
 */
function FakeObserver(callback: () => void) {
  observed.push(callback);
  return { observe: vi.fn(), unobserve: vi.fn(), disconnect };
}

vi.stubGlobal('ResizeObserver', vi.fn(FakeObserver));

afterEach(() => {
  observed = [];
  disconnect.mockClear();
});

/**
 * Renders a container, with the measured child or without, and the height read.
 *
 * @param props - Whether the child is there.
 * @returns The container.
 */
function Probe({ withChild }: { readonly withChild: boolean }) {
  const [ref, height] = useChildHeight('[data-region="bar"]');
  return (
    <div ref={ref}>
      {withChild && <div data-region="bar" />}
      <output>{height}</output>
    </div>
  );
}

/**
 * Gives the measured child a height, as layout would.
 *
 * @param container - The rendered container.
 * @param height - Its new height.
 */
const resize = (container: HTMLElement, height: number) => {
  const child = container.querySelector('[data-region="bar"]') as HTMLElement;
  Object.defineProperty(child, 'offsetHeight', { configurable: true, value: height });
};

describe('useChildHeight', () => {
  it('reads the child’s height and follows its resizes', () => {
    const { container, unmount } = render(<Probe withChild />);
    expect(container.querySelector('output')?.textContent).toBe('0');
    resize(container, 132);
    act(() => observed.at(-1)?.());
    expect(container.querySelector('output')?.textContent).toBe('132');
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('reads 0 when there is no such child', () => {
    const { container } = render(<Probe withChild={false} />);
    expect(container.querySelector('output')?.textContent).toBe('0');
    expect(observed).toEqual([]);
  });
});
