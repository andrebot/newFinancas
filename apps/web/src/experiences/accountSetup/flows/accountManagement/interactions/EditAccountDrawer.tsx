import { useState } from 'react';
import type { Account } from '@financas/api-types';
import { Button } from '../../../../../kit/button/Button';
import { Drawer } from '../../../../../kit/drawer/Drawer';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { DangerZone } from '../../../../../kit/card/DangerZone';
import { InlineConfirm } from '../../../../../kit/confirm/InlineConfirm';
import { SegmentedControl } from '../../../../../kit/segmentedControl/SegmentedControl';
import { TextField } from '../../../../../kit/textField/TextField';
import { useI18n } from '../../../../../utilities/I18nProvider';
import { nonBlank } from '../../../../../utilities/validation';
import type { AccountEdit, CardSlot, Visibility } from '../accountManagementState';
import { cardChangesOf, sparseCardChanges, takesCards } from '../accountManagementState';
import { AttachedCardFields } from './AttachedCardFields';
import { LockedField } from './LockedField';
import {
  CardFields, draftsOf, EMPTY_CARD_FORM, type CardFormState,
} from './CardFields';

// The edit-account drawer (FL11, mockup 40; OQ-35): the name, the locked-in
// type and currency with their note, the visibility — movable only by its
// creator (FR-2.3) — and, on a type that takes them (FR-2.7), the account's
// cards: each attached one's billing days and expiration editable, or the card
// removed; new ones added from a typed number. Archiving
// sits in its danger zone at the bottom; it is one-way (FR-2.4). The drawer
// holds what is typed and emits an `AccountEdit`; open/close belongs to the
// Flow.

/** What the cards section needs from its drawer. */
interface CardsSectionProps {
  /** The attached cards' slots, in order. */
  readonly slots: CardSlot[];
  /** The new cards being typed. */
  readonly newCards: readonly CardFormState[];
  /** One per new card: its number's objection, if any. */
  readonly cardErrors: readonly (string | undefined)[];
  /** Changes one attached card's fields. */
  readonly changeSlot: (index: number, patch: Partial<CardSlot>) => void;
  /** Marks one attached card for removal. */
  readonly removeSlot: (index: number) => void;
  /** Changes one new card's fields. */
  readonly changeNewCard: (index: number, patch: Partial<CardFormState>) => void;
  /** Adds an empty new card. */
  readonly addNewCard: () => void;
  /** Removes one new card again. */
  readonly removeNewCard: (index: number) => void;
}

/**
 * Renders the account's cards: each attached one's billing editable or the
 * card removable, and the new ones being typed through their numbers.
 *
 * @param props - The slots, the drafts and the handlers for them.
 * @returns The section.
 */
function CardsSection({
  slots, newCards, cardErrors, changeSlot, removeSlot, changeNewCard, addNewCard,
  removeNewCard,
}: CardsSectionProps) {
  const translator = useI18n();
  return (
    <div className="flex flex-col gap-4">
      <span className="text-sm font-medium">{translator.text('accountSetup', 'cards.title')}</span>
      {slots.map((slot, index) => (slot.removed ? null : (
        <div key={slot.id} className="rounded-lg border border-line p-4">
          <AttachedCardFields
            slot={slot}
            onChange={(patch) => changeSlot(index, patch)}
            onRemove={() => removeSlot(index)}
          />
        </div>
      )))}
      {newCards.map((form, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={`new-${index}`} className="flex flex-col gap-3 rounded-lg border border-line p-4">
          <CardFields
            form={form}
            digitsError={cardErrors[index]}
            onChange={(patch) => changeNewCard(index, patch)}
          />
          <Button variant="ghost" onClick={() => removeNewCard(index)}>
            {translator.text('accountSetup', 'card.remove')}
          </Button>
        </div>
      ))}
      <Button variant="secondary" leadingIcon="add-card-outline" onClick={addNewCard}>
        {translator.text('accountSetup', 'card.add')}
      </Button>
    </div>
  );
}

