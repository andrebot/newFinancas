import { InlineConfirm } from '../../../../../kit/confirm/InlineConfirm';
import { useI18n } from '../../../../../utilities/I18nProvider';

// Remove Member Confirm (Membership Management; FR-1.11, OQ-155): an
// Owner/Admin removing someone asks first, under the members header — they
// lose the household's shared data until invited again. Revoking an
// invitation asks nothing: it can simply be sent again.

/** Remove Member Confirm's props. */
export interface RemoveMemberConfirmProps {
  /** The member's full name. */
  readonly name: string;
  /** The remove is out: the confirm spins. */
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Renders the "remove them?" confirm.
 *
 * @param props - The name, the busy state and the handlers.
 * @returns The confirm.
 */
export function RemoveMemberConfirm({
  name, busy, onConfirm, onCancel,
}: RemoveMemberConfirmProps) {
  const translator = useI18n();
  return (
    <InlineConfirm
      tone="destructive"
      icon="person-remove-outline"
      message={translator.text('membership', 'remove.message', { name })}
      confirmLabel={translator.text('membership', 'remove.confirm')}
      cancelLabel={translator.text('membership', 'remove.cancel')}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
