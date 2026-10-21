import { useState } from 'react';
import type { Category } from '@financas/api-types';
import { InlineBanner } from '../../../../kit/alert/InlineBanner';
import { Button } from '../../../../kit/button/Button';
import { EmptyState } from '../../../../kit/emptyState/EmptyState';
import { Expandable } from '../../../../kit/expandable/Expandable';
import { SkeletonRows } from '../../../../kit/skeleton/Skeleton';
import { useAlerts } from '../../../../utilities/AlertProvider';
import { useI18n } from '../../../../utilities/I18nProvider';
import type { Translator } from '../../../../utilities/i18n';
import type { RequestFailure, RequestOutcome } from '../../../../utilities/requestOutcome';
import {
  afterAction, archiveConfirmCancelled, archiveConfirmOpened, archivingTarget, formClosed,
  formOpened, INITIAL_CATEGORIES, isFormRequest, mayCreateCategory, mayManageCategories,
  started, splitCategories,
  type CategoriesView, type CategoryEdit, type CategoryManagementState,
  type NewCategory, type OpenForm, type Outgoing,
} from './categoryManagementState';
import { ArchivedCategory, CategoryCard } from './interactions/CategoryCard';
import { CategoryFormCard, type FormInitial } from './interactions/CategoryFormCard';

// The Category Management Flow (FL12, mockup 41; OQ-173/193): the household's
// categories as cards — create one with a name, an icon and a colour (FR-10.1),
// edit it in place, add subcategories straight on its card (one atomic edit)
// and archive a category or a single subcategory behind their rules (FR-10.3/4).
// The list is the Account Setup Experience's (shared with Budget Management)
// and comes in as display state; the Flow owns what is out, the open form card
// and its last failure. A success is toasted; a form's failure shows in its
// banner, a card action's in a toast (OQ-193). It never calls the backend:
// every request goes up to the Experience, which answers an outcome once the
// list holds the change. A list whose latest fetch failed stays, with a banner
// and its retry above it, so an open form keeps what was typed.

/** What the Flow asks of the Experience. */
export interface CategoryManagementFlowProps {
  /** Their role in this household (FR-1.7). */
  readonly role?: string | undefined;
  /** The household's categories, archived included, as the Experience holds them. */
  readonly categories: CategoriesView;
  /** Fetches the list again (a retry). */
  readonly onRetry: () => void;
  /** `POST /households/:id/categories`. */
  readonly onCreate: (category: NewCategory) => Promise<RequestOutcome>;
  /** `PATCH /households/:id/categories/:categoryId` with its fields. */
  readonly onEdit: (edit: CategoryEdit) => Promise<RequestOutcome>;
  /** The same `PATCH`, adding one subcategory (OQ-173). */
  readonly onAddSubcategory: (categoryId: string, name: string) => Promise<RequestOutcome>;
  /** `POST /households/:id/categories/:categoryId/archive` — cascades. */
  readonly onArchiveCategory: (categoryId: string) => Promise<RequestOutcome>;
  /** `POST …/subcategories/:subcategoryId/archive` — single row. */
  readonly onArchiveSubcategory: (
    categoryId: string, subcategoryId: string,
  ) => Promise<RequestOutcome>;
}

/** The last failure, translated for the open form's banner. */
const alertOf = (lastError: RequestFailure | undefined, translator: Translator) => {
  if (lastError === undefined) return undefined;
  return translator.error(lastError.code, lastError.params);
};

/** What the grid needs from the Flow. */
interface CategoriesPanelProps {
  /** The loaded list (the panel only renders once it is). */
  readonly view: Extract<CategoriesView, { status: 'loaded' }>;
  /** The request that is out, if any. */
  readonly out?: Outgoing | undefined;
  /** The form card that is open, if any. */
  readonly form?: OpenForm | undefined;
  /** The archive confirm open inside a card, by category id. */
  readonly archiving?: string | undefined;
  /** Owner/Admin only (FR-1.7, OQ-193). */
  readonly canManage: boolean;
  /** The last failure of a create or edit, for the open form's banner. */
  readonly lastError?: RequestFailure | undefined;
  /** Sends a create with its typed fields. */
  readonly submitCreate: (
    name: string, icon: NewCategory['icon'], color: NewCategory['color'],
  ) => void;
  /** Sends an edit with its typed fields. */
  readonly submitEdit: (edit: CategoryEdit) => void;
  /** Closes whatever form card is open. */
  readonly closeForm: () => void;
  /** Turns a card into its edit form. */
  readonly openEdit: (categoryId: string) => void;
  /** Opens a card's archive confirm. */
  readonly requestArchive: (categoryId: string) => void;
  /** Confirms the open archive. */
  readonly confirmArchive: () => void;
  /** Closes the open archive confirm again. */
  readonly cancelArchive: () => void;
  /** Adds a subcategory under its card. */
  readonly addSubcategory: (categoryId: string, name: string) => void;
  /** Archives one of a card's subcategories. */
  readonly archiveSubcategory: (categoryId: string, subcategoryId: string, subName: string) => void;
}

