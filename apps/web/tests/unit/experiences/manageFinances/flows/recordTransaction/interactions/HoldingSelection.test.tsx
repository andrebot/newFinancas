import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  HoldingSelection, holdingMetaOf, rateTextOf, type HoldingSelectionProps,
} from '../../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/HoldingSelection';
import { createFormatter } from '../../../../../../../src/utilities/formatting';
import { createTranslator } from '../../../../../../../src/utilities/i18n';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import { CDB, CLOSED, STOCK } from '../fixtures';

// Holding Selection (BDT: Interaction → unit): the account's Holdings as
// radio rows for each read state, a trade's units with what is held; picks
// emitted. The real kit and catalog.

const translator = createTranslator('en-US');
const formatter = createFormatter('en-US');

/**
 * Renders the section with defaults.
 *
 * @param over - The props to change.
 * @returns The handlers.
 */
const renderSelection = (over: Partial<HoldingSelectionProps> = {}) => {
  const props: HoldingSelectionProps = {
    kind: 'investment_sell',
    holdings: { status: 'loaded', data: [STOCK, CDB, CLOSED] },
    currency: 'BRL',
    holdingId: undefined,
    quantity: null,
    onHolding: vi.fn(),
    onQuantity: vi.fn(),
    onRetry: vi.fn(),
    ...over,
  };
  renderInLocale(<HoldingSelection {...props} />);
  return props;
};

describe('holdingMetaOf and rateTextOf', () => {
  it('describes a market Holding by its units and a contract by its rate and due date', () => {
    expect(holdingMetaOf(STOCK, translator, formatter)).toBe('Stock · 300 units');
    expect(holdingMetaOf({ ...STOCK, quantity: 12_345 }, translator, formatter))
      .toBe('Stock · 0.00012345 units');
    expect(holdingMetaOf({ ...STOCK, quantity: 100_000_000 }, translator, formatter))
      .toBe('Stock · 1 unit');
    expect(holdingMetaOf(CDB, translator, formatter)).toBe('CDB · 110.00% of CDI · due 03/15/2028');
  });

  it('falls back on what a Holding leaves out', () => {
    expect(holdingMetaOf({ rate: null }, translator, formatter)).toBe('Other · 0 units');
    expect(holdingMetaOf({ ...CDB, dueDate: null }, translator, formatter)).toContain('due —');
    expect(rateTextOf({}, translator, formatter)).toBe('0.00% a year');
    expect(rateTextOf({ type: 'selic', value: 1_000_000, spread: 5_000 }, translator, formatter))
      .toBe('100.00% of Selic + 0.50%');
    expect(holdingMetaOf({ rate: { type: 'cdi' } }, translator, formatter)).toBe('Other · 0 units');
  });
});

describe('HoldingSelection', () => {
  it('lists the open Holdings with what each cost, and emits a pick', () => {
    const props = renderSelection();

    const rows = screen.getAllByRole('radio');
    expect(rows).toHaveLength(2);
    expect(screen.getByText(/12\.960,00/)).toBeDefined();
    expect(screen.getByText(/two CDBs can share a name/)).toBeDefined();
    fireEvent.click(screen.getByText('CDB Inter 2028'));
    expect(props.onHolding).toHaveBeenCalledWith(CDB);
  });

  it('shows the units held for the picked Holding and emits the units typed', () => {
    const props = renderSelection({ holdingId: 'bbas3', quantityError: 'Only 300 held.' });

    expect(screen.getByLabelText('Quantity sold')).toBeDefined();
    expect(screen.getByText('Only 300 held.')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Quantity sold'), { target: { value: '5' } });
    expect(props.onQuantity).toHaveBeenCalledWith(500_000_000);
  });

  it('says how many are held once no error replaces it', () => {
    renderSelection({ holdingId: 'bbas3' });

    expect(screen.getByText('Of 300 held.')).toBeDefined();
  });

  it('asks no units of a cash event', () => {
    renderSelection({ kind: 'investment_dividend' });
    expect(screen.queryByLabelText(/Quantity/)).toBeNull();
  });

  it('labels a redemption\'s units', () => {
    renderSelection({ kind: 'investment_redemption' });
    expect(screen.getByLabelText('Quantity redeemed')).toBeDefined();
  });

  it('marks the first row invalid, and leaves the cost off without a currency', () => {
    renderSelection({ holdingError: 'Choose a Holding.', currency: undefined });

    expect(screen.getByText('Choose a Holding.')).toBeDefined();
    expect(screen.getAllByRole('radio')[0]!.getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText(/12\.960,00/)).toBeNull();
  });

  it('counts a Holding without a cost as nothing spent', () => {
    const noCost = { ...STOCK, costBasis: undefined } as never;
    renderSelection({ holdings: { status: 'loaded', data: [noCost] } });

    expect(screen.getByText(/0,00/)).toBeDefined();
  });

  it('says an account has no Holdings', () => {
    renderSelection({ holdings: { status: 'loaded', data: [CLOSED] } });

    expect(screen.getByText(/no Holdings yet/)).toBeDefined();
  });

  it('asks for the account first', () => {
    renderSelection({ holdings: undefined });

    expect(screen.getByText('Choose the account first.')).toBeDefined();
  });

  it('shows the loading rows while the Holdings are read', () => {
    renderSelection({ holdings: { status: 'loading' } });

    expect(screen.getByRole('status', { name: 'Loading the Holdings' })).toBeDefined();
  });

  it('offers Try again after a failed read', () => {
    const props = renderSelection({ holdings: { status: 'failed', error: { code: 'x' } } });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText("Couldn't load this account's Holdings.")).toBeDefined();
    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  it('shows an edit\'s Holding locked, its units still open', () => {
    renderSelection({ lockedName: 'BBAS3', holdingId: 'bbas3', holdings: undefined });

    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('BBAS3')).toBeDefined();
    expect(screen.getByLabelText('Quantity sold')).toBeDefined();
  });
});
