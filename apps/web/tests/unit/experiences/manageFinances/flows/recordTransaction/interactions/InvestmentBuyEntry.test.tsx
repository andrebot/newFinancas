import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  InvestmentBuyEntry, assetTypeGroupsOf, termsSummaryOf, type InvestmentBuyEntryProps,
} from '../../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/InvestmentBuyEntry';
import { EMPTY_TERMS } from '../../../../../../../src/experiences/manageFinances/flows/recordTransaction/transactionForm';
import { createFormatter } from '../../../../../../../src/utilities/formatting';
import { createTranslator } from '../../../../../../../src/utilities/i18n';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import { formOf } from '../fixtures';

// Investment Buy Entry (BDT: Interaction → unit): the asset, a fixed-term
// contract and the units, rendered from the form; each change emitted. The
// real kit and catalog.

const translator = createTranslator('en-US');
const formatter = createFormatter('en-US');
const CDB_FORM = formOf({
  kind: 'investment_buy',
  assetType: 'cdb',
  ticker: 'CDB Inter',
  terms: {
    ...EMPTY_TERMS, rateType: 'cdi', rateValue: 1_100_000, dueDate: '2028-03-15',
  },
});

/**
 * Renders the entry with defaults.
 *
 * @param over - The props to change.
 * @returns The handlers.
 */
const renderEntry = (over: Partial<InvestmentBuyEntryProps> = {}) => {
  const props: InvestmentBuyEntryProps = {
    form: formOf({ kind: 'investment_buy' }),
    currency: 'BRL',
    errors: {},
    onAsset: vi.fn(),
    onQuantity: vi.fn(),
    onTerms: vi.fn(),
    ...over,
  };
  renderInLocale(<InvestmentBuyEntry {...props} />);
  return props;
};

describe('assetTypeGroupsOf', () => {
  it('groups as mockup 32 does, leaving out empty groups', () => {
    const groups = assetTypeGroupsOf(['stock', 'cdb', 'crypto', 'fii'], translator);

    expect(groups).toEqual([
      {
        group: 'Equity & funds',
        options: [{ value: 'stock', label: 'Stock' }, { value: 'fii', label: 'FII' }],
      },
      { group: 'Fixed income', options: [{ value: 'cdb', label: 'CDB' }] },
      { group: 'Other', options: [{ value: 'crypto', label: 'Crypto' }] },
    ]);
    expect(assetTypeGroupsOf(['crypto'], translator).map((group) => group.group))
      .toEqual(['Other']);
  });
});

describe('termsSummaryOf', () => {
  it('writes a contract in one line, with a dash for a missing due date', () => {
    expect(termsSummaryOf(CDB_FORM.terms, translator, formatter))
      .toBe('110.00% of CDI · due 03/15/2028 · At maturity');
    expect(termsSummaryOf(EMPTY_TERMS, translator, formatter))
      .toBe('0.00% a year · due — · At maturity');
  });
});

describe('InvestmentBuyEntry', () => {
  it('asks a market buy for its ticker, asset type and units — no contract', () => {
    const props = renderEntry({
      errors: {
        ticker: 'Enter the ticker or identifier.', quantity: 'Enter a quantity above zero.',
      },
    });

    expect(screen.getByText('Enter the ticker or identifier.')).toBeDefined();
    expect(screen.getByText('Enter a quantity above zero.')).toBeDefined();
    expect(screen.queryByRole('radiogroup', { name: 'Rate' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Ticker / identifier'), { target: { value: 'BBAS3' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } });
    expect(props.onAsset).toHaveBeenCalledWith({ ticker: 'BBAS3' });
    expect(props.onQuantity).toHaveBeenCalledWith(1_000_000_000);
  });

  it('offers a BRL account\'s asset types and emits the one picked', () => {
    const props = renderEntry({ errors: { assetType: 'Choose an asset type.' } });

    fireEvent.click(screen.getByRole('combobox', { name: 'Asset type' }));
    expect(screen.queryByRole('option', { name: 'Treasury' })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: 'CDB' }));
    expect(props.onAsset).toHaveBeenCalledWith({ assetType: 'cdb' });
    expect(screen.getByText('Choose an asset type.')).toBeDefined();
  });

  it('asks a fixed-term buy for its contract, its units optional', () => {
    const props = renderEntry({
      form: CDB_FORM,
      errors: { rateValue: 'Enter the rate.', dueDate: 'Required.' },
    });

    expect(screen.getByText('Fixed income: 1 unit if left empty.')).toBeDefined();
    expect(screen.getByLabelText('Rate · % of CDI')).toBeDefined();
    expect(screen.getByText('Enter the rate.')).toBeDefined();
    expect(screen.getByText('Required.')).toBeDefined();
    fireEvent.click(screen.getByText('IPCA'));
    expect(props.onTerms).toHaveBeenLastCalledWith({ ...CDB_FORM.terms, rateType: 'ipca' });
    const spread = screen.getByLabelText('Spread on top · % (optional)');
    fireEvent.change(spread, { target: { value: '1' } });
    expect(props.onTerms).toHaveBeenLastCalledWith({ ...CDB_FORM.terms, spread: 10_000 });
    fireEvent.change(screen.getByLabelText('Rate · % of CDI'), { target: { value: '120' } });
    expect(props.onTerms).toHaveBeenLastCalledWith({ ...CDB_FORM.terms, rateValue: 1_200_000 });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '01/01/2030' } });
    expect(props.onTerms).toHaveBeenLastCalledWith({ ...CDB_FORM.terms, dueDate: '2030-01-01' });
    fireEvent.click(screen.getByText('Monthly'));
    expect(props.onTerms)
      .toHaveBeenLastCalledWith({ ...CDB_FORM.terms, interestPayment: 'monthly' });
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('takes no spread on a fixed rate', () => {
    renderEntry({ form: { ...CDB_FORM, terms: { ...CDB_FORM.terms, rateType: 'fixed' } } });

    expect(screen.queryByLabelText('Spread on top · % (optional)')).toBeNull();
    expect(screen.getByLabelText('Rate · % a year')).toBeDefined();
  });

  it('asks a debenture whether it is incentivised', () => {
    const props = renderEntry({ form: { ...CDB_FORM, assetType: 'debenture' } });

    fireEvent.click(screen.getByRole('switch', { name: /Incentivised debenture/ }));

    expect(props.onTerms).toHaveBeenCalledWith({ ...CDB_FORM.terms, incentivised: true });
  });

  it('shows an edit\'s asset locked, its contract open before the schedule starts', () => {
    renderEntry({ form: CDB_FORM, editable: { quantity: true, terms: true } });

    expect(screen.queryByLabelText('Ticker / identifier')).toBeNull();
    expect(screen.getByText('CDB Inter · CDB')).toBeDefined();
    expect(screen.getByLabelText('Rate · % of CDI')).toBeDefined();
  });

  it('shows a started schedule\'s contract as one locked line, its units locked', () => {
    renderEntry({ form: CDB_FORM, editable: { quantity: false, terms: false } });

    expect(screen.getByText('110.00% of CDI · due 03/15/2028 · At maturity')).toBeDefined();
    expect(screen.queryByLabelText('Rate · % of CDI')).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Quantity').disabled).toBe(true);
  });

  it('names a locked asset without a type "Other"', () => {
    renderEntry({
      form: formOf({ kind: 'investment_buy', ticker: 'X' }),
      editable: { quantity: true, terms: true },
    });

    expect(screen.getByText('X · Other')).toBeDefined();
  });
});
