import { useId, type ReactNode, type Ref } from 'react';
import { Icon } from '../icons/Icon';
import type { SelectOption, SelectSection } from './options';

// What the select's floating panel draws (K11, OQ-138): the optional search
// box, the sections of options under their headings, and the "no results"
// line. The panel holds no state; the Select hands it the Floating UI props
// each part spreads.

/** The translated texts of the panel's search box. */
export interface SelectSearch {
  /** The search box's accessible name, e.g. "Search categories". */
  readonly label: string;
  readonly placeholder?: string | undefined;
  /** Shown when nothing matches. */
  readonly noResults: string;
}

/** Builds the props one option spreads, from Floating UI's `getItemProps`. */
export type ItemPropsOf = (
  option: SelectOption<string>,
  index: number,
) => Record<string, unknown>;

/** The search box's props. */
export interface SearchBoxProps {
  readonly search: SelectSearch;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly inputRef: Ref<HTMLInputElement>;
}

/** The list's props: what is drawn and how each option is wired. */
export interface OptionListProps {
  readonly sections: readonly SelectSection<string>[];
  /** The value currently chosen, or `null`. */
  readonly value: string | null;
  /** The position of the option the keyboard is on, or `null`. */
  readonly activeIndex: number | null;
  readonly itemPropsOf: ItemPropsOf;
}

const SEARCH_INPUT = [
  'min-w-0 flex-1 bg-transparent type-body text-ink outline-none',
  'placeholder:text-muted',
].join(' ');

const SEARCH_BOX = [
  'flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-bg px-3',
  'focus-within:border-mint',
].join(' ');

/**
 * Builds an option row's classes: highlighted while the keyboard or pointer
 * is on it, faded with a not-allowed cursor while it can't be picked.
 *
 * @param active - Whether the keyboard or pointer is on the option.
 * @param disabled - Whether the option can't be picked.
 * @returns The row's classes.
 */
export const optionClasses = (active: boolean, disabled: boolean) => [
  'flex items-center gap-3 rounded-lg px-2 py-1.5 type-body outline-none',
  disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
  active && !disabled ? 'bg-ink/5' : '',
].filter(Boolean).join(' ');

/**
 * Renders the search box at the top of the panel.
 *
 * @param props - The search texts, the current query, its change handler and the input's ref.
 * @returns The search box.
 */
export function SearchBox({
  search, query, onQueryChange, inputRef,
}: SearchBoxProps) {
  return (
    <div className={SEARCH_BOX}>
      <Icon name="search" className="size-4.5 shrink-0 text-faint" />
      <input
        ref={inputRef}
        type="search"
        aria-label={search.label}
        placeholder={search.placeholder}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className={SEARCH_INPUT}
      />
    </div>
  );
}

/**
 * Renders a slot beside an option's label, or nothing when it is empty.
 *
 * @param props - The slot's content.
 * @returns The slot, muted, with its icons sized to the text.
 */
export function OptionSlot({ children }: { readonly children: ReactNode }) {
  if (!children) {
    return null;
  }
  return <span className="flex shrink-0 items-center text-muted [&_svg]:size-4.5">{children}</span>;
}

/** One option row's props. */
interface OptionRowProps {
  readonly option: SelectOption<string>;
  readonly index: number;
  readonly selected: boolean;
  readonly active: boolean;
  readonly itemPropsOf: ItemPropsOf;
}

/**
 * Renders one option: its leading slot, label (mint while chosen) and
 * description, its trailing slot, the reason it can't be picked and the
 * check mark of the chosen one.
 *
 * @param props - The option, its position, its state and its wiring.
 * @returns The option row.
 */
function OptionRow({
  option, index, selected, active, itemPropsOf,
}: OptionRowProps) {
  const reasonId = useId();
  const disabled = Boolean(option.disabledReason);
  return (
    <div
      {...itemPropsOf(option, index)}
      aria-disabled={disabled || undefined}
      aria-describedby={disabled ? reasonId : undefined}
      className={optionClasses(active, disabled)}
    >
      <OptionSlot>{option.leading}</OptionSlot>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={selected ? 'truncate font-semibold text-mint' : 'truncate'}>
          {option.label}
        </span>
        {option.description && (
          <span className="type-caption text-muted">{option.description}</span>
        )}
      </span>
      <OptionSlot>{option.trailing}</OptionSlot>
      {disabled && (
        <span id={reasonId} className="shrink-0 type-caption text-muted">
          {option.disabledReason}
        </span>
      )}
      {selected && <Icon name="check" className="size-4.5 shrink-0 text-mint" />}
    </div>
  );
}

/** One section's props: its options and where they start in the whole list. */
interface SectionProps extends Omit<OptionListProps, 'sections'> {
  readonly section: SelectSection<string>;
  /** The position, in the whole list, of the section's first option. */
  readonly offset: number;
}

/**
 * Renders a run of options, under its heading when it has one.
 *
 * @param props - The section, where it starts and how its options are wired.
 * @returns The section.
 */
function Section({
  section, offset, value, activeIndex, itemPropsOf,
}: SectionProps) {
  const headingId = useId();
  const rows = section.options.map((option, position) => (
    <OptionRow
      key={option.value}
      option={option}
      index={offset + position}
      selected={option.value === value}
      active={offset + position === activeIndex}
      itemPropsOf={itemPropsOf}
    />
  ));
  if (section.label === undefined) {
    return rows;
  }
  return (
    <div role="group" aria-labelledby={headingId} className="flex flex-col">
      <span id={headingId} className="px-2 pt-2 pb-1 type-label text-muted">{section.label}</span>
      {rows}
    </div>
  );
}

/**
 * Lists where each section starts in the whole list of options.
 *
 * @param sections - The sections drawn.
 * @returns The position of each section's first option.
 */
export const sectionOffsets = (sections: readonly SelectSection<string>[]) => sections.reduce<
  readonly number[]
>((offsets, section, index) => (
  index === 0 ? [0] : [...offsets, offsets[index - 1]! + sections[index - 1]!.options.length]
), []);

/**
 * Renders every section of options, numbering the options across sections in
 * display order.
 *
 * @param props - The sections, the chosen value, the active position and the wiring.
 * @returns The options.
 */
export function OptionList({
  sections, value, activeIndex, itemPropsOf,
}: OptionListProps) {
  const offsets = sectionOffsets(sections);
  return sections.map((section, index) => (
    <Section
      // Sections have no id; a heading is unique within one select.
      key={section.label ?? `loose-${index}`}
      section={section}
      offset={offsets[index]!}
      value={value}
      activeIndex={activeIndex}
      itemPropsOf={itemPropsOf}
    />
  ));
}
