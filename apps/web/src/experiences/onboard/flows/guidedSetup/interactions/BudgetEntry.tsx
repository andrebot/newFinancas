import { useState } from 'react';
import type { Budget, Category } from '@financas/api-types';
import { budgets as budgetSettings } from '../../../../../config/constants';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { Button } from '../../../../../kit/button/Button';
import { InlineConfirm } from '../../../../../kit/confirm/InlineConfirm';
import { MoneyInput } from '../../../../../kit/moneyInput/MoneyInput';
import { TextField } from '../../../../../kit/textField/TextField';
import { useI18n } from '../../../../../utilities/I18nProvider';
import useFocusFirstInvalid from '../../../../../utilities/useFocusFirstInvalid';
import type {
  BudgetEdit, NewBudget,
} from '../../../../accountSetup/flows/budgetManagement/budgetManagementState';
import {
  availablePicks, claimsIn, pickerGroupsOf, targetsOf, toggleCategory, toggleSubcategory,
  type Picks,
} from '../../../../accountSetup/budgetClaims';
import {
  initialFieldsOf, objectionsOf, type InitialFields, type Objections,
} from '../../../../accountSetup/budgetForm';
import { ScopeFields } from '../../../../accountSetup/flows/budgetManagement/interactions/BudgetDrawer';
import { CoverPicker } from '../../../../accountSetup/flows/budgetManagement/interactions/CoverPicker';
import { WizardNavigation } from './WizardNavigation';

// Budget Entry (FL6, mockup 13; FR-1.22, OQ-196): the budget step's form,
// inline in the step card, for one budget at a time — a new one, or one made
// earlier in the step loaded back for editing. The name and monthly target,
// the currency and visibility (picked on a create — Shared to start, Personal
// for a Viewer — and locked on an edit, as the budget drawer holds them), and
// the claim-aware Covers picker. Its foot holds Back, "Create budget" (or
// "Save budget") and "Finish setup"; finishing with something typed and not
// saved asks first. It holds what is typed; the Flow sends it and starts it
// afresh after each save.

/** What the form holds now. */
export interface CurrentFields {
  readonly name: string;
  readonly target: number | null;
  readonly picks: Picks;
}

/**
 * Tells whether two id lists hold the same ids.
 *
 * @param left - One list.
 * @param right - The other.
 * @returns Whether they match, in any order.
 */
const sameIds = (left: readonly string[], right: readonly string[]) => (
  left.length === right.length && left.every((id) => right.includes(id))
);

/**
 * Tells whether the form holds something not saved: anything typed on a
 * create, any change on an edit.
 *
 * @param initial - What the form opened with.
 * @param current - What it holds now.
 * @returns Whether finishing would lose it.
 */
export const isUnsaved = (initial: InitialFields, current: CurrentFields): boolean => (
  current.name.trim() !== initial.name
  || current.target !== initial.target
  || !sameIds(current.picks.categoryIds, initial.held.categoryIds)
  || !sameIds(current.picks.subcategoryIds, initial.held.subcategoryIds)
);

/** BudgetEntry's props. */
export interface BudgetEntryProps {
  /** The budget being edited; a create has none. */
  readonly budget?: Budget | undefined;
  /** The household's categories, archived included. */
  readonly categories: readonly Category[];
  /** Every budget the caller can see: who claims what. */
  readonly budgets: readonly Budget[];
  /** The signed-in user: a personal scope is theirs. */
  readonly selfUserId: string;
  /** The actor can't share (a Viewer): a new budget is personal. */
  readonly personalOnly: boolean;
  /** The save is out: its button spins and everything else waits. */
  readonly busy: boolean;
  /** The last save's failure, already translated. */
  readonly alert?: string | undefined;
  /** "Discard the unsaved budget?" is open above the foot. */
  readonly discardConfirmOpen: boolean;
  /** Gets a new budget once its fields pass. */
  readonly onCreate: (budget: NewBudget) => void;
  /** Gets the edited budget's fields once they pass. */
  readonly onEdit: (edit: BudgetEdit) => void;
  /** Leaves the edit for a fresh create. */
  readonly onCancelEdit: () => void;
  readonly onBack: () => void;
  /** Asks to finish, saying whether something typed would be lost. */
  readonly onFinish: (unsaved: boolean) => void;
  /** Drops what was typed and finishes. */
  readonly onDiscard: () => void;
  /** Closes the discard confirm, keeping what was typed. */
  readonly onKeepEditing: () => void;
}

