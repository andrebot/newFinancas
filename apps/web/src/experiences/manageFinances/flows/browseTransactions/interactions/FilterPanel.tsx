import type { Account, Category } from '@financas/api-types';
import { KIND_GROUPS, type KindGroup } from '@financas/reference';
import { useId, useState } from 'react';
import { transactionKinds as settings } from '../../../../../config/constants';
import { Button } from '../../../../../kit/button/Button';
import { ChipChecks } from '../../../../../kit/chipGroup/ChipChecks';
import type { Chip } from '../../../../../kit/chipGroup/ChipGroup';
import { MultiChoiceField } from '../../../../../kit/choiceField/MultiChoiceField';
import { DateRangePicker } from '../../../../../kit/dateRangePicker/DateRangePicker';
import type { RelativePreset } from '../../../../../kit/dateRangePicker/dateRangePresets';
import { Drawer } from '../../../../../kit/drawer/Drawer';
import { Icon } from '../../../../../kit/icons/Icon';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { Translator } from '../../../../../utilities/i18n';
import {
  cardName, groupName, kindIcon, kindName,
} from '../../../transactionNames';
import { browseText } from '../browseText';
import {
  chosenInGroup, kindCodesOf, rangeProblemsOf, withGroupKinds, type LedgerFilters,
} from '../ledgerFilters';

// Filter Panel (FL16, mockup 33; FR-3.12, OQ-204, OQ-220): the drawer that
// edits a draft of the ledger's filters — kinds by group (each with Select all
// or Clear; Transfer and Investment folded until opened or used), accounts and
// cards in one picker, categories, and a date range of any span. Archived
// accounts, cards and categories are offered after the open ones, tagged.
// Show hands the draft up; Clear all empties it, the Holding too. It renders
// and emits; the Flow holds the draft.

/** FilterPanel's props. */
export interface FilterPanelProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly draft: LedgerFilters;
  readonly onDraftChange: (draft: LedgerFilters) => void;
  /** The accounts the user can see, archived ones included, with their cards. */
  readonly accounts: readonly Account[];
  /** The household's categories, archived ones included. */
  readonly categories: readonly Category[];
  /** Whether Show was refused, so the range's errors show. */
  readonly showRangeErrors: boolean;
  readonly onApply: () => void;
  readonly onClearAll: () => void;
}

/** The range presets mockup 33 offers; Custom follows them. */
const PRESETS: readonly RelativePreset[] = [
  'anyTime', 'thisMonth', 'last30Days', 'last90Days', 'thisYear',
];

/** The groups shown open at first (mockup 33); the others fold until used. */
const OPEN_GROUPS: readonly KindGroup[] = ['cash', 'credit_card'];

/** How a source chip's value tells an account from a card. */
const ACCOUNT_PREFIX = 'account:';
const CARD_PREFIX = 'card:';

/**
 * Orders choices open first, archived after with the tag.
 *
 * @param open - The open ones' chips.
 * @param archived - The archived ones' chips.
 * @param translator - The texts.
 * @returns The chips.
 */
const openFirst = (
  open: readonly Chip<string>[],
  archived: readonly Chip<string>[],
  translator: Translator,
): Chip<string>[] => [
  ...open,
  ...archived.map((chip) => ({ ...chip, tag: browseText(translator, 'archived') })),
];

/**
 * Lists the accounts and their cards as one picker's chips (OQ-204): open
 * accounts then their cards, archived ones after.
 *
 * @param accounts - The accounts, with their cards.
 * @param translator - The texts.
 * @returns The chips; values say account or card.
 */
export const sourceChipsOf = (accounts: readonly Account[], translator: Translator) => {
  const chipsOf = (list: readonly Account[]): Chip<string>[] => [
    ...list.map((account) => ({
      value: `${ACCOUNT_PREFIX}${account.id}`, label: account.name ?? '',
    })),
    ...list.flatMap((account) => (account.cards ?? []).map((card) => ({
      value: `${CARD_PREFIX}${card.id}`,
      label: cardName(translator, card),
      icon: 'credit-card-outline' as const,
    }))),
  ];
  return openFirst(
    chipsOf(accounts.filter((account) => !account.archivedAt)),
    chipsOf(accounts.filter((account) => account.archivedAt)),
    translator,
  );
};

