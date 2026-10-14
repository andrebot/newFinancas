import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { rippleGeometry, useRipple, type RippleHandlers } from '../../../../src/kit/button/ripple';

// Kit utility hook (BDT: Interaction tier → unit): only the caller's handlers
// are stand-ins, and the button's box, which jsdom doesn't lay out.

/** The test button's props: whether it ripples and the caller's handlers. */
interface ProbeProps extends RippleHandlers {
  readonly active?: boolean;
}

/**
 * A bare button using the hook the way the kit buttons do.
 *
 * @param props - Whether presses ripple and the caller's handlers.
 * @returns The button with its ripple layer.
 */
function Probe({ active = true, onPointerDown, onClick }: ProbeProps) {
  const ripple = useRipple(active, { onPointerDown, onClick });
  return (
    <button type="button" onPointerDown={ripple.onPointerDown} onClick={ripple.onClick}>
      {ripple.layer}
      Salvar
    </button>
  );
}

/**
 * Lists the ripples drawn in the layer.
 *
 * @param container - The rendered test's container.
 * @returns The ripple circles.
 */
const ripplesIn = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>('.animate-ripple'),
];

/**
 * Ends an element's CSS animation. jsdom's style object has no `animation`
 * property, so React listens for the prefixed event there; browsers fire
 * the plain `animationend`, which React then uses.
 *
 * @param element - The animated element.
 */
const endAnimation = (element: HTMLElement) => {
  fireEvent(element, new Event('webkitAnimationEnd', { bubbles: true }));
};

describe('rippleGeometry', () => {
  it('centres the circle on the press and reaches the farthest corner', () => {
    // From (10, 6) on a 100 × 36 button the farthest corner is (100, 36).
    const radius = Math.hypot(90, 30);

    expect(rippleGeometry(100, 36, { x: 10, y: 6 })).toEqual({
      left: 10 - radius, top: 6 - radius, size: radius * 2,
    });
  });

  it('covers the whole button from its centre', () => {
    expect(rippleGeometry(40, 40, { x: 20, y: 20 }).size).toBeCloseTo(Math.hypot(20, 20) * 2);
  });
});

describe('useRipple', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 50, width: 80, height: 40,
    } as DOMRect);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws a decorative, self-clipping layer hidden under reduced motion', () => {
    const { container } = render(<Probe />);
    const layer = container.querySelector('[aria-hidden="true"]')!;

    expect(layer.className).toContain('overflow-hidden rounded-[inherit]');
    expect(layer.className).toContain('motion-reduce:hidden');
    expect(screen.getByRole('button', { name: 'Salvar' })).not.toBeNull();
  });

  it('ripples from where the pointer pressed and still calls the caller', () => {
    const onPointerDown = vi.fn();
    const { container } = render(<Probe onPointerDown={onPointerDown} />);

    fireEvent.pointerDown(screen.getByRole('button'), { clientX: 110, clientY: 60 });

    const expected = rippleGeometry(80, 40, { x: 10, y: 10 });
    const ripple = ripplesIn(container)[0]!;
    expect(ripple.style.left).toBe(`${expected.left}px`);
    expect(ripple.style.top).toBe(`${expected.top}px`);
    expect(ripple.style.width).toBe(`${expected.size}px`);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it('ripples from the centre on a keyboard press', () => {
    const onClick = vi.fn();
    const { container } = render(<Probe onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'), { detail: 0 });

    const expected = rippleGeometry(80, 40, { x: 40, y: 20 });
    expect(ripplesIn(container)[0]!.style.left).toBe(`${expected.left}px`);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('adds no second ripple for the click that follows a pointer press', () => {
    const { container } = render(<Probe />);
    const button = screen.getByRole('button');

    fireEvent.pointerDown(button, { clientX: 110, clientY: 60 });
    fireEvent.click(button, { detail: 1 });

    expect(ripplesIn(container)).toHaveLength(1);
  });

  it('stacks quick presses and removes each when its animation ends', () => {
    const { container } = render(<Probe />);
    const button = screen.getByRole('button');

    fireEvent.pointerDown(button);
    fireEvent.pointerDown(button);
    expect(ripplesIn(container)).toHaveLength(2);

    endAnimation(ripplesIn(container)[0]!);
    expect(ripplesIn(container)).toHaveLength(1);
  });

  it('does not ripple while inactive, but still calls the caller', () => {
    const onPointerDown = vi.fn();
    const onClick = vi.fn();
    const { container } = render(
      <Probe active={false} onPointerDown={onPointerDown} onClick={onClick} />,
    );
    const button = screen.getByRole('button');

    fireEvent.pointerDown(button);
    fireEvent.click(button, { detail: 0 });

    expect(ripplesIn(container)).toHaveLength(0);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('copes with no caller handlers', () => {
    const { container } = render(<Probe />);

    fireEvent.click(screen.getByRole('button'), { detail: 0 });

    expect(ripplesIn(container)).toHaveLength(1);
  });
});
