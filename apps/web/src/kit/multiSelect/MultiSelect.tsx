import { FloatingFocusManager, FloatingPortal } from '@floating-ui/react';
import {
  useId, useRef, type ReactNode,
} from 'react';
import { multiSelect } from '../../config/constants';
import { useI18n } from '../../utilities/I18nProvider';
import { joinIds } from '../checkbox/Checkbox';
import { Field, fieldAria, type FieldTexts } from '../field/Field';
import { Icon } from '../icons/Icon';
import { OVERLAY_SURFACE } from '../popover/overlay';
import type { SelectEntry } from '../select/options';
import { triggerClasses } from '../select/Select';
import { SearchBox, type SelectSearch } from '../select/SelectPanel';
import {
  allOptions, applyPreset, chosenNames, everyValue, groupCounts, knownValues, toggleValue,
} from './choices';
import {
  Footer, OptionGroups, Presets, type MultiSelectPreset,
} from './MultiSelectPanel';
import useMultiSelectPanel from './useMultiSelectPanel';

// The kit's multi-select (K12, OQ-214): pick any number of values from a
// list — the payout chart's holdings (mockups 20 and 50), the ledger filter's
// long lists. A field box sums up the choice ("7 of 12 holdings · XPML11,
// KNRI11, HGLG11 +4") and opens a panel of checkboxes (K16) in groups, with
// an optional search, preset buttons (All, the caller's, Clear) and Done.
// Every tick reaches the caller at once; Done, Esc or a click outside only
// close the panel.

export type { MultiSelectPreset } from './MultiSelectPanel';

/** The multi-select's props: the field texts, the options and the choice. */
export interface MultiSelectProps<Value extends string> extends FieldTexts {
  /** Keeps the label for screen readers only, when a card title already says it. */
  readonly labelHidden?: boolean | undefined;
  /** Loose options and groups, in display order (K11's entries). */
  readonly options: readonly SelectEntry<Value>[];
  /** The chosen values; the multi-select holds no choice of its own. */
  readonly value: readonly Value[];
  /** Gets the new choice, in display order, after every tick or preset. */
  readonly onChange: (value: readonly Value[]) => void;
  /**
   * Phrases the count in the box, already translated with the caller's noun,
   * e.g. `(7, 12) => "7 of 12 holdings"`.
   */
  readonly summary: (chosen: number, total: number) => string;
  /** Shown in the box instead while nothing is chosen, already translated. */
  readonly placeholder?: string | undefined;
  /** The caller's preset buttons, between All and Clear. */
  readonly presets?: readonly MultiSelectPreset<Value>[] | undefined;
  /** Adds a search box at the top of the panel, for long lists. */
  readonly search?: SelectSearch | undefined;
  /** A muted line beside Done, e.g. how the chart colours the choice. */
  readonly note?: ReactNode | undefined;
  readonly disabled?: boolean | undefined;
  /** The trigger's id; one is made when absent. */
  readonly id?: string | undefined;
  /** Layout only, on the whole field, e.g. `w-full`. */
  readonly className?: string | undefined;
}

/** What the box shows: the caller's list, the choice and its texts. */
interface ChoiceSummaryProps {
  /** Lets the trigger be described by what it shows. */
  readonly id: string;
  readonly options: readonly SelectEntry<string>[];
  readonly value: readonly string[];
  readonly summary: (chosen: number, total: number) => string;
  readonly placeholder?: string | undefined;
}

/**
 * Renders what the box shows: the placeholder while nothing is chosen (when
 * there is one), else the count and the first chosen names, "+n" for the rest.
 *
 * @param props - The caller's list, the choice, the count phrasing and the placeholder.
 * @returns The box's content.
 */
function ChoiceSummary({
  id, options, value, summary, placeholder,
}: ChoiceSummaryProps) {
  const translator = useI18n();
  if (value.length === 0 && placeholder) {
    return (
      <span id={id} className="min-w-0 flex-1 truncate type-body-lg text-muted">{placeholder}</span>
    );
  }
  const { names, more } = chosenNames(options, value, multiSelect.summaryNames);
  const listed = [
    names.join(', '),
    ...(more > 0 ? [translator.text('multiSelect', 'more', { count: more })] : []),
  ].join(' ');
  return (
    <span id={id} className="flex min-w-0 flex-1 items-baseline gap-1.5 type-body">
      <span className="shrink-0 font-semibold text-ink tabular-nums">
        {summary(value.length, allOptions(options).length)}
      </span>
      {/* The flex gap spaces them on screen; this space spaces them when read. */}
      {listed && ' '}
      {listed && <span className="min-w-0 truncate text-muted">{`· ${listed}`}</span>}
    </span>
  );
}

