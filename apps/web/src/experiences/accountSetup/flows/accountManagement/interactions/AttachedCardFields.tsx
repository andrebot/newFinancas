import { Button } from '../../../../../kit/button/Button';
import { CardRow } from '../../../../../kit/creditCard/CardRow';
import { Select } from '../../../../../kit/select/Select';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { CardSlot } from '../accountManagementState';
import {
  DAYS, dayOption, expirationYears, expiryOf, MONTHS,
} from './CardFields';

// One attached card in the edit drawer (FL11; OQ-35, OQ-192): the saved card's
// strip (K48) — its network and last four digits, fixed, with its Remove
// button — over its billing days and expiration, which edit field by field.
// The full number is never stored (NFR-SEC-7), and a different number is a
// different card: it is removed and a new one added through `CardFields`.

/** AttachedCardFields' props. */
export interface AttachedCardFieldsProps {
  /** The slot being edited, with its current values. */
  readonly slot: CardSlot;
  /** Gets a change to one of the billing fields. */
  readonly onChange: (patch: Partial<CardSlot>) => void;
  /** Marks the card for removal. */
  readonly onRemove: () => void;
}

/**
 * Renders an attached card: its strip with the Remove button, then the days
 * and the expiration.
 *
 * @param props - The slot and its handlers.
 * @returns The fields.
 */
export function AttachedCardFields({ slot, onChange, onRemove }: AttachedCardFieldsProps) {
  const translator = useI18n();
  const billing = translator.text('creditCard', 'billing', {
    closingDay: slot.closingDay, dueDay: slot.dueDay,
  });
  const expires = translator.text('creditCard', 'expires', {
    expiry: expiryOf(slot.expirationMonth, slot.expirationYear),
  });

  return (
    <div className="flex flex-col gap-4">
      <CardRow
        network={slot.network}
        last4={slot.last4}
        networkName={translator.text('cardNetworks', slot.network)}
        meta={`${billing} · ${expires}`}
        trailing={(
          <Button variant="ghost" onClick={onRemove}>
            {translator.text('creditCard', 'remove')}
          </Button>
        )}
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label={translator.text('accountSetup', 'card.closingDay')}
          options={DAYS.map(dayOption)}
          value={String(slot.closingDay)}
          onChange={(value) => onChange({ closingDay: Number(value) })}
        />
        <Select
          label={translator.text('accountSetup', 'card.dueDay')}
          options={DAYS.map(dayOption)}
          value={String(slot.dueDay)}
          onChange={(value) => onChange({ dueDay: Number(value) })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label={translator.text('accountSetup', 'card.month')}
          options={MONTHS.map(dayOption)}
          value={String(slot.expirationMonth)}
          onChange={(value) => onChange({ expirationMonth: Number(value) })}
        />
        <Select
          label={translator.text('accountSetup', 'card.year')}
          options={expirationYears(new Date().getFullYear(), slot.expirationYear).map(dayOption)}
          value={String(slot.expirationYear)}
          onChange={(value) => onChange({ expirationYear: Number(value) })}
        />
      </div>
    </div>
  );
}
