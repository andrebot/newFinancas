import type { Currency, IndexRateUnit, InvestmentHolding } from '@financas/api-types';
import { KeyValueList, type KeyValueItem } from '../../../../../kit/keyValueList/KeyValueList';
import { ProgressBar } from '../../../../../kit/progressBar/ProgressBar';
import type { Formatter } from '../../../../../utilities/formatting';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { Translator } from '../../../../../utilities/i18n';
import useFormatter from '../../../../../utilities/useFormatter';
import { contractTermOf, type ContractTerm } from '../holdingMaintenance';
import { DetailCard } from './DetailCard';

// Contract (FL19; mockup 51; FR-11.2, OQ-205, OQ-234): a fixed-term Holding's
// read-only terms — what was invested and when, what it's expected to pay and
// the taxes on it (InvestmentProductEngine's projection, read with the
// Holding), how much of the term has run, and a note on what the estimate
// assumes: the index's latest value, or why there is no estimate yet. The
// note leaves out the mockup's tax bracket, which is the Engine's rule.
// Display only.

/** An index's latest value, as the estimate note quotes it. */
export interface LatestIndex {
  /** Percent × 10,000. */
  readonly value: number;
  readonly unit: IndexRateUnit;
}

/** Contract's props. */
export interface ContractCardProps {
  readonly holding: InvestmentHolding;
  readonly currency: Currency;
  /** Today, `YYYY-MM-DD`, for the term. */
  readonly today: string;
  /** The latest value of the index the rate tracks; none for a fixed rate or while unknown. */
  readonly latestIndex?: LatestIndex | undefined;
}

/** What the card's texts need. */
interface Texts {
  readonly translator: Translator;
  readonly formatter: Formatter;
  readonly currency: Currency;
}

/**
 * Writes one of the card's texts.
 *
 * @param translator - The texts.
 * @param key - The key, below `contract.` unless it names another part.
 * @param params - Its ICU params.
 * @returns The text.
 */
const say = (translator: Translator, key: string, params?: Record<string, string | number>) => (
  translator.text('holdingMaintenance', key as 'contract.title', params)
);

/**
 * Writes the expected taxes: the amount owed, "Not estimated" for a US
 * instrument (OQ-79), nothing while unprojected.
 *
 * @param holding - The Holding.
 * @param texts - The texts and the currency.
 * @returns The item's value and tone.
 */
const taxesOf = (holding: InvestmentHolding, { translator, formatter, currency }: Texts) => {
  const taxes = holding.expectedTaxes;
  if (!taxes) return {};
  if (!taxes.estimated) return { value: say(translator, 'contract.notEstimated') };
  return { value: formatter.money(0 - (taxes.amount ?? 0), currency), tone: 'coral' as const };
};

/**
 * Builds the four figures: invested, bought, expected payout and taxes.
 *
 * @param holding - The Holding.
 * @param texts - The texts and the currency.
 * @returns The list's items.
 */
const figuresOf = (holding: InvestmentHolding, texts: Texts): KeyValueItem[] => {
  const { translator, formatter, currency } = texts;
  const payout = holding.expectedPayout;
  return [
    {
      label: say(translator, 'contract.invested'),
      value: formatter.money(holding.costBasis ?? 0, currency),
      numeric: true,
    },
    {
      label: say(translator, 'contract.bought'),
      value: holding.boughtOn ? formatter.date(holding.boughtOn) : undefined,
      numeric: true,
    },
    {
      label: say(translator, 'contract.expectedPayout'),
      value: payout == null ? undefined : formatter.money(payout, currency),
      tone: 'mint',
      numeric: true,
    },
    { label: say(translator, 'contract.expectedTaxes'), ...taxesOf(holding, texts), numeric: true },
  ];
};

/**
 * Writes the estimate's lead: what it assumes about the index.
 *
 * @param holding - The Holding.
 * @param latestIndex - The index's latest value, if known.
 * @param texts - The texts.
 * @returns E.g. "Estimate if Selic stays at 10.50% a year".
 */
