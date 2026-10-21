import { useEffect, useState } from 'react';
import type { Account } from '@financas/api-types';
import { useAlerts } from '../../../../utilities/AlertProvider';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { RequestOutcome } from '../../../../utilities/requestOutcome';
import {
  afterAction, afterLoad, archiveConfirmCancelled, archiveConfirmOpened, drawerClosed,
  drawerOpened, INITIAL_ACCOUNTS, loadingAccounts, mayCreate, mayEdit, mayShare, started,
  type AccountActionOutcome, type AccountEdit, type AccountsOutcome, type AccountManagementState,
  type NewAccount, type Outgoing,
} from './accountManagementState';
import { AccountList } from './interactions/AccountList';
import { CreateAccountDrawer } from './interactions/CreateAccountDrawer';
import { EditAccountDrawer } from './interactions/EditAccountDrawer';

// The Account & Card Management Flow (FL11, mockup 40; OQ-175): the household's
// accounts as cards — add one with its type, currency and today's balance
// (OQ-169), edit a name or visibility, run a credit-card account's cards
// (add, edit field by field, remove) and archive behind a confirm. It fetches
// the list as it mounts, owns what is out, the open drawer and its last
// failure, and toasts each success; a failure shows only in the open drawer's
// banner, where the form still holds what was typed (OQ-192). It never calls
// the backend: every request
// goes up to the Account Setup Experience, which answers an outcome; a success
// changes the list the way the API did (OQ-175).

export type { AccountActionOutcome };

/** What the Flow asks of the Experience. */
export interface AccountManagementFlowProps {
  /** The signed-in user's id: who owns what. */
  readonly selfUserId: string;
  /** Their role in this household (FR-1.7). */
  readonly role?: string | undefined;
  /** Lists the household's accounts, archived included. */
  readonly onLoad: () => Promise<AccountsOutcome>;
  /** `POST /households/:id/accounts`. */
  readonly onCreate: (account: NewAccount) => Promise<AccountActionOutcome>;
  /** `PATCH /households/:id/accounts/:accountId`. */
  readonly onEdit: (edit: AccountEdit) => Promise<AccountActionOutcome>;
  /** `POST /households/:id/accounts/:accountId/archive`. */
  readonly onArchive: (accountId: string) => Promise<RequestOutcome>;
}

/**
 * The account the open edit drawer is about, if any.
 *
 * @param state - The Flow's state.
 * @returns Its target, or nothing while no edit drawer is open (or it can't be found).
 */
const targetOf = (state: AccountManagementState): Account | undefined => {
  const { drawer, view } = state;
  if (drawer?.kind !== 'edit' || view.status !== 'loaded') return undefined;
  return view.accounts.find((account) => account.id === drawer.accountId);
};

/** What the open drawers need from the Flow. */
interface OpenDrawersProps {
  /** The state: what is out and which drawer is open. */
  readonly state: AccountManagementState;
  /** The last failure, translated, for the open drawer's banner. */
  readonly alert?: string | undefined;
  /** The signed-in user's id: who owns what. */
  readonly selfUserId: string;
  /** The actor can't share (a Viewer): a create is personal. */
  readonly personalOnly: boolean;
  /** Sends a create with its typed fields. */
  readonly submitCreate: (account: NewAccount) => void;
  /** Sends an edit with its typed fields. */
  readonly submitEdit: (edit: AccountEdit) => void;
  /** Archives the account behind the open confirm, naming it for its toast. */
  readonly archive: (accountId: string, name: string) => void;
  /** Closes whatever drawer is open. */
  readonly closeDrawer: () => void;
  /** Opens an account's archive confirm. */
  readonly openArchive: (accountId: string) => void;
  /** Closes the open archive confirm again. */
  readonly closeArchive: () => void;
}

/**
 * Renders whatever drawer the state has open, with its handlers — nothing
 * while none is.
 *
 * @param props - The state and the Flow's handlers for it.
 * @returns The create or edit drawer, or nothing.
 */
