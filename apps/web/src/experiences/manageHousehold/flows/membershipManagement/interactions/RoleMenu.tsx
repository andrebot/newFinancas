import { household } from '../../../../../config/constants';
import type { IconName } from '../../../../../kit/icons/Icon';
import { Menu, type MenuRadioOption, type MenuTriggerProps } from '../../../../../kit/menu/Menu';
import { MenuPill, StaticPill } from '../../../../../kit/menu/MenuPill';
import { Tag } from '../../../../../kit/tag/Tag';
import type { Translator } from '../../../../../utilities/i18n';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { AssignableRole, Role } from '../membershipState';

// Role Menu (Membership Management, mockup 60): a member's role, in the row's
// role column. For an Owner/Admin looking at anyone but themselves and the
// Owner, it is a pill that opens the roles, each with what it may do
// (FR-1.7); a pick is the change (FR-1.12), no confirm. The Owner's role is
// the mint crown pill; any other role nobody here may change is a plain tag.

/** Role Menu's props. */
export interface RoleMenuProps {
  /** The member's full name, for the menu's accessible name. */
  readonly name: string;
  /** The member's current role. */
  readonly current: Role;
  /** Whether the signed-in user may change it. */
  readonly editable: boolean;
  /** A request is out: the pill waits. */
  readonly disabled: boolean;
  readonly onChange: (role: AssignableRole) => void;
}

// Each role's glyph in the menu, as mockup 60 draws it.
const GLYPHS: Record<AssignableRole, IconName> = {
  Admin: 'shield-person-outline',
  Member: 'edit-note-outline',
  Viewer: 'visibility-outline',
};

/**
 * Lists the roles an Owner/Admin may give, with what each may do.
 *
 * @param translator - The current locale's translator.
 * @returns The menu's radio options.
 */
export const roleOptions = (translator: Translator): readonly MenuRadioOption<AssignableRole>[] => (
  household.assignableRoles.map((role) => ({
    value: role,
    label: translator.text('membership', `role.${role}`),
    description: translator.text('membership', `role.${role}.description`),
    icon: GLYPHS[role],
  }))
);

/**
 * Builds the trigger of a member's role menu: the pill showing the role.
 *
 * @param label - The role, already translated.
 * @param ariaLabel - Whose role it is and which, already translated.
 * @param disabled - Whether a request is out.
 * @returns The trigger render prop.
 */
const rolePill = (label: string, ariaLabel: string, disabled: boolean) => function RolePill(
  props: MenuTriggerProps,
) {
  return <MenuPill {...props} label={label} aria-label={ariaLabel} disabled={disabled} />;
};

/**
 * Renders a member's role: the menu when it may change, otherwise a label.
 *
 * @param props - The member, whether the role may change and the handler.
 * @returns The pill, or the tag.
 */
export function RoleMenu({
  name, current, editable, disabled, onChange,
}: RoleMenuProps) {
  const translator = useI18n();
  const label = translator.text('membership', `role.${current}`);
  if (current === 'Owner') return <StaticPill label={label} icon="crown-outline" />;
  if (!editable) return <Tag>{label}</Tag>;

  const menuLabel = translator.text('membership', 'members.roleLabel', { name });
  return (
    <Menu
      label={menuLabel}
      width={300}
      trigger={rolePill(
        label,
        translator.text('membership', 'members.rolePill', { name, role: label }),
        disabled,
      )}
      entries={[{
        kind: 'radio', value: current, options: roleOptions(translator), onChange,
      }]}
    />
  );
}
