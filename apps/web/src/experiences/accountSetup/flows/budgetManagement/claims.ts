import type {
  Budget, BudgetTargetInput, Category, Subcategory,
} from '@financas/api-types';

// The claim-aware category picker's rules (FL13; FR-4.6/4.7, OQ-176, OQ-194),
// kept pure so they test without React. A Category or Subcategory belongs to
// at most one Budget per scope — the household's shared budgets, or one
// member's personal ones — and a whole Category reserves its Subcategories,
// so a Subcategory claimed elsewhere blocks its Category too. The picker
// shows the household's open categories in groups (a whole-category row, its
// subcategory rows under it) with each row's standing: free, picked here, or
// claimed by another budget, which it names. An archived target the edited
// budget already holds stays listed so it can be kept or let go (OQ-176).

/** Personal or shared (FR-4.2). */
export type Visibility = Budget['visibility'];

/** What the form has ticked: whole categories and single subcategories. */
export interface Picks {
  readonly categoryIds: readonly string[];
  readonly subcategoryIds: readonly string[];
}

/** Nothing ticked: a new budget's picker. */
export const NO_PICKS: Picks = { categoryIds: [], subcategoryIds: [] };

/** Whose budgets a claim is weighed against: the scope a form's visibility picks. */
export interface ClaimScope {
  readonly visibility: Visibility;
  /** The signed-in user: a personal scope is their own budgets. */
  readonly selfUserId: string;
  /** The budget being edited, whose own claims don't count against it. */
  readonly exceptBudgetId?: string | undefined;
}

/** Which other budget in the scope claims each target, by id. */
export interface ScopeClaims {
  readonly categories: ReadonlyMap<string, Budget>;
  readonly subcategories: ReadonlyMap<string, Budget>;
}

/** A whole-category row's standing. */
export type CategoryStanding = { readonly kind: 'free' }
  | { readonly kind: 'picked' }
  /** Another budget claims the whole category. */
  | { readonly kind: 'claimed'; readonly budget: Budget }
  /** Another budget claims one of its subcategories, so it can't be taken whole. */
  | { readonly kind: 'partly'; readonly budget: Budget }
  /** Archived, and listed only for a subcategory the budget holds: not to be taken whole. */
  | { readonly kind: 'archived' };

/** A subcategory row's standing. */
export type SubcategoryStanding = { readonly kind: 'free' }
  | { readonly kind: 'picked' }
  /** Its whole category is ticked here: it is covered with it (FR-4.6). */
  | { readonly kind: 'withCategory' }
  /** Another budget claims it. */
  | { readonly kind: 'claimed'; readonly budget: Budget }
  /** Another budget claims its whole category. */
  | { readonly kind: 'coveredBy'; readonly budget: Budget };

/** One subcategory's row. */
export interface SubcategoryRow {
  readonly subcategory: Subcategory;
  readonly standing: SubcategoryStanding;
}

/** One category's group: its whole-category row and its subcategories' rows. */
export interface PickerGroup {
  readonly category: Category;
  readonly standing: CategoryStanding;
  readonly subcategories: readonly SubcategoryRow[];
}

/**
 * Reads a budget's targets as picks.
 *
 * @param targets - The budget's targets.
 * @returns Its whole categories and single subcategories.
 */
export const picksOf = (targets: readonly BudgetTargetInput[]): Picks => ({
  categoryIds: targets.flatMap((target) => (target.categoryId ? [target.categoryId] : [])),
  subcategoryIds: targets.flatMap((target) => (target.subcategoryId ? [target.subcategoryId] : [])),
});

/**
 * Writes picks as the targets a create or edit sends.
 *
 * @param picks - What is ticked.
 * @returns The whole categories first, then the single subcategories.
 */
export const targetsOf = (picks: Picks): BudgetTargetInput[] => [
  ...picks.categoryIds.map((categoryId) => ({ categoryId })),
  ...picks.subcategoryIds.map((subcategoryId) => ({ subcategoryId })),
];

/**
 * Tells whether nothing is ticked.
 *
 * @param picks - What is ticked.
 * @returns Whether a submit would send no target.
 */