function OpenDrawers({
  state, alert, selfUserId, personalOnly, submitCreate, submitEdit, archive, closeDrawer,
  openArchive, closeArchive,
}: OpenDrawersProps) {
  const outKind = state.out?.kind;
  const drawerKind = state.drawer?.kind;
  const locked = outKind !== undefined;

  if (drawerKind === 'create') {
    return (
      <CreateAccountDrawer
        busy={outKind === 'create'}
        disabled={locked}
        alert={alert}
        personalOnly={personalOnly}
        onSubmit={submitCreate}
        onCancel={closeDrawer}
      />
    );
  }

  const editTarget = targetOf(state);
  if (drawerKind !== 'edit' || editTarget === undefined) return null;
  return (
    <EditAccountDrawer
      key={editTarget.id}
      account={editTarget}
      selfUserId={selfUserId}
      busy={outKind === 'edit'}
      archiveBusy={outKind === 'archive'}
      disabled={locked}
      alert={alert}
      archiveConfirmOpen={state.archiving === editTarget.id}
      onSubmit={submitEdit}
      onArchive={() => archive(editTarget.id, editTarget.name)}
      onOpenArchive={() => openArchive(editTarget.id)}
      onCloseArchive={closeArchive}
      onCancel={closeDrawer}
    />
  );
}

/**
 * Renders the accounts panel and its drawers, and runs their requests.
 *
 * @param props - The actor, their role and the Experience's requests.
 * @returns The panel with whatever drawer is open.
 */
export function AccountManagementFlow({
  selfUserId, role, onLoad, onCreate, onEdit, onArchive,
}: AccountManagementFlowProps) {
  const translator = useI18n();
  const alerts = useAlerts();
  const [state, setState] = useState<AccountManagementState>(INITIAL_ACCOUNTS);
  const { view } = state;

  /** Fetches the list again (a retry). */
  const reload = async () => {
    setState((current) => loadingAccounts(current));
    const outcome = await onLoad();
    setState((current) => afterLoad(current, outcome));
  };

  // The list is fetched as the Flow mounts. An answer after unmounting drops.
  useEffect(() => {
    let mounted = true;
    onLoad().then((outcome) => {
      if (mounted) setState((current) => afterLoad(current, outcome));
    });
    return () => {
      mounted = false;
    };
  }, [onLoad]);

  /**
   * Sends a request and applies its answer: the list moves on success and is
   * toasted; on a failure the drawer keeps what was typed and its banner shows
   * why.
   *
   * @param outgoing - Which request goes out.
   * @param subject - The account's name for the toast.
   * @param request - The Experience's request for it.
   */
  const run = async (
    outgoing: Outgoing,
    subject: string,
    request: () => Promise<AccountActionOutcome>,
  ) => {
    setState((current) => started(current, outgoing));
    const outcome = await request();
    setState((current) => afterAction(current, outcome));
    if (outcome.ok) {
      alerts.success(
        translator.text('accountSetup', `${outgoing.kind}.done`, { name: subject }),
      );
    }
  };

  /** Sends a create with its typed fields. */
  const submitCreate = (account: NewAccount) => {
    run({ kind: 'create' }, account.name, () => onCreate(account));
  };

  /** Sends an edit with its typed fields. */
  const submitEdit = (edit: AccountEdit) => {
    run({ kind: 'edit', accountId: edit.accountId }, edit.name, () => onEdit(edit));
  };

  /** Archives the account behind the open confirm. */
  const archive = (accountId: string, name: string) => run(
    { kind: 'archive', accountId },
    name,
    () => onArchive(accountId),
  );

  /** Opens the create drawer. */
  const openCreate = () => {
    setState((current) => drawerOpened(current, { kind: 'create' }));
  };

  /** Opens an account's edit drawer. */
  const openEdit = (accountId: string) => {
    setState((current) => drawerOpened(current, { kind: 'edit', accountId }));
  };

  /** Opens an account's archive confirm. */
  const openArchive = (accountId: string) => {
    setState((current) => archiveConfirmOpened(current, accountId));
  };

  const { lastError } = state;
  const alert = lastError === undefined
    ? undefined
    : translator.error(lastError.code, lastError.params);

  return (
    <div className="flex flex-col gap-6">
      <AccountList
        view={view}
        canCreate={mayCreate(role)}
        isEditable={(account) => mayEdit(account, selfUserId, role)}
        onAdd={openCreate}
        onEdit={openEdit}
        onRetry={reload}
      />
      <OpenDrawers
        state={state}
        alert={alert}
        selfUserId={selfUserId}
        personalOnly={!mayShare(role)}
        submitCreate={submitCreate}
        submitEdit={submitEdit}
        archive={archive}
        closeDrawer={() => setState(drawerClosed)}
        openArchive={openArchive}
        closeArchive={() => setState(archiveConfirmCancelled)}
      />
    </div>
  );
}