/** What the grid needs, beyond the panel's own state. */
interface CategoryGridProps extends Omit<CategoriesPanelProps, 'view' | 'lastError'> {
  /** The last failure, translated, for the open form's banner. */
  readonly alert?: string | undefined;
  /** The live categories (the archived ones go to their section). */
  readonly active: readonly Category[];
  /** The category whose card is its edit form, if any. */
  readonly editTarget?: Category | undefined;
}

/**
 * Renders the grid of cards — each live category as its card or its edit
 * form — and the create card while it is open.
 *
 * @param props - The list's state and the Flow's handlers for it.
 * @returns The grid.
 */
function CategoryGrid({
  active, editTarget, out, form, archiving, canManage, alert, submitCreate, submitEdit, closeForm,
  openEdit, requestArchive, confirmArchive, cancelArchive, addSubcategory, archiveSubcategory,
}: CategoryGridProps) {
  /** The fields an open edit form starts from. */
  const initialOf = (category: Category): FormInitial => ({
    name: category.name, icon: category.icon, color: category.color,
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {active.map((category) => (
        editTarget?.id === category.id ? (
          <CategoryFormCard
            key={category.id}
            mode="edit"
            initial={initialOf(category)}
            busy={out?.kind === 'edit' && out.categoryId === category.id}
            disabled={out !== undefined}
            alert={alert}
            onSubmit={(name, icon, color) => submitEdit({
              categoryId: category.id, name, icon, color,
            })}
            onCancel={closeForm}
          />
        ) : (
          <CategoryCard
            key={category.id}
            category={category}
            canManage={canManage}
            busy={out !== undefined}
            archivingOpen={archiving === category.id}
            onEdit={openEdit}
            onArchiveRequest={requestArchive}
            onConfirmArchive={confirmArchive}
            onCancelArchive={cancelArchive}
            onAddSubcategory={addSubcategory}
            onArchiveSubcategory={archiveSubcategory}
          />
        )
      ))}
      {form?.mode === 'create' && (
        <CategoryFormCard
          mode="create"
          busy={out?.kind === 'create'}
          disabled={out !== undefined}
          alert={alert}
          onSubmit={submitCreate}
          onCancel={closeForm}
        />
      )}
    </div>
  );
}

/** The archived section under the grid (FR-10.3). */
function ArchivedSection({ categories }: { readonly categories: readonly Category[] }) {
  const translator = useI18n();
  const count = categories.length;
  const title = translator.text('categoryManagement', 'archived.title', { count });

  return (
    <Expandable
      summary={(
        <span className="flex flex-col">
          <span className="font-semibold">{title}</span>
          <span className="text-sm text-muted">
            {translator.text('categoryManagement', 'archived.note')}
          </span>
        </span>
      )}
    >
      <div className="flex flex-col">
        {categories.map((category) => (
          <ArchivedCategory key={category.id} category={category} />
        ))}
      </div>
    </Expandable>
  );
}

/**
 * Renders the loaded grid — each live category as its card or its edit form,
 * the create card while it is open and the archived section below.
 *
 * @param props - The state and the Flow's handlers for it.
 * @returns The grid and its archived section.
 */
function CategoriesPanel({
  view, form, lastError, ...grid
}: CategoriesPanelProps) {
  const translator = useI18n();
  // The last failure, translated for the open form's banner.
  const alert = alertOf(lastError, translator);

  const { active, archived } = splitCategories(view.categories);
  const mode = form?.mode;
  const editTarget = active.find(
    (category) => form?.mode === 'edit' && category.id === form.categoryId,
  );

  return (
    <div className="flex flex-col gap-6">
      {active.length === 0 && mode !== 'create' ? (
        <EmptyState
          icon="category-outline"
          title={translator.text('categoryManagement', 'list.empty')}
        />
      ) : (
        <CategoryGrid active={active} editTarget={editTarget} alert={alert} form={form} {...grid} />
      )}
      {archived.length > 0 && <ArchivedSection categories={archived} />}
    </div>
  );
}

/** The list's failure and its retry. */
function LoadFailed({ onRetry }: { readonly onRetry: () => void }) {
  const translator = useI18n();
  return (
    <EmptyState
      icon="error-outline"
      title={translator.text('categoryManagement', 'load.failed')}
      action={(
        <Button onClick={onRetry}>
          {translator.text('categoryManagement', 'retry')}
        </Button>
      )}
    />
  );
}

/** What the stale-list banner needs. */
interface RefreshFailedProps {
  /** The list as the Experience hands it down. */
  readonly view: CategoriesView;
  /** Asks the Experience for the list again. */
  readonly onRetry: () => void;
}

/**
 * Renders the banner over a list whose latest fetch failed (OQ-193): the list
 * stays, so an open form keeps what was typed, and the retry sits beside it.
 *
 * @param props - The list's view and the retry.
 * @returns The banner, or nothing while the list is current.
 */
function RefreshFailed({ view, onRetry }: RefreshFailedProps) {
  const translator = useI18n();
  if (view.status !== 'loaded' || view.refreshError === undefined) return null;
  return (
    <InlineBanner
      tone="error"
      message={translator.text('categoryManagement', 'refresh.failed')}
      action={(
        <Button variant="ghost" onClick={onRetry}>
          {translator.text('categoryManagement', 'retry')}
        </Button>
      )}
    />
  );
}

/**
 * Renders the categories panel and runs its requests.
 *
 * @param props - The actor's role, the Experience's list and its requests.
 * @returns The panel with whatever form or confirm is open.
 */
export function CategoryManagementFlow({
  role, categories: view, onRetry, onCreate, onEdit, onAddSubcategory, onArchiveCategory,
  onArchiveSubcategory,
}: CategoryManagementFlowProps) {
  const translator = useI18n();
  const alerts = useAlerts();
  const [state, setState] = useState<CategoryManagementState>(INITIAL_CATEGORIES);

  /**
   * Toasts an outcome for its subject: every success, and a card action's
   * failure — a form shows its own in its banner.
   *
   * @param outgoing - The request that was out.
   * @param outcome - Its answer.
   * @param subject - The category's or subcategory's name.
   */
  const toast = (outgoing: Outgoing, outcome: RequestOutcome, subject: string) => {
    if (outcome.ok) {
      alerts.success(
        translator.text('categoryManagement', `${outgoing.kind}.done`, { name: subject }),
      );
    } else if (!isFormRequest(outgoing)) {
      alerts.error(translator.error(outcome.error.code, outcome.error.params));
    }
  };

  /**
   * Sends a request and applies its answer: a success closes what it came
   * from, a failure keeps it (and says why), and the outcome is toasted.
   *
   * @param outgoing - Which request goes out.
   * @param subject - The category's or subcategory's name for the toast.
   * @param request - The Experience's request for it.
   */
  const run = async (
    outgoing: Outgoing,
    subject: string,
    request: () => Promise<RequestOutcome>,
  ) => {
    setState((current) => started(current, outgoing));
    const outcome = await request();
    setState((current) => afterAction(current, outcome));
    toast(outgoing, outcome, subject);
  };

  /** Sends a create with its typed fields. */
  const submitCreate = (name: string, icon: NewCategory['icon'], color: NewCategory['color']) => {
    run({ kind: 'create' }, name, () => onCreate({ name, icon, color }));
  };

  /** Sends an edit with its typed fields. */
  const submitEdit = (edit: CategoryEdit) => {
    run({ kind: 'edit', categoryId: edit.categoryId }, edit.name, () => onEdit(edit));
  };

  /** Adds a subcategory under its card (an atomic edit). */
  const addSubcategory = (categoryId: string, name: string) => {
    run({ kind: 'addSubcategory', categoryId }, name, () => onAddSubcategory(categoryId, name));
  };

  /** Confirms the open archive of its category. */
  const confirmArchive = () => {
    const target = archivingTarget(view, state.archiving);
    if (target === undefined) return;
    const archive = () => onArchiveCategory(target.id);
    run({ kind: 'archiveCategory', categoryId: target.id }, target.name, archive);
  };

  /** Archives one of a card's subcategories. */
  const archiveSubcategory = (categoryId: string, subcategoryId: string, subName: string) => {
    run(
      { kind: 'archiveSubcategory', categoryId, subcategoryId },
      subName,
      () => onArchiveSubcategory(categoryId, subcategoryId),
    );
  };

  /** Opens the create card. */
  const openCreate = () => {
    setState((current) => formOpened(current, { mode: 'create' }));
  };

  /** Turns a card into its edit form. */
  const openEdit = (categoryId: string) => {
    setState((current) => formOpened(current, { mode: 'edit', categoryId }));
  };

  /** Opens a card's archive confirm. */
  const requestArchive = (categoryId: string) => {
    setState((current) => archiveConfirmOpened(current, categoryId));
  };

  if (view.status === 'failed') {
    return <LoadFailed onRetry={onRetry} />;
  }

  const canCreate = mayCreateCategory(role);
  const showAdd = canCreate && state.form?.mode !== 'create';

  return (
    <div className="flex flex-col gap-6">
      <RefreshFailed view={view} onRetry={onRetry} />
      {view.status === 'loaded' && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted">
            {translator.text('categoryManagement', 'description')}
          </p>
          {showAdd && (
            <Button variant="ghost" onClick={openCreate} disabled={state.out !== undefined}>
              {translator.text('categoryManagement', 'add')}
            </Button>
          )}
        </div>
      )}
      {view.status === 'loading' ? (
        <SkeletonRows label={translator.text('categoryManagement', 'loading')} />
      ) : (
        <CategoriesPanel
          view={view}
          out={state.out}
          form={state.form}
          archiving={state.archiving}
          canManage={mayManageCategories(role)}
          lastError={state.lastError}
          submitCreate={submitCreate}
          submitEdit={submitEdit}
          closeForm={() => setState(formClosed)}
          openEdit={openEdit}
          requestArchive={requestArchive}
          confirmArchive={confirmArchive}
          cancelArchive={() => setState(archiveConfirmCancelled)}
          addSubcategory={addSubcategory}
          archiveSubcategory={archiveSubcategory}
        />
      )}
    </div>
  );
}
