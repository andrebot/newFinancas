import {
  flip, offset, shift, size, type Middleware,
} from '@floating-ui/react';
import { overlay } from '../../config/constants';

// What every floating panel of the kit shares (K22, OQ-131): the popover,
// and later the menu, select, tooltip and pickers built on it. A panel sits
// a small gap from the element it opens from, moves to the other side or
// slides along when it would leave the viewport, and never grows past the
// space the viewport has left — so a 400px panel still fits a phone.

/**
 * The app's stacking order above the page, bottom to top: the shell's chrome
 * (z-20/30), the drawer's scrim and panel (K20), then what opens from
 * anywhere — even inside a drawer — the panels (select, menu, popover), the
 * tooltips and the toasts.
 */
export const LAYERS = {
  scrim: 'z-40',
  drawer: 'z-50',
  panel: 'z-60',
  tooltip: 'z-70',
  toast: 'z-80',
} as const;

/** The panel's surface classes, from the mockups' notification inbox, on the panel layer. */
export const OVERLAY_SURFACE = [
  LAYERS.panel,
  'overflow-y-auto rounded-2xl border border-line bg-raised text-ink shadow-overlay',
  'outline-none',
].join(' ');

/** The space a panel may take, as Floating UI's `size` measures it. */
export interface AvailableSpace {
  readonly availableWidth: number;
  readonly availableHeight: number;
  readonly elements: { readonly floating: HTMLElement };
}

/** The space a panel may take, plus the size of the element it opens from. */
export interface AvailableSpaceBeside extends AvailableSpace {
  readonly rects: { readonly reference: { readonly width: number } };
}

/** How a panel is sized beyond fitting the viewport. */
export interface OverlayOptions {
  /** Never narrower than the element it opens from (a select's list under its box). */
  readonly matchReferenceWidth?: boolean | undefined;
}

/**
 * Caps the panel at the space the viewport has left, so it stays on screen
 * and scrolls inside instead of overflowing it.
 *
 * @param space - The available width and height, and the panel element.
 */
export const fitToViewport = ({ availableWidth, availableHeight, elements }: AvailableSpace) => {
  Object.assign(elements.floating.style, {
    maxWidth: `${Math.max(0, availableWidth)}px`,
    maxHeight: `${Math.max(0, availableHeight)}px`,
  });
};

/**
 * Fits the panel to the viewport and makes it at least as wide as the element
 * it opens from, so a select's list lines up with its box.
 *
 * @param space - The available width and height, the panel and the reference's size.
 */
export const fitToViewportAndReference = (space: AvailableSpaceBeside) => {
  fitToViewport(space);
  Object.assign(space.elements.floating.style, { minWidth: `${space.rects.reference.width}px` });
};

/**
 * Builds the positioning steps every kit panel uses, in Floating UI's order:
 * gap, flip, shift, then fit.
 *
 * @param options - Whether the panel also matches the reference's width.
 * @returns The middleware list for `useFloating`.
 */
export const overlayMiddleware = ({ matchReferenceWidth }: OverlayOptions = {}): Middleware[] => [
  offset(overlay.offset),
  flip({ padding: overlay.viewportPadding }),
  shift({ padding: overlay.viewportPadding }),
  size({
    padding: overlay.viewportPadding,
    apply: matchReferenceWidth ? fitToViewportAndReference : fitToViewport,
  }),
];
