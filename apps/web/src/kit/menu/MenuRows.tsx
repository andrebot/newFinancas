import { useId } from 'react';
import { Icon } from '../icons/Icon';
import type { MenuRow, MenuRowsSection, MenuSection } from './entries';

// What the menu's floating panel draws (K23, OQ-140), from mockup 60's role
// menu: rows with an icon, a label and a muted description; the current
// choice in mint with a check; destructive commands in coral; a disabled row
// faded with its reason beside it; separators between runs. The rows hold no
// state; the Menu hands them the Floating UI props each one spreads.

/** Builds the props one row spreads, from Floating UI's `getItemProps`. */
export type RowPropsOf = (row: MenuRow) => Record<string, unknown>;

/** What the rows need to draw and wire themselves. */
interface RowsWiring {
  /** The position of the row the keyboard or pointer is on, or `null`. */
  readonly activeIndex: number | null;
  readonly itemPropsOf: RowPropsOf;
}

/**
 * Builds a row's classes: highlighted while the keyboard or pointer is on it
 * or while it is the current choice, faded with a not-allowed cursor while it
 * can't be picked.
 *
 * @param highlighted - Whether the row is active or checked.
 * @param disabled - Whether the row can't be picked.
 * @returns The row's classes.
 */
export const menuRowClasses = (highlighted: boolean, disabled: boolean) => [
  'flex items-start gap-2.5 rounded-[10px] px-2.5 py-2 text-left outline-none',
  disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
  highlighted && !disabled ? 'bg-ink/5' : '',
].filter(Boolean).join(' ');

/**
 * Picks a row's ink: mint for the current choice, coral for a destructive
 * command, otherwise the given neutral.
 *
 * @param row - The row.
 * @param neutral - The class used for any other row.
 * @returns The colour class.
 */
export const rowTone = (row: MenuRow, neutral: string) => {
  if (row.checked) {
    return 'text-mint';
  }
  return row.danger ? 'text-coral' : neutral;
};

/**
 * Builds a row's ARIA state: a radio row says whether it is checked; a
 * disabled row says so and points at its reason.
 *
 * @param row - The row.
 * @param reasonId - The id of the element holding the row's reason.
 * @returns The ARIA attributes to spread.
 */
export const rowAria = (row: MenuRow, reasonId: string) => {
  const disabled = Boolean(row.disabledReason);
  return {
    role: row.role,
    'aria-checked': row.role === 'menuitemradio' ? row.checked : undefined,
    'aria-disabled': disabled || undefined,
    'aria-describedby': disabled ? reasonId : undefined,
  };
};

/** One row's props. */
interface RowProps extends RowsWiring {
  readonly row: MenuRow;
}

/**
 * Renders the end of a row: the reason it can't be picked, or the check of
 * the current choice.
 *
 * @param props - The row and the id its reason takes.
 * @param props.row - The row.
 * @param props.reasonId - The id the reason's element takes.
 * @returns The row's end, or nothing.
 */
function RowEnd({ row, reasonId }: { readonly row: MenuRow; readonly reasonId: string }) {
  if (row.disabledReason) {
    return (
      <span id={reasonId} className="mt-0.5 shrink-0 type-caption text-muted">
        {row.disabledReason}
      </span>
    );
  }
  return row.checked ? <Icon name="check" className="size-4.5 shrink-0 text-mint" /> : null;
}

/**
 * Renders one row: its icon, label and description, then the reason it can't
 * be picked or the check of the current choice.
 *
 * @param props - The row and its wiring.
 * @returns The row.
 */
function Row({ row, activeIndex, itemPropsOf }: RowProps) {
  const reasonId = useId();
  const iconTone = rowTone(row, 'text-muted');
  const highlighted = row.index === activeIndex || row.checked;
  return (
    <div
      {...itemPropsOf(row)}
      {...rowAria(row, reasonId)}
      className={menuRowClasses(highlighted, Boolean(row.disabledReason))}
    >
      {row.icon && <Icon name={row.icon} className={`mt-0.5 size-4.5 shrink-0 ${iconTone}`} />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`type-body font-semibold ${rowTone(row, 'text-ink')}`}>{row.label}</span>
        {row.description && <span className="type-caption text-muted">{row.description}</span>}
      </span>
      <RowEnd row={row} reasonId={reasonId} />
    </div>
  );
}

/** A run of rows' props. */
interface RunProps extends RowsWiring {
  readonly section: MenuRowsSection;
}

/**
 * Renders a run of rows; a radio group sits in a `group`, named when it has a
 * label.
 *
 * @param props - The run and how its rows are wired.
 * @returns The run.
 */
function Run({ section, activeIndex, itemPropsOf }: RunProps) {
  const rows = section.rows.map((row) => (
    <Row key={row.key} row={row} activeIndex={activeIndex} itemPropsOf={itemPropsOf} />
  ));
  if (!section.radio) {
    return rows;
  }
  return (
    <div role="group" aria-label={section.label} className="flex flex-col gap-0.5">
      {rows}
    </div>
  );
}

/** The panel's content props. */
export interface MenuSectionsProps extends RowsWiring {
  readonly sections: readonly MenuSection[];
}

/**
 * Renders every section of the menu: runs of rows and the separators between
 * them.
 *
 * @param props - The sections, the active position and the wiring.
 * @returns The panel's content.
 */
export function MenuSections({ sections, activeIndex, itemPropsOf }: MenuSectionsProps) {
  return sections.map((section, position) => (
    section.kind === 'separator'
      // Sections have no id; their order is fixed while the menu is open.
      // eslint-disable-next-line react/no-array-index-key
      ? <div key={position} role="separator" className="mx-1 my-1 h-px shrink-0 bg-line" />
      : (
        <Run
          // eslint-disable-next-line react/no-array-index-key
          key={position}
          section={section}
          activeIndex={activeIndex}
          itemPropsOf={itemPropsOf}
        />
      )
  ));
}