/**
 * Reads the picked accounts and cards as the picker's values.
 *
 * @param draft - The draft.
 * @returns The values.
 */
export const sourceValueOf = (draft: LedgerFilters) => [
  ...draft.accountIds.map((id) => `${ACCOUNT_PREFIX}${id}`),
  ...draft.creditCardIds.map((id) => `${CARD_PREFIX}${id}`),
];

/**
 * Splits the picker's values back into accounts and cards.
 *
 * @param draft - The draft.
 * @param values - The picker's values.
 * @returns The draft with them.
 */
export const withSources = (draft: LedgerFilters, values: readonly string[]): LedgerFilters => {
  const idsOf = (prefix: string) => values
    .filter((value) => value.startsWith(prefix))
    .map((value) => value.slice(prefix.length));
  return { ...draft, accountIds: idsOf(ACCOUNT_PREFIX), creditCardIds: idsOf(CARD_PREFIX) };
};

/**
 * Lists the categories as chips — each takes its subcategories (OQ-201) —
 * open ones first, archived after.
 *
 * @param categories - The household's categories.
 * @param translator - The texts.
 * @returns The chips.
 */
export const categoryChipsOf = (categories: readonly Category[], translator: Translator) => {
  const chipsOf = (list: readonly Category[]) => list.map((category) => ({
    value: category.id, label: category.name, icon: category.icon,
  }));
  return openFirst(
    chipsOf(categories.filter((category) => !category.archivedAt)),
    chipsOf(categories.filter((category) => category.archivedAt)),
    translator,
  );
};

/** One kind group's props. */
interface KindGroupProps {
  readonly group: KindGroup;
  readonly kinds: readonly string[];
  readonly onChange: (kinds: readonly string[]) => void;
}

/**
 * Renders one kind group: its header with the count and Select all or Clear,
 * and its kinds as chips — folded behind the header until opened, when it
 * starts folded and nothing in it is ticked.
 *
 * @param props - The group, the ticked kinds and the handler.
 * @returns The group.
 */
