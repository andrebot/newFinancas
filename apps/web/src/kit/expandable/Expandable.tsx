import { useId, useState, type ReactNode } from 'react';
import { Icon } from '../icons/Icon';

// The kit's expandable row / accordion (K42, OQ-182): a summary that is one
// button, and under it a panel that exists only while open. The `row` surface
// is a ledger transaction (mockups 30, 34) or a holding (51): open, it is
// raised and edged in mint. The `card` surface is a bordered section that
// folds away, e.g. archived categories (41). The open state is the row's own
// unless the caller passes `expanded`, e.g. a ledger that keeps one row open.
// The kit sets the panel apart from the summary; the caller pads the rest.

/** How the expandable is drawn: a list row, or a bordered card section. */
export type ExpandableSurface = 'row' | 'card';

/** The expandable's props. */
export interface ExpandableProps {
  /** What the closed row shows, laid out by the caller; it sits in the button, so no controls. */
  readonly summary: ReactNode;
  /** The panel shown while open, padded by the caller; its actions live here. */
  readonly children: ReactNode;
  /** Defaults to `row`. */
  readonly surface?: ExpandableSurface | undefined;
  /** Makes the open state the caller's; pair it with `onExpandedChange`. */
  readonly expanded?: boolean | undefined;
  /** The starting open state when the row holds its own. Defaults to closed. */
  readonly defaultExpanded?: boolean | undefined;
  /** Reports each toggle with the state it asks for. */
  readonly onExpandedChange?: ((expanded: boolean) => void) | undefined;
}

const TRIGGER = [
  'flex w-full cursor-pointer items-center gap-3 text-left hover:bg-ink/5',
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint',
].join(' ');

const TRIGGER_PADDING: Record<ExpandableSurface, string> = {
  row: 'py-3 pl-5 pr-4',
  card: 'px-5 py-3.5 text-muted',
};

// A row's panel starts 8px lower, 20px under the summary (OQ-182); a card's
// is ruled off from its header.
const PANEL: Record<ExpandableSurface, string> = {
  row: 'pt-2',
  card: 'border-t border-line',
};

const CLOSED_CHEVRON: Record<ExpandableSurface, string> = {
  row: 'text-faint',
  card: '',
};

/**
 * Builds the classes of the expandable's outer box.
 *
 * @param surface - A list row or a bordered card.
 * @param open - Whether the panel shows.
 * @returns The box's classes.
 */
export const expandableClasses = (surface: ExpandableSurface, open: boolean) => {
  if (surface === 'card') {
    return 'overflow-hidden rounded-card border border-line';
  }
  return open ? 'border-y border-mint/30 bg-raised' : '';
};

/**
 * Builds the classes of the summary's button.
 *
 * @param surface - A list row or a bordered card.
 * @returns The button's classes.
 */
export const triggerClasses = (surface: ExpandableSurface) => (
  `${TRIGGER} ${TRIGGER_PADDING[surface]}`
);

/**
 * Builds the classes of the chevron: it turns over and goes mint while open.
 *
 * @param surface - A list row or a bordered card.
 * @param open - Whether the panel shows.
 * @returns The chevron's classes.
 */
export const chevronClasses = (surface: ExpandableSurface, open: boolean) => [
  'size-5 shrink-0 transition-transform duration-200',
  open ? 'rotate-180 text-mint' : CLOSED_CHEVRON[surface],
].filter(Boolean).join(' ');

/**
 * Holds the open state: the caller's when it passes `expanded`, the row's own
 * otherwise. Toggling always reports the asked-for state.
 *
 * @param expanded - The caller's open state, if it holds it.
 * @param defaultExpanded - The row's starting state when it holds its own.
 * @param onExpandedChange - Told of each toggle.
 * @returns Whether the panel shows, and the toggle.
 */
export function useExpanded(
  expanded: boolean | undefined,
  defaultExpanded: boolean,
  onExpandedChange?: (next: boolean) => void,
): readonly [boolean, () => void] {
  const [ownOpen, setOwnOpen] = useState(defaultExpanded);
  const open = expanded ?? ownOpen;
  const toggle = () => {
    setOwnOpen(!open);
    onExpandedChange?.(!open);
  };
  return [open, toggle];
}

/**
 * Renders the summary's button with its chevron and, while open, the panel
 * as a region named by that button.
 *
 * @param props - The summary, the panel, the surface and the open state.
 * @returns The expandable's box.
 */
export function Expandable({
  summary, children, surface = 'row', expanded, defaultExpanded = false, onExpandedChange,
}: ExpandableProps) {
  const [open, toggle] = useExpanded(expanded, defaultExpanded, onExpandedChange);
  const id = useId();
  const triggerId = `${id}-trigger`;
  const panelId = `${id}-panel`;
  return (
    <div className={expandableClasses(surface, open)}>
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={triggerClasses(surface)}
        onClick={toggle}
      >
        <div className="min-w-0 flex-1">{summary}</div>
        <Icon name="expand-more" className={chevronClasses(surface, open)} />
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className={PANEL[surface]}
        >
          {children}
        </div>
      )}
    </div>
  );
}
