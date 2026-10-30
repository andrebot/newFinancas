import type { Account, Category, Currency } from '@financas/api-types';
import { recordTransaction as settings } from '../../../../../config/constants';
import type { Chip } from '../../../../../kit/chipGroup/ChipGroup';
import { DateInput } from '../../../../../kit/dateInput/DateInput';
import { LockedField } from '../../../../../kit/field/LockedField';
import { MoneyInput } from '../../../../../kit/moneyInput/MoneyInput';
import { TextField } from '../../../../../kit/textField/TextField';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { Translator } from '../../../../../utilities/i18n';
import { cardName } from '../../../transactionNames';
import {
  accountChoicesOf, cardEntriesOf, cardEntryOf, directionOf, groupOf, isBillPayment, isBuy,
  isCardKind, isTrade, namesCard, type CardEntry, type TransactionForm,
} from '../transactionForm';
import { ChoiceField } from '../../../../../kit/choiceField/ChoiceField';
import { recordText } from '../recordText';

// Transaction Entry (FL15, mockup 31; FR-3.1, FR-3.4, OQ-201, OQ-219): what
// every kind has — the amount as the hero, signed and in the target's
// currency (FR-2.2), the target (an account, a card, or a card and the
// account paying its bill), the date and description, and the category with
// its subcategory, optional for every kind. On an edit the target is shown,
// never changed (D6). Each part renders and emits; the Flow holds the form.

/** The value that stands for "no category" among the chips. */
export const NO_CATEGORY = 'none';

/** AmountField's props. */
export interface AmountFieldProps {
  readonly form: TransactionForm;
  /** The target's currency; nothing while no target is chosen. */
  readonly currency: Currency | undefined;
  readonly error?: string | undefined;
  /** A started schedule keeps its amount (D8). */
  readonly disabled?: boolean | undefined;
  readonly onChange: (amount: number | null) => void;
}

/**
 * Picks the amount's caption key: what a buy invests, what a sell or
 * redemption receives, or the plain amount.
 *
 * @param kind - The kind's code.
 * @returns The `recordTransaction` key.
 */
const amountLabelOf = (kind: string) => {
  if (isBuy(kind)) return 'amount.invested';
  return isTrade(kind) ? 'amount.received' : 'amount.label';
};

/**
 * Writes the line under the amount: where a trade's money goes, or which way
 * it moves and whose currency it is in.
 *
 * @param kind - The kind's code.
 * @param currency - The target's currency, if chosen.
 * @param translator - The texts.
 * @returns The hint.
 */
const amountHintOf = (kind: string, currency: Currency | undefined, translator: Translator) => {
  if (isBuy(kind)) return recordText(translator, 'amount.hint.buy');
  if (isTrade(kind)) return recordText(translator, 'amount.hint.sell');
  return recordText(translator, 'amount.hint', {
    direction: directionOf(kind),
    target: isCardKind(kind) ? 'card' : 'account',
    currency: currency ?? 'none',
  });
};

/**
 * Renders the amount in the hero look, signed by the kind's direction.
 *
 * @param props - The form, the currency, the error, whether it is locked, and the handler.
 * @returns The amount field.
 */
export function AmountField({
  form, currency, error, disabled, onChange,
}: AmountFieldProps) {
  const translator = useI18n();
  return (
    <MoneyInput
      variant="hero"
      label={recordText(translator, amountLabelOf(form.kind))}
      hint={amountHintOf(form.kind, currency, translator)}
      error={error}
      currency={currency ?? settings.placeholderCurrency}
      direction={directionOf(form.kind)}
      value={form.amount}
      disabled={disabled}
      onChange={onChange}
    />
  );
}

/** TargetFields' props. */
export interface TargetFieldsProps {
  readonly form: TransactionForm;
  /** The accounts the user can see, with their cards. */
  readonly accounts: readonly Account[];
  readonly accountError?: string | undefined;
  readonly cardError?: string | undefined;
  /** An edit: the targets are shown, not picked (OQ-201 D6). */
  readonly locked?: boolean | undefined;
  readonly onAccount: (accountId: string) => void;
  readonly onCard: (creditCardId: string) => void;
}

/**
 * Names a card: its network and last digits.
 *
 * @param entry - The card with its account.
 * @param translator - The texts.
 * @returns The card's name.
 */
export const cardNameOf = (entry: CardEntry, translator: Translator) => (
  cardName(translator, entry.card)
);

/**
 * Picks the account's caption key: the paying account of a bill payment, the
 * account an investment kind sits in, or where cash goes from or to.
 *
 * @param kind - The kind's code.
 * @returns The `recordTransaction` key.
 */
const accountLabelOf = (kind: string) => {
  if (isBillPayment(kind)) return 'field.payer';
  if (groupOf(kind) === 'investment') return 'field.account';
  return `field.account.${directionOf(kind)}`;
};

/**
 * Renders the locked targets of an edit: its account and, where it names one, its card.
 *
 * @param props - The form, the accounts and the texts' source.
 * @returns The locked fields.
 */
function LockedTargets({ form, accounts }: Pick<TargetFieldsProps, 'form' | 'accounts'>) {
  const translator = useI18n();
  const card = cardEntryOf(accounts, form.creditCardId);
  const account = accounts.find((candidate) => candidate.id === form.accountId);
  return (
    <>
      {namesCard(form.kind) && card && (
        <LockedField
          label={recordText(translator, 'field.card')}
          value={cardNameOf(card, translator)}
        />
      )}
      {account && (
        <LockedField
          label={recordText(translator, accountLabelOf(form.kind))}
          value={account.name}
        />
      )}
    </>
  );
}

