import { Icon } from '../../../../../kit/icons/Icon';
import { NumberInput } from '../../../../../kit/numberInput/NumberInput';
import { useI18n } from '../../../../../utilities/I18nProvider';
import type { RatePair } from '../goalProgress';

// The exchange-rate calculator (FL14, mockup 43; FR-8.4, FR-9): "1 USD = 5.20
// BRL", typed on a mixed-currency goal's card. It only emits the rate up — the
// Flow keeps it, nothing is sent or stored (FR-9.1), and every card needing the
// same pair reads it.

/** The sun-tinted box mockup 43 draws around the calculator. */
const BOX = [
  'flex flex-wrap items-center gap-2 rounded-xl border border-sun/40 bg-sun/[.06]',
  'px-3 py-2.5 type-body-sm',
].join(' ');

/** RateField's props. */
export interface RateFieldProps {
  readonly pair: RatePair;
  /** The rate typed, × 10,000, or `null` while empty. */
  readonly value: number | null;
  /** Gets the new rate, or `null` once cleared. */
  readonly onChange: (rate: number | null) => void;
}

/**
 * Renders the rate box: its label, the base, the compact input and the quote.
 *
 * @param props - The pair, the rate and its handler.
 * @returns The calculator.
 */
export function RateField({ pair, value, onChange }: RateFieldProps) {
  const translator = useI18n();

  return (
    <div className={BOX}>
      <Icon name="currency-exchange" className="text-sun" />
      <span className="text-muted">{translator.text('goalManagement', 'rate.label')}</span>
      <span className="font-semibold tabular-nums">
        {translator.text('goalManagement', 'rate.base', { base: pair.base })}
      </span>
      <NumberInput
        kind="exchange"
        size="compact"
        label={translator.text('goalManagement', 'rate.input', { ...pair })}
        value={value}
        onChange={onChange}
      />
      <span className="font-semibold tabular-nums">{pair.quote}</span>
      <span className="ml-auto type-caption text-muted">
        {translator.text('goalManagement', 'rate.note')}
      </span>
    </div>
  );
}
