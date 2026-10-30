import type { Currency } from '@financas/api-types';
import { isFixedTerm } from '@financas/reference';
import { recordTransaction as settings } from '../../../../../config/constants';
import { DateInput } from '../../../../../kit/dateInput/DateInput';
import { LockedField } from '../../../../../kit/field/LockedField';
import { Icon } from '../../../../../kit/icons/Icon';
import { NumberInput } from '../../../../../kit/numberInput/NumberInput';
import { SegmentedControl } from '../../../../../kit/segmentedControl/SegmentedControl';
import { Select } from '../../../../../kit/select/Select';
import type { SelectGroup } from '../../../../../kit/select/options';
import { Switch } from '../../../../../kit/switch/Switch';
import { TextField } from '../../../../../kit/textField/TextField';
import type { Formatter } from '../../../../../utilities/formatting';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { Translator } from '../../../../../utilities/i18n';
import useFormatter from '../../../../../utilities/useFormatter';
import {
  assetTypesFor, INTEREST_PAYMENTS, isDebentureBuy, isFixedTermBuy, RATE_TYPES, takesSpread,
  type ContractTerms, type TransactionForm,
} from '../transactionForm';
import { assetTypeName, recordText } from '../recordText';

// Investment Buy Entry (FL15, mockup 32; FR-5.1, FR-11.1, OQ-50, OQ-201,
// OQ-205, OQ-219): what a buy names — its asset type (the fixed-term ones of
// the account currency's market) and ticker — and, for a fixed-term type, the
// contract: the rate (a spread on CDI or Selic), the due date, when interest
// is paid and a debenture's incentivised flag. Units are optional on a
// fixed-term buy (1 unit, D11). On an edit the asset is shown, never changed
// (D6), and the terms only while the schedule hasn't started (D8). It renders
// and emits; the Flow holds the form.

/** The refusals the buy's fields show, already translated. */
export interface BuyErrors {
  readonly assetType?: string | undefined;
  readonly ticker?: string | undefined;
  readonly quantity?: string | undefined;
  readonly rateValue?: string | undefined;
  readonly dueDate?: string | undefined;
}

/** InvestmentBuyEntry's props. */
export interface InvestmentBuyEntryProps {
  readonly form: TransactionForm;
  /** The account's currency, which narrows the fixed-term types. */
  readonly currency: Currency | undefined;
  readonly errors: BuyErrors;
  /**
   * On an edit, what may change — the asset never does; the units and terms
   * only before the schedule starts. A new buy has none: everything is open.
   */
  readonly editable?: { readonly quantity: boolean; readonly terms: boolean } | undefined;
  readonly onAsset: (asset: { readonly assetType?: string; readonly ticker?: string }) => void;
  readonly onQuantity: (quantity: number | null) => void;
  readonly onTerms: (terms: ContractTerms) => void;
}

/**
 * Groups the asset types as mockup 32 does: equity and funds, fixed income, other.
 *
 * @param codes - The asset types offered.
 * @param translator - The texts.
 * @returns The select's groups, the empty ones left out.
 */
export const assetTypeGroupsOf = (
  codes: readonly string[],
  translator: Translator,
): SelectGroup<string>[] => {
  const equity: readonly string[] = settings.equityAssetTypes;
  const groupOfCode = (code: string) => {
    if (isFixedTerm(code)) return 'fixedIncome';
    return equity.includes(code) ? 'equity' : 'other';
  };
  return (['equity', 'fixedIncome', 'other'] as const)
    .map((group) => ({
      group: recordText(translator, `assetGroup.${group}`),
      options: codes
        .filter((code) => groupOfCode(code) === group)
        .map((code) => ({ value: code, label: assetTypeName(translator, code) })),
    }))
    .filter((group) => group.options.length > 0);
};

/**
 * Writes a contract's terms in one line, for an edit whose schedule has started.
 *
 * @param terms - The contract.
 * @param translator - The texts.
 * @param formatter - Numbers and dates in the interface language.
 * @returns E.g. "110% of CDI · due 15/03/2028 · At maturity".
 */
export const termsSummaryOf = (
  terms: ContractTerms,
  translator: Translator,
  formatter: Formatter,
) => recordText(translator, 'terms.summary', {
  rate: recordText(translator, `rate.${terms.rateType}`, {
    rate: formatter.rate(terms.rateValue ?? 0),
  }),
  dueDate: terms.dueDate ? formatter.date(terms.dueDate) : '—',
  interestPayment: recordText(translator, `interestPayment.${terms.interestPayment}`),
});

/** ContractFields' props. */
interface ContractFieldsProps {
  readonly form: TransactionForm;
  readonly errors: BuyErrors;
  readonly onTerms: (terms: ContractTerms) => void;
}

/**
 * Renders a fixed-term contract's fields: the rate type and value, a spread on
 * CDI or Selic, the due date, when interest is paid, a debenture's flag.
 *
 * @param props - The form, the errors and the handler.
 * @returns The contract's fields.
 */
