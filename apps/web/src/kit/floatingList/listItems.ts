import type { KeyboardEvent } from 'react';

// What the kit's floating lists share (K11 select, K23 menu): the pure rules
// for walking and picking their rows. A row is disabled exactly when it has a
// reason, so the arrow keys, typeahead, clicks and keys all skip it the same
// way in every list.

/** The part of a row these rules read. Every text is already translated. */
export interface ListItem {
  readonly label: string;
  /** Why the row can't be picked; a row is disabled exactly when it has one. */
  readonly disabledReason?: string | undefined;
}

/**
 * Lists the texts typeahead matches against; a disabled row has none, so
 * typing never lands on it.
 *
 * @param items - The rows drawn, in display order.
 * @returns One label, or `null`, per row.
 */
export const typeaheadLabelsOf = (items: readonly ListItem[]) => (
  items.map((item) => (item.disabledReason ? null : item.label))
);

/**
 * Lists the positions, in display order, of the rows that can't be picked,
 * so the arrow keys skip them.
 *
 * @param items - The rows drawn, in display order.
 * @returns The indices of the disabled rows.
 */
export const disabledIndicesOf = (items: readonly ListItem[]) => (
  items.flatMap((item, index) => (item.disabledReason ? [index] : []))
);

/**
 * Tells whether a key picks the row the keyboard is on.
 *
 * @param event - The key pressed on a row.
 * @returns Whether it is Enter or Space.
 */
export const isPickKey = (event: KeyboardEvent) => event.key === 'Enter' || event.key === ' ';

/**
 * Builds the handlers that pick a row by click, Enter or Space; a disabled
 * row ignores them.
 *
 * @param item - The row the handlers belong to.
 * @param pick - Picks the row and closes the panel.
 * @returns The row's click and key handlers.
 */
export const pickHandlers = <Item extends ListItem>(
  item: Item,
  pick: (item: Item) => void,
) => ({
  onClick: () => {
    if (!item.disabledReason) {
      pick(item);
    }
  },
  onKeyDown: (event: KeyboardEvent) => {
    if (isPickKey(event) && !item.disabledReason) {
      event.preventDefault();
      pick(item);
    }
  },
});
