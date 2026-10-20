import { CARD_NETWORKS } from '@financas/reference';
import { Select } from '../../../../../kit/select/Select';
import { TextField } from '../../../../../kit/textField/TextField';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { CardSlot } from '../accountManagementState';
import {
  DAYS, dayOption, EXPIRATION_YEARS, MONTHS,
} from './CardFields';

// One attached card's edit fields (FL11; OQ-35): the network, its last four
// digits and the billing days and expiration. The full number is never stored
// (NFR-SEC-7), so an attached card edits field by field — there is no number
// to re-type. New cards come from `CardFields`, which reads them off a typed
// number instead.

/** AttachedCardFields' props. */
export interface AttachedCardFieldsProps {
  /** The slot being edited, with its current values. */
  readonly slot: CardSlot;
  /** Gets a change to one of the fields. */
  readonly onChange: (patch: Partial<CardSlot>) => void;
}

/**
 * Renders an attached card's fields: network, last four digits and the days.
 *
 * @param props - The slot and its change handler.
 * @returns The fields.
 */
export function AttachedCardFields({ slot, onChange }: AttachedCardFieldsProps) {
  const translator = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Select
          label={translator.text('accountSetup', 'card.network')}
          options={CARD_NETWORKS.map((value) => ({
            value, label: translator.text('cardNetworks', value),
          }))}
          value={slot.network}
          onChange={(value) => onChange({ network: value })}
        />
        <TextField
          label={translator.text('accountSetup', 'card.last4')}
          inputMode="numeric"
          maxLength={4}
          value={slot.last4}
          onChange={(value) => onChange({ last4: value.replace(/\D/g, '').slice(0, 4) })}
        />
      </div>
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
          options={EXPIRATION_YEARS.map(dayOption)}
          value={String(slot.expirationYear)}
          onChange={(value) => onChange({ expirationYear: Number(value) })}
        />
      </div>
    </div>
  );
}
