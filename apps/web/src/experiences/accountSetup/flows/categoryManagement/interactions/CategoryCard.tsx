import { useState, type KeyboardEvent } from 'react';
import type { Category } from '@financas/api-types';
import { categories as categorySettings } from '../../../../../config/constants';
import { IconButton } from '../../../../../kit/button/IconButton';
import { CategoryDisc } from '../../../../../kit/categoryChip/CategoryChip';
import { InlineConfirm } from '../../../../../kit/confirm/InlineConfirm';
import { Icon } from '../../../../../kit/icons/Icon';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { nonBlank } from '../../../../../utilities/validation';
import { liveSubcategoriesOf } from '../categoryManagementState';

// A category's card in the grid (FL12, mockup 41): its disc and name, its
// live subcategories as chips — each archivable on its own (FR-10.3) — the
// dashed "+ Subcategory" pill that opens an inline field to add one more
// (OQ-173: a single atomic edit), and the Edit and Archive icon buttons for
// Owner/Admin. A long name wraps rather than pushing the buttons out. While
// its archive confirm is open the card shows that instead, as the mockup's
// coral-ringed card does. It holds no
// request state of its own; every action goes up to the Flow, and every
// control waits while a request is out. The typed subcategory stays until it
// shows up among the live ones, so a refused add keeps it for another try.

/** The subcategory chip's archive button surface. */
const SUB_ARCHIVE_CLASS = [
  'grid size-6 cursor-pointer place-items-center rounded-full',
  'text-muted hover:text-coral disabled:cursor-default disabled:opacity-40',
].join(' ');

/** The dashed pill that opens the inline field (mockup 41's `.addsub`). */
const ADD_SUB_PILL_CLASS = [
  'inline-flex h-[30px] cursor-pointer items-center gap-1 rounded-full border border-dashed',
  'border-line px-3 text-[13px] text-muted hover:border-mint/50 hover:text-mint',
  'disabled:cursor-default disabled:opacity-40',
].join(' ');

/** The open field's ringed chip (mockup 41's inline add). */
const ADD_SUB_CHIP_CLASS = [
  'inline-flex h-[30px] items-center gap-1 rounded-full border border-mint/60 bg-bg pl-3 pr-1',
  'ring-3 ring-mint/15',
].join(' ');

/** The open field's confirm button. */
const ADD_SUB_CLASS = [
  'grid size-6 cursor-pointer place-items-center rounded-full bg-mint',
  'text-onmint disabled:cursor-default disabled:opacity-40',
].join(' ');

/**
 * Holds the inline subcategory field's text, cleared once a new live
 * subcategory shows up — the add went through. A refused add, or a sibling
 * archived, keeps it. Set while rendering, React's pattern for state that
 * follows a prop.
 *
 * @param liveCount - How many live subcategories the card lists now.
 * @returns The text and its setter.
 */
const useSubcategoryDraft = (liveCount: number) => {
  const [subName, setSubName] = useState('');
  const [seenCount, setSeenCount] = useState(liveCount);
  if (liveCount !== seenCount) {
    setSeenCount(liveCount);
    if (liveCount > seenCount) setSubName('');
  }
  return [subName, setSubName] as const;
};

/** The inline subcategory entry's props. */
interface SubcategoryEntryProps {
  /** How many live subcategories the card lists now. */
  readonly liveCount: number;
  /** A request is out: the pill, the field and its button wait. */
  readonly busy: boolean;
  /** Adds a subcategory by its trimmed name. */
  readonly onAdd: (name: string) => void;
}

/**
 * Renders the card's way to add a subcategory (mockup 41): the dashed
 * "+ Subcategory" pill, which opens a ringed field with its ✓. Enter adds, Escape
 * closes; the field stays open and focused after an add, for the next one.
 *
 * @param props - The live count, the busy state and the add.
 * @returns The pill, or the open field.
 */
