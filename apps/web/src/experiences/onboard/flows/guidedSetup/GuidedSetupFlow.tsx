import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../../../kit/button/Button';
import { IconButton } from '../../../../kit/button/IconButton';
import { Card } from '../../../../kit/card/Card';
import { EmptyState } from '../../../../kit/emptyState/EmptyState';
import { Icon } from '../../../../kit/icons/Icon';
import { WizardLayout } from '../../../../kit/layouts/WizardLayout';
import { SkeletonRows } from '../../../../kit/skeleton/Skeleton';
import { Stepper } from '../../../../kit/stepper/Stepper';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { RequestOutcome } from '../../../../utilities/requestOutcome';
import useFormatter from '../../../../utilities/useFormatter';
import type {
  AccountActionOutcome, AccountsOutcome, NewAccount,
} from '../../../accountSetup/flows/accountManagement/accountManagementState';
import type {
  BudgetEdit, NewBudget,
} from '../../../accountSetup/flows/budgetManagement/budgetManagementState';
import { alertOf, coverChipsOf, jointViewOf } from '../../../accountSetup/budgetForm';
import { mayManageOwned, mayShareOwned } from '../../../accountSetup/ownership';
import type { BudgetsView, CategoriesView } from '../../../accountSetup/sharedLists';
import {
  accountFormToggled, afterAccountCreate, afterAccountsLoad, afterBudgetWrite, budgetFormOpened,
  discardCancelled, finishRequested, INITIAL_GUIDED_SETUP, liveAccountsOf, loadingAccounts,
  nextStep, previousStep, showsAccountForm, started, stepMoved, STEPPED, summaryOf,
  type GuidedSetupState, type SetupDestination, type SteppedStep,
} from './guidedSetupState';
import { BudgetEntry } from './interactions/BudgetEntry';
import { FirstAccountEntry } from './interactions/FirstAccountEntry';
import { SetupCompleteSummary } from './interactions/SetupCompleteSummary';
import { SetupDoneRow } from './interactions/SetupDoneRow';
import { WizardNavigation } from './interactions/WizardNavigation';

// The Guided Setup Flow (FL6, mockups 11–14; FR-1.22, OQ-63, OQ-196): a new
// household's first steps, right after it is named. Three steps beside the
// stepper — add an account (mandatory: there is no way on until the household
// has one), review the seeded categories, set a budget (both optional) — then
// the summary with the next steps. The account and budget steps hold their
// forms inline, as the mockups draw them; the categories step shows Account
// Setup's Category Management Flow, which the Experience renders and hands in
// (EBD: Experiences compose Flows). It owns the step, the accounts
// (loaded once, then grown by each create), what is out and the last failure;
// the categories and budgets are the Experience's, handed down. It never calls
// the backend: every request goes up to the Experience hosting it (Onboard),
// which answers an outcome; a finish emits where to go.

/** What the Flow asks of the Experience, and the way out it emits. */
export interface GuidedSetupFlowProps {
  /** The household being set up, for the summary's title. */
  readonly householdName: string;
  /** The signed-in user's id: who owns what. */
  readonly selfUserId: string;
  /** Their role in this household (FR-1.7). */
  readonly role?: string | undefined;
  /** Lists the household's accounts, archived included. */
  readonly onLoadAccounts: () => Promise<AccountsOutcome>;
  /** `POST /households/:id/accounts`. */
  readonly onCreateAccount: (account: NewAccount) => Promise<AccountActionOutcome>;
  /** The household's categories: the budget step's picker and the summary's count. */
  readonly categories: CategoriesView;
  /** Fetches the categories again after a failed load. */
  readonly onRetryCategories: () => void;
  /** The Category Management Flow as the Experience renders it, for the categories step. */
  readonly categoryManagement: ReactNode;
  /** The budgets the caller can see: the budget step's list and its claims. */
  readonly budgets: BudgetsView;
  /** Fetches the budgets again after a failed load. */
  readonly onRetryBudgets: () => void;
  /** `POST /households/:id/budgets`. */
  readonly onCreateBudget: (budget: NewBudget) => Promise<RequestOutcome>;
  /** `PATCH /households/:id/budgets/:budgetId`. */
  readonly onEditBudget: (edit: BudgetEdit) => Promise<RequestOutcome>;
  /** Leaves the wizard for a destination (mockup 14). */
  readonly onFinish: (destination: SetupDestination) => void;
}