function KindGroupFilter({ group, kinds, onChange }: KindGroupProps) {
  const translator = useI18n();
  const id = useId();
  const codes = kindCodesOf(group);
  const chosen = chosenInGroup(kinds, group);
  const [unfolded, setUnfolded] = useState(OPEN_GROUPS.includes(group) || chosen.length > 0);
  const name = groupName(translator, group);
  const all = chosen.length === codes.length;
  const change = (next: readonly string[]) => onChange(withGroupKinds(kinds, group, next));
  if (!unfolded) {
    return (
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={settings.groupIcons[group]}
        trailingIcon="expand-more"
        aria-expanded={false}
        onClick={() => setUnfolded(true)}
      >
        {name}
        <span className="font-normal text-muted">
          {browseText(translator, 'filter.groupKinds', { count: codes.length })}
        </span>
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-line p-3">
      <div className="flex items-center gap-2">
        <Icon name={settings.groupIcons[group]} className="size-4.5 text-muted" />
        <span id={`${id}-name`} className="font-semibold">{name}</span>
        {chosen.length > 0 && (
          <span className="type-caption text-mint">
            {browseText(translator, 'filter.kindCount', { count: chosen.length })}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          aria-label={browseText(
            translator,
            all ? 'filter.clearIn' : 'filter.selectAllIn',
            { group: name },
          )}
          onClick={() => change(all ? [] : codes)}
        >
          {browseText(translator, all ? 'filter.clear' : 'filter.selectAll')}
        </Button>
      </div>
      <ChipChecks
        labelledBy={`${id}-name`}
        options={codes.map((code) => ({
          value: code, label: kindName(translator, code), icon: kindIcon(code),
        }))}
        value={chosen}
        onChange={change}
      />
    </div>
  );
}

/**
 * Renders the kind groups under their caption.
 *
 * @param props - The draft and its handler.
 * @returns The kind filter.
 */
function KindFilter({ draft, onDraftChange }: Pick<FilterPanelProps, 'draft' | 'onDraftChange'>) {
  const translator = useI18n();
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 type-caption font-semibold text-muted">
        {browseText(translator, 'filter.kind')}
        {draft.kinds.length > 0 && (
          <>
            {' '}
            <span className="font-normal text-mint">
              {browseText(translator, 'filter.kindCount', { count: draft.kinds.length })}
            </span>
          </>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {KIND_GROUPS.map((group) => (
          <KindGroupFilter
            key={group}
            group={group}
            kinds={draft.kinds}
            onChange={(kinds) => onDraftChange({ ...draft, kinds })}
          />
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Renders the accounts-and-cards picker and the category picker.
 *
 * @param props - The draft, its handler and the lists.
 * @returns The two pickers.
 */
function ListFilters({
  draft, onDraftChange, accounts, categories,
}: Pick<FilterPanelProps, 'draft' | 'onDraftChange' | 'accounts' | 'categories'>) {
  const translator = useI18n();
  const noResults = browseText(translator, 'filter.noResults');
  /**
   * Builds a picker's summary from its catalog key.
   *
   * @param key - The summary's key.
   * @returns The summary.
   */
  const summaryOf = (key: 'filter.source.summary' | 'filter.category.summary') => (
    chosen: number,
    total: number,
  ) => browseText(translator, key, { chosen, total });
  return (
    <>
      <MultiChoiceField
        label={browseText(translator, 'filter.source')}
        options={sourceChipsOf(accounts, translator)}
        value={sourceValueOf(draft)}
        onChange={(values) => onDraftChange(withSources(draft, values))}
        summary={summaryOf('filter.source.summary')}
        placeholder={browseText(translator, 'filter.source.placeholder')}
        search={{ label: browseText(translator, 'filter.source.search'), noResults }}
      />
      <MultiChoiceField
        label={browseText(translator, 'filter.category')}
        options={categoryChipsOf(categories, translator)}
        value={draft.categoryIds}
        onChange={(categoryIds) => onDraftChange({ ...draft, categoryIds })}
        summary={summaryOf('filter.category.summary')}
        placeholder={browseText(translator, 'filter.category.placeholder')}
        search={{ label: browseText(translator, 'filter.category.search'), noResults }}
      />
    </>
  );
}

/**
 * Renders the date range with its hint, and its errors once Show was refused.
 *
 * @param props - The draft, its handler and whether the errors show.
 * @returns The date range.
 */
function RangeFilter({
  draft, onDraftChange, showRangeErrors,
}: Pick<FilterPanelProps, 'draft' | 'onDraftChange' | 'showRangeErrors'>) {
  const translator = useI18n();
  const problems = showRangeErrors ? rangeProblemsOf(draft.range) : {};
  /**
   * Translates one end's refusal.
   *
   * @param end - From or To.
   * @returns Its message, or nothing.
   */
  const errorOf = (end: 'from' | 'to') => {
    const problem = problems[end];
    return problem && translator.field(problem.code, problem.params);
  };
  return (
    <div className="flex flex-col gap-2">
      <DateRangePicker
        label={browseText(translator, 'filter.dateRange')}
        presets={PRESETS}
        value={draft.range}
        onChange={(range) => onDraftChange({ ...draft, range })}
        errors={{ from: errorOf('from'), to: errorOf('to') }}
      />
      <p className="type-caption text-muted">{browseText(translator, 'filter.rangeHint')}</p>
    </div>
  );
}

/**
 * Renders the filter drawer.
 *
 * @param props - The open state, the draft, the lists and the handlers.
 * @returns The drawer.
 */
export function FilterPanel(props: FilterPanelProps) {
  const {
    open, onClose, onApply, onClearAll,
  } = props;
  const translator = useI18n();
  return (
    <Drawer
      open={open}
      onClose={onClose}
      caption={browseText(translator, 'filter.caption')}
      title={browseText(translator, 'filter.title')}
      footer={(
        <>
          <Button variant="ghost" className="mr-auto" onClick={onClearAll}>
            {browseText(translator, 'filter.clearAll')}
          </Button>
          <Button variant="primary" onClick={onApply}>
            {browseText(translator, 'filter.show')}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-6">
        <KindFilter {...props} />
        <ListFilters {...props} />
        <RangeFilter {...props} />
      </div>
    </Drawer>
  );
}