/**
 * Renders the target pickers: the card where the kind names one, then the
 * account where it takes one — for a bill payment, the accounts in the card's
 * currency (OQ-219).
 *
 * @param props - The form, the accounts, the errors, whether locked, and the handlers.
 * @returns The target fields.
 */
export function TargetFields({
  form, accounts, accountError, cardError, locked, onAccount, onCard,
}: TargetFieldsProps) {
  const translator = useI18n();
  if (locked) return <LockedTargets form={form} accounts={accounts} />;
  const accountChoices = accountChoicesOf(form, accounts);
  const cardChoices: Chip<string>[] = cardEntriesOf(accounts).map((entry) => ({
    value: entry.card.id, label: cardNameOf(entry, translator), tag: entry.account.name,
  }));
  return (
    <>
      {namesCard(form.kind) && (
        <ChoiceField
          label={recordText(translator, 'field.card')}
          options={cardChoices}
          value={form.creditCardId}
          error={cardError}
          onChange={onCard}
        />
      )}
      {!isCardKind(form.kind) && (
        <ChoiceField
          label={recordText(translator, accountLabelOf(form.kind))}
          options={accountChoices.map((account) => ({
            value: account.id, label: account.name, tag: account.currency,
          }))}
          value={form.accountId}
          error={accountError}
          onChange={onAccount}
        />
      )}
    </>
  );
}

/** DetailFields' props. */
export interface DetailFieldsProps {
  readonly date: string;
  readonly description: string;
  readonly dateError?: string | undefined;
  /** A started schedule keeps its date (D8). */
  readonly dateDisabled?: boolean | undefined;
  readonly onDate: (date: string) => void;
  readonly onDescription: (description: string) => void;
}

/**
 * Renders the date and the description side by side (mockup 31).
 *
 * @param props - The values, the date's error and lock, and the handlers.
 * @returns The two fields.
 */
export function DetailFields({
  date, description, dateError, dateDisabled, onDate, onDescription,
}: DetailFieldsProps) {
  const translator = useI18n();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
      <DateInput
        label={recordText(translator, 'field.date')}
        value={date}
        error={dateError}
        disabled={dateDisabled}
        onChange={onDate}
      />
      <TextField
        label={recordText(translator, 'field.description')}
        value={description}
        onChange={onDescription}
      />
    </div>
  );
}

/** CategoryFields' props. */
export interface CategoryFieldsProps {
  /** The household's categories, archived ones included. */
  readonly categories: readonly Category[];
  readonly categoryId: string | undefined;
  readonly subcategoryId: string | undefined;
  /** The kind is an investment one: the note says how it counts (mockup 32). */
  readonly investment: boolean;
  readonly onCategory: (categoryId: string | undefined) => void;
  readonly onSubcategory: (subcategoryId: string | undefined) => void;
}

/**
 * Lists the categories offered: the open ones, and the one an edit already
 * has even when archived (OQ-201 F10) — "Uncategorized" first.
 *
 * @param categories - The household's categories.
 * @param chosen - The category chosen, if any.
 * @param uncategorized - The "none" chip's name.
 * @returns The chips.
 */
export const categoryChoicesOf = (
  categories: readonly Category[],
  chosen: string | undefined,
  uncategorized: string,
): Chip<string>[] => [
  { value: NO_CATEGORY, label: uncategorized },
  ...categories
    .filter((category) => category.archivedAt === null || category.id === chosen)
    .map((category) => ({ value: category.id, label: category.name, icon: category.icon })),
];

/**
 * Renders the category and, once it has open subcategories, the subcategory —
 * each with an "Uncategorized" / "None" choice, both optional (FR-3.4).
 *
 * @param props - The categories, the choices, the kind's note and the handlers.
 * @returns The category fields.
 */
export function CategoryFields({
  categories, categoryId, subcategoryId, investment, onCategory, onSubcategory,
}: CategoryFieldsProps) {
  const translator = useI18n();
  const category = categories.find((candidate) => candidate.id === categoryId);
  const subcategories = (category?.subcategories ?? []).filter(
    (subcategory) => subcategory.archivedAt === null || subcategory.id === subcategoryId,
  );
  const fromChip = (value: string) => (value === NO_CATEGORY ? undefined : value);
  return (
    <>
      <ChoiceField
        label={recordText(translator, 'field.category')}
        note={recordText(translator, investment ? 'category.note.investment' : 'category.note')}
        options={categoryChoicesOf(
          categories,
          categoryId,
          recordText(translator, 'category.none'),
        )}
        value={categoryId ?? NO_CATEGORY}
        onChange={(value) => onCategory(fromChip(value))}
      />
      {subcategories.length > 0 && (
        <ChoiceField
          label={recordText(translator, 'field.subcategory')}
          note={recordText(translator, 'subcategory.note')}
          options={[
            { value: NO_CATEGORY, label: recordText(translator, 'subcategory.none') },
            ...subcategories.map(({ id, name }) => ({ value: id, label: name })),
          ]}
          value={subcategoryId ?? NO_CATEGORY}
          onChange={(value) => onSubcategory(fromChip(value))}
        />
      )}
    </>
  );
}