/** The dashed tip under the stepper (mockups 11–13). */
const TIP = [
  'mt-8 flex gap-2 rounded-2xl border border-dashed border-line p-4',
  'type-caption text-faint',
].join(' ');

/** The stepper's texts for each step. */
const STEP_KEYS = {
  account: 'step.account',
  categories: 'step.categories',
  budget: 'step.budget',
} as const;

/**
 * Renders the stepper and its tip beside the step (mockups 11–13).
 *
 * @param props - The open step.
 * @returns The aside.
 */
function SetupAside({ step }: { readonly step: SteppedStep }) {
  const translator = useI18n();
  const current = STEPPED.indexOf(step);
  return (
    <>
      <Stepper
        ariaLabel={translator.text('guidedSetup', 'stepper.label')}
        completedLabel={translator.text('guidedSetup', 'stepper.completed')}
        caption={translator.text('guidedSetup', 'caption', {
          current: current + 1, total: STEPPED.length,
        })}
        current={current}
        steps={STEPPED.map((stepped) => {
          const key = STEP_KEYS[stepped];
          return {
            label: translator.text('guidedSetup', key),
            hint: translator.text('guidedSetup', `${key}.hint`),
          };
        })}
      />
      <p className={TIP}>
        <Icon name="lightbulb-outline" className="size-4 shrink-0" />
        {translator.text('guidedSetup', 'tip')}
      </p>
    </>
  );
}

/**
 * Renders a step's card: its title, the line under it and its content.
 *
 * @param props - The texts and the content.
 * @returns The card.
 */
function StepCard({ title, subtitle, children }: {
  readonly title: string;
  readonly subtitle: string;
  readonly children: ReactNode;
}) {
  return (
    <Card size="lg" as="section" className="flex flex-col gap-5">
      <div>
        <h1 className="type-heading-lg">{title}</h1>
        <p className="mt-1 text-muted">{subtitle}</p>
      </div>
      {children}
    </Card>
  );
}

/** What a step needs from the Flow: its props, its state and its handlers. */
interface StepProps {
  readonly flow: GuidedSetupFlowProps;
  readonly state: GuidedSetupState;
  readonly setState: (update: (state: GuidedSetupState) => GuidedSetupState) => void;
  /** Sends a request and applies its answer, one at a time. */
  readonly run: <Outcome extends RequestOutcome>(
    out: 'account' | 'budget',
    request: () => Promise<Outcome>,
    apply: (state: GuidedSetupState, outcome: Outcome) => GuidedSetupState,
  ) => void;
}

/**
 * Renders the accounts added so far, or their loading or failure.
 *
 * @param props - The Flow's state and the retry.
 * @returns The list, or nothing while it is empty.
 */
function AddedAccounts({ state, onRetry }: {
  readonly state: GuidedSetupState;
  readonly onRetry: () => void;
}) {
  const translator = useI18n();
  const { accounts } = state;
  if (accounts.status === 'loading') {
    return <SkeletonRows count={1} label={translator.text('guidedSetup', 'account.loading')} />;
  }
  if (accounts.status === 'failed') {
    return (
      <EmptyState
        icon="error-outline"
        title={translator.text('guidedSetup', 'account.failed')}
        action={<Button onClick={onRetry}>{translator.text('guidedSetup', 'retry')}</Button>}
      />
    );
  }
  const live = liveAccountsOf(accounts);
  if (live.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {live.map((account) => (
        <SetupDoneRow
          key={account.id}
          title={account.name}
          detail={translator.text('guidedSetup', 'account.row', {
            type: translator.text('accountSetup', `type.${account.type}`),
            currency: account.currency,
            cards: account.cards.length,
          })}
        />
      ))}
    </ul>
  );
}

/**
 * Renders the account step: the accounts added so far, then the form — or,
 * once there is an account, Add another and Continue.
 *
 * @param props - The Flow's props, state and handlers.
 * @returns The step's card.
 */
