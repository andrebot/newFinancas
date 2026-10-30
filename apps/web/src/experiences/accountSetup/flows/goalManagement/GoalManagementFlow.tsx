import { useState } from 'react';
import { InlineBanner } from '../../../../kit/alert/InlineBanner';
import { Button } from '../../../../kit/button/Button';
import { EmptyState } from '../../../../kit/emptyState/EmptyState';
import { SkeletonRows } from '../../../../kit/skeleton/Skeleton';
import { useAlerts } from '../../../../utilities/AlertProvider';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { Translator } from '../../../../utilities/i18n';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';
import useToday from '../../../../utilities/useToday';
import useDrawerClosedOnHide from '../../hiddenTab';
import { mayCreateOwned, mayManageOwned, mayShareOwned } from '../../../ownership';
import type { ProgressStatus } from '../../sharedLists';
import {
  afterAction, confirmCancelled, confirmOpened, drawerClosed, drawerOpened, entriesOf, goalIn,
  INITIAL_GOALS, isGoalAction, isGone, jointStatusOf, rateEntered, started, statusChanged,
  toastsFailure, type GoalAction, type GoalEdit, type GoalManagementState, type GoalsView,
  type NewGoal, type Outgoing,
} from './goalManagementState';
import { GoalDrawer, type GoalSteps } from './interactions/GoalDrawer';
import { GoalList } from './interactions/GoalList';

// The Goal Management Flow (FL14, mockup 43; FR-8, FR-9, OQ-177, OQ-195): the
// goals the caller can see as cards, Active or Completed — add one with its
// name, target currency, visibility, target and due date, edit it in the same
// drawer (visibility locked) — opened by clicking its card — and complete,
// reopen or delete it from there, each behind its inline confirm (OQ-195). A
// mixed-currency goal's estimate takes the rate typed on its card, kept here
// only and never sent (FR-9.1). The goals and their progress are the Account
// Setup Experience's and come in as display state; the Flow owns the status
// shown, what is out, the open drawer and its confirm, the last failure and
// the rates. A success is toasted; a form's failure shows in the drawer's
// banner and a step's is toasted. It never calls the backend.

/** What the Flow asks of the Experience. */
export interface GoalManagementFlowProps {
  /** The signed-in user's id: whose personal goals are whose. */
  readonly selfUserId: string;
  /** Their role in this household (FR-1.7). */
  readonly role?: string | undefined;
  /** Every shared goal and the caller's personal ones, by status, with their progress. */
  readonly goals: GoalsView;
  /** Fetches the goals and their progress again (a retry). */
  readonly onRetry: () => void;
  /** `POST /households/:id/goals`. */
  readonly onCreate: (goal: NewGoal) => Promise<RequestOutcome>;
  /** `PATCH /households/:id/goals/:goalId`. */
  readonly onEdit: (edit: GoalEdit) => Promise<RequestOutcome>;
  /** `DELETE /households/:id/goals/:goalId`. */
  readonly onDelete: (goalId: string) => Promise<RequestOutcome>;
  /** `POST /households/:id/goals/:goalId/complete`. */
  readonly onComplete: (goalId: string) => Promise<RequestOutcome>;
  /** `POST /households/:id/goals/:goalId/reopen`. */
  readonly onReopen: (goalId: string) => Promise<RequestOutcome>;
  /** Whether its tab is the open one: hidden, it shows no drawer (OQ-197). Open by default. */
  readonly active?: boolean;
}

/**
 * Writes a toasted failure: a request whose goal is gone says so by the name
 * it had — an edit adding that the changes weren't saved; any other is the
 * error code's own message.
 *
 * @param outgoing - The request that failed.
 * @param failure - Why.
 * @param name - The goal's name before the request went out.
 * @param translator - The texts.
 * @returns The toast's message.
 */
export const failureToastOf = (
  outgoing: Outgoing,
  failure: RequestFailure,
  name: string,
  translator: Translator,
): string => {
  if (!isGone(failure)) return translator.error(failure.code, failure.params);
  const key = outgoing.kind === 'edit' ? 'edit.gone' : 'gone';
  return translator.text('goalManagement', key, { name });
};

/**
 * Tells whether the open drawer's own request is out: a create or an edit.
 *
 * @param out - The request that is out, if any.
 * @returns Whether the drawer's submit spins.
 */
const isFormOut = (out: Outgoing | undefined) => out?.kind === 'create' || out?.kind === 'edit';

/**
 * Tells which goal a request is about.
 *
 * @param out - The request, if any.
 * @returns The goal's id, or nothing for a create or with nothing out.
 */
export const goalIdOf = (out: Outgoing | undefined) => (
  out && 'goalId' in out ? out.goalId : undefined
);

