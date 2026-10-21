import {
  autoUpdate,
  FloatingFocusManager,
  FloatingPortal,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
  type Placement,
} from '@floating-ui/react';
import { useState, type ReactNode } from 'react';
import { OVERLAY_SURFACE, overlayMiddleware } from './overlay';

// The kit's popover (K22, OQ-131): a panel that opens from a button and
// floats over the page — the notification inbox. It is a non-modal dialog:
// a click on the trigger toggles it; Esc, a click outside or tabbing away
// closes it and focus goes back to the trigger. It renders in a portal, so a
// card or drawer with hidden overflow never clips it.

/** What the trigger must spread on its button: the ref and the ARIA / click props. */
export type PopoverTriggerProps = Record<string, unknown> & {
  readonly ref: (node: Element | null) => void;
};

/** The popover's props. */
export interface PopoverProps {
  /** Draws the button that opens the panel, spreading the props it gets. */
  readonly trigger: (props: PopoverTriggerProps) => ReactNode;
  /** The panel's accessible name, already translated. */
  readonly label: string;
  /** The panel's content; a function gets `close` (e.g. after a navigation). */
  readonly children: ReactNode | ((close: () => void) => ReactNode);
  /** Where the panel sits relative to the trigger; it flips when out of room. */
  readonly placement?: Placement | undefined;
  /** The panel's width in px; the viewport still caps it. Content width when absent. */
  readonly width?: number | undefined;
  /** Told whenever the panel opens or closes (e.g. to mark notifications seen). */
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
}

/**
 * Renders the panel's content, handing `close` to a content function.
 *
 * @param children - The content, or a function that builds it.
 * @param close - Closes the panel.
 * @returns The content to render.
 */
export const renderContent = (
  children: PopoverProps['children'],
  close: () => void,
) => (typeof children === 'function' ? children(close) : children);

/**
 * Renders a trigger and, while open, its floating panel. The open state
 * lives here; `onOpenChange` reports each change to the caller.
 *
 * @param props - The trigger, label, content, placement, width and change handler.
 * @returns The trigger, plus the panel in a portal while open.
 */
export function Popover({
  trigger, label, children, placement = 'bottom-end', width, onOpenChange,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const changeOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };
  const {
    refs: { setReference, setFloating }, floatingStyles, context,
  } = useFloating({
    open,
    onOpenChange: changeOpen,
    placement,
    middleware: overlayMiddleware(),
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ]);

  return (
    <>
      {trigger({ ref: setReference, ...getReferenceProps() })}
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={setFloating}
              aria-label={label}
              className={OVERLAY_SURFACE}
              style={{ ...floatingStyles, width }}
              {...getFloatingProps()}
            >
              {renderContent(children, () => changeOpen(false))}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
