import { detectCardNetwork, isValidCardNumber } from '@financas/reference';
import { CardNumberInput } from '../../../../../kit/creditCard/CardNumberInput';
import { Select } from '../../../../../kit/select/Select';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { CardDraft } from '../accountManagementState';

// One credit card's form fields (FL11, mockup 11; NFR-SEC-7): the number —
// grouped as its network writes it, with the detection under it — and the
// billing days and expiration. The caller holds what is typed and gets a
// `CardDraft` only when every field passes: a valid number (its length and
// Luhn), a closing day, a due day and an expiration. Only the network and the
// last four digits ever leave this form; the number itself never does.

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

export const DAYS = Array.from({ length: 28 }, (_, index) => index + 1);
export const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
/** The years an expiration may name: this one and the fifteen after it. */
export const EXPIRATION_YEARS = (() => {
  const first = new Date().getFullYear();
  return Array.from({ length: 16 }, (_, index) => first + index);
})();

/** Names a day's option, labelled by its number. */
export const dayOption = (value: number) => ({ value: String(value), label: String(value) });

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
 * Renders one card's fields: the number with its detection, the billing days
 * and the expiration.
 *
 * @param props - The form state, the field error and the change handler.
 * @returns The fields.
 */
export function CardFields({ form, digitsError, onChange }: CardFieldsProps) {
  const translator = useI18n();
  const network = detectCardNetwork(form.digits);
  const detected = translator.text('cardNetworks', network);
  const hint = form.digits.length > 0 && !digitsError
    ? translator.text('creditCard', 'detected', { network: detected })
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <CardNumberInput
        label={translator.text('creditCard', 'number')}
        hint={hint}
        error={digitsError}
        value={form.digits}
        onChange={(value) => onChange({ digits: value })}
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label={translator.text('accountSetup', 'card.closingDay')}
          options={DAYS.map(dayOption)}
          placeholder={translator.text('accountSetup', 'card.pickDay')}
          value={form.closingDay === null ? null : String(form.closingDay)}
          onChange={(value) => onChange({ closingDay: Number(value) })}
        />
        <Select
          label={translator.text('accountSetup', 'card.dueDay')}
          options={DAYS.map(dayOption)}
          placeholder={translator.text('accountSetup', 'card.pickDay')}
          value={form.dueDay === null ? null : String(form.dueDay)}
          onChange={(value) => onChange({ dueDay: Number(value) })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label={translator.text('accountSetup', 'card.month')}
          options={MONTHS.map(dayOption)}
          placeholder={translator.text('accountSetup', 'card.pickMonth')}
          value={form.expirationMonth === null ? null : String(form.expirationMonth)}
          onChange={(value) => onChange({ expirationMonth: Number(value) })}
        />
        <Select
          label={translator.text('accountSetup', 'card.year')}
          options={EXPIRATION_YEARS.map(dayOption)}
          placeholder={translator.text('accountSetup', 'card.pickYear')}
          value={form.expirationYear === null ? null : String(form.expirationYear)}
          onChange={(value) => onChange({ expirationYear: Number(value) })}
        />
      </div>
    </div>
  );
}
