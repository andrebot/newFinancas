import { FloatingFocusManager, FloatingPortal } from '@floating-ui/react';
import { useId, useRef } from 'react';
import { Field, fieldAria, type FieldTexts } from '../field/Field';
import { Icon } from '../icons/Icon';
import { OVERLAY_SURFACE } from '../popover/overlay';
import { findOption, type SelectEntry, type SelectOption } from './options';
import {
  OptionList, OptionSlot, SearchBox, type SelectSearch,
} from './SelectPanel';
import { useSelectList } from './useSelectList';

// The kit's select (K11, OQ-138): pick one value from a list too long for a
// row of chips — many accounts, categories with their subcategories. It is a
// select-only combobox in the kit's field frame: a button that opens a
// floating listbox. Options may sit in groups, carry an icon, a tag and a
// description, and be disabled with the reason shown beside them. Typing
// letters jumps to an option; long lists can opt into a search box.

export type { SelectEntry, SelectGroup, SelectOption } from './options';
export type { SelectSearch } from './SelectPanel';

/** The select's props: the field texts, the options and the chosen value. */
export interface SelectProps<Value extends string> extends FieldTexts {
  /** Loose options and groups, in display order. */
  readonly options: readonly SelectEntry<Value>[];
  /** The chosen value; `null` while nothing is chosen. */
  readonly value: Value | null;
  /** Gets the picked value; the select holds no value of its own. */
  readonly onChange: (value: Value) => void;
  /** Shown in the box while nothing is chosen, already translated. */
  readonly placeholder?: string | undefined;
  /** Adds a search box at the top of the panel, for long lists. */
  readonly search?: SelectSearch | undefined;
  readonly disabled?: boolean | undefined;
  /** The trigger's id; one is made when absent. */
  readonly id?: string | undefined;
  /** Layout only, on the whole field, e.g. `w-48`, `flex-1`. */
  readonly className?: string | undefined;
}

/**
 * Builds the classes of the button that shows the choice: the text field's
 * box, with the halo while focused or open — mint, or coral while invalid.
 *
 * @param invalid - Whether the field shows an error.
 * @returns The trigger's classes.
 */
export const triggerClasses = (invalid: boolean) => [
  'flex h-[46px] w-full items-center gap-2 rounded-[14px] border bg-bg px-3.5 text-left',
  'outline-none transition-[border-color,box-shadow] duration-150',
  'focus:ring-3 aria-expanded:ring-3',
  invalid
    ? 'border-coral ring-coral/15'
    : 'border-line ring-mint/15 focus:border-mint aria-expanded:border-mint',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

/** What the box shows: the chosen option, if any, and the placeholder. */
interface ChosenValueProps {
  readonly option: SelectOption<string> | undefined;
  readonly placeholder?: string | undefined;
}

/**
 * Renders what the box shows: the chosen option's icon and label, or the
 * placeholder while nothing is chosen.
 *
 * @param props - The chosen option, if any, and the placeholder.
 * @returns The box's content.
 */
function ChosenValue({ option, placeholder }: ChosenValueProps) {
  if (!option) {
    return <span className="min-w-0 flex-1 truncate type-body-lg text-faint">{placeholder}</span>;
  }
  return (
    <>
      <OptionSlot>{option.leading}</OptionSlot>
      <span className="min-w-0 flex-1 truncate type-body-lg text-ink">{option.label}</span>
    </>
  );
}

/** The floating panel's props: the running select, its search and its name. */
interface FloatingPanelProps {
  readonly list: ReturnType<typeof useSelectList<string>>;
  readonly value: string | null;
  readonly search: SelectSearch | undefined;
  /** The listbox's accessible name: the field's label. */
  readonly label: string;
}

/**
 * Renders the open panel in a portal: the search box when there is one, the
 * listbox, and "no results" when the search leaves nothing. Focus goes to the
 * search box, else to the panel, and returns to the trigger on close.
 *
 * @param props - The running select, the chosen value, the search texts and the label.
 * @returns The floating panel.
 */
function FloatingPanel({
  list, value, search, label,
}: FloatingPanelProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  return (
    <FloatingPortal>
      <FloatingFocusManager
        context={list.context}
        modal={false}
        initialFocus={search ? searchRef : 0}
      >
        <div {...list.panelProps} className={`flex flex-col gap-2 p-1.5 ${OVERLAY_SURFACE}`}>
          {search && (
            <SearchBox
              search={search}
              query={list.query}
              onQueryChange={list.setQuery}
              inputRef={searchRef}
            />
          )}
          <div
            {...list.listboxProps}
            aria-label={label}
            className="flex max-h-72 min-h-0 flex-col overflow-y-auto"
          >
            <OptionList
              sections={list.sections}
              value={value}
              activeIndex={list.activeIndex}
              itemPropsOf={list.itemPropsOf}
            />
          </div>
          {search && list.shown.length === 0 && (
            <p className="px-2 py-3 type-body-sm text-muted">{search.noResults}</p>
          )}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
}

/**
 * Renders a labelled select with an optional hint or error. It holds no
 * value: the caller passes `value` and gets the pick through `onChange`.
 * The panel's open state, the keyboard position and the search live in
 * `useSelectList`.
 *
 * @param props - The options, value, change handler, field texts and settings.
 * @returns The select.
 */
export function Select<Value extends string>({
  options, value, onChange, placeholder, search, disabled, id, className, ...texts
}: SelectProps<Value>) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const list = useSelectList({
    options, value, onChange, searchable: search !== undefined,
  });

  return (
    <Field controlId={controlId} className={className} {...texts}>
      <button
        type="button"
        disabled={disabled}
        {...list.triggerProps}
        {...fieldAria(controlId, texts)}
        id={controlId}
        className={triggerClasses(Boolean(texts.error))}
      >
        <ChosenValue option={findOption(options, value)} placeholder={placeholder} />
        <Icon
          name="expand-more"
          className={`size-5 shrink-0 text-muted ${list.open ? 'rotate-180' : ''}`}
        />
      </button>
      {list.open && (
        <FloatingPanel
          list={list}
          value={value}
          search={search}
          label={texts.label}
        />
      )}
    </Field>
  );
}