/**
 * Finds the goal the open edit drawer is about.
 *
 * @param goals - The Experience's goals.
 * @param state - The Flow's state.
 * @returns It, or nothing while no edit drawer is open (or once it is gone).
 */
const editTargetOf = (goals: GoalsView, state: GoalManagementState) => (
  state.drawer?.kind === 'edit' ? goalIn(goals, state.drawer.goalId) : undefined
);

/** A transition the panel applies to the Flow's state. */
type Apply = (update: (state: GoalManagementState) => GoalManagementState) => void;

/**
 * Tells whether a drawer shows: Add, or Edit while its goal is still listed.
 *
 * @param state - The Flow's state.
 * @param editTarget - The goal the edit drawer is about, if still listed.
 * @returns Whether the drawer renders.
 */
const isDrawerShown = (state: GoalManagementState, editTarget: unknown) => (
  state.drawer?.kind === 'create' || editTarget !== undefined
);

/**
 * Builds the edit drawer's steps (OQ-195): the open confirm, whether a step
 * is out, and the handlers that move the Flow's state.
 *
 * @param state - The Flow's state.
 * @param onConfirm - Sends the open step.
 * @param apply - Applies a transition to the Flow's state.
 * @returns The steps.
 */
const stepsOf = (
  state: GoalManagementState,
  onConfirm: () => void,
  apply: Apply,
): GoalSteps => ({
  confirm: state.confirm,
  busy: state.out !== undefined && isGoalAction(state.out),
  onAsk: (action: GoalAction) => apply((current) => confirmOpened(current, action)),
  onConfirm,
  onCancel: () => apply(confirmCancelled),
});

/**
 * Renders the banners over the list: a refetch that failed, and the shown
 * status's progress read that never loaded — its cards then show their
 * definitions alone (OQ-195).
 *
 * @param props - Whether the lists are stale, how the shown progress read went, and the retry.
 * @returns The banners, if any.
 */
function Banners({ stale, progress, onRetry }: {
  readonly stale: boolean;
  readonly progress: ProgressStatus;
  readonly onRetry: () => void;
}) {
  const translator = useI18n();
  const retry = (
    <Button variant="ghost" onClick={onRetry}>{translator.text('goalManagement', 'retry')}</Button>
  );
  return (
    <>
      {stale && (
        <InlineBanner
          tone="error"
          message={translator.text('goalManagement', 'refresh.failed')}
          action={retry}
        />
      )}
      {progress === 'failed' && (
        <InlineBanner
          tone="info"
          message={translator.text('goalManagement', 'progress.failed')}
          action={retry}
        />
      )}
    </>
  );
}

/**
 * Renders whichever drawer is open: Add, or Edit while its goal is still listed.
 *
 * @param props - The goals, the state, the actor's role and the handlers.
 * @returns The drawer, or nothing.
 */
function PanelDrawer({
  goals, state, role, onSubmit, onConfirm, apply,
}: Pick<GoalsPanelProps, 'goals' | 'state' | 'role' | 'onSubmit' | 'onConfirm' | 'apply'>) {
  const translator = useI18n();
  const { out, lastError } = state;
  const editTarget = editTargetOf(goals, state);
  if (!isDrawerShown(state, editTarget)) return null;
  return (
    <GoalDrawer
      key={editTarget?.id ?? 'create'}
      goal={editTarget}
      personalOnly={!mayShareOwned(role)}
      busy={isFormOut(out)}
      disabled={out !== undefined}
      alert={lastError && translator.error(lastError.code, lastError.params)}
      onSubmit={onSubmit}
      onCancel={() => apply(drawerClosed)}
      steps={editTarget && stepsOf(state, onConfirm, apply)}
    />
  );
}

/** The loaded panel's props: the goals, the state, the actor and the Flow's handlers. */
interface GoalsPanelProps {
  readonly goals: GoalsView;
  readonly stale: boolean;
  readonly state: GoalManagementState;
  readonly today: string;
  readonly selfUserId: string;
  readonly role?: string | undefined;
  readonly onRetry: () => void;
  readonly onSubmit: (fields: NewGoal) => void;
  readonly onConfirm: () => void;
  readonly apply: Apply;
  /** Whether the Flow's tab is the open one: hidden, no drawer shows. */
  readonly active: boolean;
}

/**
 * Renders the loaded panel: the banners, Add goal, the list and whatever
 * drawer is open while the tab is.
 *
 * @param props - The goals, the state, the actor and the handlers.
 * @returns The panel.
 */
