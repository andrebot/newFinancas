import {
  autoUpdate,
  FloatingPortal,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
  useRole,
  type Placement,
} from '@floating-ui/react';
import { useState, type ReactNode } from 'react';
import { tooltip } from '../../config/constants';
import { LAYERS, overlayMiddleware } from '../popover/overlay';

// The kit's tooltip (K24, OQ-160): a short line naming what a control does —
// an icon button's purpose, a disabled control's reason. It is an inverted
// chip (ink on the page's background colour) that shows after the pointer
// rests on the trigger, or at once on keyboard focus, and goes on leave,
// blur, Escape or a press. Touch never shows it. It renders in a portal, so a
// card with hidden overflow never clips it.
//
// Two ways to attach it:
// - a render function gets the props to spread on an enabled trigger (an
//   `IconButton`); `triggerProps` merges in another floating trigger's, so a
//   Menu's button can carry a tooltip too;
// - any other content is wrapped in a focusable span, for a disabled trigger
//   (which gets no pointer or focus events) or plain text.

/** What a render-function trigger spreads on its element. */
export type TooltipTriggerProps = Record<string, unknown> & {
  readonly ref: (node: Element | null) => void;
};

/** Another floating trigger's props, merged with the tooltip's. */
export type MergedTriggerProps = Record<string, unknown> & {
  readonly ref?: ((node: Element | null) => void) | undefined;
};

/** The tooltip's props. */
export interface TooltipProps {
  /** The text, already translated. */
  readonly content: string;
  /** The trigger: a render function, or content to wrap (a disabled control). */
  readonly children: ReactNode | ((props: TooltipTriggerProps) => ReactNode);
  /** Defaults to `top`; it flips when out of room. */
  readonly placement?: Placement | undefined;
  /**
   * The text repeats the trigger's own name (an icon button's `label`), so
   * assistive tech isn't told it twice: no description, the chip hidden.
   */
  readonly repeatsName?: boolean | undefined;
  /** Another floating trigger's props on the same element, e.g. a Menu's. */
  readonly triggerProps?: MergedTriggerProps | undefined;
}

const SURFACE = [
  `pointer-events-none ${LAYERS.tooltip} max-w-64 rounded-lg bg-ink px-2 py-1`,
  'type-caption font-medium text-bg shadow-overlay',
].join(' ');

// The wrapper of a disabled trigger: its shape, with the kit's keyboard ring.
const WRAPPER = [
  'inline-flex rounded-full',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint',
].join(' ');

/**
 * Renders the trigger and, while shown, the tooltip.
 *
 * @param props - The text, the trigger, the placement, the name rule and merged props.
 * @returns The trigger, plus the chip in a portal while shown.
 */
export function Tooltip({
  content, children, placement = 'top', repeatsName = false, triggerProps = {},
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const {
    refs: { setReference, setFloating }, floatingStyles, context,
  } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    middleware: overlayMiddleware(),
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { mouseOnly: true, delay: { open: tooltip.openDelayMs, close: 0 } }),
    useFocus(context, { visibleOnly: true }),
    useDismiss(context, { referencePress: true }),
    useRole(context, { role: 'tooltip', enabled: !repeatsName }),
  ]);
  const { ref: mergedRef, ...merged } = triggerProps;
  const ref = useMergeRefs([setReference, mergedRef]);
  const reference = { ref, ...getReferenceProps(merged) } as TooltipTriggerProps;

  return (
    <>
      {typeof children === 'function' ? children(reference) : (
        // A disabled control gets no events, so its wrapper takes the hover and the focus.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        <span tabIndex={0} className={WRAPPER} {...reference}>
          {children}
        </span>
      )}
      {open && (
        <FloatingPortal>
          <div
            ref={setFloating}
            className={SURFACE}
            style={floatingStyles}
            aria-hidden={repeatsName || undefined}
            {...getFloatingProps()}
          >
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
