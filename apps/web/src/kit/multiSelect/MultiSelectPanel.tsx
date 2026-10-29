import { useId, type ReactNode } from 'react';
import { useI18n } from '../../utilities/I18nProvider';
import { Button } from '../button/Button';
import { Checkbox } from '../checkbox/Checkbox';
import type { SelectOption, SelectSection } from '../select/options';
import { OptionSlot } from '../select/SelectPanel';
import { countChosen } from './choices';

// What the multi-select's floating panel draws (K12, OQ-214), below its
// search box: the preset buttons, the options as checkboxes in groups laid
// out in columns, "no results", and the footer with the caller's note and
// Done. The panel holds no state; the MultiSelect hands it the choice and
// the moves.

/** A preset button the caller offers between All and Clear, e.g. "FIIs". */
export interface MultiSelectPreset<Value extends string> {
  /** The button's text, already translated. */
  readonly label: string;
  /** The values it chooses; it replaces the choice. */
  readonly values: readonly Value[];
}

/** The preset row's props. */
interface PresetsProps {
  readonly presets: readonly MultiSelectPreset<string>[];
  /** Applies the values of the button pressed. */
  readonly onPreset: (values: readonly string[] | 'all') => void;
}

/** The groups' props: what is drawn, the choice and how a tick reaches it. */
export interface OptionGroupsProps {
  readonly sections: readonly SelectSection<string>[];
  readonly value: readonly string[];
  readonly onToggle: (option: string, checked: boolean) => void;
}

/** The footer's props. */
interface FooterProps {
  /** A muted line beside Done, e.g. how the chart colours the choice. */
  readonly note?: ReactNode | undefined;
  readonly onDone: () => void;
}

const GROUPS = [
  'grid max-h-72 min-h-0 grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]',
  'gap-x-4 gap-y-3 overflow-y-auto p-1',
].join(' ');

/**
 * Builds a preset button's classes: the mockups' small `opt` chip, muted for
 * Clear.
 *
 * @param muted - Whether the text is muted (Clear).
 * @returns The button's classes.
 */
export const presetClasses = (muted: boolean) => [
  'inline-flex h-7 cursor-pointer items-center rounded-xl border border-line px-3',
  'type-caption font-medium transition-colors duration-150 hover:border-mint/40',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint',
  muted ? 'text-muted' : 'text-ink',
].join(' ');

/**
 * Renders the preset buttons: All, the caller's presets, then Clear.
 *
 * @param props - The caller's presets and what a press applies.
 * @returns The row of preset buttons.
 */
export function Presets({ presets, onPreset }: PresetsProps) {
  const translator = useI18n();
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" className={presetClasses(false)} onClick={() => onPreset('all')}>
        {translator.text('multiSelect', 'all')}
      </button>
      {presets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          className={presetClasses(false)}
          onClick={() => onPreset(preset.values)}
        >
          {preset.label}
        </button>
      ))}
      <button type="button" className={presetClasses(true)} onClick={() => onPreset([])}>
        {translator.text('multiSelect', 'clear')}
      </button>
    </div>
  );
}

/**
 * Renders what a checkbox row says: its leading slot, the label (muted while
 * unticked) and its trailing slot at the row's end.
 *
 * @param props - The option and whether it is ticked.
 * @param props.option - The option drawn.
 * @param props.checked - Whether it is ticked.
 * @returns The row's label.
 */
function RowLabel({ option, checked }: {
  readonly option: SelectOption<string>;
  readonly checked: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <OptionSlot>{option.leading}</OptionSlot>
      <span className={`min-w-0 flex-1 truncate ${checked ? '' : 'text-muted'}`}>
        {option.label}
      </span>
      <OptionSlot>{option.trailing}</OptionSlot>
    </span>
  );
}

/** One group's props: its options, the choice and the tick handler. */
interface OptionGroupProps extends Omit<OptionGroupsProps, 'sections'> {
  readonly section: SelectSection<string>;
}

/**
 * Renders one group: its heading with how many of its options are chosen
 * ("5/6"), then a checkbox per option. A disabled option says why under its
 * label. Loose options form a group with no heading.
 *
 * @param props - The section, the choice and the tick handler.
 * @returns The group.
 */
function OptionGroup({ section, value, onToggle }: OptionGroupProps) {
  const headingId = useId();
  const named = section.label !== undefined;
  return (
    <div
      role="group"
      aria-labelledby={named ? headingId : undefined}
      className="flex min-w-0 flex-col gap-2"
    >
      {named && (
        <div className="flex items-center justify-between gap-2 px-1">
          <span id={headingId} className="type-label text-muted">{section.label}</span>
          <span className="type-caption text-muted tabular-nums">
            {`${countChosen(section, value)}/${section.options.length}`}
          </span>
        </div>
      )}
      {section.options.map((option) => {
        const checked = value.includes(option.value);
        return (
          <Checkbox
            key={option.value}
            checked={checked}
            onChange={(next) => onToggle(option.value, next)}
            label={<RowLabel option={option} checked={checked} />}
            description={option.disabledReason ?? option.description}
            disabled={Boolean(option.disabledReason)}
          />
        );
      })}
    </div>
  );
}

/**
 * Renders the groups side by side, as many columns as fit, scrolling inside
 * the panel past 288px.
 *
 * @param props - The sections drawn, the choice and the tick handler.
 * @returns The groups.
 */
export function OptionGroups({ sections, value, onToggle }: OptionGroupsProps) {
  return (
    <div className={GROUPS}>
      {sections.map((section, index) => (
        <OptionGroup
          // Sections have no id; a heading is unique within one multi-select.
          key={section.label ?? `loose-${index}`}
          section={section}
          value={value}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

/**
 * Renders the footer: the caller's note, if any, and Done, which closes the
 * panel (every tick has already reached the caller).
 *
 * @param props - The note and the close handler.
 * @returns The footer.
 */
export function Footer({ note, onDone }: FooterProps) {
  const translator = useI18n();
  return (
    <div className="flex items-center gap-3 border-t border-line pt-2.5">
      {note && <span className="min-w-0 flex-1 type-caption text-muted">{note}</span>}
      <Button variant="primary" size="sm" className="ml-auto" onClick={onDone}>
        {translator.text('multiSelect', 'done')}
      </Button>
    </div>
  );
}