/** What the visibility field needs from its drawer. */
interface VisibilityFieldProps {
  /** The account being edited. */
  readonly account: Account;
  /** The signed-in user's id: who may move it. */
  readonly selfUserId: string;
  /** The picked value, while its creator moves it. */
  readonly value: Visibility;
  /** Gets a new pick. */
  readonly onChange: (value: Visibility) => void;
}

/**
 * Renders the visibility control: movable for its creator, locked for
 * everyone else (FR-2.3).
 *
 * @param props - The account, the actor and the current value.
 * @returns The control or the locked field.
 */
function VisibilityField({
  account, selfUserId, value, onChange,
}: VisibilityFieldProps) {
  const translator = useI18n();
  if (account.ownerUserId !== selfUserId) {
    return (
      <LockedField
        label={translator.text('accountSetup', 'field.visibility')}
        value={translator.text(
          'accountSetup',
          account.visibility === 'personal' ? 'visibility.personal' : 'visibility.shared',
        )}
      />
    );
  }
  return (
    <SegmentedControl
      label={translator.text('accountSetup', 'field.visibility')}
      options={(['personal', 'shared'] as const).map((option) => ({
        value: option,
        label: translator.text(
          'accountSetup',
          option === 'personal' ? 'visibility.personal' : 'visibility.shared',
        ),
      }))}
      value={value}
      onChange={onChange}
    />
  );
}

/** EditAccountDrawer's props. */
export interface EditAccountDrawerProps {
  /** The account being edited, as the list last held it. */
  readonly account: Account;
  /** The signed-in user's id: who may move the visibility. */
  readonly selfUserId: string;
  /** The edit is out: Save spins and ignores submits. */
  readonly busy: boolean;
  /** The archive is out: the confirm spins. */
  readonly archiveBusy?: boolean | undefined;
  /** A request is out: the buttons wait — Cancel and Archive too. */
  readonly disabled: boolean;
  /** A failure of the last edit, already translated. */
  readonly alert?: string | undefined;
  /** The archive confirm is open inside this drawer (closed by default). */
  readonly archiveConfirmOpen?: boolean | undefined;
  /** Gets the edit once its fields pass. */
  readonly onSubmit: (edit: AccountEdit) => void;
  /** Archives the account; the confirm is already open. */
  readonly onArchive: () => void;
  /** Opens the archive confirm. */
  readonly onOpenArchive: () => void;
  /** Closes it again. */
  readonly onCloseArchive: () => void;
  /** Closes the drawer. */
  readonly onCancel: () => void;
}

/**
 * Reads an account's cards into their edit slots, in order.
 *
 * @param account - The account.
 * @returns One slot per attached card, nothing removed yet.
 */
const slotsOf = (account: Account): CardSlot[] => account.cards.map((card) => ({
  id: card.id,
  network: card.network,
  last4: card.last4,
  closingDay: card.closingDay,
  dueDay: card.dueDay,
  expirationMonth: card.expirationMonth,
  expirationYear: card.expirationYear,
}));

/**
 * Renders the edit form inside the drawer.
 *
 * @param props - The account, the actor and the handlers.
 * @returns The drawer with its form.
 */
