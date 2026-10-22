import type { Budget, BudgetTargetInput, Category } from '@financas/api-types';
import { OpenableCard } from '../../../../../kit/card/OpenableCard';
import { CategoryChip } from '../../../../../kit/categoryChip/CategoryChip';
import { EmptyState } from '../../../../../kit/emptyState/EmptyState';
import { Tag } from '../../../../../kit/tag/Tag';
import { formatMoney } from '../../../../../utilities/formatting';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { targetName } from '../claims';

// The household's budgets as mockup 42 draws them: a grid of cards — the
// name, its visibility and currency tags, the monthly target and the
// categories it covers as chips. For whoever may manage it (OQ-176) the whole
// card opens its edit drawer, where Delete lives too — as an account's card
// does (OQ-194). Setup shows definitions only: no spend against target
// (stakeholder, OQ-176).

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
  /** Opens its edit drawer; nothing when the actor may not manage it (OQ-176). */
  readonly onOpen?: (() => void) | undefined;
}

/**
 * Renders a budget's card: the whole card opens its edit drawer, where Delete
 * lives too (OQ-194) — a plain card for whoever may not manage it.
 *
 * @param props - The budget, the categories and its opener, if any.
 * @returns The card.
 */
function BudgetCard({ budget, categories, onOpen }: BudgetCardProps) {
  const translator = useI18n();
  const visibilityTag = VISIBILITY_TAGS[budget.visibility];

  return (
    <OpenableCard
      name={budget.name}
      nameClassName="type-heading-sm"
      onOpen={onOpen}
      className="flex flex-col gap-3"
      aside={(
        <span className="flex shrink-0 items-center gap-2 pt-1">
          <Tag size="sm" tone={visibilityTag.tone} icon={visibilityTag.icon}>
            {translator.text('budgetManagement', visibilityTag.label)}
          </Tag>
          <Tag size="sm">{budget.currency}</Tag>
        </span>
      )}
    >
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
    </OpenableCard>
  );
}

/** BudgetList's props. */
export interface BudgetListProps {
  /** The budgets the caller can see, by name. */
  readonly budgets: readonly Budget[];
  readonly categories: readonly Category[];
  /** Tells whether the actor may manage one budget. */
  readonly isManageable: (budget: Budget) => boolean;
  /** Opens a budget's edit drawer. */
  readonly onEdit: (budgetId: string) => void;
}

/**
 * Renders the grid of budget cards, or its empty state.
 *
 * @param props - The budgets, the categories, the actor's rights and the Flow's opener.
 * @returns The grid.
 */
export function BudgetList({
  budgets, categories, isManageable, onEdit,
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
          onOpen={isManageable(budget) ? () => onEdit(budget.id) : undefined}
        />
      ))}
    </div>
  );
}
