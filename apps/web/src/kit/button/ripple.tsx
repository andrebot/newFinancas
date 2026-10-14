import {
  useRef, useState, type MouseEvent, type PointerEvent,
} from 'react';

// The kit buttons' press feedback (K4, OQ-136): a circle in the button's own
// text colour that grows from where it was pressed and fades. A keyboard press
// (Enter / Space) has no pointer, so its ripple starts from the centre. The
// layer clips the ripples itself, so the button keeps no `overflow-hidden`
// that would cut its focus ring or badge, and it is hidden for users who
// prefer reduced motion.

const LAYER = 'pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] '
  + 'motion-reduce:hidden';

/** A point inside the button, in px from its top-left corner. */
export interface RipplePoint {
  readonly x: number;
  readonly y: number;
}

/** One ripple: the square its circle is drawn in, relative to the button. */
export interface Ripple {
  readonly id: number;
  readonly left: number;
  readonly top: number;
  readonly size: number;
}

/** The caller's own handlers, which the ripple's handlers still call. */
export interface RippleHandlers {
  readonly onPointerDown?: ((event: PointerEvent<HTMLButtonElement>) => void) | undefined;
  readonly onClick?: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined;
}

/**
 * Works out the square a ripple is drawn in: centred on the press and big
 * enough that its circle reaches the button's farthest corner.
 *
 * @param width - The button's width in px.
 * @param height - The button's height in px.
 * @param origin - Where it was pressed, relative to the button.
 * @returns The square's left, top and side, relative to the button.
 */
export const rippleGeometry = (width: number, height: number, origin: RipplePoint) => {
  const radius = Math.hypot(
    Math.max(origin.x, width - origin.x),
    Math.max(origin.y, height - origin.y),
  );
  return { left: origin.x - radius, top: origin.y - radius, size: radius * 2 };
};

/** The ripple layer's props. */
interface RippleLayerProps {
  readonly ripples: readonly Ripple[];
  readonly onEnd: (id: number) => void;
}

/**
 * Draws the running ripples, clipped to the button's rounded shape.
 *
 * @param props - The ripples and what to call when one finishes.
 * @returns The decorative layer.
 */
function RippleLayer({ ripples, onEnd }: RippleLayerProps) {
  return (
    <span
      aria-hidden="true"
      className={LAYER}
    >
      {ripples.map(({
        id, left, top, size,
      }) => (
        <span
          key={id}
          className="absolute animate-ripple rounded-full bg-current"
          style={{
            left, top, width: size, height: size,
          }}
          onAnimationEnd={() => onEnd(id)}
        />
      ))}
    </span>
  );
}

/**
 * Adds the ripple to a kit button: handlers that start one on each press and
 * the layer that draws them. The caller's handlers still run.
 *
 * @param active - Whether presses ripple; false while disabled or busy.
 * @param handlers - The caller's `onPointerDown` and `onClick`, if any.
 * @returns The handlers for the native button and the layer to render in it.
 */
export function useRipple(active: boolean, handlers: RippleHandlers) {
  const [ripples, setRipples] = useState<readonly Ripple[]>([]);
  const lastId = useRef(0);

  const start = (button: HTMLElement, clientPoint?: RipplePoint) => {
    const box = button.getBoundingClientRect();
    const origin = clientPoint
      ? { x: clientPoint.x - box.left, y: clientPoint.y - box.top }
      : { x: box.width / 2, y: box.height / 2 };
    lastId.current += 1;
    const ripple = { id: lastId.current, ...rippleGeometry(box.width, box.height, origin) };
    setRipples((running) => [...running, ripple]);
  };

  const remove = (id: number) => setRipples(
    (running) => running.filter((ripple) => ripple.id !== id),
  );

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (active) start(event.currentTarget, { x: event.clientX, y: event.clientY });
    handlers.onPointerDown?.(event);
  };

  // A click with no pointer behind it (`detail` 0) came from Enter or Space.
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (active && event.detail === 0) start(event.currentTarget);
    handlers.onClick?.(event);
  };

  return {
    onPointerDown,
    onClick,
    layer: <RippleLayer ripples={ripples} onEnd={remove} />,
  };
}