/**
 * Renders the budget step's form and its foot.
 *
 * @param props - The budget (on an edit), the lists, the actor, the state and the handlers.
 * @returns The form.
 */
export function BudgetEntry({
  budget, categories, budgets, selfUserId, personalOnly, busy, alert, discardConfirmOpen,
  onCreate, onEdit, onCancelEdit, onBack, onFinish, onDiscard, onKeepEditing,
}: BudgetEntryProps) {
  const translator = useI18n();
  const [initial] = useState(() => initialFieldsOf(budget));
  const [name, setName] = useState(initial.name);
  const [currency, setCurrency] = useState(initial.currency);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [target, setTarget] = useState(initial.target);
  const [picks, setPicks] = useState(initial.held);
  const [objections, setObjections] = useState<Objections>({});
  const [refusals, setRefusals] = useState(0);
  useFocusFirstInvalid(refusals);

  const claims = claimsIn(budgets, { visibility, selfUserId, exceptBudgetId: budget?.id });
  const groups = pickerGroupsOf(categories, claims, picks, initial.held);

  /** Checks the fields and emits them when they pass; the first problem takes the focus. */
  const save = () => {
    const available = availablePicks(groups);
    const found = objectionsOf(name, target, available, translator);
    setObjections(found);
    const refused = Object.values(found).some((objection) => objection !== undefined);
    if (refused || target === null) {
      setRefusals((count) => count + 1);
      return;
    }
    const fields = { name: name.trim(), targetAmount: target, targets: targetsOf(available) };
    if (budget) onEdit({ budgetId: budget.id, ...fields });
    else onCreate({ ...fields, currency, visibility });
  };

  /**
   * Changes the ticks and drops the covers' refusal.
   *
   * @param next - The ticks after the change.
   */
  const changePicks = (next: Picks) => {
    setPicks(next);
    setObjections((current) => ({ ...current, covers: undefined }));
  };

  const mode = budget ? 'save' : 'create';

  return (
    <div className="flex flex-col gap-5">
      {budget && (
        <div className="flex items-center justify-between gap-3">
          <span className="type-body-sm font-semibold">
            {translator.text('guidedSetup', 'budget.editing', { name: budget.name })}
          </span>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancelEdit}>
            {translator.text('guidedSetup', 'budget.cancelEdit')}
          </Button>
        </div>
      )}
      {alert && <InlineBanner tone="error" message={alert} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={translator.text('budgetManagement', 'field.name')}
          value={name}
          maxLength={budgetSettings.nameMaxLength}
          error={objections.name}
          onChange={(value) => {
            setName(value);
            setObjections((current) => ({ ...current, name: undefined }));
          }}
        />
        <MoneyInput
          variant="hero"
          label={translator.text('budgetManagement', 'field.target')}
          currency={currency}
          value={target}
          error={objections.target}
          onChange={(amount) => {
            setTarget(amount);
            setObjections((current) => ({ ...current, target: undefined }));
          }}
        />
      </div>
      <ScopeFields
        locked={budget !== undefined}
        personalOnly={personalOnly}
        currency={currency}
        visibility={visibility}
        onCurrency={setCurrency}
        onVisibility={setVisibility}
      />
      <CoverPicker
        groups={groups}
        disabled={busy}
        error={objections.covers}
        onToggleCategory={(category) => changePicks(toggleCategory(picks, category))}
        onToggleSubcategory={(subcategoryId) => (
          changePicks(toggleSubcategory(picks, subcategoryId))
        )}
      />
      <WizardNavigation
        onBack={onBack}
        backDisabled={busy}
        confirm={discardConfirmOpen && (
          <InlineConfirm
            tone="destructive"
            message={translator.text('guidedSetup', 'discard.message')}
            confirmLabel={translator.text('guidedSetup', 'discard.confirm')}
            cancelLabel={translator.text('guidedSetup', 'discard.cancel')}
            onConfirm={onDiscard}
            onCancel={onKeepEditing}
          />
        )}
        secondary={{
          label: translator.text('guidedSetup', `budget.${mode}`),
          busy,
          onClick: save,
        }}
        primary={{
          label: translator.text('guidedSetup', 'finish'),
          disabled: busy,
          trailingIcon: 'check',
          onClick: () => onFinish(isUnsaved(initial, { name, target, picks })),
        }}
      />
    </div>
  );
}
