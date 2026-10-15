import type { IconName } from '../icons/Icon';
import type { ListItem } from '../floatingList/listItems';

// The menu's entries (K23, OQ-140) and the pure work on them. The caller
// lists actions (a row's Edit / Archive / Delete), radio groups (a member's
// role) and separators, in display order. They are turned into sections to
// draw, whose rows are numbered across the whole menu: the order the arrow
// keys walk.

/** What every menu row shows. Every text is already translated. */
export interface MenuItemLook extends ListItem {
  /** Before the label; decorative, the label names the row. */
  readonly icon?: IconName | undefined;
  /** A muted second line under the label, e.g. what a role may do. */
  readonly description?: string | undefined;
}

/** A command, e.g. "Archive". */
export interface MenuAction extends MenuItemLook {
  readonly kind: 'action';
  /** Unique within the menu. */
  readonly id: string;
  /** `danger` draws a destructive command in coral. */
  readonly tone?: 'danger' | undefined;
  /** Runs once the menu has closed. */
  readonly onSelect: () => void;
}

/** One choice of a radio group, e.g. the "Admin" role. */
export interface MenuRadioOption<Value extends string> extends MenuItemLook {
  readonly value: Value;
}

/** Choices of which exactly one is current, e.g. a member's role. */
export interface MenuRadioGroup<Value extends string> {
  readonly kind: 'radio';
  /** The group's accessible name, e.g. "Role"; none when the menu's own label says it. */
  readonly label?: string | undefined;
  /** The current choice; `null` while there is none. */
  readonly value: Value | null;
  /** Gets the picked value; the menu holds no value of its own. */
  readonly onChange: (value: Value) => void;
  readonly options: readonly MenuRadioOption<Value>[];
}

/** A line between runs of rows. */
export interface MenuSeparator {
  readonly kind: 'separator';
}

/** What the caller lists, in display order. */
export type MenuEntry<Value extends string> = MenuAction | MenuRadioGroup<Value> | MenuSeparator;

/** One row as drawn: its looks, its role and what picking it does. */
export interface MenuRow extends MenuItemLook {
  /** Unique within its section. */
  readonly key: string;
  /** Its position in the whole menu, the order the arrow keys walk. */
  readonly index: number;
  readonly role: 'menuitem' | 'menuitemradio';
  /** Whether it is the current choice; always false for an action. */
  readonly checked: boolean;
  readonly danger: boolean;
  readonly select: () => void;
}

/** A run of rows: a radio group (named or not) or a run of actions. */
export interface MenuRowsSection {
  readonly kind: 'rows';
  readonly radio: boolean;
  /** A radio group's accessible name. */
  readonly label?: string | undefined;
  readonly rows: readonly MenuRow[];
}

/** What the panel draws, in order: runs of rows and separators. */
export type MenuSection = MenuRowsSection | MenuSeparator;

/**
 * Turns an action into its row.
 *
 * @param action - The caller's action.
 * @param index - Its position in the whole menu.
 * @returns The row.
 */
export const actionRow = (action: MenuAction, index: number): MenuRow => ({
  key: action.id,
  index,
  role: 'menuitem',
  label: action.label,
  icon: action.icon,
  description: action.description,
  disabledReason: action.disabledReason,
  checked: false,
  danger: action.tone === 'danger',
  select: action.onSelect,
});

/**
 * Turns a radio group's options into rows; picking one hands its value on.
 *
 * @param group - The caller's radio group.
 * @param offset - The position, in the whole menu, of its first option.
 * @returns The rows, in the group's order.
 */
export const radioRows = <Value extends string>(
  group: MenuRadioGroup<Value>,
  offset: number,
): readonly MenuRow[] => group.options.map((option, position) => ({
  key: option.value,
  index: offset + position,
  role: 'menuitemradio',
  label: option.label,
  icon: option.icon,
  description: option.description,
  disabledReason: option.disabledReason,
  checked: option.value === group.value,
  danger: false,
  select: () => group.onChange(option.value),
}));

/**
 * Counts the rows of the sections built so far.
 *
 * @param sections - The sections so far.
 * @returns How many rows they hold.
 */
const rowCount = (sections: readonly MenuSection[]) => sections.reduce(
  (count, section) => count + (section.kind === 'rows' ? section.rows.length : 0),
  0,
);

/**
 * Adds one entry to the sections built so far: an action joins the unnamed
 * run before it, or starts one; a radio group is its own section.
 *
 * @param sections - The sections so far.
 * @param entry - The next entry.
 * @returns The sections with the entry added.
 */
const addEntry = <Value extends string>(
  sections: readonly MenuSection[],
  entry: MenuEntry<Value>,
): readonly MenuSection[] => {
  const offset = rowCount(sections);
  if (entry.kind === 'separator') {
    return [...sections, entry];
  }
  if (entry.kind === 'radio') {
    return [...sections, {
      kind: 'rows', radio: true, label: entry.label, rows: radioRows(entry, offset),
    }];
  }
  const last = sections.at(-1);
  if (last?.kind === 'rows' && !last.radio) {
    return [
      ...sections.slice(0, -1),
      { kind: 'rows', radio: false, rows: [...last.rows, actionRow(entry, offset)] },
    ];
  }
  return [...sections, { kind: 'rows', radio: false, rows: [actionRow(entry, offset)] }];
};

/**
 * Splits the caller's entries into the sections drawn in the panel.
 *
 * @param entries - Actions, radio groups and separators, in display order.
 * @returns The sections, in the same order.
 */
export const toMenuSections = <Value extends string>(entries: readonly MenuEntry<Value>[]) => (
  entries.reduce<readonly MenuSection[]>(addEntry, [])
);

/**
 * Lists every row of the sections in display order.
 *
 * @param sections - The sections drawn.
 * @returns Their rows, one after another.
 */
export const rowsOf = (sections: readonly MenuSection[]) => sections.flatMap(
  (section) => (section.kind === 'rows' ? section.rows : []),
);

/**
 * Finds the current choice, where the keyboard starts when the menu opens.
 *
 * @param rows - The rows drawn, in display order.
 * @returns Its position, or `null` when no row is checked.
 */
export const checkedIndexOf = (rows: readonly MenuRow[]) => (
  rows.find((row) => row.checked)?.index ?? null
);
