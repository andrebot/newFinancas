import { useId, useState } from 'react';
import type { Category } from '@financas/api-types';
import type { Catalog } from '@financas/i18n';
import { boxClasses } from '../../../../../kit/checkbox/Checkbox';
import { CategoryDisc } from '../../../../../kit/categoryChip/CategoryChip';
import { Icon } from '../../../../../kit/icons/Icon';
import { useI18n } from '../../../../../utilities/I18nProvider';
import {
  opensByItself, type CategoryStanding, type PickerGroup, type SubcategoryStanding,
} from '../../../budgetClaims';

// The claim-aware category picker (FL13, mockup 42; FR-4.6/4.7, OQ-194): the
// budget's "Covers" as one group per category — a whole-category row, with a
// chevron revealing its subcategory rows indented under it. A row another
// budget in the scope holds is disabled and names where it lives; a ticked
// category covers its subcategories, shown ticked with it. A group opens by
// itself when one of its subcategories is ticked or claimed; the chevron
// opens and closes the rest. It holds only which groups are open: the ticks
// and every standing come from the drawer.

/** The chevron that opens a group. */
const CHEVRON_CLASS = [
  'grid size-9 shrink-0 cursor-pointer place-items-center rounded-full',
  'text-muted hover:text-ink',
].join(' ');

/**
 * Tells whether a subcategory row can be ticked or unticked here: free or
 * ticked on its own — not covered with its category, nor held elsewhere.
 *
 * @param standing - The row's standing.
 * @returns Whether its box takes a click.
 */
const isOpenToPick = (standing: SubcategoryStanding) => (
  standing.kind === 'picked' || standing.kind === 'free'
);

/** A row's surface: mint while ticked, muted while another budget holds it. */
const rowClasses = (checked: boolean, disabled: boolean) => [
  'group flex min-h-11 flex-1 items-center gap-3 rounded-lg border px-3 py-2 type-body',
  checked ? 'border-mint/60 bg-mint/10' : 'border-line',
  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-muted',
].join(' ');

/** What one row shows and does. */
interface PickRowProps {
  readonly label: string;
  /** The standing's note on the right ("in Fun Money", "all subcategories"). */
  readonly note?: string | undefined;
  readonly checked: boolean;
  readonly disabled: boolean;
  /** The covers are refused: each row marks itself invalid. */
  readonly invalid: boolean;
  readonly onToggle: () => void;
  /** The category's disc, on a whole-category row. */
  readonly disc?: Category | undefined;
}

/**
 * Renders one row: its box, its disc and name, and its note.
 *
 * @param props - The texts, the tick, the disabled state and the toggle.
 * @returns The row.
 */
function PickRow({
  label, note, checked, disabled, invalid, onToggle, disc,
}: PickRowProps) {
  const id = useId();
  return (
    <label htmlFor={id} className={rowClasses(checked, disabled)}>
      <span className={boxClasses(invalid && !checked)}>
        <input
          id={id}
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={note ? `${id}-note` : undefined}
          onChange={onToggle}
        />
        <Icon name="check" className="invisible size-3.5 group-has-checked:visible" />
      </span>
      {disc && <CategoryDisc icon={disc.icon} color={disc.color} size="xs" />}
      <span className="min-w-0 flex-1 break-words">{label}</span>
      {note && <span id={`${id}-note`} className="shrink-0 type-caption text-muted">{note}</span>}
    </label>
  );
}

/** The picker's texts, by key: what a standing's note is written with. */
type Translate = (
  key: keyof Catalog['budgetManagement'], params?: Readonly<Record<string, string>>,
) => string;

/**
 * Writes a whole-category row's note.
 *
 * @param standing - The row's standing.
 * @param translate - The picker's texts.
 * @returns "all subcategories", where it lives, or nothing while it is free.
 */
const categoryNote = (standing: CategoryStanding, translate: Translate) => {
  if (standing.kind === 'picked') return translate('cover.all');
  if (standing.kind === 'claimed') return translate('cover.in', { budget: standing.budget.name });
  if (standing.kind === 'partly') {
    return translate('cover.partly', { budget: standing.budget.name });
  }
  return undefined;
};

/**
 * Writes a subcategory row's note.
 *
 * @param standing - The row's standing.
 * @param translate - The picker's texts.
 * @returns Where it lives, "with the whole category", or nothing while free or ticked.
 */
const subcategoryNote = (standing: SubcategoryStanding, translate: Translate) => {
  if (standing.kind === 'withCategory') return translate('cover.withCategory');
  if (standing.kind === 'claimed') return translate('cover.in', { budget: standing.budget.name });
  if (standing.kind === 'coveredBy') {
    return translate('cover.coveredBy', { budget: standing.budget.name });
  }
  return undefined;
};

/**
 * Adds "archived" to a note, for a claim the edited budget keeps (OQ-176).
 *
 * @param note - The standing's note, if any.
 * @param archived - Whether the category or subcategory is archived.
 * @param translate - The picker's texts.
 * @returns The note, with the archived mark when it applies.
 */
const withArchived = (note: string | undefined, archived: boolean, translate: Translate) => {
  if (!archived) return note;
  const mark = translate('cover.archived');
  return note ? `${note} · ${mark}` : mark;
};

