import { useState, type ReactNode } from 'react';
import type {
  Budget, Category, Currency,
} from '@financas/api-types';
import { budgets as budgetSettings, money } from '../../../../../config/constants';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { Button } from '../../../../../kit/button/Button';
import { DangerZone } from '../../../../../kit/card/DangerZone';
import { InlineConfirm } from '../../../../../kit/confirm/InlineConfirm';
import { Drawer } from '../../../../../kit/drawer/Drawer';
import { LockedField } from '../../../../../kit/field/LockedField';
import { MoneyInput } from '../../../../../kit/moneyInput/MoneyInput';
import { SegmentedControl } from '../../../../../kit/segmentedControl/SegmentedControl';
import { TextField } from '../../../../../kit/textField/TextField';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { Translator } from '../../../../../utilities/i18n';
import useFocusFirstInvalid from '../../../../../utilities/useFocusFirstInvalid';
import { nonBlank } from '../../../../../utilities/validation';
import type { NewBudget } from '../budgetManagementState';
import {
  availablePicks, claimsIn, isEmptyPick, NO_PICKS, pickerGroupsOf, picksOf, targetsOf,
  toggleCategory, toggleSubcategory, type Picks, type Visibility,
} from '../claims';
import { CoverPicker } from './CoverPicker';

// The budget drawer (FL13, mockup 42; FR-4.1/4.2, OQ-176, OQ-194): one form
// for Add and Edit — the name, the currency and visibility (picked on Add,
// shown locked on Edit: they never change), the monthly target in the hero
// money look, the claim-aware Covers picker and, on Edit, Delete behind its
// inline confirm in a danger zone — as an account's drawer holds Archive. The
// visibility picks the scope the claims are weighed in, so switching it
// re-reads which rows are free; a tick another budget took meanwhile is
// dropped from what is sent.
// It holds what is typed, checks it before emitting, and shows the server's
// objections in its banner. The drawer itself (open/close) belongs to the Flow.

/** How each visibility's pill looks (mockup 42). */
const VISIBILITY_OPTIONS = [
  { value: 'personal', icon: 'person-outline', label: 'visibility.personal' },
  { value: 'shared', icon: 'group-outline', label: 'visibility.shared' },
] as const;

/** The form's refusals, already translated, by field. */
interface Objections {
  readonly name?: string | undefined;
  readonly target?: string | undefined;
  readonly covers?: string | undefined;
}

/**
 * Checks the form before it is sent.
 *
 * @param name - The typed name.
 * @param target - The monthly target in minor units, or nothing typed.
 * @param picks - What is ticked and still free.
 * @param translator - The texts.
 * @returns Each field's refusal, if any.
 */
export const objectionsOf = (
  name: string,
  target: number | null,
  picks: Picks,
  translator: Translator,
): Objections => {
  const blank = nonBlank(name);
  return {
    name: blank && translator.field(blank.code, blank.params),
    target: target === null || target < 1
      ? translator.text('budgetManagement', 'error.target')
      : undefined,
    covers: isEmptyPick(picks) ? translator.text('budgetManagement', 'error.covers') : undefined,
  };
};

/**
 * Tells whether the form may be sent.
 *
 * @param objections - The form's refusals.
 * @returns Whether none is set.
 */
const passes = (objections: Objections) => Object.values(objections).every(
  (objection) => objection === undefined,
);

/** What the form starts from. */
export interface InitialFields {
  readonly name: string;
  readonly currency: Currency;
  readonly visibility: Visibility;
  readonly target: number | null;
  /** What the edited budget holds on the server: nothing on a create. */
  readonly held: Picks;
}

/**
 * Builds the form's starting fields: the budget's on an edit; on a create, an
 * empty form in BRL, shared unless the actor can't share (mockup 42).
 *
 * @param budget - The budget an edit is about, if any.
 * @param personalOnly - The actor can't share (a Viewer).
 * @returns The fields the form opens with.
 */
export const initialFieldsOf = (
  budget: Budget | undefined,
  personalOnly: boolean,
): InitialFields => (budget
  ? {
    name: budget.name,
    currency: budget.currency,
    visibility: budget.visibility,
    target: budget.targetAmount,
    held: picksOf(budget.targets),
  }
  : {
    name: '',
    currency: 'BRL',
    visibility: personalOnly ? 'personal' : 'shared',
    target: null,
    held: NO_PICKS,
  });

