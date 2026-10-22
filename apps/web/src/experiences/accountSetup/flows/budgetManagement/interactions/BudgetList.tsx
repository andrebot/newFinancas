import type { Budget, BudgetTargetInput, Category } from '@financas/api-types';
import { IconButton } from '../../../../../kit/button/IconButton';
import { Card } from '../../../../../kit/card/Card';
import { CategoryChip } from '../../../../../kit/categoryChip/CategoryChip';
import { InlineConfirm } from '../../../../../kit/confirm/InlineConfirm';
import { EmptyState } from '../../../../../kit/emptyState/EmptyState';
import { Tag } from '../../../../../kit/tag/Tag';
import { formatMoney } from '../../../../../utilities/formatting';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { targetName } from '../claims';

// The household's budgets as mockup 42 draws them: a grid of cards — the
// name, its visibility and currency tags, the monthly target and the
// categories it covers as chips — with Edit and Delete as icon buttons for
// whoever may manage it (OQ-176). Setup shows definitions only: no spend
// against target (stakeholder, OQ-176). While its delete confirm is open the
// card shows that instead, coral-ringed like the category card's archive.

/** How each visibility's tag looks: its tone, its icon and its label's key. */
const VISIBILITY_TAGS = {
  personal: { tone: 'neutral', icon: 'person-outline', label: 'visibility.personal' },
  shared: { tone: 'sky', icon: 'group-outline', label: 'visibility.shared' },
} as const;

/** What a covered target's chip shows: its name and its category's look. */
interface CoverChip {
  readonly key: string;
  readonly name: string;
  readonly category: Category;
}

/**
 * Builds the chips a card lists under "Covers", in the budget's order. A
 * target not among the categories (none should be) is left out.
 *
 * @param targets - The budget's targets.
 * @param categories - The household's categories, archived included.
 * @returns One chip per target found: a subcategory carries its category's look.
 */
export const coverChipsOf = (
  targets: readonly BudgetTargetInput[],
  categories: readonly Category[],
): CoverChip[] => targets.flatMap((target) => {
  const category = categories.find((candidate) => (
    candidate.id === target.categoryId
    || candidate.subcategories.some((subcategory) => subcategory.id === target.subcategoryId)
  ));
  const name = targetName(categories, target);
  if (!category || name === undefined) return [];
  // Exactly one of the ids is set (OQ-176); names aren't unique, so the key is the id.
  return [{ key: String(target.categoryId ?? target.subcategoryId), name, category }];
});

/** One budget card's props. */
interface BudgetCardProps {
  readonly budget: Budget;
  readonly categories: readonly Category[];
  /** The actor may edit and delete it (OQ-176). */
  readonly canManage: boolean;
  /** A request is out: every control waits. */
  readonly busy: boolean;
  /** This card's delete is out: its confirm spins. */
  readonly deleteBusy: boolean;
  /** This card's delete confirm is open. */
  readonly deletingOpen: boolean;
  readonly onEdit: (budgetId: string) => void;
  readonly onDeleteRequest: (budgetId: string) => void;
  readonly onConfirmDelete: () => void;
  readonly onCancelDelete: () => void;
}

/**
 * Renders a budget's card — or its delete confirm while that is open.
 *
 * @param props - The budget, the categories, the actor's right and the Flow's handlers.
 * @returns The card.
 */
function BudgetCard({
  budget, categories, canManage, busy, deleteBusy, deletingOpen, onEdit, onDeleteRequest,
  onConfirmDelete, onCancelDelete,
}: BudgetCardProps) {
  const translator = useI18n();

  if (deletingOpen) {
    return (
      <div className="flex flex-col gap-4 rounded-xl2 bg-raised p-5 ring-1 ring-coral/40">
        <InlineConfirm
          tone="destructive"
          message={translator.text('budgetManagement', 'delete.confirm', { name: budget.name })}
          confirmLabel={translator.text('budgetManagement', 'delete.action')}
          cancelLabel={translator.text('budgetManagement', 'cancel')}
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
          busy={deleteBusy}
          disabled={busy && !deleteBusy}
        />
      </div>
    );
  }

  const visibilityTag = VISIBILITY_TAGS[budget.visibility];

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 break-words type-heading-sm">{budget.name}</span>
        <span className="flex shrink-0 items-center gap-2 pt-1">
          <Tag size="sm" tone={visibilityTag.tone} icon={visibilityTag.icon}>
            {translator.text('budgetManagement', visibilityTag.label)}
          </Tag>
          <Tag size="sm">{budget.currency}</Tag>
        </span>
        {canManage && (
          <span className="-mr-1 flex shrink-0">
            <IconButton
              icon="edit-outline"
              size="sm"
              label={translator.text('budgetManagement', 'card.edit', { name: budget.name })}
              onClick={() => onEdit(budget.id)}
              disabled={busy}
            />
            <IconButton
              icon="delete-outline"
              size="sm"
              className="hover:!text-coral"
              label={translator.text('budgetManagement', 'card.delete', { name: budget.name })}
              onClick={() => onDeleteRequest(budget.id)}
              disabled={busy}
            />
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="type-display-sm tabular-nums">
          {formatMoney(budget.targetAmount, budget.currency)}
        </span>
        <span className="type-body-sm text-muted">
          {translator.text('budgetManagement', 'card.perMonth')}
        </span>
      </div>
      <span className="type-body-sm text-muted">
        {translator.text('budgetManagement', 'card.covers')}
      </span>
      <div className="flex flex-wrap gap-2">
        {coverChipsOf(budget.targets, categories).map((chip) => (
          <CategoryChip
            key={chip.key}
            name={chip.name}
            icon={chip.category.icon}
            color={chip.category.color}
          />
        ))}
      </div>
    </Card>
  );
}

/** BudgetList's props. */
export interface BudgetListProps {
  /** The budgets the caller can see, by name. */
  readonly budgets: readonly Budget[];
  readonly categories: readonly Category[];
  /** Tells whether the actor may manage one budget. */
  readonly isManageable: (budget: Budget) => boolean;
  /** A request is out: every control waits. */
  readonly busy: boolean;
  /** The budget whose delete is out, so only its confirm spins. */
  readonly deletingOut?: string | undefined;
  /** The delete confirm open on a card, by budget id. */
  readonly deleting?: string | undefined;
  readonly onEdit: (budgetId: string) => void;
  readonly onDeleteRequest: (budgetId: string) => void;
  readonly onConfirmDelete: () => void;
  readonly onCancelDelete: () => void;
}

/**
 * Renders the grid of budget cards, or its empty state.
 *
 * @param props - The budgets, the categories, the actor's rights and the Flow's handlers.
 * @returns The grid.
 */
export function BudgetList({
  budgets, categories, isManageable, busy, deletingOut, deleting, onEdit, onDeleteRequest,
  onConfirmDelete, onCancelDelete,
}: BudgetListProps) {
  const translator = useI18n();

  if (budgets.length === 0) {
    return (
      <EmptyState icon="donut-large" title={translator.text('budgetManagement', 'list.empty')} />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {budgets.map((budget) => (
        <BudgetCard
          key={budget.id}
          budget={budget}
          categories={categories}
          canManage={isManageable(budget)}
          busy={busy}
          deleteBusy={deletingOut === budget.id}
          deletingOpen={deleting === budget.id}
          onEdit={onEdit}
          onDeleteRequest={onDeleteRequest}
          onConfirmDelete={onConfirmDelete}
          onCancelDelete={onCancelDelete}
        />
      ))}
    </div>
  );
}
