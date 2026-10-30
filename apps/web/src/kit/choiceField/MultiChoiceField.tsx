import { choiceField as settings } from '../../config/constants';
import { ChipCheckGroup } from '../chipGroup/ChipChecks';
import type { Chip } from '../chipGroup/ChipGroup';
import { Icon } from '../icons/Icon';
import { MultiSelect } from '../multiSelect/MultiSelect';
import type { SelectSearch } from '../select/SelectPanel';
import { Tag } from '../tag/Tag';

// Any number of picks out of a list of named choices — the ledger filter's
// accounts and cards, and its categories (mockup 33, OQ-214, OQ-220): chips
// while the list is short, the multi-select (K12) once it passes
// `choiceField.chipListLimit`, with the same names, icons and tags. The
// one-pick sibling is `ChoiceField`.

/** MultiChoiceField's props. */
export interface MultiChoiceFieldProps<Value extends string> {
  /** The caption, already translated. */
  readonly label: string;
  readonly options: readonly Chip<Value>[];
  readonly value: readonly Value[];
  readonly onChange: (value: readonly Value[]) => void;
  /**
   * Phrases the multi-select's count, already translated with the caller's
   * noun, e.g. `(2, 14) => "2 of 14 categories"`.
   */
  readonly summary: (chosen: number, total: number) => string;
  /** The multi-select's text while nothing is chosen, e.g. "All categories". */
  readonly placeholder?: string | undefined;
  /** The multi-select's search box, for a long list. */
  readonly search?: SelectSearch | undefined;
}

/**
 * Renders the list as chips, or as a multi-select once it is too long for them.
 *
 * @param props - The caption, the choices, the choice, the handler and the
 *   multi-select's texts and search.
 * @returns The field.
 */
export function MultiChoiceField<Value extends string>({
  label, options, value, onChange, summary, placeholder, search,
}: MultiChoiceFieldProps<Value>) {
  if (options.length <= settings.chipListLimit) {
    return <ChipCheckGroup label={label} options={options} value={value} onChange={onChange} />;
  }
  return (
    <MultiSelect
      label={label}
      options={options.map((option) => ({
        value: option.value,
        label: option.label,
        leading: option.icon && <Icon name={option.icon} className="size-4" />,
        trailing: option.tag && <Tag size="micro">{option.tag}</Tag>,
      }))}
      value={value}
      onChange={onChange}
      summary={summary}
      placeholder={placeholder}
      search={search}
      className="w-full"
    />
  );
}