const leadOf = (holding: InvestmentHolding, latestIndex: LatestIndex | undefined, texts: Texts) => {
  const type = holding.rate?.type;
  if (!type || type === 'fixed' || !latestIndex) return say(texts.translator, 'contract.estimate');
  return say(texts.translator, 'contract.estimateIf', {
    index: say(texts.translator, `index.${type}`),
    rate: texts.formatter.rate(latestIndex.value),
    unit: latestIndex.unit,
  });
};

/**
 * Writes what the estimate comes to after taxes: the net, or that taxes
 * aren't estimated (a US instrument, OQ-79).
 *
 * @param holding - The Holding.
 * @param texts - The texts and the currency.
 * @returns The part, or none while unprojected.
 */
const netPartOf = (holding: InvestmentHolding, { translator, formatter, currency }: Texts) => {
  const taxes = holding.expectedTaxes;
  if (!taxes || holding.expectedPayout == null) return [];
  if (!taxes.estimated) return [say(translator, 'contract.untaxed')];
  const net = holding.expectedPayout - (taxes.amount ?? 0);
  return [say(translator, 'contract.net', { amount: formatter.money(net, currency) })];
};

/**
 * Writes the estimate's note: its lead and the net it comes to, or why there is none.
 *
 * @param holding - The Holding.
 * @param latestIndex - The index's latest value, if known.
 * @param texts - The texts and the currency.
 * @returns The note.
 */
export const estimateNoteOf = (
  holding: InvestmentHolding,
  latestIndex: LatestIndex | undefined,
  texts: Texts,
) => {
  const { translator } = texts;
  const missing = holding.projectionUnavailable;
  if (missing) {
    const index = say(translator, `index.${missing.indexCode}`);
    return say(translator, 'contract.missing', { index });
  }
  return [leadOf(holding, latestIndex, texts), ...netPartOf(holding, texts)].join(' · ');
};

/**
 * Writes how long the contract has to go: "2 yrs 5 mo to go", or that it
 * matures this month.
 *
 * @param term - The contract's term.
 * @param translator - The texts.
 * @returns The text.
 */
export const termLeftOf = (term: ContractTerm, translator: Translator) => {
  const parts = [
    ...(term.yearsLeft > 0 ? [say(translator, 'contract.years', { count: term.yearsLeft })] : []),
    ...(term.monthsLeft > 0
      ? [say(translator, 'contract.months', { count: term.monthsLeft })]
      : []),
  ];
  if (parts.length === 0) return say(translator, 'contract.maturing');
  return say(translator, 'contract.toGo', { span: parts.join(' ') });
};

/**
 * Draws how much of the term has run, when the buy's date and the due date are known.
 *
 * @param props - The Holding and today.
 * @returns The bar, or nothing.
 */
function TermBar({ holding, today }: {
  readonly holding: InvestmentHolding;
  readonly today: string;
}) {
  const translator = useI18n();
  if (!holding.boughtOn || !holding.dueDate) return null;
  const term = contractTermOf(holding.boughtOn, holding.dueDate, today);
  const left = termLeftOf(term, translator);
  return (
    <div className="mt-auto flex flex-col gap-1.5">
      <div className="flex justify-between gap-3 type-caption text-muted">
        <span>{say(translator, 'contract.term')}</span>
        <span className="tabular-nums">{left}</span>
      </div>
      <ProgressBar
        size="thin"
        segments={[{ value: term.elapsedPercent, tone: 'sky' }]}
        ariaLabel={say(translator, 'contract.term')}
        ariaValueText={left}
      />
    </div>
  );
}

/**
 * Renders a fixed-term Holding's contract.
 *
 * @param props - The Holding, its currency, today and the index's latest value.
 * @returns The card.
 */
export function ContractCard({
  holding, currency, today, latestIndex,
}: ContractCardProps) {
  const translator = useI18n();
  const formatter = useFormatter();
  const texts = { translator, formatter, currency };
  return (
    <DetailCard
      icon="description-outline"
      title={say(translator, 'contract.title')}
      mode="readOnly"
    >
      <KeyValueList
        items={figuresOf(holding, texts)}
        size="lg"
        columns={2}
        emptyLabel={say(translator, 'contract.unknown')}
      />
      <TermBar holding={holding} today={today} />
      <p className="type-caption text-muted">{estimateNoteOf(holding, latestIndex, texts)}</p>
    </DetailCard>
  );
}