/** BudgetDrawer's props. */
export interface BudgetDrawerProps {
  /** The budget an edit is about; a create has none. */
  readonly budget?: Budget | undefined;
  /** The household's categories, archived included. */
  readonly categories: readonly Category[];
  /** Every budget the caller can see: who claims what. */
  readonly budgets: readonly Budget[];
  /** The signed-in user: a personal scope is theirs. */
  readonly selfUserId: string;
  /** The actor can't share (a Viewer): a new budget is personal. */
  readonly personalOnly: boolean;
  /** This drawer's request is out: its button spins. */
  readonly busy: boolean;
  /** A request is out: the buttons wait — Cancel too, so its answer has a banner. */
  readonly disabled: boolean;
  /** The last request's failure, already translated. */
  readonly alert?: string | undefined;
  /** The delete confirm is open inside this edit drawer. */
  readonly deleteConfirmOpen: boolean;
  /** The delete is out: the confirm spins. */
  readonly deleteBusy: boolean;
  /** Opens the delete confirm (an edit only). */
  readonly onOpenDelete: () => void;
  /** Deletes the budget; the confirm is already open. */
  readonly onDelete: () => void;
  /** Closes the delete confirm; the drawer stays. */
  readonly onCloseDelete: () => void;
  /** Gets the fields once they pass (currency and visibility as they stand on an edit). */
  readonly onSubmit: (fields: NewBudget) => void;
  /** Closes the drawer. */
  readonly onCancel: () => void;
}

/**
 * Renders a pill group under its visible label, as mockup 42 draws them (the
 * group carries the same name for screen readers, so the text is hidden from them).
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
 * Renders the currency and visibility: picked on a create, locked on an edit
 * (Guided Setup's budget step uses it too, OQ-196).
 *
 * @param props - The values, whether they are locked, who may share, and the setters.
 * @returns The two fields and their note.
 */
export function ScopeFields({
  locked, personalOnly, currency, visibility, onCurrency, onVisibility,
}: {
  readonly locked: boolean;
  readonly personalOnly: boolean;
  readonly currency: Currency;
  readonly visibility: Visibility;
  readonly onCurrency: (currency: Currency) => void;
  readonly onVisibility: (visibility: Visibility) => void;
}) {
  const translator = useI18n();
  const visibilityLabel = translator.text('budgetManagement', `visibility.${visibility}`);
  const lockVisibility = locked || personalOnly;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-x-6 gap-y-4 [&>*]:min-w-0">
        {locked ? (
          <LockedField
            label={translator.text('budgetManagement', 'field.currency')}
            value={currency}
          />
        ) : (
          <LabelledPills label={translator.text('budgetManagement', 'field.currency')}>
            <SegmentedControl
              label={translator.text('budgetManagement', 'field.currency')}
              options={money.currencies.map((value) => ({ value, label: value }))}
              value={currency}
              onChange={onCurrency}
            />
          </LabelledPills>
        )}
        {lockVisibility ? (
          <LockedField
            label={translator.text('budgetManagement', 'field.visibility')}
            value={visibilityLabel}
          />
        ) : (
          <LabelledPills label={translator.text('budgetManagement', 'field.visibility')}>
            <SegmentedControl
              label={translator.text('budgetManagement', 'field.visibility')}
              options={VISIBILITY_OPTIONS.map((option) => ({
                value: option.value,
                icon: option.icon,
                label: translator.text('budgetManagement', option.label),
              }))}
              value={visibility}
              onChange={onVisibility}
            />
          </LabelledPills>
        )}
      </div>
      <span className="type-caption text-muted">
        {translator.text('budgetManagement', 'lockedNote')}
      </span>
    </div>
  );
}

/** What the edit drawer's delete zone shows and does. */
interface DeleteZoneProps {
  readonly name: string;
  readonly confirmOpen: boolean;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}

/**
 * Renders the edit drawer's danger zone: Delete behind its inline confirm, as
 * an account's drawer holds Archive (OQ-194). A hard delete (FR-4.10).
 *
 * @param props - The budget's name, the confirm's state and its handlers.
 * @returns The zone.
 */
