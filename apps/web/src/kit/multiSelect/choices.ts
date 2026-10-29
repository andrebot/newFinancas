import {
  flattenSections, toSections, type SelectEntry, type SelectOption, type SelectSection,
} from '../select/options';

// The multi-select's pure moves (K12, OQ-214): ticking a row, applying a
// preset, and what the closed box and the group headings count. A choice is
// always kept in display order, whatever order the rows were ticked in, so
// the box lists the names as the panel draws them. Disabled options (those
// with a reason) never change: no tick, preset or Clear reaches them.

/** The chosen names the closed box lists, and how many more there are. */
export interface ChosenNames {
  readonly names: readonly string[];
  readonly more: number;
}

/**
 * Lists every option of the caller's list, in display order.
 *
 * @param entries - Loose options and groups, in display order.
 * @returns Their options, one after another.
 */
export const allOptions = <Value extends string>(entries: readonly SelectEntry<Value>[]) => (
  flattenSections(toSections(entries))
);

/**
 * Keeps the chosen values in display order, dropping any no option holds.
 *
 * @param options - Every option, in display order.
 * @param chosen - The values to keep.
 * @returns The chosen values, in display order.
 */
const inDisplayOrder = <Value extends string>(
  options: readonly SelectOption<Value>[],
  chosen: ReadonlySet<Value>,
) => options.filter((option) => chosen.has(option.value)).map((option) => option.value);

/**
 * Ticks or unticks one option.
 *
 * @param entries - The caller's list.
 * @param value - The current choice.
 * @param option - The option's value.
 * @param checked - Whether it is now ticked.
 * @returns The new choice, in display order.
 */
export const toggleValue = <Value extends string>(
  entries: readonly SelectEntry<Value>[],
  value: readonly Value[],
  option: Value,
  checked: boolean,
) => {
  const chosen = new Set(value);
  if (checked) {
    chosen.add(option);
  } else {
    chosen.delete(option);
  }
  return inDisplayOrder(allOptions(entries), chosen);
};

/**
 * Applies a preset: its enabled options become the choice, while disabled
 * options keep whatever state they had. All is every value; Clear is none.
 *
 * @param entries - The caller's list.
 * @param value - The current choice.
 * @param preset - The values the preset chooses.
 * @returns The new choice, in display order.
 */
export const applyPreset = <Value extends string>(
  entries: readonly SelectEntry<Value>[],
  value: readonly Value[],
  preset: readonly Value[],
) => {
  const current = new Set(value);
  const wanted = new Set(preset);
  const options = allOptions(entries);
  const chosen = new Set(options
    .filter((option) => (option.disabledReason ? current : wanted).has(option.value))
    .map((option) => option.value));
  return inDisplayOrder(options, chosen);
};

/**
 * Lists the values of every option, for the All preset.
 *
 * @param entries - The caller's list.
 * @returns Every value, in display order.
 */
export const everyValue = <Value extends string>(entries: readonly SelectEntry<Value>[]) => (
  allOptions(entries).map((option) => option.value)
);

/**
 * Picks the chosen names the closed box lists: the first few in display
 * order, and how many are left over for "+n".
 *
 * @param entries - The caller's list.
 * @param value - The current choice.
 * @param limit - How many names to list.
 * @returns The names listed and the count left over.
 */
export const chosenNames = <Value extends string>(
  entries: readonly SelectEntry<Value>[],
  value: readonly Value[],
  limit: number,
): ChosenNames => {
  const chosen = new Set(value);
  const labels = allOptions(entries)
    .filter((option) => chosen.has(option.value))
    .map((option) => option.label);
  return { names: labels.slice(0, limit), more: Math.max(labels.length - limit, 0) };
};

/**
 * Counts how many of a section's options are chosen, for its "n/m" heading.
 *
 * @param section - The section drawn.
 * @param value - The current choice.
 * @returns The count chosen.
 */
export const countChosen = <Value extends string>(
  section: SelectSection<Value>,
  value: readonly Value[],
) => section.options.filter((option) => value.includes(option.value)).length;
