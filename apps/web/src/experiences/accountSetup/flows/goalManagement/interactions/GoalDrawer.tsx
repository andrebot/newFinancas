import { useState, type ReactNode } from 'react';
import type { Currency, Goal } from '@financas/api-types';
import { goals as goalSettings, money } from '../../../../../config/constants';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { Button } from '../../../../../kit/button/Button';
import { DangerZone } from '../../../../../kit/card/DangerZone';
import { InlineConfirm } from '../../../../../kit/confirm/InlineConfirm';
import { DateInput } from '../../../../../kit/dateInput/DateInput';
import { Drawer } from '../../../../../kit/drawer/Drawer';
import { LockedField } from '../../../../../kit/field/LockedField';
import { MoneyInput } from '../../../../../kit/moneyInput/MoneyInput';
import { SegmentedControl } from '../../../../../kit/segmentedControl/SegmentedControl';
import { TextField } from '../../../../../kit/textField/TextField';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { Translator } from '../../../../../utilities/i18n';
import useFocusFirstInvalid from '../../../../../utilities/useFocusFirstInvalid';
import {
  firstError, isoDate, nonBlank, required,
} from '../../../../../utilities/validation';
import type { GoalAction, NewGoal } from '../goalManagementState';

// The goal drawer (FL14, mockup 43; FR-8.1, OQ-177) — the Goal Form: one form
// for Add and Edit — the name, the target currency, the visibility (picked on
// Add, shown locked on Edit: it never changes), the target in the hero money
// look and the due date (a past one is allowed: overdue is a display state).
// The target currency stays editable on Edit (OQ-177). On Edit the drawer also
// holds the goal's steps, each behind its inline confirm (OQ-195): Mark
// completed — Reopen once completed — and, in a danger zone, Delete, as a
// budget's drawer holds it. Funding is never set
// here — it is the Holding's (OQ-48), as the form's note says. It holds what
// is typed, checks it before emitting, and shows the server's objections in
// its banner. The drawer itself (open/close) belongs to the Flow.

/** How each visibility's pill looks (mockup 43). */
const VISIBILITY_OPTIONS = [
  { value: 'personal', icon: 'person-outline', label: 'visibility.personal' },
  { value: 'shared', icon: 'group-outline', label: 'visibility.shared' },
] as const;

/** The due date's rule: required, and a real calendar date. */
const DUE_DATE_RULE = firstError(required, isoDate());

/** The form's refusals, already translated, by field. */
interface Objections {
  readonly name?: string | undefined;
  readonly target?: string | undefined;
  readonly dueDate?: string | undefined;
}

/**
 * Checks the form before it is sent.
 *
 * @param name - The typed name.
 * @param target - The target in minor units, or nothing typed.
 * @param dueDate - The due date as the Date input emits it.
 * @param translator - The texts.
 * @returns Each field's refusal, if any.
 */
export const objectionsOf = (
  name: string,
  target: number | null,
  dueDate: string,
  translator: Translator,
): Objections => {
  const blank = nonBlank(name);
  const badDate = DUE_DATE_RULE(dueDate);
  return {
    name: blank && translator.field(blank.code, blank.params),
    target: target === null || target < 1
      ? translator.text('goalManagement', 'error.target')
      : undefined,
    dueDate: badDate && translator.field(badDate.code, badDate.params),
  };
};

/** What the form starts from. */
export interface InitialFields {
  readonly name: string;
  readonly currency: Currency;
  readonly visibility: Goal['visibility'];
  readonly target: number | null;
  readonly dueDate: string;
}

/**
 * Builds the form's starting fields: the goal's on an edit; on a create, an
 * empty form in BRL, shared unless the actor can't share (mockup 43).
 *
 * @param goal - The goal an edit is about, if any.
 * @param personalOnly - The actor can't share (a Viewer).
 * @returns The fields the form opens with.
 */
export const initialFieldsOf = (goal: Goal | undefined, personalOnly: boolean): InitialFields => (
  goal
    ? {
      name: goal.name,
      currency: goal.targetCurrency,
      visibility: goal.visibility,
      target: goal.targetAmount,
      dueDate: goal.dueDate,
    }
    : {
      name: '',
      currency: 'BRL',
      visibility: personalOnly ? 'personal' : 'shared',
      target: null,
      dueDate: '',
    });

/** GoalDrawer's props. */
export interface GoalDrawerProps {
  /** The goal an edit is about; a create has none. */
  readonly goal?: Goal | undefined;
  /** The actor can't share (a Viewer): a new goal is personal. */
  readonly personalOnly: boolean;
  /** This drawer's request is out: its button spins. */
  readonly busy: boolean;
  /** A request is out: the buttons wait — Cancel too, so its answer has a banner. */
  readonly disabled: boolean;
  /** The last request's failure, already translated. */
  readonly alert?: string | undefined;
  /** Gets the fields once they pass (the visibility as it stands on an edit). */
  readonly onSubmit: (fields: NewGoal) => void;
  /** Closes the drawer. */
  readonly onCancel: () => void;
  /** The edit drawer's steps; a create has none. */
  readonly steps?: GoalSteps | undefined;
}