/**
 * Renders the chevron that opens and closes a group's subcategory rows.
 *
 * @param props - Its label, whether the group is open, the panel's id and the toggle.
 * @returns The chevron.
 */
function Chevron({
  label, open, panelId, onToggleOpen,
}: {
  readonly label: string;
  readonly open: boolean;
  readonly panelId: string;
  readonly onToggleOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      // Points at the panel only while it is drawn.
      aria-controls={open ? panelId : undefined}
      aria-label={label}
      onClick={onToggleOpen}
      className={CHEVRON_CLASS}
    >
      <Icon
        name="expand-more"
        className={`size-5 transition-transform ${open ? 'rotate-180' : ''}`}
      />
    </button>
  );
}

/** One group's props. */
interface GroupProps {
  readonly group: PickerGroup;
  readonly open: boolean;
  readonly disabled: boolean;
  readonly invalid: boolean;
  readonly onToggleOpen: () => void;
  readonly onToggleCategory: (category: Category) => void;
  readonly onToggleSubcategory: (subcategoryId: string) => void;
}

/**
 * Renders a category's group: its row with the chevron and, while open, its
 * subcategory rows.
 *
 * @param props - The group, whether it is open, the disabled state and the toggles.
 * @returns The group.
 */
function Group({
  group, open, disabled, invalid, onToggleOpen, onToggleCategory, onToggleSubcategory,
}: GroupProps) {
  const translator = useI18n();
  const panelId = useId();
  const translate: Translate = (key, params) => translator.text('budgetManagement', key, params);
  const { category, standing, subcategories } = group;
  const taken = standing.kind !== 'free' && standing.kind !== 'picked';

  return (
    <li className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <PickRow
          label={category.name}
          note={withArchived(
            categoryNote(standing, translate),
            category.archivedAt !== null,
            translate,
          )}
          checked={standing.kind === 'picked'}
          disabled={disabled || taken}
          invalid={invalid}
          onToggle={() => onToggleCategory(category)}
          disc={category}
        />
        {subcategories.length > 0 && (
          <Chevron
            label={translate('cover.expand', { name: category.name })}
            open={open}
            panelId={panelId}
            onToggleOpen={onToggleOpen}
          />
        )}
      </div>
      {open && subcategories.length > 0 && (
        <ul id={panelId} className="ml-8 mr-11 flex flex-col gap-2">
          {subcategories.map(({ subcategory, standing: subStanding }) => (
            <li key={subcategory.id} className="flex">
              <PickRow
                label={subcategory.name}
                note={withArchived(
                  subcategoryNote(subStanding, translate),
                  subcategory.archivedAt !== null,
                  translate,
                )}
                checked={subStanding.kind === 'picked' || subStanding.kind === 'withCategory'}
                disabled={disabled || !isOpenToPick(subStanding)}
                invalid={invalid}
                onToggle={() => onToggleSubcategory(subcategory.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** The picker's props. */
export interface CoverPickerProps {
  /** The groups, with each row's standing, as the drawer built them. */
  readonly groups: readonly PickerGroup[];
  /** A request is out: every row waits. */
  readonly disabled: boolean;
  /** Why the covers were refused, already translated. */
  readonly error?: string | undefined;
  readonly onToggleCategory: (category: Category) => void;
  readonly onToggleSubcategory: (subcategoryId: string) => void;
}

/**
 * Renders the "Covers" field: its label and hint, the groups, the error and
 * the note on claims.
 *
 * @param props - The groups, the disabled state, the error and the toggles.
 * @returns The picker.
 */
export function CoverPicker({
  groups, disabled, error, onToggleCategory, onToggleSubcategory,
}: CoverPickerProps) {
  const translator = useI18n();
  const labelId = useId();
  // Only the groups the user opened or closed by hand; the rest follow `opensByItself`.
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(new Map());

  /**
   * Flips one group open or closed by hand.
   *
   * @param group - The group.
   * @param open - Whether it is open now.
   */
  const flip = (group: PickerGroup, open: boolean) => {
    setToggled((current) => new Map(current).set(group.category.id, !open));
  };

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <span id={labelId} className="type-caption font-semibold text-muted">
          {translator.text('budgetManagement', 'covers.label')}
        </span>
        <span className="type-caption text-muted">
          {translator.text('budgetManagement', 'covers.hint')}
        </span>
      </div>
      {groups.length === 0 ? (
        <p className="type-body-sm text-muted">
          {translator.text('budgetManagement', 'covers.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => {
            const open = toggled.get(group.category.id) ?? opensByItself(group);
            return (
              <Group
                key={group.category.id}
                group={group}
                open={open}
                disabled={disabled}
                invalid={error !== undefined}
                onToggleOpen={() => flip(group, open)}
                onToggleCategory={onToggleCategory}
                onToggleSubcategory={onToggleSubcategory}
              />
            );
          })}
        </ul>
      )}
      {error && <span className="type-caption font-medium text-coral">{error}</span>}
      <p className="type-caption text-muted">
        {translator.text('budgetManagement', 'covers.note')}
      </p>
    </div>
  );
}
