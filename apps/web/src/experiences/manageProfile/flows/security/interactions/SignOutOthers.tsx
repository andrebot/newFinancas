import { Button } from '../../../../../kit/button/Button';
import { InlineConfirm } from '../../../../../kit/confirm/InlineConfirm';
import { useI18n } from '../../../../../utilities/I18nProvider';

// Sign Out All Others (Security, mockup 70; FR-1.3, OQ-62): the coral button
// in the sessions panel's header, and the confirm it opens under the header
// (OQ-154) — every device but this one is signed out. The button stays in
// place while the confirm is open, so a cancel gives it the focus back.

/** The button's props. */
export interface SignOutOthersButtonProps {
  /** A revoke is out: the button waits. */
  readonly disabled: boolean;
  /** The user asked: the Flow opens the confirm. */
  readonly onOpen: () => void;
}

/**
 * Renders the header's "Sign out all others" button.
 *
 * @param props - Whether it waits, and its handler.
 * @returns The button.
 */
export function SignOutOthersButton({ disabled, onOpen }: SignOutOthersButtonProps) {
  const translator = useI18n();

  return (
    <Button variant="danger-ghost" size="sm" disabled={disabled} onClick={onOpen}>
      {translator.text('security', 'others.open')}
    </Button>
  );
}

/** The confirm's props. */
export interface SignOutOthersConfirmProps {
  /** The revoke is out: the confirm spins and cancel waits. */
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Renders the "sign out every other device?" confirm.
 *
 * @param props - The busy state and the handlers.
 * @returns The confirm.
 */
export function SignOutOthersConfirm({ busy, onConfirm, onCancel }: SignOutOthersConfirmProps) {
  const translator = useI18n();

  return (
    <InlineConfirm
      tone="destructive"
      icon="logout"
      message={translator.text('security', 'others.message')}
      confirmLabel={translator.text('security', 'others.confirm')}
      cancelLabel={translator.text('security', 'others.cancel')}
      onConfirm={onConfirm}
      onCancel={onCancel}
      busy={busy}
    />
  );
}