function SubcategoryEntry({ liveCount, busy, onAdd }: SubcategoryEntryProps) {
  const translator = useI18n();
  const [open, setOpen] = useState(false);
  const [subName, setSubName] = useSubcategoryDraft(liveCount);

  /** Adds the typed subcategory; the field clears once it is listed. */
  const add = () => {
    if (busy || nonBlank(subName) !== undefined) return;
    onAdd(subName.trim());
  };

  /** Closes the field, dropping what was typed. */
  const close = () => {
    setOpen(false);
    setSubName('');
  };

  /**
   * Adds on Enter and closes on Escape.
   *
   * @param event - The key pressed in the field.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') add();
    if (event.key === 'Escape') close();
  };

  if (!open) {
    return (
      <span>
        <button
          type="button"
          className={ADD_SUB_PILL_CLASS}
          disabled={busy}
          onClick={() => setOpen(true)}
        >
          <Icon name="add" className="size-3.5" />
          {translator.text('categoryManagement', 'sub.add.open')}
        </button>
      </span>
    );
  }

  return (
    <span className={ADD_SUB_CHIP_CLASS}>
      <input
        // The field opens on the user's own click, so taking the focus is expected.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={subName}
        maxLength={categorySettings.nameMaxLength}
        aria-label={translator.text('categoryManagement', 'sub.add.placeholder')}
        placeholder={translator.text('categoryManagement', 'sub.add.placeholder')}
        // Read-only, not disabled, while the add is out: a disabled field drops the
        // focus, and the user keeps typing the next one after Enter.
        readOnly={busy}
        aria-busy={busy}
        onChange={(event) => setSubName(event.target.value)}
        onKeyDown={onKeyDown}
        className="w-36 bg-transparent text-[13px] outline-none"
      />
      <button
        type="button"
        aria-label={translator.text('categoryManagement', 'sub.add')}
        onClick={add}
        disabled={busy || nonBlank(subName) !== undefined}
        className={ADD_SUB_CLASS}
      >
        <Icon name="check" className="size-3.5" />
      </button>
    </span>
  );
}

/** The category card's props. */
export interface CategoryCardProps {
  /** The live category. */
  readonly category: Category;
  /** Owner/Admin only (FR-1.7, OQ-193): the manage controls show. */
  readonly canManage: boolean;
  /** A request is out: its own control spins, the others wait. */
  readonly busy: boolean;
  /** This card's archive confirm is open. */
  readonly archivingOpen: boolean;
  /** Turns this card into its edit form. */
  readonly onEdit: (categoryId: string) => void;
  /** Opens this card's archive confirm. */
  readonly onArchiveRequest: (categoryId: string) => void;
  /** Confirms the open archive. */
  readonly onConfirmArchive: () => void;
  /** Closes the open archive confirm again. */
  readonly onCancelArchive: () => void;
  /** Adds a subcategory under this one (an atomic edit). */
  readonly onAddSubcategory: (categoryId: string, name: string) => void;
  /** Archives one of its subcategories (single row, no cascade). */
  readonly onArchiveSubcategory: (
    categoryId: string, subcategoryId: string, subName: string,
  ) => void;
}

/**
 * Renders a live category's card — or its archive confirm while that is open.
 *
 * @param props - The category and the Flow's handlers for it.
 * @returns The card.
 */
export function CategoryCard({
  category, canManage, busy, archivingOpen, onEdit, onArchiveRequest, onConfirmArchive,
  onCancelArchive, onAddSubcategory, onArchiveSubcategory,
}: CategoryCardProps) {
  const translator = useI18n();

  if (archivingOpen) {
    return (
      <div className="flex flex-col gap-4 rounded-xl2 bg-raised p-5 ring-1 ring-coral/40">
        <InlineConfirm
          tone="destructive"
          message={translator.text('categoryManagement', 'archive.confirm', {
            name: category.name,
            count: liveSubcategoriesOf(category).length,
          })}
          confirmLabel={translator.text('categoryManagement', 'archive.action')}
          cancelLabel={translator.text('categoryManagement', 'cancel')}
          onConfirm={onConfirmArchive}
          onCancel={onCancelArchive}
          busy={busy}
        />
      </div>
    );
  }

  const subs = liveSubcategoriesOf(category);

  return (
    <div className="flex flex-col gap-3 rounded-xl2 bg-raised p-5">
      <div className="flex items-center gap-3">
        <CategoryDisc icon={category.icon} color={category.color} size="lg" />
        <span className="min-w-0 flex-1 break-words font-semibold">{category.name}</span>
        {canManage && (
          <span className="-mr-1 flex shrink-0">
            <IconButton
              icon="edit-outline"
              size="sm"
              label={translator.text('categoryManagement', 'card.edit', { name: category.name })}
              onClick={() => onEdit(category.id)}
              disabled={busy}
            />
            <IconButton
              icon="archive-outline"
              size="sm"
              className="hover:!text-coral"
              label={translator.text('categoryManagement', 'card.archive', { name: category.name })}
              onClick={() => onArchiveRequest(category.id)}
              disabled={busy}
            />
          </span>
        )}
      </div>
      <p className="type-body text-muted">
        {subs.length === 0
          ? translator.text('categoryManagement', 'sub.none')
          : translator.text('categoryManagement', 'subs.count', { count: subs.length })}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {subs.map((sub) => {
          const label = translator.text('categoryManagement', 'sub.archive', { name: sub.name });
          return (
            <span key={sub.id} className="flex items-center gap-1">
              <span className="rounded-full bg-card px-3 py-1 text-[13px]">{sub.name}</span>
              {canManage && (
                <button
                  type="button"
                  aria-label={label}
                  className={SUB_ARCHIVE_CLASS}
                  disabled={busy}
                  onClick={() => onArchiveSubcategory(category.id, sub.id, sub.name)}
                >
                  <Icon name="delete-outline" className="size-4" />
                </button>
              )}
            </span>
          );
        })}
        {canManage && (
          <SubcategoryEntry
            liveCount={subs.length}
            busy={busy}
            onAdd={(name) => onAddSubcategory(category.id, name)}
          />
        )}
      </div>
    </div>
  );
}

/** An archived category's row in the collapsed section (FR-10.3). */
interface ArchivedCategoryProps {
  /** The archived category. */
  readonly category: Category;
}

/**
 * Renders an archived category, read-only: archiving is one-way.
 *
 * @param props - The category.
 * @returns Its muted row.
 */
export function ArchivedCategory({ category }: ArchivedCategoryProps) {
  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <CategoryDisc icon={category.icon} color={category.color} size="sm" />
      <span className="text-muted">{category.name}</span>
    </div>
  );
}