export const isEmptyPick = (picks: Picks): boolean => (
  picks.categoryIds.length === 0 && picks.subcategoryIds.length === 0
);

/**
 * Tells whether a budget sits in a scope (FR-4.2): a shared one in the
 * household's, a personal one in its owner's — never the one being edited.
 *
 * @param budget - A budget the caller can see.
 * @param scope - The form's visibility, the caller and the edited budget.
 * @returns Whether its claims count against the form.
 */
const inScope = (budget: Budget, scope: ClaimScope): boolean => {
  if (budget.id === scope.exceptBudgetId || budget.visibility !== scope.visibility) return false;
  return scope.visibility === 'shared' || budget.ownerUserId === scope.selfUserId;
};

/**
 * Collects who claims what in a scope.
 *
 * @param budgets - Every budget the caller can see.
 * @param scope - The form's visibility, the caller and the edited budget.
 * @returns Each claimed category and subcategory, with the budget that holds it.
 */
export const claimsIn = (budgets: readonly Budget[], scope: ClaimScope): ScopeClaims => {
  const categories = new Map<string, Budget>();
  const subcategories = new Map<string, Budget>();
  budgets.filter((budget) => inScope(budget, scope)).forEach((budget) => {
    budget.targets.forEach((target) => {
      if (target.categoryId) categories.set(target.categoryId, budget);
      if (target.subcategoryId) subcategories.set(target.subcategoryId, budget);
    });
  });
  return { categories, subcategories };
};

/**
 * Finds the first other budget holding one of a category's subcategories.
 *
 * @param category - The category.
 * @param claims - The scope's claims.
 * @returns That budget, or nothing.
 */
const subcategoryClaimer = (category: Category, claims: ScopeClaims): Budget | undefined => (
  category.subcategories
    .map((subcategory) => claims.subcategories.get(subcategory.id))
    .find((budget) => budget !== undefined)
);

/**
 * Weighs a whole-category row.
 *
 * @param category - The category.
 * @param claims - The scope's claims.
 * @param picks - What is ticked.
 * @returns Its standing; a claim elsewhere wins over a stale tick.
 */
export const categoryStanding = (
  category: Category,
  claims: ScopeClaims,
  picks: Picks,
): CategoryStanding => {
  const claimer = claims.categories.get(category.id);
  if (claimer) return { kind: 'claimed', budget: claimer };
  const partial = subcategoryClaimer(category, claims);
  if (partial) return { kind: 'partly', budget: partial };
  return picks.categoryIds.includes(category.id) ? { kind: 'picked' } : { kind: 'free' };
};

/**
 * Weighs a subcategory row.
 *
 * @param subcategory - The subcategory.
 * @param category - Its category.
 * @param claims - The scope's claims.
 * @param picks - What is ticked.
 * @returns Its standing; a claim elsewhere wins over a stale tick.
 */
export const subcategoryStanding = (
  subcategory: Subcategory,
  category: Category,
  claims: ScopeClaims,
  picks: Picks,
): SubcategoryStanding => {
  const parentClaimer = claims.categories.get(category.id);
  if (parentClaimer) return { kind: 'coveredBy', budget: parentClaimer };
  const claimer = claims.subcategories.get(subcategory.id);
  if (claimer) return { kind: 'claimed', budget: claimer };
  if (picks.categoryIds.includes(category.id)) return { kind: 'withCategory' };
  return picks.subcategoryIds.includes(subcategory.id) ? { kind: 'picked' } : { kind: 'free' };
};

/**
 * Tells whether a category or subcategory is listed: open, or one the edited
 * budget already holds (it may keep an archived claim, OQ-176).
 *
 * @param item - The category or subcategory.
 * @param heldIds - The ids the edited budget holds at that level.
 * @returns Whether the picker shows it.
 */
const listed = (item: { id: string; archivedAt: string | null }, heldIds: readonly string[]) => (
  item.archivedAt === null || heldIds.includes(item.id)
);