function GoalsPanel({
  goals, stale, state, today, selfUserId, role, onRetry, onSubmit, onConfirm, apply, active,
}: GoalsPanelProps) {
  const translator = useI18n();
  const { out } = state;

  return (
    <div className="flex flex-col gap-6">
      <Banners stale={stale} progress={goals.progress[state.status]} onRetry={onRetry} />
      {mayCreateOwned(role) && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            leadingIcon="add"
            disabled={out !== undefined}
            onClick={() => apply((current) => drawerOpened(current, { kind: 'create' }))}
          >
            {translator.text('goalManagement', 'add')}
          </Button>
        </div>
      )}
      <GoalList
        status={state.status}
        counts={{
          active: entriesOf(goals, 'active').length,
          completed: entriesOf(goals, 'completed').length,
        }}
        entries={entriesOf(goals, state.status)}
        today={today}
        rates={state.rates}
        progress={goals.progress[state.status]}
        isManageable={(goal) => mayManageOwned(goal, selfUserId, role)}
        onStatus={(status) => apply((current) => statusChanged(current, status))}
        onEdit={(goalId) => apply((current) => drawerOpened(current, { kind: 'edit', goalId }))}
        onRate={(pair, rate) => apply((current) => rateEntered(current, pair, rate))}
      />
      {active && (
        <PanelDrawer
          goals={goals}
          state={state}
          role={role}
          onSubmit={onSubmit}
          onConfirm={onConfirm}
          apply={apply}
        />
      )}
    </div>
  );
}

/**
 * Renders the goals panel and runs its requests.
 *
 * @param props - The actor, their role, the Experience's goals and its requests.
 * @returns The panel with whatever drawer or confirm is open.
 */
export function GoalManagementFlow({
  selfUserId, role, goals, onRetry, onCreate, onEdit, onDelete, onComplete, onReopen,
  active = true,
}: GoalManagementFlowProps) {
  const translator = useI18n();
  const alerts = useAlerts();
  const [state, setState] = useState<GoalManagementState>(INITIAL_GOALS);
  useDrawerClosedOnHide(active, setState, drawerClosed);
  const today = useToday();
  const joint = jointStatusOf(goals);

  /**
   * Sends a request and applies its answer: a success closes what it came
   * from and is toasted; a form's failure stays in its banner, a card's — and
   * an edit's whose goal is gone — is toasted. One request at a time.
   *
   * @param outgoing - Which request goes out.
   * @param subject - The goal's name for the toast, as sent.
   * @param request - The Experience's request for it.
   */
  const run = async (
    outgoing: Outgoing,
    subject: string,
    request: () => Promise<RequestOutcome>,
  ) => {
    if (state.out) return;
    // Read before the request: the list fetched again may no longer hold it.
    const former = goalIn(goals, goalIdOf(outgoing))?.name ?? subject;
    setState((current) => started(current, outgoing));
    const outcome = await request();
    setState((current) => afterAction(current, outcome));
    if (outcome.ok) {
      alerts.success(translator.text('goalManagement', `${outgoing.kind}.done`, { name: subject }));
    } else if (toastsFailure(outgoing, outcome.error)) {
      alerts.error(failureToastOf(outgoing, outcome.error, former, translator));
    }
  };

  /**
   * Sends the open drawer's fields: a create, or an edit of its goal — the
   * visibility left out, as it never changes (OQ-177).
   *
   * @param fields - The form's fields as they passed.
   */
  const submit = (fields: NewGoal) => {
    const { drawer } = state;
    if (drawer?.kind === 'edit') {
      const edit = {
        goalId: drawer.goalId,
        name: fields.name,
        targetAmount: fields.targetAmount,
        targetCurrency: fields.targetCurrency,
        dueDate: fields.dueDate,
      };
      run({ kind: 'edit', goalId: drawer.goalId }, fields.name, () => onEdit(edit));
      return;
    }
    run({ kind: 'create' }, fields.name, () => onCreate(fields));
  };

  /** Confirms the edit drawer's open step on its goal. */
  const confirm = () => {
    const step = state.confirm;
    const target = editTargetOf(goals, state);
    if (!step || !target) return;
    const requests = { complete: onComplete, reopen: onReopen, delete: onDelete };
    run({ kind: step, goalId: target.id }, target.name, () => requests[step](target.id));
  };

  if (joint.status === 'failed') {
    return (
      <EmptyState
        icon="error-outline"
        title={translator.text('goalManagement', 'load.failed')}
        action={<Button onClick={onRetry}>{translator.text('goalManagement', 'retry')}</Button>}
      />
    );
  }
  if (joint.status === 'loading') {
    return <SkeletonRows label={translator.text('goalManagement', 'loading')} />;
  }
  return (
    <GoalsPanel
      goals={goals}
      stale={joint.stale}
      state={state}
      today={today}
      selfUserId={selfUserId}
      role={role}
      onRetry={onRetry}
      onSubmit={submit}
      onConfirm={confirm}
      apply={setState}
      active={active}
    />
  );
}
