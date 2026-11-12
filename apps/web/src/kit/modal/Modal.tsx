import {
  FloatingFocusManager, FloatingOverlay, FloatingPortal, useDismiss, useFloating,
  useInteractions, useRole, useTransitionStatus,
} from '@floating-ui/react';
import type { MutableRefObject, ReactNode, Ref } from 'react';
import { Icon } from '../icons/Icon';

// The modal shell the kit's drawer (K20) and dialog (K21) share (OQ-241):
// a portal holding a scrim and a panel, the panel a modal dialog — focus
// stays inside, the page behind doesn't scroll, Esc and a press on the scrim
// ask the caller to close it. Each caller draws its own panel (heading,
// body, footer) and its own motion; the shell only sets `data-status`
// (initial → open → close) on the scrim and the panel for them to style.

/** How a modal looks and moves: the scrim's and panel's classes, and the transition's length. */
export interface ModalSurface {
  /** The scrim's classes; the shell adds none, so the caller places and colours it. */
  readonly scrim: string;
  /** The panel's classes. */
  readonly panel: string;
  /** How long it takes to come in or go out, in ms. */
  readonly transitionMs: number;
}

/** The shell's props. */
export interface ModalProps {
  /** Whether it is open; the caller holds it. */
  readonly open: boolean;
  /** Asked for by Esc or a press on the scrim. */
  readonly onClose: () => void;
  /** The id of the heading that names the dialog. */
  readonly labelledBy: string;
  /** Where the opening focus goes. */
  readonly initialFocus: MutableRefObject<HTMLElement | null>;
  /** The scrim's and panel's look, and the transition's length. */
  readonly surface: ModalSurface;
  /** The panel's content. */
  readonly children: ReactNode;
}

/** What can take focus when a modal opens: the body's first field or control. */
const FOCUSABLE = [
  'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])',
  'button:not([disabled])', 'a[href]', '[tabindex]:not([tabindex="-1"])',
].join(', ');

const CLOSE_BUTTON = [
  'flex size-10 shrink-0 items-center justify-center rounded-full text-muted',
  'hover:bg-ink/5 hover:text-ink outline-none focus-visible:outline-2 focus-visible:outline-mint',
].join(' ');

/**
 * Builds the body's ref, which points the opening focus at its first field,
 * or at the ✕ when the body has nothing to focus.
 *
 * @param target - Where the opening focus goes.
 * @param closeButton - The ✕, the fallback.
 * @returns The callback ref for the body.
 */
export const focusFirstField = (
  target: MutableRefObject<HTMLElement | null>,
  closeButton: MutableRefObject<HTMLButtonElement | null>,
) => (body: HTMLDivElement | null) => {
  // eslint-disable-next-line no-param-reassign -- a ref is written through.
  target.current = body?.querySelector<HTMLElement>(FOCUSABLE) ?? closeButton.current;
};

/** The ✕'s props. */
export interface CloseButtonProps {
  /** Its accessible name, already translated. */
  readonly label: string;
  /** Asks the caller to close. */
  readonly onClick: () => void;
  /** Its ref, the opening focus's fallback. */
  readonly buttonRef: Ref<HTMLButtonElement>;
}

/**
 * Renders a modal's ✕.
 *
 * @param props - Its label, its click handler and its ref.
 * @returns The round icon button.
 */
export function CloseButton({ label, onClick, buttonRef }: CloseButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={CLOSE_BUTTON}
      aria-label={label}
      onClick={onClick}
    >
      <Icon name="close" className="size-[22px]" />
    </button>
  );
}

/**
 * Renders the scrim and the panel while open, and while they go out.
 *
 * @param props - The open state, the close request, the heading's id, the opening focus,
 *   the look and the content.
 * @returns The scrim and panel in a portal, or nothing while closed.
 */
export function Modal({
  open, onClose, labelledBy, initialFocus, surface, children,
}: ModalProps) {
  const { refs: { setFloating }, context } = useFloating({
    open,
    // Only `useDismiss` changes it from here, and only ever to closed.
    onOpenChange: onClose,
  });
  const { getFloatingProps } = useInteractions([
    useDismiss(context, { outsidePressEvent: 'mousedown' }),
    useRole(context, { role: 'dialog' }),
  ]);
  const { isMounted, status } = useTransitionStatus(context, { duration: surface.transitionMs });
  const timing = { transitionDuration: `${surface.transitionMs}ms` };

  if (!isMounted) {
    return null;
  }

  return (
    <FloatingPortal>
      <FloatingOverlay lockScroll className={surface.scrim} data-status={status} style={timing} />
      <FloatingFocusManager context={context} initialFocus={initialFocus}>
        <div
          ref={setFloating}
          aria-labelledby={labelledBy}
          aria-modal="true"
          className={surface.panel}
          data-status={status}
          style={timing}
          {...getFloatingProps()}
        >
          {children}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
}
