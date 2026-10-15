import type { ReactNode } from 'react';

// The select's options (K11, OQ-138) and the pure work on them: splitting the
// caller's list into sections (loose options and named groups), flattening
// them for keyboard navigation, and narrowing them to a search.

/** One choice in the list. Every text is already translated. */
export interface SelectOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
  /** Before the label: a category icon, an account's colour dot. */
  readonly leading?: ReactNode | undefined;
  /** After the label: a tag such as the account's currency. */
  readonly trailing?: ReactNode | undefined;
  /** A muted second line under the label, e.g. what a role may do. */
  readonly description?: string | undefined;
  /**
   * Why the option can't be picked (e.g. "in Fun Money" for a claimed
   * category). An option is disabled exactly when it has a reason, so a
   * disabled option always says why.
   */
  readonly disabledReason?: string | undefined;
}

/** Options under a heading, e.g. a category's subcategories. */
export interface SelectGroup<Value extends string> {
  /** The heading, already translated. */
  readonly group: string;
  readonly options: readonly SelectOption<Value>[];
}

/** What the caller lists: loose options and groups, in display order. */
export type SelectEntry<Value extends string> = SelectOption<Value> | SelectGroup<Value>;

/** A run of options as drawn: under a heading, or without one. */
export interface SelectSection<Value extends string> {
  readonly label?: string | undefined;
  readonly options: readonly SelectOption<Value>[];
}

/**
 * Tells a group from a loose option.
 *
 * @param entry - One entry of the caller's list.
 * @returns Whether the entry is a group.
 */
export const isGroup = <Value extends string>(
  entry: SelectEntry<Value>,
): entry is SelectGroup<Value> => 'group' in entry;

/**
 * Adds one entry to the sections built so far: a group becomes its own
 * section; a loose option joins the unnamed section before it, or starts one.
 *
 * @param sections - The sections so far.
 * @param entry - The next entry.
 * @returns The sections with the entry added.
 */
const addEntry = <Value extends string>(
  sections: readonly SelectSection<Value>[],
  entry: SelectEntry<Value>,
): readonly SelectSection<Value>[] => {
  if (isGroup(entry)) {
    return [...sections, { label: entry.group, options: entry.options }];
  }
  const last = sections.at(-1);
  if (last && last.label === undefined) {
    return [...sections.slice(0, -1), { options: [...last.options, entry] }];
  }
  return [...sections, { options: [entry] }];
};

/**
 * Splits the caller's list into the sections drawn in the panel.
 *
 * @param entries - Loose options and groups, in display order.
 * @returns The sections, in the same order.
 */
export const toSections = <Value extends string>(entries: readonly SelectEntry<Value>[]) => (
  entries.reduce<readonly SelectSection<Value>[]>(addEntry, [])
);

/**
 * Lists every option of the sections in display order, the order the arrow
 * keys walk.
 *
 * @param sections - The sections drawn.
 * @returns Their options, one after another.
 */
export const flattenSections = <Value extends string>(
  sections: readonly SelectSection<Value>[],
) => sections.flatMap((section) => section.options);

/**
 * Finds the option holding a value, in loose options and groups alike.
 *
 * @param entries - The caller's list.
 * @param value - The value to look for; `null` when nothing is chosen.
 * @returns The option, or `undefined` when none holds the value.
 */
export const findOption = <Value extends string>(
  entries: readonly SelectEntry<Value>[],
  value: Value | null,
) => flattenSections(toSections(entries)).find((option) => option.value === value);

/**
 * Prepares a text for matching: lower case, no accents and no outer spaces,
 * so "saude" finds "Saúde".
 *
 * @param text - A label or what was typed.
 * @returns The text to compare.
 */
export const normalizeForSearch = (text: string) => (
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
);

/**
 * Narrows one section to the search: all of it when its heading matches,
 * otherwise only the options whose label does.
 *
 * @param section - The section to narrow.
 * @param query - The normalized search.
 * @returns The narrowed section.
 */
const narrowSection = <Value extends string>(
  section: SelectSection<Value>,
  query: string,
): SelectSection<Value> => {
  if (section.label !== undefined && normalizeForSearch(section.label).includes(query)) {
    return section;
  }
  return {
    ...section,
    options: section.options.filter((option) => normalizeForSearch(option.label).includes(query)),
  };
};

/**
 * Narrows the sections to what was typed in the search box, dropping the
 * sections left empty. An empty search keeps everything.
 *
 * @param sections - The sections drawn.
 * @param search - What was typed.
 * @returns The matching sections.
 */
export const filterSections = <Value extends string>(
  sections: readonly SelectSection<Value>[],
  search: string,
) => {
  const query = normalizeForSearch(search);
  if (query === '') {
    return sections;
  }
  return sections
    .map((section) => narrowSection(section, query))
    .filter((section) => section.options.length > 0);
};