/** What the edit drawer's steps show and do (OQ-195). */
export interface GoalSteps {
  /** The step whose confirm is open, if any. */
  readonly confirm?: GoalAction | undefined;
  /** That step's request is out: its confirm spins. */
  readonly busy: boolean;
  /** Opens a step's confirm. */
  readonly onAsk: (action: GoalAction) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** What a step's section needs: the goal, whether a request is out, and the steps. */
interface StepZoneProps {
  readonly goal: Goal;
  readonly disabled: boolean;
  readonly steps: GoalSteps;
}

/**
 * Renders the open step's inline confirm: mint for completing and reopening,
 * which can be undone, coral for deleting, which can't.
 *
 * @param props - The step, the goal's name, whether a request is out, and the steps.
 * @returns The confirm.
 */
function StepConfirm({
  action, name, disabled, steps,
}: {
  readonly action: GoalAction;
  readonly name: string;
  readonly disabled: boolean;
  readonly steps: GoalSteps;
}) {
  const translator = useI18n();
  return (
    <InlineConfirm
      tone={action === 'delete' ? 'destructive' : 'reversible'}
      message={translator.text('goalManagement', `${action}.confirm`, { name })}
      confirmLabel={translator.text('goalManagement', `${action}.action`)}
      cancelLabel={translator.text('goalManagement', 'cancel')}
      busy={steps.busy}
      disabled={disabled}
      onConfirm={steps.onConfirm}
      onCancel={steps.onCancel}
    />
  );
}

/**
 * Renders the lifecycle step: Mark completed for an active goal, Reopen for a
 * completed one — its button, or its confirm once asked.
 *
 * @param props - The goal, whether a request is out, and the steps.
 * @returns The section.
 */
function LifecycleZone({ goal, disabled, steps }: StepZoneProps) {
  const translator = useI18n();
  const action = goal.completedAt === null ? 'complete' : 'reopen';
  return (
    <section className="flex flex-col gap-4 rounded-card border border-line px-5 py-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h2 className="font-semibold">{translator.text('goalManagement', `${action}.title`)}</h2>
          <p className="type-body-sm text-muted">
            {translator.text('goalManagement', `${action}.description`)}
          </p>
        </div>
        {steps.confirm !== action && (
          <Button variant="secondary" disabled={disabled} onClick={() => steps.onAsk(action)}>
            {translator.text('goalManagement', `${action}.action`)}
          </Button>
        )}
      </div>
      {steps.confirm === action && (
        <StepConfirm action={action} name={goal.name} disabled={disabled} steps={steps} />
      )}
    </section>
  );
}

/**
 * Renders the delete step in the drawer's danger zone: a hard delete, the
 * holdings kept (FR-8.6).
 *
 * @param props - The goal, whether a request is out, and the steps.
 * @returns The zone.
 */
function DeleteZone({ goal, disabled, steps }: StepZoneProps) {
  const translator = useI18n();
  return (
    <DangerZone
      title={translator.text('goalManagement', 'delete.title')}
      description={translator.text('goalManagement', 'delete.description')}
      actionLabel={translator.text('goalManagement', 'delete.action')}
      onAction={() => steps.onAsk('delete')}
      disabled={disabled}
      confirm={steps.confirm === 'delete'
        ? <StepConfirm action="delete" name={goal.name} disabled={disabled} steps={steps} />
        : undefined}
    />
  );
}

/**
 * Renders a pill group under its visible label (the group carries the same
 * name for screen readers, so the text is hidden from them).
 *
 * @param props - The label and the group.
 * @returns The labelled group.
 */
function LabelledPills({ label, children }: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span aria-hidden className="type-caption font-semibold text-muted">{label}</span>
      {children}
    </div>
  );
}

/**
 * Renders the visibility: picked on a create by whoever may share, locked
 * otherwise, with its note on an edit.
 *
 * @param props - The value, whether it is locked, and its setter.
 * @returns The field.
 */
function VisibilityField({ locked, visibility, onChange }: {
  readonly locked: boolean;
  readonly visibility: Goal['visibility'];
  readonly onChange: (visibility: Goal['visibility']) => void;
}) {
  const translator = useI18n();
  const label = translator.text('goalManagement', 'field.visibility');
  if (locked) {
    return (
      <LockedField
        label={label}
        value={translator.text('goalManagement', `visibility.${visibility}`)}
      />
    );
  }
  return (
    <LabelledPills label={label}>
      <SegmentedControl
        label={label}
        options={VISIBILITY_OPTIONS.map((option) => ({
          value: option.value,
          icon: option.icon,
          label: translator.text('goalManagement', option.label),
        }))}
        value={visibility}
        onChange={onChange}
      />
    </LabelledPills>
  );
}

