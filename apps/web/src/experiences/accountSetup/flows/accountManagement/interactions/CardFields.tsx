import {
  CARD_NUMBER_FORMATS, detectCardNetwork, isValidCardNumber,
} from '@financas/reference';
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

/** Why one of a card's fields doesn't pass; each has its own message. */
export type CardObjection = 'number.required' | 'number.length' | 'number.invalid'
  | 'pick.day' | 'pick.month' | 'pick.year';

/** A card's failing fields, each with its objection; empty when the card passes. */
export type CardObjections = Partial<Record<keyof CardFormState, CardObjection>>;

/** The picks a card needs, with the objection each raises while empty. */
const PICKS: readonly (readonly [keyof CardFormState, CardObjection])[] = [
  ['closingDay', 'pick.day'],
  ['dueDay', 'pick.day'],
  ['expirationMonth', 'pick.month'],
  ['expirationYear', 'pick.year'],
];

/**
 * Names what is wrong with a card number: missing, a length its network (read
 * from the first digits) never has, or a checksum that fails — a typo.
 *
 * @param digits - The digits as typed.
 * @returns The objection, or nothing when the number is valid.
 */
export const numberObjection = (digits: string): CardObjection | undefined => {
  if (digits.length === 0) return 'number.required';
  if (isValidCardNumber(digits)) return undefined;
  const { lengths } = CARD_NUMBER_FORMATS[detectCardNetwork(digits)];
  return lengths.includes(digits.length) ? 'number.invalid' : 'number.length';
};

/**
 * Names each of a card's fields that doesn't pass, so each shows its own message.
 *
 * @param form - What is typed and picked.
 * @returns The failing fields and why; empty when the card passes.
 */
export const cardObjectionsOf = (form: CardFormState): CardObjections => {
  const entries = [
    ['digits', numberObjection(form.digits)] as const,
    ...PICKS.map(([field, objection]) => (
      [field, form[field] === null ? objection : undefined] as const
    )),
  ];
  return Object.fromEntries(entries.filter(([, objection]) => objection !== undefined));
};

/** What the new cards' fields read into, with the objections of each that fails. */
export interface DraftsResult {
  /** The drafts that passed. */
  readonly drafts: CardDraft[];
  /** One per form: its failing fields, or nothing when it passed. */
  readonly errors: (CardObjections | undefined)[];
}

/**
 * Reads the cards' fields into their drafts, naming what fails in each.
 *
 * @param forms - What is typed in each card.
 * @returns Its drafts and its objections, per form.
 */
export const draftsOf = (forms: readonly CardFormState[]): DraftsResult => {
  const drafts: CardDraft[] = [];
  const errors = forms.map((form) => {
    const draft = cardDraftOf(form);
    if (draft === undefined) return cardObjectionsOf(form);
    drafts.push(draft);
    return undefined;
  });
  return { drafts, errors };
};

/**
 * Drops the objections of the fields a change touched; the others stay.
 *
 * @param objections - The card's objections, if any.
 * @param patch - The fields that changed.
 * @returns What is left, or nothing when none is.
 */
export const withoutObjections = (
  objections: CardObjections | undefined,
  patch: Partial<CardFormState>,
): CardObjections | undefined => {
  if (objections === undefined) return undefined;
  const left = Object.fromEntries(
    Object.entries(objections).filter(([field]) => !(field in patch)),
  );
  return Object.keys(left).length === 0 ? undefined : left;
};

/** CardFields' props. */
export interface CardFieldsProps {
  /** What is typed and picked. */
  readonly form: CardFormState;
  /** The fields that failed the last submit, each shown under its field. */
  readonly errors?: CardObjections | undefined;
  /** Gets a change to one of the fields. */
  readonly onChange: (patch: Partial<CardFormState>) => void;
}

/**
 * Renders one card's fields: the number beside its live preview, the billing
 * days and the expiration.
 *
 * @param props - The form state, the fields' objections and the change handler.
 * @returns The fields.
 */
export function CardFields({ form, errors = {}, onChange }: CardFieldsProps) {
  const translator = useI18n();
  const network = detectCardNetwork(form.digits);
  /** Translates a field's objection, naming the network for a length. */
  const errorOf = (field: keyof CardFormState) => {
    const objection = errors[field];
    return objection && translator.text('accountSetup', `card.error.${objection}`, {
      network: translator.text('cardNetworks', network),
    });
  };
  const digitsError = errorOf('digits');
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
          error={errorOf('closingDay')}
          onChange={(value) => onChange({ closingDay: Number(value) })}
        />
        <Select
          label={translator.text('accountSetup', 'card.dueDay')}
          options={DAYS.map(dayOption)}
          placeholder={translator.text('accountSetup', 'card.pickDay')}
          value={selectValue(form.dueDay)}
          error={errorOf('dueDay')}
          onChange={(value) => onChange({ dueDay: Number(value) })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label={translator.text('accountSetup', 'card.month')}
          options={MONTHS.map(dayOption)}
          placeholder={translator.text('accountSetup', 'card.pickMonth')}
          value={selectValue(form.expirationMonth)}
          error={errorOf('expirationMonth')}
          onChange={(value) => onChange({ expirationMonth: Number(value) })}
        />
        <Select
          label={translator.text('accountSetup', 'card.year')}
          options={expirationYears(new Date().getFullYear()).map(dayOption)}
          placeholder={translator.text('accountSetup', 'card.pickYear')}
          value={selectValue(form.expirationYear)}
          error={errorOf('expirationYear')}
          onChange={(value) => onChange({ expirationYear: Number(value) })}
        />
      </div>
    </div>
  );
}