/** The floating panel's props: the running panel, the choice and its moves. */
interface FloatingPanelProps {
  readonly panel: ReturnType<typeof useMultiSelectPanel<string>>;
  /** Each group's "n/m", counted over the whole group. */
  readonly counts: ReadonlyMap<string, string>;
  readonly value: readonly string[];
  readonly presets: readonly MultiSelectPreset<string>[];
  readonly search: SelectSearch | undefined;
  readonly note: ReactNode;
  /** The dialog's accessible name: the field's label. */
  readonly label: string;
  readonly onToggle: (option: string, checked: boolean) => void;
  readonly onPreset: (values: readonly string[] | 'all') => void;
}

/**
 * Renders the open panel in a portal: the search box when there is one, the
 * presets, the groups (or "no results" when the search leaves nothing) and
 * the footer. Focus goes to the search box, else to the first preset, and
 * returns to the trigger on close.
 *
 * @param props - The running panel, the choice, the panel's parts and the moves.
 * @returns The floating panel.
 */
function FloatingPanel({
  panel, counts, value, presets, search, note, label, onToggle, onPreset,
}: FloatingPanelProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  return (
    <FloatingPortal>
      <FloatingFocusManager
        context={panel.context}
        modal={false}
        initialFocus={search ? searchRef : 0}
      >
        <div
          {...panel.panelProps}
          aria-label={label}
          className={`flex flex-col gap-3 p-3 ${OVERLAY_SURFACE}`}
        >
          {search && (
            <SearchBox
              search={search}
              query={panel.query}
              onQueryChange={panel.setQuery}
              inputRef={searchRef}
            />
          )}
          <Presets presets={presets} onPreset={onPreset} />
          {panel.sections.length > 0
            ? (
              <OptionGroups
                sections={panel.sections}
                counts={counts}
                value={value}
                onToggle={onToggle}
              />
            )
            : <p className="px-1 py-2 type-body-sm text-muted">{search?.noResults}</p>}
          <Footer note={note} onDone={panel.close} />
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
}

/**
 * Renders a labelled multi-select with an optional hint or error. It holds
 * no choice: the caller passes `value` and gets every change through
 * `onChange`, in display order. Values no option holds are ignored. The
 * panel's open state and search live in
 * `useMultiSelectPanel`; the moves on the choice are in `choices.ts`.
 *
 * @param props - The options, choice, change handler, texts and settings.
 * @returns The multi-select.
 */
export function MultiSelect<Value extends string>({
  options, value: given, onChange, summary, placeholder, presets = [], search, note,
  disabled, id, className, labelHidden, ...texts
}: MultiSelectProps<Value>) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const summaryId = `${controlId}-summary`;
  const aria = fieldAria(controlId, texts);
  const panel = useMultiSelectPanel(options);
  const value = knownValues(options, given);
  const toggle = (option: string, checked: boolean) => (
    onChange(toggleValue(options, value, option as Value, checked))
  );
  const preset = (values: readonly string[] | 'all') => onChange(applyPreset(
    options,
    value,
    values === 'all' ? everyValue(options) : values as readonly Value[],
  ));

  return (
    <Field controlId={controlId} labelHidden={labelHidden} className={className} {...texts}>
      <button
        type="button"
        disabled={disabled}
        {...panel.triggerProps}
        {...aria}
        // The label names the button over its text, so the choice it shows
        // describes it instead.
        aria-describedby={joinIds(summaryId, aria['aria-describedby'])}
        id={controlId}
        className={triggerClasses(Boolean(texts.error))}
      >
        <Icon name="filter-list" className="size-4.5 shrink-0 text-muted" />
        <ChoiceSummary
          id={summaryId}
          options={options}
          value={value}
          summary={summary}
          placeholder={placeholder}
        />
        <Icon
          name="expand-more"
          className={`size-5 shrink-0 text-muted ${panel.open ? 'rotate-180' : ''}`}
        />
      </button>
      {panel.open && (
        <FloatingPanel
          panel={panel}
          counts={groupCounts(options, value)}
          value={value}
          presets={presets}
          search={search}
          note={note}
          label={texts.label}
          onToggle={toggle}
          onPreset={preset}
        />
      )}
    </Field>
  );
}