/**
 * Renders what follows the fields: on a create, the note that funding comes
 * later (OQ-48); on an edit, the goal's steps (OQ-195).
 *
 * @param props - The goal (on an edit), whether a request is out, and the steps.
 * @returns The note or the steps.
 */
function DrawerFoot({ goal, disabled, steps }: {
  readonly goal?: Goal | undefined;
  readonly disabled: boolean;
  readonly steps?: GoalSteps | undefined;
}) {
  const translator = useI18n();
  if (!goal) {
    return (
      <p className="type-body-sm text-muted">{translator.text('goalManagement', 'fundNote')}</p>
    );
  }
  if (!steps) return null;
  return (
    <>
      <LifecycleZone goal={goal} disabled={disabled} steps={steps} />
      <DeleteZone goal={goal} disabled={disabled} steps={steps} />
    </>
  );
}

/**
 * Renders the goal form inside the drawer.
 *
 * @param props - The goal (on an edit), the actor's rights, the busy state and the handlers.
 * @returns The drawer with its form.
 */
export function GoalDrawer({
  goal, personalOnly, busy, disabled, alert, onSubmit, onCancel, steps,
}: GoalDrawerProps) {
  const translator = useI18n();
  const [initial] = useState(() => initialFieldsOf(goal, personalOnly));
  const [name, setName] = useState(initial.name);
  const [currency, setCurrency] = useState(initial.currency);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [target, setTarget] = useState(initial.target);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [objections, setObjections] = useState<Objections>({});
  const [refusals, setRefusals] = useState(0);
  useFocusFirstInvalid(refusals);
  const mode = goal ? 'edit' : 'create';

  /**
   * Drops one field's refusal once it is changed.
   *
   * @param field - The field.
   */
  const clear = (field: keyof Objections) => setObjections(
    (current) => ({ ...current, [field]: undefined }),
  );

  /** Checks the fields and emits them when they pass; the first problem takes the focus. */
  const submit = () => {
    const found = objectionsOf(name, target, dueDate, translator);
    setObjections(found);
    if (Object.values(found).some(Boolean) || target === null) {
      setRefusals((count) => count + 1);
      return;
    }
    onSubmit({
      name: name.trim(), targetAmount: target, targetCurrency: currency, dueDate, visibility,
    });
  };

  return (
    <Drawer
      open
      onClose={onCancel}
      caption={translator.text('goalManagement', `${mode}.caption`)}
      title={translator.text('goalManagement', `${mode}.title`)}
      footer={(
        <>
          <Button variant="secondary" disabled={disabled} onClick={onCancel}>
            {translator.text('goalManagement', 'cancel')}
          </Button>
          <Button variant="primary" busy={busy} disabled={disabled && !busy} onClick={submit}>
            {translator.text('goalManagement', `${mode}.submit`)}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-5">
        {alert && <InlineBanner tone="error" message={alert} />}
        <TextField
          label={translator.text('goalManagement', 'field.name')}
          value={name}
          maxLength={goalSettings.nameMaxLength}
          onChange={(value) => {
            setName(value);
            clear('name');
          }}
          error={objections.name}
        />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-x-6 gap-y-4 [&>*]:min-w-0">
            <LabelledPills label={translator.text('goalManagement', 'field.currency')}>
              <SegmentedControl
                label={translator.text('goalManagement', 'field.currency')}
                options={money.currencies.map((value) => ({ value, label: value }))}
                value={currency}
                onChange={setCurrency}
              />
            </LabelledPills>
            <VisibilityField
              locked={goal !== undefined || personalOnly}
              visibility={visibility}
              onChange={setVisibility}
            />
          </div>
          {goal && (
            <span className="type-caption text-muted">
              {translator.text('goalManagement', 'lockedNote')}
            </span>
          )}
        </div>
        <MoneyInput
          variant="hero"
          label={translator.text('goalManagement', 'field.target')}
          currency={currency}
          value={target}
          onChange={(amount) => {
            setTarget(amount);
            clear('target');
          }}
          error={objections.target}
        />
        <DateInput
          label={translator.text('goalManagement', 'field.dueDate')}
          value={dueDate}
          onChange={(value) => {
            setDueDate(value);
            clear('dueDate');
          }}
          error={objections.dueDate}
        />
        <DrawerFoot goal={goal} disabled={disabled} steps={steps} />
      </div>
    </Drawer>
  );
}
