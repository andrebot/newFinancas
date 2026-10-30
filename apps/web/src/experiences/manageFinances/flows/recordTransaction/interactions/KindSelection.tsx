import { KIND_GROUPS, type KindGroup } from '@financas/reference';
import { transactionKinds as settings } from '../../../../../config/constants';
import { ChipRadios } from '../../../../../kit/chipGroup/ChipGroup';
import { LockedField } from '../../../../../kit/field/LockedField';
import { SegmentedControl } from '../../../../../kit/segmentedControl/SegmentedControl';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { groupOf, kindsOfGroup } from '../transactionForm';
import { groupName, kindIcon, kindName } from '../../../transactionNames';
import { recordText } from '../recordText';

// Kind Group & Kind Selection (FL15, mockup 31; FR-3.1): the four groups as
// tiles — Cash, Transfer, Credit card, Investment — then the group's kinds as
// chips, which decide what the rest of the drawer asks for. The groups and
// kinds are reference data (`@financas/reference`). On an edit the kind is
// shown, never changed (OQ-201 D6). It renders and emits; the Flow holds the kind.

/** KindSelection's props. */
export interface KindSelectionProps {
  /** The kind's code. */
  readonly kind: string;
  /** Gets a group picked: the Flow moves to its first kind. */
  readonly onGroupChange: (group: KindGroup) => void;
  /** Gets a kind picked. */
  readonly onKindChange: (kind: string) => void;
  /** An edit: the kind is shown, not picked. */
  readonly locked?: boolean | undefined;
}

/**
 * Renders the group tiles and the group's kind chips, or the locked kind.
 *
 * @param props - The kind, the handlers and whether it is locked.
 * @returns The kind selection.
 */
export function KindSelection({
  kind, onGroupChange, onKindChange, locked,
}: KindSelectionProps) {
  const translator = useI18n();
  const nameOf = (code: string) => kindName(translator, code);
  if (locked) {
    return (
      <LockedField label={recordText(translator, 'field.kind')} value={nameOf(kind)} />
    );
  }
  const group = groupOf(kind);
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        layout="tiles"
        label={recordText(translator, 'field.group')}
        options={KIND_GROUPS.map((value) => ({
          value,
          icon: settings.groupIcons[value],
          label: groupName(translator, value),
        }))}
        value={group}
        onChange={onGroupChange}
      />
      <ChipRadios
        label={recordText(translator, 'field.kind')}
        options={kindsOfGroup(group).map(({ code }) => ({
          value: code,
          icon: kindIcon(code),
          label: nameOf(code),
        }))}
        value={kind}
        onChange={onKindChange}
      />
    </div>
  );
}
