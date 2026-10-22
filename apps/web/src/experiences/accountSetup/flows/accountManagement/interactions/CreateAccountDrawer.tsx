import { useState } from 'react';
import type { Currency } from '@financas/api-types';
import { Button } from '../../../../../kit/button/Button';
import { Drawer } from '../../../../../kit/drawer/Drawer';
import { MoneyInput } from '../../../../../kit/moneyInput/MoneyInput';
import { SegmentedControl } from '../../../../../kit/segmentedControl/SegmentedControl';
import { Select } from '../../../../../kit/select/Select';
import { TextField } from '../../../../../kit/textField/TextField';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { useI18n } from '../../../../../utilities/I18nProvider';
import useFocusFirstInvalid from '../../../../../utilities/useFocusFirstInvalid';
import { nonBlank } from '../../../../../utilities/validation';
import {
  takesCards, type AccountType, type NewAccount, type Visibility,
} from '../accountManagementState';
import {
  CardFields, draftsOf, EMPTY_CARD_FORM, withoutObjections, type CardFormState,
  type CardObjections,
} from './CardFields';
import { LockedField } from '../../../../../kit/field/LockedField';

// The create-account drawer (FL11, mockup 40; OQ-169): the name, the type and
// currency — locked in once created — the visibility (fixed at Personal for a
// Viewer, who can't share), today's opening balance and, on a type that takes
// them (FR-2.7), its cards. Cards typed under a type that doesn't are neither
// checked nor sent. It holds what is typed, checks it before emitting, and
// shows the server's objections in its banner. The drawer itself (open/close)
// belongs to the Flow; this renders its content.

const TYPES: readonly AccountType[] = ['checking', 'savings', 'credit_card_only', 'investment'];
const CURRENCIES: readonly Currency[] = ['BRL', 'USD'];
const VISIBILITIES: readonly Visibility[] = ['personal', 'shared'];

/** CreateAccountDrawer's props. */
export interface CreateAccountDrawerProps {
  /** The create is out: the button spins and ignores submits. */
  readonly busy: boolean;
  /** A request is out: the buttons wait — Cancel too, so its answer has a banner. */
  readonly disabled: boolean;
  /** A failure of the last create, already translated. */
  readonly alert?: string | undefined;
  /** The actor can't share (a Viewer): the account is personal, the field locked. */
  readonly personalOnly?: boolean | undefined;
  /** Gets the account once its fields pass. */
  readonly onSubmit: (account: NewAccount) => void;
  /** Closes the drawer. */
  readonly onCancel: () => void;
}

/**
 * Renders the create form inside the drawer.
 *
 * @param props - The busy state, the failure and the handlers.
 * @returns The drawer with its form.
 */
export function CreateAccountDrawer({
  busy, disabled, alert, personalOnly, onSubmit, onCancel,
}: CreateAccountDrawerProps) {
  const translator = useI18n();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [currency, setCurrency] = useState<Currency>('BRL');
  const [visibility, setVisibility] = useState<Visibility>('personal');
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  const [cards, setCards] = useState<readonly CardFormState[]>([]);
  const [nameError, setNameError] = useState<string>();
  const [cardErrors, setCardErrors] = useState<readonly (CardObjections | undefined)[]>([]);
  const [refusals, setRefusals] = useState(0);
  useFocusFirstInvalid(refusals);

  /**
   * Keeps the typed name and drops its error.
   *
   * @param value - The new text.
   */
  const changeName = (value: string) => {
    setName(value);
    setNameError(undefined);
  };

  /**
   * Changes one card's fields.
   *
   * @param index - Which card.
   * @param patch - What changed in it.
   */
  const changeCard = (index: number, patch: Partial<CardFormState>) => {
    setCards((current) => current.map((form, position) => (
      position === index ? { ...form, ...patch } : form
    )));
    setCardErrors((current) => current.map((error, position) => (
      position === index ? withoutObjections(error, patch) : error
    )));
  };

  /** Adds an empty card to the list. */
  const addCard = () => setCards((current) => [...current, EMPTY_CARD_FORM]);

  /** Removes one card from the list. */
  const removeCard = (index: number) => {
    setCards((current) => current.filter((_, position) => position !== index));
    setCardErrors((current) => current.filter((_, position) => position !== index));
  };

  const showCards = takesCards(type);

  /**
   * Checks the fields and emits the account when they pass. A card that
   * fails its checks shows why under each failing field, and the first
   * problem takes the focus; cards hidden by the type are left out.
   */
  const submit = () => {
    const foundName = nonBlank(name);
    setNameError(foundName && translator.field(foundName.code, foundName.params));
    const { drafts, errors } = draftsOf(showCards ? cards : []);
    setCardErrors(errors);
    if (foundName || errors.some((error) => error !== undefined)) {
      setRefusals((count) => count + 1);
      return;
    }
    onSubmit({
      name: name.trim(),
      type,
      currency,
      visibility: personalOnly ? 'personal' : visibility,
      openingBalance,
      cards: drafts,
    });
  };

  return (
    <Drawer
      open
      size="wide"
      onClose={onCancel}
      caption={translator.text('accountSetup', 'create.caption')}
      title={translator.text('accountSetup', 'create.title')}
      footer={(
        <>
          <Button variant="secondary" disabled={disabled} onClick={onCancel}>
            {translator.text('accountSetup', 'cancel')}
          </Button>
          <Button variant="primary" busy={busy} disabled={disabled && !busy} onClick={submit}>
            {translator.text('accountSetup', 'create.submit')}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        {alert && <InlineBanner tone="error" message={alert} />}
        <TextField
          label={translator.text('accountSetup', 'field.name')}
          value={name}
          onChange={changeName}
          error={nameError}
        />
        <Select
          label={translator.text('accountSetup', 'field.type')}
          options={TYPES.map((value) => ({
            value, label: translator.text('accountSetup', `type.${value}`),
          }))}
          value={type}
          onChange={(value) => setType(value)}
        />
        <SegmentedControl
          label={translator.text('accountSetup', 'field.currency')}
          options={CURRENCIES.map((value) => ({ value, label: value }))}
          value={currency}
          onChange={setCurrency}
        />
        {personalOnly ? (
          <LockedField
            label={translator.text('accountSetup', 'field.visibility')}
            value={translator.text('accountSetup', 'visibility.personal')}
          />
        ) : (
          <SegmentedControl
            label={translator.text('accountSetup', 'field.visibility')}
            options={VISIBILITIES.map((value) => ({
              value,
              label: translator.text(
                'accountSetup',
                value === 'personal' ? 'visibility.personal' : 'visibility.shared',
              ),
            }))}
            value={visibility}
            onChange={setVisibility}
          />
        )}
        <MoneyInput
          label={translator.text('accountSetup', 'field.openingBalance')}
          hint={translator.text('accountSetup', 'openingBalance.hint')}
          currency={currency}
          allowNegative
          value={openingBalance}
          onChange={setOpeningBalance}
        />
        {showCards && (
          <div className="flex flex-col gap-4">
            <span className="text-sm font-medium">
              {translator.text('accountSetup', 'cards.title')}
            </span>
            {cards.map((form, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={index} className="flex flex-col gap-3 rounded-lg border border-line p-4">
                <CardFields
                  form={form}
                  errors={cardErrors[index]}
                  onChange={(patch) => changeCard(index, patch)}
                />
                <Button variant="ghost" onClick={() => removeCard(index)}>
                  {translator.text('accountSetup', 'card.remove')}
                </Button>
              </div>
            ))}
            <Button variant="secondary" leadingIcon="add-card-outline" onClick={addCard}>
              {translator.text('accountSetup', 'card.add')}
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
