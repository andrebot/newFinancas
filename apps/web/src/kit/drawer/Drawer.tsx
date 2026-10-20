import {
  FloatingFocusManager, FloatingOverlay, FloatingPortal, useDismiss, useFloating,
  useInteractions, useRole, useTransitionStatus,
} from '@floating-ui/react';
import {
  useId, useRef, type MutableRefObject, type ReactNode,
} from 'react';
import { drawer } from '../../config/constants';
import { useI18n } from '../../utilities/I18nProvider';
import { Icon } from '../icons/Icon';

// The kit's drawer (K20, OQ-191): the right-side panel every focused form
// opens in — Record, Filter, Edit, Add Budget / Goal, Value history (mockups
// 31–33, 40, 52). From `md` up it docks right, 520px wide, under the 64px
// header, over a scrim; below `md` it is a full-screen sheet. It is a modal
// dialog: focus stays inside and the page behind doesn't scroll. Esc, a click
// on the scrim or the ✕ ask the caller to close it, so a caller with a save
// out can ignore them. It slides in and out (the panel) and fades (the
// scrim), unless the device asks for less motion.

/** The drawer's props. */
export interface DrawerProps {
  /** Whether it is open; the caller holds it. */
  readonly open: boolean;
  /** Asked for by Esc, the scrim or the ✕. */
  readonly onClose: () => void;
  /** The heading, already translated, e.g. "Main Checking"; it names the dialog. */
  readonly title: string;
  /** The small line above the title, already translated, e.g. "Edit account". */
  readonly caption?: string | undefined;
  /** The scrolling body, usually a form's fields. */
  readonly children: ReactNode;
  /** The pinned actions row, e.g. Cancel / Save. */
  readonly footer?: ReactNode;
}

/** What can take focus when the drawer opens: the body's first field or control. */
const FOCUSABLE = [
  'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])',
  'button:not([disabled])', 'a[href]', '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** The scrim, fading in and out. */
export const SCRIM = [
  'z-40 bg-scrim transition-opacity ease-out motion-reduce:transition-none md:top-16',
  'data-[status=initial]:opacity-0 data-[status=close]:opacity-0',
].join(' ');

/** The panel: a full-screen sheet rising below `md`, the right-hand drawer from it. */
export const PANEL = [
  'fixed inset-0 z-50 flex flex-col bg-card outline-none',
  'transition-transform ease-out motion-reduce:transition-none',
  'data-[status=initial]:translate-y-full data-[status=close]:translate-y-full',
  'md:top-16 md:left-auto md:w-[520px] md:border-l md:border-line',
  'md:data-[status=initial]:translate-x-full md:data-[status=initial]:translate-y-0',
  'md:data-[status=close]:translate-x-full md:data-[status=close]:translate-y-0',
].join(' ');

const CAPTION = 'type-caption font-semibold tracking-wider text-faint uppercase';

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

/**
 * Renders the drawer while it is open, and while it slides out.
 *
 * @param props - The open state, the close request, the heading, the body and the footer.
 * @returns The scrim and panel in a portal, or nothing while closed.
 */
export function Drawer({
  open, onClose, title, caption, children, footer,
}: DrawerProps) {
  const translator = useI18n();
  const titleId = useId();
  const firstField = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const { refs: { setFloating }, context } = useFloating({
    open,
    // Only `useDismiss` changes it from here, and only ever to closed.
    onOpenChange: onClose,
  });
  const { getFloatingProps } = useInteractions([
    useDismiss(context, { outsidePressEvent: 'mousedown' }),
    useRole(context, { role: 'dialog' }),
  ]);
  const { isMounted, status } = useTransitionStatus(context, { duration: drawer.transitionMs });
  const timing = { transitionDuration: `${drawer.transitionMs}ms` };

  if (!isMounted) {
    return null;
  }

  return (
    <FloatingPortal>
      <FloatingOverlay lockScroll className={SCRIM} data-status={status} style={timing} />
      <FloatingFocusManager context={context} initialFocus={firstField}>
        <div
          ref={setFloating}
          aria-labelledby={titleId}
          aria-modal="true"
          className={PANEL}
          data-status={status}
          style={timing}
          {...getFloatingProps()}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-5">
            <div className="min-w-0">
              {caption && <div className={CAPTION}>{caption}</div>}
              <h2 id={titleId} className="truncate font-display text-xl font-bold">{title}</h2>
            </div>
            <button
              ref={closeButton}
              type="button"
              className={CLOSE_BUTTON}
              aria-label={translator.text('drawer', 'close')}
              onClick={onClose}
            >
              <Icon name="close" className="size-[22px]" />
            </button>
          </div>
          <div
            ref={focusFirstField(firstField, closeButton)}
            className="flex-1 overflow-y-auto px-6 py-5"
          >
            {children}
          </div>
          {footer && (
            <div className="flex items-center justify-end gap-3 border-t border-line px-6 py-4">
              {footer}
            </div>
          )}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
}