function ContractFields({ form, errors, onTerms }: ContractFieldsProps) {
  const translator = useI18n();
  const { terms } = form;
  const change = (patch: Partial<ContractTerms>) => onTerms({ ...terms, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        size="sm"
        label={recordText(translator, 'field.rateType')}
        options={RATE_TYPES.map((value) => ({
          value, label: recordText(translator, `rateType.${value}`),
        }))}
        value={terms.rateType}
        onChange={(rateType) => change({ rateType })}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NumberInput
          kind="rate"
          label={recordText(translator, `rateValue.${terms.rateType}`)}
          allowNegative={!takesSpread(terms.rateType) && terms.rateType !== 'fixed'}
          error={errors.rateValue}
          value={terms.rateValue}
          onChange={(rateValue) => change({ rateValue })}
        />
        <DateInput
          label={recordText(translator, 'field.dueDate')}
          error={errors.dueDate}
          value={terms.dueDate}
          onChange={(dueDate) => change({ dueDate })}
        />
        {takesSpread(terms.rateType) && (
          <NumberInput
            kind="rate"
            label={recordText(translator, 'field.spread')}
            value={terms.spread}
            onChange={(spread) => change({ spread })}
          />
        )}
      </div>
      <p className="type-caption text-muted">{recordText(translator, 'terms.hint')}</p>
      <SegmentedControl
        size="sm"
        label={recordText(translator, 'field.interestPayment')}
        options={INTEREST_PAYMENTS.map((value) => ({
          value, label: recordText(translator, `interestPayment.${value}`),
        }))}
        value={terms.interestPayment}
        onChange={(interestPayment) => change({ interestPayment })}
      />
      <p className="type-caption text-muted">
        {recordText(translator, 'interestPayment.hint')}
      </p>
      {isDebentureBuy(form) && (
        <Switch
          label={recordText(translator, 'field.incentivised')}
          description={recordText(translator, 'incentivised.hint')}
          checked={terms.incentivised}
          onChange={(incentivised) => change({ incentivised })}
        />
      )}
    </div>
  );
}

/**
 * Renders the asset: its type and ticker, picked on a new buy, shown on an edit.
 *
 * @param props - The form, the currency, the errors, whether it is locked, and the handler.
 * @returns The asset fields.
 */
function AssetFields({
  form, currency, errors, locked, onAsset,
}: Pick<InvestmentBuyEntryProps, 'form' | 'currency' | 'errors' | 'onAsset'> & {
  readonly locked: boolean;
}) {
  const translator = useI18n();
  if (locked) {
    return (
      <LockedField
        label={recordText(translator, 'field.asset')}
        value={recordText(translator, 'asset.locked', {
          ticker: form.ticker,
          assetType: assetTypeName(translator, form.assetType ?? 'other'),
        })}
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <TextField
        label={recordText(translator, 'field.ticker')}
        hint={recordText(translator, 'ticker.hint')}
        error={errors.ticker}
        value={form.ticker}
        onChange={(ticker) => onAsset({ ticker })}
      />
      <Select
        label={recordText(translator, 'field.assetType')}
        placeholder={recordText(translator, 'assetType.placeholder')}
        error={errors.assetType}
        options={assetTypeGroupsOf(assetTypesFor(currency), translator)}
        value={form.assetType ?? null}
        onChange={(assetType) => onAsset({ assetType })}
      />
    </div>
  );
}

/**
 * Renders the buy's section: the asset, a fixed-term contract's terms — shown
 * locked once its schedule has started — and the units.
 *
 * @param props - The form, the currency, the errors, the edit's lock and the handlers.
 * @returns The section.
 */
export function InvestmentBuyEntry({
  form, currency, errors, editable, onAsset, onQuantity, onTerms,
}: InvestmentBuyEntryProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  const fixedTerm = isFixedTermBuy(form);
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line p-4">
      <div className="flex items-center gap-2 type-body-sm font-semibold">
        <Icon name="candlestick-chart-outline" className="size-4.5 text-muted" />
        {recordText(translator, 'field.asset')}
      </div>
      <AssetFields
        form={form}
        currency={currency}
        errors={errors}
        locked={editable !== undefined}
        onAsset={onAsset}
      />
      {fixedTerm && (editable?.terms === false
        ? (
          <LockedField
            label={recordText(translator, 'field.terms')}
            value={termsSummaryOf(form.terms, translator, formatter)}
          />
        )
        : <ContractFields form={form} errors={errors} onTerms={onTerms} />)}
      <NumberInput
        kind="quantity"
        className="sm:w-48"
        label={recordText(translator, 'quantity.investment_buy')}
        hint={fixedTerm ? recordText(translator, 'quantity.fixedTermHint') : undefined}
        error={errors.quantity}
        disabled={editable?.quantity === false}
        value={form.quantity}
        onChange={onQuantity}
      />
    </section>
  );
}
