import {
  useId, useRef, type ReactNode,
} from 'react';
import { drawer } from '../../config/constants';
import { useI18n } from '../../utilities/I18nProvider';
import { CloseButton, focusFirstField, Modal } from '../modal/Modal';
import { LAYERS } from '../popover/overlay';

// The kit's drawer (K20, OQ-191): the right-side panel every focused form
// opens in — Record, Filter, Edit, Add Budget / Goal, Value history (mockups
// 31–33, 40, 52). From `md` up it docks right, 520px wide, under the 64px
// header, over a scrim; below `md` it is a full-screen sheet. It is a modal
// dialog: focus stays inside and the page behind doesn't scroll. Esc, a click
// on the scrim or the ✕ ask the caller to close it, so a caller with a save
// out can ignore them. It slides in and out (the panel) and fades (the
// scrim), unless the device asks for less motion. The modal wiring is the
// shell it shares with the dialog (K21, `kit/modal/Modal`, OQ-241).

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
  /** Its width from `md` up: 520px, or 640px for a form with a wide row (a card number). */
  readonly size?: DrawerSize | undefined;
}

/** The drawer's width from `md` up; below it, every drawer is a full-screen sheet. */
export type DrawerSize = 'default' | 'wide';

/** The panel's width per size, from `md` up. */
export const DRAWER_WIDTHS: Record<DrawerSize, string> = {
  default: 'md:w-[520px]',
  wide: 'md:w-[640px]',
};

/**
 * The scrim, fading in and out; from `md` up it starts under the 64px header.
 * Floating UI's overlay sets `top: 0` inline, so the class needs `!` to win.
 */
export const SCRIM = [
  `${LAYERS.scrim} bg-scrim transition-opacity ease-out motion-reduce:transition-none md:top-16!`,
  'data-[status=initial]:opacity-0 data-[status=close]:opacity-0',
].join(' ');

/** The panel: a full-screen sheet rising below `md`, the right-hand drawer from it. */
export const PANEL = [
  `fixed inset-0 ${LAYERS.drawer} flex flex-col bg-card outline-none`,
  'transition-transform ease-out motion-reduce:transition-none',
  'data-[status=initial]:translate-y-full data-[status=close]:translate-y-full',
  'md:top-16 md:left-auto md:border-l md:border-line',
  'md:data-[status=initial]:translate-x-full md:data-[status=initial]:translate-y-0',
  'md:data-[status=close]:translate-x-full md:data-[status=close]:translate-y-0',
].join(' ');

const CAPTION = 'type-caption font-semibold tracking-wider text-muted uppercase';

/**
 * Renders the drawer while it is open, and while it slides out.
 *
 * @param props - The open state, the close request, the heading, the body, the footer and the size.
 * @returns The scrim and panel in a portal, or nothing while closed.
 */
export function Drawer({
  open, onClose, title, caption, children, footer, size = 'default',
}: DrawerProps) {
  const translator = useI18n();
  const titleId = useId();
  const firstField = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const surface = {
    scrim: SCRIM,
    panel: `${PANEL} ${DRAWER_WIDTHS[size]}`,
    transitionMs: drawer.transitionMs,
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      initialFocus={firstField}
      surface={surface}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-5">
        <div className="min-w-0">
          {caption && <div className={CAPTION}>{caption}</div>}
          <h2 id={titleId} className="truncate type-heading-md">{title}</h2>
        </div>
        <CloseButton
          buttonRef={closeButton}
          label={translator.text('drawer', 'close')}
          onClick={onClose}
        />
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
    </Modal>
  );
}