function DeleteZone({
  name, confirmOpen, busy, disabled, onOpen, onDelete, onClose,
}: DeleteZoneProps) {
  const translator = useI18n();
  return (
    <DangerZone
      title={translator.text('budgetManagement', 'delete.title')}
      description={translator.text('budgetManagement', 'delete.description')}
      actionLabel={translator.text('budgetManagement', 'delete.action')}
      onAction={onOpen}
      disabled={disabled}
      confirm={confirmOpen ? (
        <InlineConfirm
          tone="destructive"
          message={translator.text('budgetManagement', 'delete.confirm', { name })}
          confirmLabel={translator.text('budgetManagement', 'delete.action')}
          cancelLabel={translator.text('budgetManagement', 'cancel')}
          busy={busy}
          disabled={disabled}
          onConfirm={onDelete}
          onCancel={onClose}
        />
      ) : undefined}
    />
  );
}

/**
 * Renders the budget form inside the drawer.
 *
 * @param props - The budget (on an edit), the lists, the actor, the busy state and the handlers.
 * @returns The drawer with its form.
 */
export function BudgetDrawer({
  budget, categories, budgets, selfUserId, personalOnly, busy, disabled, alert, deleteConfirmOpen,
  deleteBusy, onOpenDelete, onDelete, onCloseDelete, onSubmit, onCancel,
}: BudgetDrawerProps) {
  const translator = useI18n();
  const [initial] = useState(() => initialFieldsOf(budget, personalOnly));
  const { held } = initial;
  const [name, setName] = useState(initial.name);
  const [currency, setCurrency] = useState(initial.currency);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [target, setTarget] = useState(initial.target);
  const [picks, setPicks] = useState(held);
  const [objections, setObjections] = useState<Objections>({});
  const [refusals, setRefusals] = useState(0);
  useFocusFirstInvalid(refusals);

  const claims = claimsIn(budgets, { visibility, selfUserId, exceptBudgetId: budget?.id });
  const groups = pickerGroupsOf(categories, claims, picks, held);
  const mode = budget ? 'edit' : 'create';

  /**
   * Changes the ticks and drops the covers' refusal.
   *
   * @param next - The ticks after the change.
   */
  const changePicks = (next: Picks) => {
    setPicks(next);
    setObjections((current) => ({ ...current, covers: undefined }));
  };

  /** Checks the fields and emits them when they pass; the first problem takes the focus. */
  const submit = () => {
    const available = availablePicks(groups);
    const found = objectionsOf(name, target, available, translator);
    setObjections(found);
    if (!passes(found) || target === null) {
      setRefusals((count) => count + 1);
      return;
    }
    onSubmit({
      name: name.trim(), targetAmount: target, currency, visibility, targets: targetsOf(available),
    });
  };

  return (
    <Drawer
      open
      onClose={onCancel}
      caption={translator.text('budgetManagement', `${mode}.caption`)}
      title={translator.text('budgetManagement', `${mode}.title`)}
      footer={(
        <>
          <Button variant="secondary" disabled={disabled} onClick={onCancel}>
            {translator.text('budgetManagement', 'cancel')}
          </Button>
          <Button variant="primary" busy={busy} disabled={disabled && !busy} onClick={submit}>
            {translator.text('budgetManagement', `${mode}.submit`)}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-5">
        {alert && <InlineBanner tone="error" message={alert} />}
        <TextField
          label={translator.text('budgetManagement', 'field.name')}
          value={name}
          maxLength={budgetSettings.nameMaxLength}
          onChange={(value) => {
            setName(value);
            setObjections((current) => ({ ...current, name: undefined }));
          }}
          error={objections.name}
        />
        <ScopeFields
          locked={budget !== undefined}
          personalOnly={personalOnly}
          currency={currency}
          visibility={visibility}
          onCurrency={setCurrency}
          onVisibility={setVisibility}
        />
        <MoneyInput
          variant="hero"
          label={translator.text('budgetManagement', 'field.target')}
          currency={currency}
          value={target}
          onChange={(amount) => {
            setTarget(amount);
            setObjections((current) => ({ ...current, target: undefined }));
          }}
          error={objections.target}
        />
        <CoverPicker
          groups={groups}
          disabled={disabled}
          error={objections.covers}
          onToggleCategory={(category) => changePicks(toggleCategory(picks, category))}
          onToggleSubcategory={(subcategoryId) => (
            changePicks(toggleSubcategory(picks, subcategoryId))
          )}
        />
        {budget && (
          <DeleteZone
            name={budget.name}
            confirmOpen={deleteConfirmOpen}
            busy={deleteBusy}
            disabled={disabled}
            onOpen={onOpenDelete}
            onDelete={onDelete}
            onClose={onCloseDelete}
          />
        )}
      </div>
    </Drawer>
  );
}
