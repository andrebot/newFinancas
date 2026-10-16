import { IconButton } from '../../../../../kit/button/IconButton';
import { InlineConfirm } from '../../../../../kit/confirm/InlineConfirm';
import { Menu, type MenuEntry, type MenuTriggerProps } from '../../../../../kit/menu/Menu';
import { Tooltip } from '../../../../../kit/tooltip/Tooltip';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { fullName, type HouseholdMember } from '../membershipState';

// Transfer Ownership (Membership Management, mockup 60; FR-1.20, OQ-155): the
// Owner hands the household to another member — any role, not only an Admin
// — and stays on as an Admin. The swap button on the Owner's own row opens
// the other members; a pick opens the confirm under the members header. It
// can't be undone by the one who asks, so the confirm is the destructive one.

/** The button's props. */
export interface TransferOwnershipButtonProps {
  /** Everyone but the Owner. */
  readonly candidates: readonly HouseholdMember[];
  /** A request is out: the button waits. */
  readonly disabled: boolean;
  /** Gets the member picked to be the Owner. */
  readonly onPick: (userId: string) => void;
}

/**
 * Builds the trigger of the transfer menu: the round swap button, named in a
 * tooltip too (K24).
 *
 * @param label - Its name, already translated.
 * @param disabled - Whether a request is out.
 * @returns The trigger render prop.
 */
const swapButton = (label: string, disabled: boolean) => function SwapButton(
  props: MenuTriggerProps,
) {
  return (
    <Tooltip content={label} repeatsName triggerProps={props}>
      {(tip) => <IconButton {...tip} icon="swap-horiz" label={label} disabled={disabled} />}
    </Tooltip>
  );
};

/**
 * Renders the Owner's swap button and the menu of who may take over.
 *
 * @param props - The candidates, the lock and the handler.
 * @returns The button and, while open, its menu.
 */
export function TransferOwnershipButton({
  candidates, disabled, onPick,
}: TransferOwnershipButtonProps) {
  const translator = useI18n();
  const label = translator.text('membership', 'transfer.open');
  const entries: readonly MenuEntry<string>[] = candidates.map((member) => ({
    kind: 'action',
    id: member.userId,
    label: fullName(member),
    description: translator.text('membership', `role.${member.role}`),
    onSelect: () => onPick(member.userId),
  }));

  return (
    <Menu
      label={label}
      entries={entries}
      trigger={swapButton(label, disabled)}
    />
  );
}

/** The confirm's props. */
export interface TransferOwnershipConfirmProps {
  /** The future Owner's full name. */
  readonly name: string;
  /** The transfer is out: the confirm spins. */
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Renders the "make them the Owner?" confirm.
 *
 * @param props - The name, the busy state and the handlers.
 * @returns The confirm.
 */
export function TransferOwnershipConfirm({
  name, busy, onConfirm, onCancel,
}: TransferOwnershipConfirmProps) {
  const translator = useI18n();
  return (
    <InlineConfirm
      tone="destructive"
      icon="swap-horiz"
      message={translator.text('membership', 'transfer.message', { name })}
      confirmLabel={translator.text('membership', 'transfer.confirm')}
      cancelLabel={translator.text('membership', 'transfer.cancel')}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
