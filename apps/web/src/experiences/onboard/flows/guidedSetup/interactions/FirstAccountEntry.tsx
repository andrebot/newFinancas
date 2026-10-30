import { useState, type ReactNode } from 'react';
import type { Currency } from '@financas/api-types';
import { accounts, money } from '../../../../../config/constants';
import { InlineBanner } from '../../../../../kit/alert/InlineBanner';
import { LockedField } from '../../../../../kit/field/LockedField';
import { Icon, type IconName } from '../../../../../kit/icons/Icon';
import { MoneyInput } from '../../../../../kit/moneyInput/MoneyInput';
import { OptionCardGroup } from '../../../../../kit/optionCard/OptionCardGroup';
import { SegmentedControl } from '../../../../../kit/segmentedControl/SegmentedControl';
import { TextField } from '../../../../../kit/textField/TextField';
import { useI18n } from '../../../../../utilities/I18nProvider';
import useFocusFirstInvalid from '../../../../../utilities/useFocusFirstInvalid';
import { nonBlank } from '../../../../../utilities/validation';
import {
  takesCards, type AccountType, type CardDraft, type NewAccount, type Visibility,
} from '../../../../accountSetup/flows/accountManagement/accountManagementState';
import {
  cardDraftOf, cardObjectionsOf, EMPTY_CARD_FORM, withoutObjections, type CardFormState,
  type CardObjections,
} from '../../../../accountSetup/flows/accountManagement/interactions/CardFields';
import { AccountCardsField } from './AccountCardsField';
import { WizardNavigation } from './WizardNavigation';

// First Account Entry (FL6, mockup 11; FR-1.22, OQ-169, OQ-196): the account
// step's form, inline in the step card. The name, the type as four tiles, the
// currency, the visibility (Shared to start; Personal for a Viewer, who can't
// share), today's balance with its hint, the box on why earlier transactions
// never change it, and — on a type that takes them — its cards. "Add account
// & continue" checks it all and emits the account; a card still open in its
// form goes with it once it passes, and is refused field by field otherwise.
// It holds what is typed; the Flow sends it and shows the server's answer in
// the banner.

/** Each type's tile icon (mockup 11). */
const TYPE_ICONS: Readonly<Record<AccountType, IconName>> = accounts.typeIcons;

const TYPES = Object.keys(TYPE_ICONS) as AccountType[];

/** How each visibility's pill looks, as the budget form's (mockup 42). */
const VISIBILITY_OPTIONS = [
  { value: 'personal', icon: 'person-outline', label: 'visibility.personal' },
  { value: 'shared', icon: 'group-outline', label: 'visibility.shared' },
] as const;

/**
 * Tells whether a card's form holds nothing yet.
 *
 * @param form - The card's fields.
 * @returns Whether nothing is typed or picked.
 */
export const isBlankCard = (form: CardFormState): boolean => (
  Object.entries(form).every(([field, value]) => (
    field === 'digits' ? value === '' : value === null
  ))
);

/** What a card still open in its form adds to the account. */
export interface PendingCard {
  /** The card, once its fields pass. */
  readonly draft?: CardDraft | undefined;
  /** Its failing fields otherwise. */
  readonly errors?: CardObjections | undefined;
}

/**
 * Reads a card left open in its form: nothing when there is none or it is
 * blank, the card when it passes, its objections otherwise.
 *
 * @param form - The open card's fields, if its form is open.
 * @returns What it adds.
 */
export const pendingCardOf = (form: CardFormState | undefined): PendingCard => {
  if (form === undefined || isBlankCard(form)) return {};
  const draft = cardDraftOf(form);
  return draft ? { draft } : { errors: cardObjectionsOf(form) };
};

/**
 * Lists the cards the account is created with: none on a type that doesn't
 * take them; otherwise the saved ones and the open one, once it passes.
 *
 * @param showCards - Whether the type takes cards.
 * @param saved - The cards saved so far.
 * @param pending - What the open card adds.
 * @returns The cards to send.
 */