function AccountStep({
  flow, state, setState, run,
}: StepProps) {
  const translator = useI18n();
  const added = liveAccountsOf(state.accounts).length > 0;
  const { lastError } = state;

  /** Sends the account the form emitted. */
  const create = (account: NewAccount) => (
    run('account', () => flow.onCreateAccount(account), afterAccountCreate)
  );

  /** Closes the form beside the accounts already added. */
  const closeForm = () => setState((current) => accountFormToggled(current, false));

  /** Fetches the accounts again (a retry): the Flow's load effect sends it. */
  const reload = () => setState(loadingAccounts);

  return (
    <StepCard
      title={translator.text('guidedSetup', added ? 'account.added.title' : 'account.title')}
      subtitle={translator.text(
        'guidedSetup',
        added ? 'account.added.subtitle' : 'account.subtitle',
      )}
    >
      <AddedAccounts state={state} onRetry={reload} />
      {showsAccountForm(state) ? (
        <FirstAccountEntry
          busy={state.out === 'account'}
          alert={lastError && translator.error(lastError.code, lastError.params)}
          personalOnly={!mayShareOwned(flow.role)}
          onSubmit={create}
          onCancel={added ? closeForm : undefined}
        />
      ) : state.accounts.status === 'loaded' && (
        <WizardNavigation
          secondary={{
            label: translator.text('guidedSetup', 'account.addAnother'),
            onClick: () => setState((current) => accountFormToggled(current, true)),
          }}
          primary={{
            label: translator.text('guidedSetup', 'continue'),
            trailingIcon: 'arrow-forward',
            onClick: () => setState((current) => stepMoved(current, nextStep(current.step))),
          }}
        />
      )}
    </StepCard>
  );
}

/**
 * Renders the categories step: Category Management as the Experience hands it
 * in, then Back and "Looks good, continue".
 *
 * @param props - The Flow's props and handlers.
 * @returns The step's card.
 */
function CategoriesStep({ flow, setState }: Pick<StepProps, 'flow' | 'setState'>) {
  const translator = useI18n();
  return (
    <StepCard
      title={translator.text('guidedSetup', 'categories.title')}
      subtitle={translator.text('guidedSetup', 'categories.subtitle')}
    >
      {flow.categoryManagement}
      <WizardNavigation
        onBack={() => setState((current) => stepMoved(current, previousStep(current.step)))}
        primary={{
          label: translator.text('guidedSetup', 'categories.continue'),
          trailingIcon: 'arrow-forward',
          onClick: () => setState((current) => stepMoved(current, nextStep(current.step))),
        }}
      />
    </StepCard>
  );
}

/**
 * Renders the budget step: the budgets made so far, each with its Edit, then
 * the form for a new one or the one being edited.
 *
 * @param props - The Flow's props, state and handlers.
 * @returns The step's card content.
 */
