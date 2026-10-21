import { detectCardNetwork, isValidCardNumber } from '@financas/reference';
import { creditCard } from '../../../../../config/constants';
import { CardNumberInput } from '../../../../../kit/creditCard/CardNumberInput';
import { CardPreview } from '../../../../../kit/creditCard/CardPreview';
import { Select } from '../../../../../kit/select/Select';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { CardDraft } from '../accountManagementState';

// One credit card's form fields (FL11, mockup 11; NFR-SEC-7): the number —
// grouped as its network writes it — beside the live card preview (K48), which
// names the detected network, and the billing days and expiration. The caller
// holds what is typed and gets a `CardDraft` only when every field passes: a
// valid number (its length and Luhn), a closing day, a due day and an
// expiration. Only the network and the last four digits ever leave this form;
// the number itself never does.

/** What one card's fields hold while it is typed. */
export interface CardFormState {
  /** The digits as typed, without separators. */
  readonly digits: string;
  /** 1–28, or `null` while nothing is picked. */
  readonly closingDay: number | null;
  /** 1–28, or `null` while nothing is picked. */
  readonly dueDay: number | null;
  /** 1–12, or `null` while nothing is picked. */
  readonly expirationMonth: number | null;
  /** Full year, e.g. 2030, or `null` while nothing is picked. */
  readonly expirationYear: number | null;
}

/** The fields as they open: nothing typed, nothing picked. */
export const EMPTY_CARD_FORM: CardFormState = {
  digits: '', closingDay: null, dueDay: null, expirationMonth: null, expirationYear: null,
};

/** The days a billing cycle may close or fall due on: 1–28, so every month has it (OQ-170). */
export const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);
export const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

/**
 * Lists the years an expiration may name: the first one and the window after
 * it, plus a saved card's own year when it falls outside (an expired card
 * still shows its year).
 *
 * @param firstYear - The first year offered, normally this one.
 * @param keep - A year that must be offered, if any.
 * @returns The years, in order.
 */
export const expirationYears = (firstYear: number, keep?: number): number[] => {
  const years = Array.from(
    { length: creditCard.expirationYearsAhead + 1 },
    (_, index) => firstYear + index,
  );
  if (keep === undefined || years.includes(keep)) return years;
  return [...years, keep].sort((left, right) => left - right);
};

/**
 * Turns a picked number into a Select's value.
 *
 * @param value - The pick, or `null` while nothing is picked.
 * @returns Its text, or `null` for the placeholder.
 */
export const selectValue = (value: number | null): string | null => (
  value === null ? null : String(value)
);

/** Names a day's option, labelled by its number. */
export const dayOption = (value: number) => ({ value: String(value), label: String(value) });

/**
 * Writes an expiration the way a card prints it.
 *
 * @param month - 1–12, or `null` while not picked.
 * @param year - The full year, or `null` while not picked.
 * @returns `MM/YY`, e.g. `08/30`; nothing until both are picked.
 */
export const expiryOf = (month: number | null, year: number | null): string | undefined => {
  if (month === null || year === null) return undefined;
  return `${String(month).padStart(2, '0')}/${String(year % 100).padStart(2, '0')}`;
};

/**
 * Reads a card's fields into what the API takes, when they pass.
 *
 * @param form - What is typed and picked.
 * @returns The draft — network from the number, its last four digits — or
 *   `undefined` while any field is missing or the number fails its checks.
 */
export const cardDraftOf = (form: CardFormState): CardDraft | undefined => {
  if (!isValidCardNumber(form.digits)) return undefined;
  const {
    closingDay, dueDay, expirationMonth, expirationYear,
  } = form;
  if (closingDay === null || dueDay === null) return undefined;
  if (expirationMonth === null || expirationYear === null) return undefined;
  return {
    network: detectCardNetwork(form.digits),
    last4: form.digits.slice(-4),
    closingDay,
    dueDay,
    expirationMonth,
    expirationYear,
  };
};

/** What the new cards' fields read into, with an error for each that fails. */
export interface DraftsResult {
  /** The drafts that passed. */
  readonly drafts: CardDraft[];
  /** One per form: its objection, or nothing when it passed. */
  readonly errors: (string | undefined)[];
}

/**
 * Reads the cards' fields into their drafts, naming each one that fails.
 *
 * @param forms - What is typed in each card.
 * @param incomplete - The objection for a card whose fields don't pass.
 * @returns Its drafts and its errors, per form.
 */
export const draftsOf = (forms: readonly CardFormState[], incomplete: string): DraftsResult => {
  const drafts: CardDraft[] = [];
  const errors = forms.map((form) => {
    const draft = cardDraftOf(form);
    if (draft === undefined) return incomplete;
    drafts.push(draft);
    return undefined;
  });
  return { drafts, errors };
};

/** CardFields' props. */
export interface CardFieldsProps {
  /** What is typed and picked. */
  readonly form: CardFormState;
  /** The number's objection, already translated, under the field. */
  readonly digitsError?: string | undefined;
  /** Gets a change to one of the fields. */
  readonly onChange: (patch: Partial<CardFormState>) => void;
}

/**
 * Renders one card's fields: the number beside its live preview, the billing
 * days and the expiration.
 *
 * @param props - The form state, the field error and the change handler.
 * @returns The fields.
 */
export function CardFields({ form, digitsError, onChange }: CardFieldsProps) {
  const translator = useI18n();
  const network = detectCardNetwork(form.digits);
  const caption = form.digits.length > 0 && !digitsError
    ? translator.text('creditCard', 'detected', {
      network: translator.text('cardNetworks', network),
    })
    : undefined;
  const billing = form.closingDay !== null && form.dueDay !== null
    ? translator.text('creditCard', 'billing', {
      closingDay: form.closingDay, dueDay: form.dueDay,
    })
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-start">
        <CardPreview
          network={network}
          digits={form.digits}
          billing={billing}
          expiry={expiryOf(form.expirationMonth, form.expirationYear)}
          caption={caption}
        />
        <CardNumberInput
          label={translator.text('creditCard', 'number')}
          error={digitsError}
          value={form.digits}
          onChange={(value) => onChange({ digits: value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label={translator.text('accountSetup', 'card.closingDay')}
          options={DAYS.map(dayOption)}
          placeholder={translator.text('accountSetup', 'card.pickDay')}
          value={selectValue(form.closingDay)}
          onChange={(value) => onChange({ closingDay: Number(value) })}
        />
        <Select
          label={translator.text('accountSetup', 'card.dueDay')}
          options={DAYS.map(dayOption)}
          placeholder={translator.text('accountSetup', 'card.pickDay')}
          value={selectValue(form.dueDay)}
          onChange={(value) => onChange({ dueDay: Number(value) })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label={translator.text('accountSetup', 'card.month')}
          options={MONTHS.map(dayOption)}
          placeholder={translator.text('accountSetup', 'card.pickMonth')}
          value={selectValue(form.expirationMonth)}
          onChange={(value) => onChange({ expirationMonth: Number(value) })}
        />
        <Select
          label={translator.text('accountSetup', 'card.year')}
          options={expirationYears(new Date().getFullYear()).map(dayOption)}
          placeholder={translator.text('accountSetup', 'card.pickYear')}
          value={selectValue(form.expirationYear)}
          onChange={(value) => onChange({ expirationYear: Number(value) })}
        />
      </div>
    </div>
  );
}