export const cardsSent = (
  showCards: boolean,
  saved: readonly CardDraft[],
  pending: PendingCard,
): CardDraft[] => {
  if (!showCards) return [];
  return pending.draft ? [...saved, pending.draft] : [...saved];
};

/** FirstAccountEntry's props. */
export interface FirstAccountEntryProps {
  /** The create is out: the button spins. */
  readonly busy: boolean;
  /** The last create's failure, already translated. */
  readonly alert?: string | undefined;
  /** The actor can't share (a Viewer): the account is personal, the field locked. */
  readonly personalOnly: boolean;
  /** Gets the account once its fields pass. */
  readonly onSubmit: (account: NewAccount) => void;
  /** Closes the form when other accounts exist; without it, the step's note shows. */
  readonly onCancel?: (() => void) | undefined;
}

/**
 * Renders the box on how the starting balance and earlier transactions
 * relate (OQ-169), always shown on the first account.
 *
 * @returns The box.
 */
function StartingBalanceExplainer() {
  const translator = useI18n();
  const points = [
    { key: 'earlier.history', icon: 'history', tone: 'text-faint' },
    { key: 'earlier.counts', icon: 'check-circle-outline', tone: 'text-mint' },
    { key: 'earlier.unchanged', icon: 'lock-outline', tone: 'text-faint' },
  ] as const;
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-ink/[.02] px-4 py-3.5">
      <Icon name="info-outline" className="mt-0.5 size-5 shrink-0 text-sky" />
      <div className="flex flex-col gap-2 type-body-sm">
        <span className="font-semibold">{translator.text('guidedSetup', 'earlier.title')}</span>
        <ul className="flex flex-col gap-1.5 text-muted">
          {points.map((point) => (
            <li key={point.key} className="flex gap-2">
              <Icon name={point.icon} className={`mt-0.5 size-4 shrink-0 ${point.tone}`} />
              <span>{translator.text('guidedSetup', point.key)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Renders a field's visible caption over a control that carries the same name
 * for screen readers (so the caption is hidden from them).
 *
 * @param props - The caption and the control.
 * @returns The captioned control.
 */
function Captioned({ caption, children }: {
  readonly caption: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span aria-hidden className="type-caption font-semibold text-muted">{caption}</span>
      {children}
    </div>
  );
}

/**
 * Holds the cards' part of the form: the saved drafts and the one open card.
 *
 * @returns The cards' values and their handlers.
 */
const useCardsState = () => {
  const [saved, setSaved] = useState<readonly CardDraft[]>([]);
  const [form, setForm] = useState<CardFormState>();
  const [errors, setErrors] = useState<CardObjections>();

  return {
    saved,
    form,
    errors,
    setErrors,
    /** Opens an empty card form. */
    open: () => setForm(EMPTY_CARD_FORM),
    /** Closes the card form, dropping what was typed. */
    cancel: () => {
      setForm(undefined);
      setErrors(undefined);
    },
    /**
     * Changes the open card's fields and drops their objections.
     *
     * @param patch - What changed.
     */
    change: (patch: Partial<CardFormState>) => {
      setForm((current) => current && { ...current, ...patch });
      setErrors((current) => withoutObjections(current, patch));
    },
    /**
     * Saves the open card once it passes.
     *
     * @param open - The open card's fields.
     * @returns Whether it was saved.
     */
    save: (open: CardFormState): boolean => {
      const draft = cardDraftOf(open);
      if (draft === undefined) {
        setErrors(cardObjectionsOf(open));
        return false;
      }
      setSaved((current) => [...current, draft]);
      setForm(undefined);
      return true;
    },
    /**
     * Drops a saved card.
     *
     * @param index - Which one.
     */
    remove: (index: number) => setSaved((current) => (
      current.filter((_, position) => position !== index)
    )),
  };
};

/**
 * Renders the account step's form and its foot.
 *
 * @param props - The busy state, the failure, who may share and the handlers.
 * @returns The form.
 */
export function FirstAccountEntry({
  busy, alert, personalOnly, onSubmit, onCancel,
}: FirstAccountEntryProps) {
  const translator = useI18n();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [type, setType] = useState<AccountType>('checking');
  const [currency, setCurrency] = useState<Currency>('BRL');
  const [visibility, setVisibility] = useState<Visibility>(personalOnly ? 'personal' : 'shared');
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);
  const cards = useCardsState();
  const [refusals, setRefusals] = useState(0);
  useFocusFirstInvalid(refusals);
  const showCards = takesCards(type);

  /**
   * Saves the open card, or shows why it can't be.
   *
   * @param open - The open card's fields.
   */
  const saveCard = (open: CardFormState) => {
    if (!cards.save(open)) setRefusals((count) => count + 1);
  };

  /**
   * Checks the fields and emits the account when they pass; cards hidden by
   * the type are left out, and the first problem takes the focus.
   */
  const submit = () => {
    const blank = nonBlank(name);
    const pending = showCards ? pendingCardOf(cards.form) : {};
    setNameError(blank && translator.field(blank.code, blank.params));
    cards.setErrors(pending.errors);
    if (blank || pending.errors) {
      setRefusals((count) => count + 1);
      return;
    }
    // A Viewer's visibility starts at Personal and its field is locked.
    onSubmit({
      name: name.trim(),
      type,
      currency,
      visibility,
      openingBalance,
      cards: cardsSent(showCards, cards.saved, pending),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {alert && <InlineBanner tone="error" message={alert} />}
      <TextField
        label={translator.text('guidedSetup', 'account.name')}
        value={name}
        error={nameError}
        onChange={(value) => {
          setName(value);
          setNameError(undefined);
        }}
      />
      <Captioned caption={translator.text('guidedSetup', 'account.type')}>
        <OptionCardGroup
          layout="tiles"
          label={translator.text('guidedSetup', 'account.type')}
          options={TYPES.map((value) => ({
            value,
            icon: TYPE_ICONS[value],
            label: translator.text('accountSetup', `type.${value}`),
            description: translator.text('guidedSetup', `type.${value}.hint`),
          }))}
          value={type}
          onChange={setType}
        />
      </Captioned>
      <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <Captioned caption={translator.text('accountSetup', 'field.currency')}>
            <SegmentedControl
              label={translator.text('accountSetup', 'field.currency')}
              options={money.currencies.map((value) => ({ value, label: value }))}
              value={currency}
              onChange={setCurrency}
            />
          </Captioned>
          {personalOnly ? (
            <LockedField
              label={translator.text('accountSetup', 'field.visibility')}
              value={translator.text('accountSetup', 'visibility.personal')}
            />
          ) : (
            <Captioned caption={translator.text('accountSetup', 'field.visibility')}>
              <SegmentedControl
                label={translator.text('accountSetup', 'field.visibility')}
                options={VISIBILITY_OPTIONS.map((option) => ({
                  value: option.value,
                  icon: option.icon,
                  label: translator.text('accountSetup', option.label),
                }))}
                value={visibility}
                onChange={setVisibility}
              />
            </Captioned>
          )}
        </div>
        <MoneyInput
          variant="hero"
          label={translator.text('guidedSetup', 'account.balance')}
          hint={translator.text('guidedSetup', 'account.balance.hint')}
          currency={currency}
          allowNegative
          value={openingBalance}
          onChange={setOpeningBalance}
        />
      </div>
      <StartingBalanceExplainer />
      {showCards && (
        <AccountCardsField
          saved={cards.saved}
          form={cards.form}
          errors={cards.errors}
          disabled={busy}
          onOpen={cards.open}
          onChange={cards.change}
          onSave={saveCard}
          onCancel={cards.cancel}
          onRemove={cards.remove}
        />
      )}
      <WizardNavigation
        note={onCancel ? undefined : translator.text('guidedSetup', 'account.required')}
        secondary={onCancel && {
          label: translator.text('guidedSetup', 'account.cancel'),
          disabled: busy,
          onClick: onCancel,
        }}
        primary={{
          label: translator.text('guidedSetup', 'account.submit'),
          busy,
          trailingIcon: 'arrow-forward',
          onClick: submit,
        }}
      />
    </div>
  );
}
