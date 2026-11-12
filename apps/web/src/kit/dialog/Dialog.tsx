import { useId, useRef, type ReactNode } from 'react';
import { dialog } from '../../config/constants';
import { useI18n } from '../../utilities/I18nProvider';
import { Icon, type IconName } from '../icons/Icon';
import { CloseButton, focusFirstField, Modal } from '../modal/Modal';
import { LAYERS } from '../popover/overlay';

// The kit's dialog (K21, OQ-241): a short, focused task that doesn't need a
// drawer's room — the audit-log export's date range (mockup 24). From `md` up
// it is a 440px card in the middle of the screen, over a scrim that covers
// everything, the header included; below `md` it is a full-screen sheet, as
// the drawer is. It is a modal dialog on the shell the drawer shares
// (`kit/modal/Modal`): focus stays inside, the page behind doesn't scroll,
// and Esc, a press on the scrim or the ✕ ask the caller to close it. The card
// fades and grows in (the sheet rises), unless the device asks for less motion.

/** The dialog's props. */
export interface DialogProps {
  /** Whether it is open; the caller holds it. */
  readonly open: boolean;
  /** Asked for by Esc, the scrim or the ✕. */
  readonly onClose: () => void;
  /** The heading, already translated, e.g. "Export audit log"; it names the dialog. */
  readonly title: string;
  /** The small line under the title, already translated, e.g. "The Doe Household · CSV". */
  readonly subtitle?: string | undefined;
  /** The glyph in the mint badge beside the title, e.g. `download`. */
  readonly icon?: IconName | undefined;
  /** The body, usually a few fields and a note. */
  readonly children: ReactNode;
  /** The actions row, e.g. Cancel / Download CSV. */
  readonly footer?: ReactNode;
}

/** The scrim, over the whole viewport, fading in and out. */
export const SCRIM = [
  `${LAYERS.scrim} bg-scrim transition-opacity ease-out motion-reduce:transition-none`,
  'data-[status=initial]:opacity-0 data-[status=close]:opacity-0',
].join(' ');

/** The panel: a full-screen sheet rising below `md`, the centred card growing in from it. */
export const PANEL = [
  `fixed inset-0 ${LAYERS.drawer} flex flex-col gap-5 bg-card p-6 outline-none`,
  'transition-[translate,scale,opacity] ease-out motion-reduce:transition-none',
  'data-[status=initial]:translate-y-full data-[status=close]:translate-y-full',
  'md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[calc(100dvh-4rem)] md:w-[440px]',
  'md:-translate-x-1/2 md:-translate-y-1/2',
  'md:rounded-[24px] md:border md:border-line md:shadow-dialog',
  'md:data-[status=initial]:-translate-y-1/2 md:data-[status=initial]:scale-95',
  'md:data-[status=initial]:opacity-0',
  'md:data-[status=close]:-translate-y-1/2 md:data-[status=close]:scale-95',
  'md:data-[status=close]:opacity-0',
].join(' ');

const BADGE = 'flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint/15 text-mint';

/**
 * Renders the dialog while it is open, and while it goes out.
 *
 * @param props - The open state, the close request, the heading, the badge, the body and
 *   the footer.
 * @returns The scrim and panel in a portal, or nothing while closed.
 */
export function Dialog({
  open, onClose, title, subtitle, icon, children, footer,
}: DialogProps) {
  const translator = useI18n();
  const titleId = useId();
  const firstField = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const surface = { scrim: SCRIM, panel: PANEL, transitionMs: dialog.transitionMs };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      initialFocus={firstField}
      surface={surface}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon && <span className={BADGE}><Icon name={icon} className="size-5" /></span>}
          <div className="min-w-0">
            <h2 id={titleId} className="truncate type-heading-sm">{title}</h2>
            {subtitle && <div className="truncate type-caption text-muted">{subtitle}</div>}
          </div>
        </div>
        <CloseButton
          buttonRef={closeButton}
          label={translator.text('dialog', 'close')}
          onClick={onClose}
        />
      </div>
      <div
        ref={focusFirstField(firstField, closeButton)}
        className="min-h-0 flex-1 overflow-y-auto md:flex-initial"
      >
        {children}
      </div>
      {footer && <div className="flex items-center justify-end gap-2">{footer}</div>}
    </Modal>
  );
}
