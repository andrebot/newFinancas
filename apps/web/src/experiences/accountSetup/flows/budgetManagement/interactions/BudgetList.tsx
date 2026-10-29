import type { Budget, Category } from '@financas/api-types';
import { Amount } from '../../../../../kit/amount/Amount';
import { OpenableCard } from '../../../../../kit/card/OpenableCard';
import { CategoryChip } from '../../../../../kit/categoryChip/CategoryChip';
import { EmptyState } from '../../../../../kit/emptyState/EmptyState';
import { Tag } from '../../../../../kit/tag/Tag';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { coverChipsOf } from '../../../budgetForm';

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
        <Amount
          amount={budget.targetAmount}
          currency={budget.currency}
          className="type-display-sm"
        />
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