export function EditAccountDrawer({
  account, selfUserId, busy, archiveBusy, disabled, alert, archiveConfirmOpen,
  onSubmit, onArchive, onOpenArchive, onCloseArchive, onCancel,
}: EditAccountDrawerProps) {
  const translator = useI18n();
  const [name, setName] = useState(account.name);
  const [visibility, setVisibility] = useState<Visibility>(account.visibility);
  const [slots, setSlots] = useState<CardSlot[]>(() => slotsOf(account));
  const [newCards, setNewCards] = useState<readonly CardFormState[]>([]);
  const [nameError, setNameError] = useState<string>();
  const [cardErrors, setCardErrors] = useState<readonly (string | undefined)[]>([]);

  const isCreator = account.ownerUserId === selfUserId;
  const showCards = takesCards(account.type);

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
   * Changes one attached card's fields.
   *
   * @param index - Which slot.
   * @param patch - What changed in it.
   */
  const changeSlot = (index: number, patch: Partial<CardSlot>) => {
    setSlots((current) => current.map((slot, position) => (
      position === index ? { ...slot, ...patch } : slot
    )));
  };

  /** Marks one attached card for removal. */
  const removeSlot = (index: number) => {
    setSlots((current) => current.map((slot, position) => (
      position === index ? { ...slot, removed: true } : slot
    )));
  };

  /** Changes one new card's fields. */
  const changeNewCard = (index: number, patch: Partial<CardFormState>) => {
    setNewCards((current) => current.map((form, position) => (
      position === index ? { ...form, ...patch } : form
    )));
    setCardErrors(
      (current) => current.map((error, position) => (position === index ? undefined : error)),
    );
  };

  /** Adds an empty new card. */
  const addNewCard = () => setNewCards((current) => [...current, EMPTY_CARD_FORM]);

  /** Removes one new card again. */
  const removeNewCard = (index: number) => {
    setNewCards((current) => current.filter((_, position) => position !== index));
    setCardErrors((current) => current.filter((_, position) => position !== index));
  };

  /** The visibility to send up: only when its creator moved it. */
  const visibilityToSend = (): Visibility | undefined => (
    isCreator && visibility !== account.visibility ? visibility : undefined
  );

  /**
   * Checks the fields and emits the edit when they pass. The visibility goes
   * up only when its creator moved it; the card changes carry what actually
   * changed.
   */
  const submit = () => {
    const foundName = nonBlank(name);
    setNameError(foundName && translator.field(foundName.code, foundName.params));
    if (foundName) return;
    const incomplete = translator.text('accountSetup', 'card.incomplete');
    const { drafts, errors } = draftsOf(newCards, incomplete);
    setCardErrors(errors);
    if (errors.some((error) => error !== undefined)) return;
    const changes = sparseCardChanges(cardChangesOf([...slots, ...drafts], account.cards));
    onSubmit({
      accountId: account.id,
      name: name.trim(),
      visibility: visibilityToSend(),
      cards: changes,
    });
  };

  return (
    <Drawer
      open
      onClose={onCancel}
      caption={translator.text('accountSetup', 'edit.caption')}
      title={account.name}
      footer={(
        <>
          <Button variant="secondary" disabled={disabled} onClick={onCancel}>
            {translator.text('accountSetup', 'cancel')}
          </Button>
          <Button variant="primary" busy={busy} disabled={disabled && !busy} onClick={submit}>
            {translator.text('accountSetup', 'edit.submit')}
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
        <div className="grid grid-cols-2 gap-4">
          <LockedField
            label={translator.text('accountSetup', 'field.type')}
            value={translator.text('accountSetup', `type.${account.type}`)}
          />
          <LockedField
            label={translator.text('accountSetup', 'field.currency')}
            value={account.currency}
          />
        </div>
        <span className="-mt-2 text-xs text-muted">
          {translator.text('accountSetup', 'lockedNote')}
        </span>
        <VisibilityField
          account={account}
          selfUserId={selfUserId}
          value={visibility}
          onChange={setVisibility}
        />
        {showCards && (
          <CardsSection
            slots={slots}
            newCards={newCards}
            cardErrors={cardErrors}
            changeSlot={changeSlot}
            removeSlot={removeSlot}
            changeNewCard={changeNewCard}
            addNewCard={addNewCard}
            removeNewCard={removeNewCard}
          />
        )}
        <DangerZone
          title={translator.text('accountSetup', 'archive.title')}
          description={translator.text('accountSetup', 'archive.description')}
          actionLabel={translator.text('accountSetup', 'archive.action')}
          onAction={onOpenArchive}
          disabled={disabled}
          confirm={archiveConfirmOpen ? (
            <InlineConfirm
              tone="destructive"
              message={translator.text('accountSetup', 'archive.confirm', { name: account.name })}
              confirmLabel={translator.text('accountSetup', 'archive.action')}
              cancelLabel={translator.text('accountSetup', 'cancel')}
              busy={archiveBusy === true}
              disabled={disabled}
              onConfirm={onArchive}
              onCancel={onCloseArchive}
            />
          ) : undefined}
        />
      </div>
    </Drawer>
  );
}
