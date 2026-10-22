import { Button } from '../../../../../kit/button/Button';
import { IconButton } from '../../../../../kit/button/IconButton';
import { CardRow } from '../../../../../kit/creditCard/CardRow';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { CardDraft } from '../../../../accountSetup/flows/accountManagement/accountManagementState';
import {
  CardFields, expiryOf, type CardFormState, type CardObjections,
} from '../../../../accountSetup/flows/accountManagement/interactions/CardFields';

// The first account's cards (FL6, mockup 11; FR-2.7, NFR-SEC-7): the cards
// saved so far as their K48 strips, each with its ✕, and one "New credit card"
// form at a time — the number beside its live preview, the billing days and
// expiry picked from dropdowns (OQ-192) — with Cancel and Save card. A saved
// card is only a draft until the account is created with it. The entry holds
// every value; this renders them and emits each change.

/** AccountCardsField's props. */
export interface AccountCardsFieldProps {
  /** The cards saved so far. */
  readonly saved: readonly CardDraft[];
  /** The new card's fields while its form is open. */
  readonly form?: CardFormState | undefined;
  /** The new card's failing fields from the last Save card. */
  readonly errors?: CardObjections | undefined;
  /** A request is out: the buttons wait. */
  readonly disabled: boolean;
  /** Opens the new card's form. */
  readonly onOpen: () => void;
  /** Gets a change to one of the new card's fields. */
  readonly onChange: (patch: Partial<CardFormState>) => void;
  /** Saves the new card, as its fields stand, once it passes. */
  readonly onSave: (form: CardFormState) => void;
  /** Closes the new card's form, dropping what was typed. */
  readonly onCancel: () => void;
  /** Drops a saved card. */
  readonly onRemove: (index: number) => void;
}

/**
 * Renders the cards field: the saved strips, then the open form or its button.
 *
 * @param props - The cards, the open form and the handlers.
 * @returns The field.
 */
export function AccountCardsField({
  saved, form, errors, disabled, onOpen, onChange, onSave, onCancel, onRemove,
}: AccountCardsFieldProps) {
  const translator = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <span className="type-caption font-semibold text-muted">
        {translator.text('guidedSetup', 'cards.title')}
        {' '}
        <span className="font-normal text-faint">
          {translator.text('guidedSetup', 'cards.optional')}
        </span>
      </span>
      {saved.length > 0 && (
        <ul className="flex flex-col gap-2">
          {saved.map((card, index) => (
            <li key={`${card.network}-${card.last4}-${String(index)}`}>
              <CardRow
                network={card.network}
                last4={card.last4}
                networkName={translator.text('cardNetworks', card.network)}
                meta={[
                  translator.text('creditCard', 'billing', {
                    closingDay: card.closingDay, dueDay: card.dueDay,
                  }),
                  translator.text('creditCard', 'expires', {
                    expiry: expiryOf(card.expirationMonth, card.expirationYear),
                  }),
                ].join(' · ')}
                trailing={(
                  <IconButton
                    icon="close"
                    size="sm"
                    className="ml-auto"
                    label={translator.text('guidedSetup', 'card.remove', { last4: card.last4 })}
                    disabled={disabled}
                    onClick={() => onRemove(index)}
                  />
                )}
              />
            </li>
          ))}
        </ul>
      )}
      {form ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-mint/40 bg-bg p-4">
          <span className="type-body-sm font-semibold">
            {translator.text('guidedSetup', 'card.new')}
          </span>
          <CardFields form={form} errors={errors} onChange={onChange} />
          <p className="type-caption text-faint">{translator.text('guidedSetup', 'card.note')}</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={disabled} onClick={onCancel}>
              {translator.text('guidedSetup', 'card.cancel')}
            </Button>
            <Button variant="primary" size="sm" disabled={disabled} onClick={() => onSave(form)}>
              {translator.text('guidedSetup', 'card.save')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="secondary"
          leadingIcon="add-card-outline"
          disabled={disabled}
          className="self-start"
          onClick={onOpen}
        >
          {translator.text('guidedSetup', 'card.add')}
        </Button>
      )}
    </div>
  );
}
