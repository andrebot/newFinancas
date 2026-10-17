import {
  defaultCategoriesFor, isCategoryIcon, isPaletteToken, type CategoryIcon, type PaletteToken,
} from '@financas/reference';
import {
  and, asc, eq, inArray, isNull, sql, type SQL,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { categories, households, subcategories } from '../db/schema';
import type { Language } from '../db/schema/values';

// CategoryAccessor (A9, VBD): a household's Category → Subcategory taxonomy
// (FR-10, 02-data-model.md). It applies data changes only; who may change a
// Category, and whether an archived one still takes edits, are AccountManager's
// decisions. What stays here (OQ-173):
// - exactly two levels is structural — a Subcategory has no parent-subcategory
//   column (FR-10.2);
// - an icon or colour outside the in-code sets is refused, as a second line
//   behind the Manager's validation (OQ-85, OQ-126);
// - an edit, Subcategories included, is all or nothing;
// - archiving is one-way and archiving a Category archives its live
//   Subcategories in the same transaction (FR-10.3/10.4);
// - the default set is seeded once per household (FR-10.1), checked while
//   holding the household's row lock.
// Names need not be unique.

export interface Subcategory {
  readonly id: string;
  readonly categoryId: string;
  readonly name: string;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
}

export interface Category {
  readonly id: string;
  readonly householdId: string;
  readonly name: string;
  readonly icon: CategoryIcon;
  readonly color: PaletteToken;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly subcategories: readonly Subcategory[];
}

/** How a Category looks: its icon and palette colour, unchecked as they come in. */
export interface CategoryStyle {
  readonly icon: string;
  readonly color: string;
}

/** A Category to create. */
export interface NewCategory extends CategoryStyle {
  readonly name: string;
}

/** One Subcategory of an edit: renamed when it has an `id`, created when not. */
export interface SubcategoryEdit {
  readonly id?: string;
  readonly name: string;
}

/**
 * What an edit may change. Subcategories not listed stay as they are —
 * archiving one has its own operation.
 */
export interface CategoryChanges extends Partial<NewCategory> {
  readonly subcategories?: readonly SubcategoryEdit[];
}

/** Why an icon or colour was refused. */
export type StyleRefusal = 'invalid_icon' | 'invalid_color';

/** Why an edit was refused; nothing of it is kept. */
export type EditRefusal = StyleRefusal | 'not_found' | 'subcategory_not_found';

/** Which Categories a list returns; archived ones only on request. */
export interface CategoryFilter {
  readonly includeArchived?: boolean;
}

const categoryColumns = {
  id: categories.id,
  householdId: categories.householdId,
  name: categories.name,
  icon: categories.icon,
  color: categories.color,
  archivedAt: categories.archivedAt,
  createdAt: categories.createdAt,
};

const subcategoryColumns = {
  id: subcategories.id,
  categoryId: subcategories.categoryId,
  name: subcategories.name,
  archivedAt: subcategories.archivedAt,
  createdAt: subcategories.createdAt,
};

type CategoryRow = Omit<Category, 'icon' | 'color' | 'subcategories'> & {
  readonly icon: string;
  readonly color: string;
};

/** Keeps the first archive time when archived again. */
const ARCHIVE_ONCE = { archivedAt: sql`coalesce(${categories.archivedAt}, now())` };

/**
 * Narrows a row's icon and colour to the in-code sets they were checked against
 * on write, and attaches its Subcategories.
 *
 * @param row - A selected Category row.
 * @param children - Its Subcategories.
 * @returns The Category.
 */
const toCategory = (row: CategoryRow, children: readonly Subcategory[]): Category => ({
  ...row, icon: row.icon as CategoryIcon, color: row.color as PaletteToken, subcategories: children,
});

/**
 * Checks an icon and a colour against the in-code sets; an absent one passes.
 *
 * @param style - The icon and/or colour to write.
 * @returns Why one was refused, or `undefined`.
 */
const styleRefusal = (style: Partial<CategoryStyle>): StyleRefusal | undefined => {
  if (style.icon !== undefined && !isCategoryIcon(style.icon)) return 'invalid_icon';
  if (style.color !== undefined && !isPaletteToken(style.color)) return 'invalid_color';
  return undefined;
};

/**
 * The condition selecting one Category of a household.
 *
 * @param householdId - The household.
 * @param categoryId - The Category.
 * @returns The SQL condition.
 */
const categoryIs = (householdId: string, categoryId: string) => and(
  eq(categories.id, categoryId),
  eq(categories.householdId, householdId),
);

/**
 * Builds Categories with their Subcategories — rows selected open ones first,
 * then archived, each by name.
 *
 * @param db - Database or transaction.
 * @param where - Which Categories.
 * @param includeArchived - Whether archived Categories and Subcategories come too.
 * @returns The Categories.
 */
const loadCategories = async (
  db: Database,
  where: SQL | undefined,
  includeArchived: boolean,
): Promise<Category[]> => {
  const live = (column: typeof categories.archivedAt | typeof subcategories.archivedAt) => (
    includeArchived ? undefined : isNull(column)
  );
  const rows: CategoryRow[] = await db.select(categoryColumns).from(categories)
    .where(and(where, live(categories.archivedAt)))
    .orderBy(sql`${categories.archivedAt} IS NOT NULL`, asc(categories.name), asc(categories.id));
  if (rows.length === 0) return [];
  const children = await db.select(subcategoryColumns).from(subcategories)
    .where(and(
      inArray(subcategories.categoryId, rows.map((row) => row.id)),
      live(subcategories.archivedAt),
    ))
    .orderBy(
      sql`${subcategories.archivedAt} IS NOT NULL`,
      asc(subcategories.name),
      asc(subcategories.id),
    );
  return rows.map((row) => toCategory(
    row,
    children.filter((child) => child.categoryId === row.id),
  ));
};

/**
 * Reads one Category of a household with all its Subcategories, archived ones
 * included.
 *
 * @param db - Database or transaction.
 * @param householdId - The household.
 * @param categoryId - The Category.
 * @returns The Category, or `undefined`.
 */
const findCategory = async (
  db: Database,
  householdId: string,
  categoryId: string,
): Promise<Category | undefined> => {
  const [category] = await loadCategories(db, categoryIs(householdId, categoryId), true);
  return category;
};

/**
 * Tells whether every Subcategory an edit renames is one of this Category's.
 *
 * @param db - A transaction.
 * @param categoryId - The Category.
 * @param edits - The edit's Subcategories.
 * @returns `true` when each `id` belongs to the Category.
 */
const ownsSubcategories = async (
  db: Database,
  categoryId: string,
  edits: readonly SubcategoryEdit[],
): Promise<boolean> => {
  const ids = [...new Set(edits.flatMap((edit) => (edit.id === undefined ? [] : [edit.id])))];
  if (ids.length === 0) return true;
  const owned = await db.select({ id: subcategories.id }).from(subcategories)
    .where(and(eq(subcategories.categoryId, categoryId), inArray(subcategories.id, ids)));
  return owned.length === ids.length;
};

/**
 * Renames the edit's existing Subcategories and creates its new ones.
 *
 * @param db - A transaction.
 * @param categoryId - The Category.
 * @param edits - The edit's Subcategories, already checked to belong to it.
 * @returns Resolves once written.
 */
const writeSubcategories = async (
  db: Database,
  categoryId: string,
  edits: readonly SubcategoryEdit[],
) => {
  const created = edits.filter((edit) => edit.id === undefined);
  const renamed = edits.filter((edit) => edit.id !== undefined);
  if (created.length > 0) {
    await db.insert(subcategories)
      .values(created.map((edit) => ({ categoryId, name: edit.name })));
  }
  await Promise.all(renamed.map((edit) => db.update(subcategories).set({ name: edit.name })
    .where(eq(subcategories.id, edit.id!))));
};

/**
 * Inserts a household's default Categories and their Subcategories.
 *
 * @param db - A transaction.
 * @param householdId - The household.
 * @param language - The language the names are in.
 * @returns Resolves once inserted.
 */
const insertDefaults = async (db: Database, householdId: string, language: Language) => {
  const defaults = defaultCategoriesFor(language);
  const inserted = await db.insert(categories).values(defaults.map((category) => ({
    householdId, name: category.name, icon: category.icon, color: category.color,
  }))).returning({ id: categories.id, name: categories.name });
  // Default names are distinct within a language, so a name finds its row.
  const idByName = new Map(inserted.map((row) => [row.name, row.id]));
  const children = defaults.flatMap((category) => category.subcategories.map((name) => ({
    categoryId: idByName.get(category.name)!, name,
  })));
  // The default set always has Subcategories (packages/reference).
  await db.insert(subcategories).values(children);
};

/**
 * Builds the CategoryAccessor over a database (or a transaction).
 *
 * @param db - Where to read and write.
 * @returns The accessor's operations.
 */
const createCategoryAccessor = (db: Database) => ({
  /**
   * Creates a Category, with no Subcategories yet (FR-10.1).
   *
   * @param householdId - The household.
   * @param category - Its name, icon and colour.
   * @returns The Category, or why its icon or colour was refused.
   */
  insert: async (
    householdId: string,
    category: NewCategory,
  ): Promise<Category | StyleRefusal> => {
    const refusal = styleRefusal(category);
    if (refusal) return refusal;
    const [row] = await db.insert(categories).values({ ...category, householdId })
      .returning(categoryColumns);
    return toCategory(row!, []);
  },

  /**
   * Reads one Category of a household with all its Subcategories, archived ones
   * included.
   *
   * @param householdId - The household.
   * @param categoryId - The Category.
   * @returns The Category, or `undefined`.
   */
  findById: (householdId: string, categoryId: string): Promise<Category | undefined> => (
    findCategory(db, householdId, categoryId)
  ),

  /**
   * Lists a household's Categories with their Subcategories, open ones first,
   * then archived, each by name. Without `includeArchived`, archived Categories
   * and Subcategories are left out.
   *
   * @param householdId - The household.
   * @param filter - Whether archived ones come too.
   * @returns The Categories.
   */
  list: (householdId: string, filter: CategoryFilter = {}): Promise<Category[]> => (
    loadCategories(db, eq(categories.householdId, householdId), filter.includeArchived ?? false)
  ),

  /**
   * Edits a Category and its Subcategories in one go (FR-10.2): renames listed
   * Subcategories with an `id`, creates those without. An empty change reads it
   * back.
   *
   * @param householdId - The household.
   * @param categoryId - The Category.
   * @param changes - The fields to change.
   * @returns The Category as it now stands, or why nothing was written.
   */
  update: async (
    householdId: string,
    categoryId: string,
    changes: CategoryChanges,
  ): Promise<Category | EditRefusal> => {
    const refusal = styleRefusal(changes);
    if (refusal) return refusal;
    return db.transaction(async (tx) => {
      const { subcategories: edits = [], ...fields } = changes;
      const [category] = await tx.select({ id: categories.id }).from(categories)
        .where(categoryIs(householdId, categoryId)).for('update');
      if (!category) return 'not_found';
      if (!await ownsSubcategories(tx, categoryId, edits)) return 'subcategory_not_found';
      const set = Object.fromEntries(Object.entries(fields)
        .filter(([, value]) => value !== undefined));
      if (Object.keys(set).length > 0) {
        await tx.update(categories).set(set).where(eq(categories.id, categoryId));
      }
      await writeSubcategories(tx, categoryId, edits);
      return (await findCategory(tx, householdId, categoryId))!;
    });
  },

  /**
   * Archives a Category, one way, and every live Subcategory with it, at the same
   * time (FR-10.3/10.4). Already-archived ones, the Category included, keep
   * their first time.
   *
   * @param householdId - The household.
   * @param categoryId - The Category.
   * @returns `true` when it exists.
   */
  archive: (householdId: string, categoryId: string): Promise<boolean> => (
    db.transaction(async (tx) => {
      const archived = await tx.update(categories).set(ARCHIVE_ONCE)
        .where(categoryIs(householdId, categoryId)).returning({ id: categories.id });
      if (archived.length === 0) return false;
      await tx.update(subcategories).set({ archivedAt: sql`now()` })
        .where(and(eq(subcategories.categoryId, categoryId), isNull(subcategories.archivedAt)));
      return true;
    })
  ),

  /**
   * Archives one Subcategory, one way; its Category and siblings are untouched
   * (FR-10.3/10.4). Archiving it again keeps the first time.
   *
   * @param householdId - The household.
   * @param categoryId - Its Category, from the route.
   * @param subcategoryId - The Subcategory.
   * @returns `true` when it exists under that Category of that household.
   */
  archiveSubcategory: async (
    householdId: string,
    categoryId: string,
    subcategoryId: string,
  ): Promise<boolean> => (
    await db.update(subcategories)
      .set({ archivedAt: sql`coalesce(${subcategories.archivedAt}, now())` })
      .where(and(
        eq(subcategories.id, subcategoryId),
        eq(subcategories.categoryId, categoryId),
        inArray(
          subcategories.categoryId,
          db.select({ id: categories.id }).from(categories)
            .where(eq(categories.householdId, householdId)),
        ),
      ))
      .returning({ id: subcategories.id })
  ).length > 0,

  /**
   * Seeds a new household's default Categories in its creator's language
   * (FR-10.1, OQ-98) — once: a household that already has a Category, or no
   * longer exists, is left alone.
   *
   * @param householdId - The household.
   * @param language - The creator's language.
   * @returns `true` when the defaults were inserted.
   */
  seedDefaults: (householdId: string, language: Language): Promise<boolean> => (
    db.transaction(async (tx) => {
      const [household] = await tx.select({ id: households.id }).from(households)
        .where(eq(households.id, householdId)).for('update');
      if (!household) return false;
      const [existing] = await tx.select({ id: categories.id }).from(categories)
        .where(eq(categories.householdId, householdId)).limit(1);
      if (existing) return false;
      await insertDefaults(tx, householdId, language);
      return true;
    })
  ),
});

/** The CategoryAccessor's operations. */
export type CategoryAccessor = ReturnType<typeof createCategoryAccessor>;

export default createCategoryAccessor;