function BudgetStepBody({
  flow, state, setState, run,
}: StepProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  const view = jointViewOf(flow.budgets, flow.categories);
  if (view.status === 'failed') {
    return (
      <EmptyState
        icon="error-outline"
        title={translator.text('budgetManagement', 'load.failed')}
        action={(
          <Button onClick={() => {
            flow.onRetryBudgets();
            flow.onRetryCategories();
          }}
          >
            {translator.text('budgetManagement', 'retry')}
          </Button>
        )}
      />
    );
  }
  if (view.status === 'loading') {
    return <SkeletonRows label={translator.text('budgetManagement', 'loading')} />;
  }

  const { budgets, categories } = view;
  const editing = budgets.find((budget) => budget.id === state.editingBudgetId);
  const busy = state.out === 'budget';
  const send = (request: () => Promise<RequestOutcome>) => run('budget', request, afterBudgetWrite);

  return (
    <>
      {budgets.length > 0 && (
        <ul className="flex flex-col gap-2">
          {budgets.map((budget) => (
            <SetupDoneRow
              key={budget.id}
              title={translator.text('guidedSetup', 'budget.row', {
                name: budget.name, amount: formatter.money(budget.targetAmount, budget.currency),
              })}
              detail={formatter.list(
                coverChipsOf(budget.targets, categories).map((chip) => chip.name),
              )}
              trailing={mayManageOwned(budget, flow.selfUserId, flow.role) && (
                <IconButton
                  icon="edit-outline"
                  size="sm"
                  label={translator.text('guidedSetup', 'budget.edit', { name: budget.name })}
                  disabled={busy}
                  onClick={() => setState((current) => budgetFormOpened(current, budget.id))}
                />
              )}
            />
          ))}
        </ul>
      )}
      {budgets.length > 0 && editing === undefined && (
        <div className="flex items-center gap-3 type-caption text-faint">
          <span className="h-px flex-1 bg-line" />
          {translator.text('guidedSetup', 'budget.addAnother')}
          <span className="h-px flex-1 bg-line" />
        </div>
      )}
      <BudgetEntry
        key={state.budgetFormKey}
        budget={editing}
        categories={categories}
        budgets={budgets}
        selfUserId={flow.selfUserId}
        personalOnly={!mayShareOwned(flow.role)}
        busy={busy}
        alert={alertOf(state.lastError, view, translator)}
        discardConfirmOpen={state.discardConfirmOpen}
        onCreate={(budget) => send(() => flow.onCreateBudget(budget))}
        onEdit={(edit) => send(() => flow.onEditBudget(edit))}
        onCancelEdit={() => setState((current) => budgetFormOpened(current, undefined))}
        onBack={() => setState((current) => stepMoved(current, previousStep(current.step)))}
        onFinish={(unsaved) => setState((current) => finishRequested(current, unsaved))}
        onDiscard={() => setState((current) => stepMoved(current, 'complete'))}
        onKeepEditing={() => setState(discardCancelled)}
      />
    </>
  );
}

/**
 * Renders the open step's card.
 *
 * @param props - The Flow's props, state and handlers.
 * @returns The card.
 */
function OpenStep({
  flow, state, setState, run,
}: StepProps) {
  const translator = useI18n();
  const { step } = state;
  if (step === 'account') {
    return <AccountStep flow={flow} state={state} setState={setState} run={run} />;
  }
  if (step === 'categories') return <CategoriesStep flow={flow} setState={setState} />;
  return (
    <StepCard
      title={translator.text('guidedSetup', 'budget.title')}
      subtitle={translator.text('guidedSetup', 'budget.subtitle')}
    >
      <BudgetStepBody flow={flow} state={state} setState={setState} run={run} />
    </StepCard>
  );
}

/**
 * Renders the wizard: the open step beside the stepper, or the summary.
 *
 * @param props - The Experience's lists, requests and way out.
 * @returns The page.
 */
export function GuidedSetupFlow(flow: GuidedSetupFlowProps) {
  const {
    householdName, onLoadAccounts, categories, budgets, onFinish,
  } = flow;
  const [state, setState] = useState<GuidedSetupState>(INITIAL_GUIDED_SETUP);
  const { accountsLoad } = state;

  // The accounts are fetched as the Flow mounts, on each retry (a bumped
  // `accountsLoad`) and for a new `onLoadAccounts`. An answer that lands after
  // unmounting, or after a newer fetch was asked for, drops.
  useEffect(() => {
    let current = true;
    onLoadAccounts().then((outcome) => {
      if (current) setState((latest) => afterAccountsLoad(latest, outcome));
    });
    return () => {
      current = false;
    };
  }, [onLoadAccounts, accountsLoad]);

  /**
   * Sends a request and applies its answer. One at a time: while one is
   * out, another isn't sent, so each answer lands on its own request.
   *
   * @param out - Which request goes out.
   * @param request - The Experience's request for it.
   * @param apply - How its answer moves the state.
   */
  const run: StepProps['run'] = async (out, request, apply) => {
    if (state.out) return;
    setState((current) => started(current, out));
    const outcome = await request();
    setState((current) => apply(current, outcome));
  };

  if (state.step === 'complete') {
    return (
      <WizardLayout width="wide">
        <SetupCompleteSummary
          householdName={householdName}
          summary={summaryOf(state.accounts, categories, budgets)}
          onFinish={onFinish}
        />
      </WizardLayout>
    );
  }
  return (
    <WizardLayout aside={<SetupAside step={state.step} />}>
      <OpenStep flow={flow} state={state} setState={setState} run={run} />
    </WizardLayout>
  );
}
