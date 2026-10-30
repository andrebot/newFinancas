import { recordTransaction as settings } from '../../../../../config/constants';
import { ChipGroup, type Chip } from '../../../../../kit/chipGroup/ChipGroup';
import { Icon } from '../../../../../kit/icons/Icon';
import { Select } from '../../../../../kit/select/Select';
import { Tag } from '../../../../../kit/tag/Tag';

// One pick out of the drawer's lists — the accounts, the cards, the
// categories and their subcategories (FL15; OQ-138, OQ-219): the mockups'
// chips while the list is short, the select (K11) once it passes
// `recordTransaction.chipListLimit`, with the same names, icons and tags.

/** ChoiceField's props. */
export interface ChoiceFieldProps<Value extends string> {
  /** The caption, already translated. */
  readonly label: string;
  /** A quieter note after the caption (chips) or the hint (select). */
  readonly note?: string | undefined;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly options: readonly Chip<Value>[];
  readonly value: Value | undefined;
  readonly onChange: (value: Value) => void;
}

/**
 * Renders the list as chips, or as a select once it is too long for them.
 *
 * @param props - The caption, its note and message, the choices, the value and the handler.
 * @returns The field.
 */
export function ChoiceField<Value extends string>({
  label, note, hint, error, options, value, onChange,
}: ChoiceFieldProps<Value>) {
  if (options.length <= settings.chipListLimit) {
    return (
      <ChipGroup
        label={label}
        note={note}
        hint={hint}
        error={error}
        options={options}
        value={value}
        onChange={onChange}
      />
    );
  }
  return (
    <Select
      label={note ? `${label} ${note}` : label}
      hint={hint}
      error={error}
      options={options.map((option) => ({
        value: option.value,
        label: option.label,
        leading: option.icon && <Icon name={option.icon} className="size-4" />,
        trailing: option.tag && <Tag size="micro">{option.tag}</Tag>,
      }))}
      value={value ?? null}
      onChange={onChange}
    />
  );
}