/**
 * Builds the picker's groups, in the categories' order.
 *
 * @param categories - The household's categories, archived included.
 * @param claims - The scope's claims.
 * @param picks - What is ticked.
 * @param held - What the edited budget holds on the server (nothing for a create).
 * @returns One group per listed category, with its listed subcategories.
 */
export const pickerGroupsOf = (
  categories: readonly Category[],
  claims: ScopeClaims,
  picks: Picks,
  held: Picks,
): PickerGroup[] => categories.flatMap((category) => {
  const subcategories = category.subcategories
    .filter((subcategory) => listed(subcategory, held.subcategoryIds))
    .map((subcategory) => ({
      subcategory, standing: subcategoryStanding(subcategory, category, claims, picks),
    }));
  const open = listed(category, held.categoryIds);
  if (!open && subcategories.length === 0) return [];
  const standing: CategoryStanding = open
    ? categoryStanding(category, claims, picks)
    : { kind: 'archived' };
  return [{ category, standing, subcategories }];
});

/**
 * Ticks or unticks a whole category. Ticking it drops the single
 * subcategories under it, which it now covers (FR-4.6).
 *
 * @param picks - What is ticked.
 * @param category - The category.
 * @returns The picks after the toggle.
 */
export const toggleCategory = (picks: Picks, category: Category): Picks => {
  if (picks.categoryIds.includes(category.id)) {
    return { ...picks, categoryIds: picks.categoryIds.filter((id) => id !== category.id) };
  }
  const covered = new Set(category.subcategories.map((subcategory) => subcategory.id));
  return {
    categoryIds: [...picks.categoryIds, category.id],
    subcategoryIds: picks.subcategoryIds.filter((id) => !covered.has(id)),
  };
};

/**
 * Ticks or unticks a single subcategory.
 *
 * @param picks - What is ticked.
 * @param subcategoryId - The subcategory.
 * @returns The picks after the toggle.
 */
export const toggleSubcategory = (picks: Picks, subcategoryId: string): Picks => (
  picks.subcategoryIds.includes(subcategoryId)
    ? { ...picks, subcategoryIds: picks.subcategoryIds.filter((id) => id !== subcategoryId) }
    : { ...picks, subcategoryIds: [...picks.subcategoryIds, subcategoryId] }
);

/**
 * Keeps only the picks the groups still show as ticked: a pick claimed
 * elsewhere meanwhile (a refresh after a 409, or a switch of visibility) is
 * dropped, as is one no longer listed.
 *
 * @param groups - The picker's groups, as built from these picks.
 * @returns What a submit sends.
 */
export const availablePicks = (groups: readonly PickerGroup[]): Picks => ({
  categoryIds: groups.flatMap((group) => (
    group.standing.kind === 'picked' ? [group.category.id] : []
  )),
  subcategoryIds: groups.flatMap((group) => group.subcategories.flatMap((row) => (
    row.standing.kind === 'picked' ? [row.subcategory.id] : []
  ))),
});

/**
 * Tells whether a group opens by itself: one of its subcategories is ticked
 * on its own or claimed elsewhere, so its standing shows without a click.
 *
 * @param group - The group.
 * @returns Whether its subcategory rows show from the start.
 */
export const opensByItself = (group: PickerGroup): boolean => group.subcategories.some((row) => (
  row.standing.kind === 'picked' || row.standing.kind === 'claimed'
));

/**
 * Names a target for a message, from the categories the picker lists.
 *
 * @param categories - The household's categories.
 * @param target - A category or subcategory id, as a 409's params carry it.
 * @returns `Category` or `Category › Subcategory`, or nothing when not found.
 */
export const targetName = (
  categories: readonly Category[],
  target: { readonly categoryId?: unknown; readonly subcategoryId?: unknown },
): string | undefined => {
  const whole = categories.find((category) => category.id === target.categoryId);
  if (whole) return whole.name;
  const parent = categories.find((category) => category.subcategories.some(
    (subcategory) => subcategory.id === target.subcategoryId,
  ));
  const sub = parent?.subcategories.find((subcategory) => subcategory.id === target.subcategoryId);
  return parent && sub ? `${parent.name} › ${sub.name}` : undefined;
};
