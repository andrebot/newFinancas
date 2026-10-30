import { act, fireEvent, screen } from '@testing-library/react';
import { TRANSACTION_KINDS } from '@financas/reference';
import type {
  HoldingAllocation, InvestmentHolding, InvestmentScheduleEntry,
} from '@financas/api-types';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  RecordTransactionFlow, type RecordTransactionFlowProps,
} from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/RecordTransactionFlow';
import type { GoalAllocationEntryProps } from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/GoalAllocationEntry';
import type { HoldingSelectionProps } from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/HoldingSelection';
import type { InvestmentBuyEntryProps } from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/InvestmentBuyEntry';
import type { KindSelectionProps } from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/KindSelection';
import type {
  AmountFieldProps, CategoryFieldsProps, DetailFieldsProps, OwnTransferSwitchProps,
  ReceivedAmountFieldProps, TargetFieldsProps,
} from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/TransactionEntry';
import { EMPTY_TERMS } from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/transactionForm';
import { AlertProvider } from '../../../../../../src/utilities/AlertProvider';
import { createAlertQueue, type AlertQueue } from '../../../../../../src/utilities/alerts';
import type { DataOutcome, RequestOutcome } from '../../../../../../src/utilities/requestOutcome';
import { renderInLocale } from '../../../../../support/renderInLocale';
import {
  ACCOUNTS, CATEGORIES, CDB, GOALS, STOCK, accountRowOf,
} from './fixtures';

// The Record Transaction Flow (BDT: Flow, unit). Its Interactions are stubbed
// — they have their own suites — so the Flow is tested against its state,
// its reads and its submit; the Experience's reads and writes are the
// callbacks it is handed. The kit's drawer and banners, the toast queue and
// the translator stay real.

/**
 * Writes a value for a stub's data attribute.
 *
 * @param value - Anything.
 * @returns It as text; nothing for `undefined`.
 */
const data = (value: unknown) => (value === undefined ? '' : JSON.stringify(value));

vi.mock('../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/KindSelection', () => ({
  /**
   * The kinds' stand-in: the kind, the lock, one button per kind and group.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  KindSelection: ({
    kind, locked, kindsHidden, onGroupChange, onKindChange,
  }: KindSelectionProps) => (
    <div
      data-testid="kind"
      data-kind={kind}
      data-locked={String(Boolean(locked))}
      data-kinds-hidden={String(Boolean(kindsHidden))}
    >
      <button type="button" onClick={() => onGroupChange('investment')}>group investment</button>
      {TRANSACTION_KINDS.map(({ code }) => (
        <button key={code} type="button" onClick={() => onKindChange(code)}>
          {`kind ${code}`}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/TransactionEntry', () => ({
  /**
   * The amount's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  AmountField: ({
    currency, error, disabled, onChange,
  }: AmountFieldProps) => (
    <div
      data-testid="amount"
      data-currency={currency ?? ''}
      data-error={error ?? ''}
      data-disabled={String(Boolean(disabled))}
    >
      <button type="button" onClick={() => onChange(5_000)}>amount</button>
    </div>
  ),
  /**
   * The targets' stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  TargetFields: ({
    locked, accountError, cardError, toAccountError, onAccount, onCard, onToAccount,
  }: TargetFieldsProps) => (
    <div
      data-testid="targets"
      data-locked={String(Boolean(locked))}
      data-account-error={accountError ?? ''}
      data-card-error={cardError ?? ''}
      data-to-error={toAccountError ?? ''}
    >
      <button type="button" onClick={() => onAccount('itau')}>account itau</button>
      <button type="button" onClick={() => onCard('nu1')}>card nu1</button>
      <button type="button" onClick={() => onToAccount('chase')}>to chase</button>
    </div>
  ),
  /**
   * "Between your accounts?"'s stand-in (OQ-222).
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  OwnTransferSwitch: ({ on, locked, onChange }: OwnTransferSwitchProps) => (
    <div data-testid="own" data-on={String(on)} data-locked={String(Boolean(locked))}>
      <button type="button" onClick={() => onChange(!on)}>between accounts</button>
    </div>
  ),
  /**
   * What arrived's stand-in (OQ-222).
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  ReceivedAmountField: ({
    account, value, error, onChange,
  }: ReceivedAmountFieldProps) => (
    <div
      data-testid="received"
      data-account={account.id}
      data-value={data(value)}
      data-error={error ?? ''}
    >
      <button type="button" onClick={() => onChange(950)}>received</button>
    </div>
  ),
  /**
   * The details' stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  DetailFields: ({
    date, dateError, dateDisabled, onDate, onDescription,
  }: DetailFieldsProps) => (
    <div
      data-testid="details"
      data-date={date}
      data-error={dateError ?? ''}
      data-disabled={String(Boolean(dateDisabled))}
    >
      <button type="button" onClick={() => onDate('2026-10-02')}>date</button>
      <button type="button" onClick={() => onDate('')}>clear date</button>
      <button type="button" onClick={() => onDescription(' Feira ')}>description</button>
    </div>
  ),
  /**
   * The category's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  CategoryFields: ({
    categoryId, subcategoryId, investment, onCategory, onSubcategory,
  }: CategoryFieldsProps) => (
    <div
      data-testid="category"
      data-category={categoryId ?? ''}
      data-subcategory={subcategoryId ?? ''}
      data-investment={String(investment)}
    >
      <button type="button" onClick={() => onCategory('groceries')}>category</button>
      <button type="button" onClick={() => onSubcategory('market')}>subcategory</button>
    </div>
  ),
}));
vi.mock('../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/HoldingSelection', () => ({
  /**
   * The Holding picker's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  HoldingSelection: ({
    holdings, holdingId, quantity, holdingError, quantityError, lockedName, onHolding, onQuantity,
    onRetry,
  }: HoldingSelectionProps) => (
    <div
      data-testid="holding"
      data-status={holdings?.status ?? ''}
      data-holding={holdingId ?? ''}
      data-quantity={data(quantity)}
      data-error={holdingError ?? ''}
      data-quantity-error={quantityError ?? ''}
      data-locked={lockedName ?? ''}
    >
      <button type="button" onClick={() => onHolding(STOCK)}>holding bbas3</button>
      <button type="button" onClick={() => onHolding(CDB)}>holding cdb1</button>
      <button type="button" onClick={() => onQuantity(500_000_000)}>quantity</button>
      <button type="button" onClick={onRetry}>retry holdings</button>
    </div>
  ),
}));
vi.mock('../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/InvestmentBuyEntry', () => ({
  /**
   * The buy's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  InvestmentBuyEntry: ({
    currency, errors, editable, onAsset, onQuantity, onTerms,
  }: InvestmentBuyEntryProps) => (
    <div
      data-testid="buy"
      data-currency={currency ?? ''}
      data-errors={data(errors)}
      data-editable={data(editable)}
    >
      <button type="button" onClick={() => onAsset({ assetType: 'stock', ticker: 'BBAS3' })}>
        asset
      </button>
      <button type="button" onClick={() => onQuantity(100_000_000)}>buy quantity</button>
      <button
        type="button"
        onClick={() => onTerms({ ...EMPTY_TERMS, rateValue: 120_000, dueDate: '2030-01-01' })}
      >
        terms
      </button>
    </div>
  ),
}));
vi.mock('../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/GoalAllocationEntry', () => ({
  /**
   * The split's stand-in.
   *
   * @param props - What the Flow passes.
   * @returns The stub.
   */
  GoalAllocationEntry: ({
    source, rows, goals, load, showErrors, error, onChange, onRetry,
  }: GoalAllocationEntryProps) => (
    <div
      data-testid="split"
      data-source={source}
      data-rows={data(rows.map((row) => [row.goalId, row.percent]))}
      data-goals={data(goals.map((goal) => goal.id))}
      data-load={load?.status ?? ''}
      data-show-errors={String(showErrors)}
      data-error={error ?? ''}
    >
      <button
        type="button"
        onClick={() => onChange([{ goalId: 'laptop', name: 'Laptop', percent: 50 }])}
      >
        split
      </button>
      <button
        type="button"
        onClick={() => onChange([{ goalId: 'laptop', name: 'Laptop', percent: 150 }])}
      >
        overfull split
      </button>
      <button type="button" onClick={onRetry}>retry split</button>
    </div>
  ),
}));

/** A promise the test settles when it wants. */
const deferred = <Value,>() => {
  let settle: (value: Value) => void = () => {};
  const promise = new Promise<Value>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
};

const OFFLINE = { code: 'network.unavailable' };

let queue: AlertQueue;

beforeEach(() => {
  queue = createAlertQueue(3);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 14, 10));
});

afterEach(() => {
  vi.useRealTimers();
});

/** The Experience's requests, as spied. */
type Requests = {
  [Key in keyof Pick<RecordTransactionFlowProps, 'onLoadHoldings' | 'onLoadSplit' | 'onLoadSchedule'
    | 'onRecord' | 'onSave' | 'onClose'>]: ReturnType<typeof vi.fn<RecordTransactionFlowProps[Key]>>
};

/** The toasts on screen. */
const toasts = () => queue.visible().map(({ message }) => message);

/**
 * Renders the Flow with its requests spied.
 *
 * @param over - The props over the defaults.
 * @param prepare - Programs the requests before the first render.
 * @returns The requests and a rerender with other props.
 */
const renderFlow = (
  over: Partial<RecordTransactionFlowProps> = {},
  prepare: (requests: Requests) => void = () => {},
) => {
  const requests = {
    onLoadHoldings: vi.fn(async (): Promise<DataOutcome<readonly InvestmentHolding[]>> => (
      { ok: true, data: [STOCK, CDB] })),
    onLoadSplit: vi.fn(async (): Promise<DataOutcome<readonly HoldingAllocation[]>> => (
      { ok: true, data: [{ goalId: 'house', percentage: 40 }] })),
    onLoadSchedule: vi.fn(async (): Promise<DataOutcome<readonly InvestmentScheduleEntry[]>> => (
      { ok: true, data: [] })),
    onRecord: vi.fn(async (): Promise<RequestOutcome> => ({ ok: true })),
    onSave: vi.fn(async (): Promise<RequestOutcome> => ({ ok: true })),
    onClose: vi.fn(),
  };
  prepare(requests);
  /**
   * Builds the Flow.
   *
   * @param props - The props over the defaults.
   * @returns The element.
   */
  const flow = (props: Partial<RecordTransactionFlowProps>) => (
    <AlertProvider queue={queue}>
      <RecordTransactionFlow
        accounts={ACCOUNTS}
        categories={CATEGORIES}
        goals={GOALS}
        {...requests}
        {...props}
      />
    </AlertProvider>
  );
  const view = renderInLocale(flow(over));
  return {
    ...requests,
    rerender: (props: Partial<RecordTransactionFlowProps>) => view.rerenderInLocale(flow(props)),
  };
};

/**
 * Clicks a stub's button and lets its promises settle.
 *
 * @param name - The button's text.
 */
const press = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

/**
 * Reads a stub's data attribute.
 *
 * @param testId - The stub.
 * @param attribute - The attribute, without `data-`.
 * @returns Its value.
 */
const attr = (testId: string, attribute: string) => (
  screen.getByTestId(testId).getAttribute(`data-${attribute}`)
);

describe('recording a new transaction', () => {
  it('opens on a cash deposit dated today, landing in this month', () => {
    renderFlow();

    expect(screen.getByRole('dialog', { name: 'Record Transaction' })).toBeDefined();
    expect(screen.getByText('New')).toBeDefined();
    expect(attr('kind', 'kind')).toBe('deposit');
    expect(attr('kind', 'locked')).toBe('false');
    expect(attr('details', 'date')).toBe('2026-09-14');
    expect(screen.getByText('September 2026')).toBeDefined();
    expect(screen.queryByTestId('holding')).toBeNull();
    expect(screen.queryByTestId('buy')).toBeNull();
    expect(screen.queryByTestId('split')).toBeNull();
  });

  it('draws the category before the details for cash, after them for an investment', async () => {
    renderFlow();
    const order = () => screen.getAllByTestId(/category|details/)
      .map((node) => node.dataset.testid);

    expect(order()).toEqual(['category', 'details']);
    await press('group investment');
    expect(order()).toEqual(['details', 'category']);
    expect(attr('category', 'investment')).toBe('true');
  });

  it('refuses an incomplete form and clears a refusal once fixed', async () => {
    const { onRecord } = renderFlow();

    await press('Record Transaction');

    expect(onRecord).not.toHaveBeenCalled();
    expect(attr('amount', 'error')).toBe('Enter an amount.');
    expect(attr('targets', 'account-error')).toBe('Choose an account.');
    await press('amount');
    expect(attr('amount', 'error')).toBe('');
    expect(attr('targets', 'account-error')).toBe('Choose an account.');
  });

  it('drops the month note while the date isn\'t real', async () => {
    renderFlow();

    await press('clear date');

    expect(screen.queryByText('Lands in')).toBeNull();
  });

  it('records a cash kind, toasts it and closes', async () => {
    const { onRecord, onClose } = renderFlow();

    await press('kind pix_payment');
    await press('account itau');
    await press('amount');
    await press('date');
    await press('description');
    await press('category');
    await press('subcategory');
    await press('Record Transaction');

    expect(onRecord).toHaveBeenCalledExactlyOnceWith({
      kind: 'pix_payment',
      date: '2026-10-02',
      amount: 5_000,
      currency: 'BRL',
      accountId: 'itau',
      categoryId: 'groceries',
      subcategoryId: 'market',
      description: 'Feira',
    });
    expect(toasts()).toEqual(['Transaction recorded.']);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('records a bill payment on its card and payer (OQ-219)', async () => {
    const { onRecord } = renderFlow();

    await press('kind credit_card_bill_payment');
    await press('card nu1');
    await press('amount');
    await press('Record Transaction');

    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'credit_card_bill_payment', creditCardId: 'nu1', accountId: 'itau', currency: 'BRL',
    }));
  });

  it('keeps a failure in the banner and the drawer open, waiting meanwhile', async () => {
    const answer = deferred<RequestOutcome>();
    const { onRecord, onClose } = renderFlow();
    onRecord.mockReturnValueOnce(answer.promise);

    await press('account itau');
    await press('amount');
    await press('Record Transaction');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    await press('Record Transaction');
    expect(onRecord).toHaveBeenCalledOnce();
    await act(async () => answer.settle({ ok: false, error: { code: 'account.archived' } }));

    expect(screen.getByRole('alert').textContent).toContain('archived');
    expect(onClose).not.toHaveBeenCalled();
    expect(toasts()).toEqual([]);
  });

  it('sends nothing when the chosen account is gone from the list', async () => {
    const { onRecord, rerender } = renderFlow();

    await press('account itau');
    await press('amount');
    rerender({ accounts: [] });
    await press('Record Transaction');

    expect(onRecord).not.toHaveBeenCalled();
  });

  it('closes on Cancel, and on Escape while nothing is out', async () => {
    const { onClose } = renderFlow();

    await press('Cancel');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('a buy (mockup 32)', () => {
  it('records a market buy with its split', async () => {
    const { onRecord } = renderFlow();

    await press('group investment');
    await press('account itau');
    await press('amount');
    await press('asset');
    await press('buy quantity');
    expect(attr('buy', 'currency')).toBe('BRL');
    expect(attr('split', 'source')).toBe('purchase');
    expect(attr('split', 'goals')).toBe(data(['house', 'laptop']));
    expect(attr('split', 'load')).toBe('');
    await press('split');
    await press('Record Transaction');

    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'investment_buy',
      assetType: 'stock',
      ticker: 'BBAS3',
      quantity: 100_000_000,
      allocations: [{ goalId: 'laptop', percentage: 50 }],
    }));
  });

  it('shows the buy\'s refusals, the split\'s too, and clears them as fixed', async () => {
    renderFlow();

    await press('group investment');
    await press('overfull split');
    await press('Record Transaction');
    expect(JSON.parse(attr('buy', 'errors')!)).toMatchObject({
      assetType: 'Choose an asset type.', ticker: 'Enter the ticker or identifier.',
    });
    expect(attr('split', 'show-errors')).toBe('true');
    expect(attr('split', 'error')).toContain('at least 1%');

    await press('asset');
    await press('terms');
    await press('split');
    expect(JSON.parse(attr('buy', 'errors')!).ticker).toBeUndefined();
    expect(attr('split', 'error')).toBe('');
  });
});

describe('a sell (mockup 35, OQ-206)', () => {
  it('reads the account\'s Holdings, then the Holding\'s split, and pre-fills it', async () => {
    const { onLoadHoldings, onLoadSplit } = renderFlow();

    await press('kind investment_sell');
    expect(attr('holding', 'status')).toBe('');
    await press('account itau');
    expect(onLoadHoldings).toHaveBeenCalledExactlyOnceWith('itau');
    expect(attr('holding', 'status')).toBe('loaded');
    expect(screen.queryByTestId('split')).toBeNull();

    await press('holding bbas3');
    expect(onLoadSplit).toHaveBeenCalledExactlyOnceWith('bbas3');
    expect(attr('split', 'source')).toBe('holding');
    expect(attr('split', 'load')).toBe('loaded');
    expect(attr('split', 'rows')).toBe(data([['house', 40]]));
  });

  it('sends the sell without its split while untouched, with it once changed', async () => {
    const { onRecord } = renderFlow();

    await press('kind investment_sell');
    await press('account itau');
    await press('holding bbas3');
    await press('amount');
    await press('quantity');
    await press('Record Transaction');
    expect(onRecord).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ allocations: expect.anything() }),
    );
    expect(onRecord).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'investment_sell', holdingId: 'bbas3', quantity: 500_000_000,
    }));
  });

  it('sends a changed split with the sell', async () => {
    const { onRecord } = renderFlow();

    await press('kind investment_sell');
    await press('account itau');
    await press('holding bbas3');
    await press('amount');
    await press('quantity');
    await press('split');
    await press('Record Transaction');

    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({
      allocations: [{ goalId: 'laptop', percentage: 50 }],
    }));
  });

  it('refuses units beyond what the Holding holds', async () => {
    const { onRecord } = renderFlow();

    await press('kind investment_redemption');
    await press('account itau');
    await press('holding cdb1');
    expect(attr('holding', 'quantity')).toBe(data(100_000_000));
    await press('quantity');
    await press('amount');
    await press('Record Transaction');

    expect(onRecord).not.toHaveBeenCalled();
    expect(attr('holding', 'quantity-error')).toBe('Only 1 held.');
  });

  it('asks for a cash event\'s Holding', async () => {
    renderFlow();

    await press('kind investment_dividend');
    await press('account itau');
    await press('amount');
    await press('Record Transaction');

    expect(attr('holding', 'error')).toBe('Choose a Holding.');
    expect(screen.queryByTestId('split')).toBeNull();
  });

  it('asks again for the Holdings after a failed read', async () => {
    const { onLoadHoldings } = renderFlow();
    onLoadHoldings.mockResolvedValueOnce({ ok: false, error: { code: 'network.unavailable' } });

    await press('kind investment_sell');
    await press('account itau');
    expect(attr('holding', 'status')).toBe('failed');
    await press('retry holdings');

    expect(onLoadHoldings).toHaveBeenCalledTimes(2);
    expect(attr('holding', 'status')).toBe('loaded');
  });

  it('asks for nothing on a retry before an account is chosen', async () => {
    const { onLoadHoldings } = renderFlow();

    await press('kind investment_sell');
    await press('retry holdings');

    expect(onLoadHoldings).not.toHaveBeenCalled();
  });

  it('asks again for the split after a failed read', async () => {
    const { onLoadSplit } = renderFlow();
    onLoadSplit.mockResolvedValueOnce({ ok: false, error: { code: 'network.unavailable' } });

    await press('kind investment_sell');
    await press('account itau');
    await press('holding bbas3');
    expect(attr('split', 'load')).toBe('failed');
    await press('retry split');

    expect(onLoadSplit).toHaveBeenCalledTimes(2);
    expect(attr('split', 'rows')).toBe(data([['house', 40]]));
  });

  it('ignores a split read for a Holding no longer picked', async () => {
    const first = deferred<DataOutcome<readonly HoldingAllocation[]>>();
    const { onLoadSplit } = renderFlow();
    onLoadSplit.mockReturnValueOnce(first.promise);

    await press('kind investment_sell');
    await press('account itau');
    await press('holding bbas3');
    await press('holding cdb1');
    await act(async () => first.settle({ ok: true, data: [{ goalId: 'laptop', percentage: 90 }] }));

    expect(attr('holding', 'holding')).toBe('cdb1');
    expect(attr('split', 'rows')).toBe(data([['house', 40]]));
  });
});

describe('editing a ledger row (OQ-201 D6)', () => {
  it('opens the row with its kind and targets locked, and sends only what changed', async () => {
    const { onSave, onClose } = renderFlow({ transaction: { item: accountRowOf() } });

    expect(screen.getByRole('dialog', { name: 'Edit Transaction' })).toBeDefined();
    expect(attr('kind', 'locked')).toBe('true');
    expect(attr('targets', 'locked')).toBe('true');
    await press('amount');
    await press('Save changes');

    expect(onSave).toHaveBeenCalledExactlyOnceWith('t1', { amount: 5_000 });
    expect(toasts()).toEqual(['Transaction saved.']);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('just closes an edit with no change', async () => {
    const { onSave, onClose } = renderFlow({ transaction: { item: accountRowOf() } });

    await press('Save changes');

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('checks what may change, never the identity', async () => {
    const unpriced = accountRowOf({ amount: undefined } as never);
    const { onSave } = renderFlow({ transaction: { item: unpriced } });

    await press('Save changes');

    expect(onSave).not.toHaveBeenCalled();
    expect(attr('amount', 'error')).toBe('Enter an amount.');
    expect(attr('targets', 'account-error')).toBe('');
  });

  it('shows a sell\'s Holding by name, reading no Holdings and no split', async () => {
    const { onLoadHoldings, onLoadSplit } = renderFlow({
      transaction: {
        item: accountRowOf({
          kind: 'investment_sell',
          holdingId: 'bbas3',
          quantity: 5,
          holding: { ticker: 'BBAS3', assetType: 'stock' },
        }),
      },
    });

    await press('quantity');

    expect(attr('holding', 'locked')).toBe('BBAS3');
    expect(onLoadHoldings).not.toHaveBeenCalled();
    expect(onLoadSplit).not.toHaveBeenCalled();
    expect(screen.queryByTestId('split')).toBeNull();
  });

  it('names a card row\'s Holding as nothing', () => {
    renderFlow({
      transaction: {
        item: {
          ledger: 'card',
          id: 'c1',
          kind: 'investment_tax',
          creditCardId: 'visa1',
          date: '2026-09-14',
        } as never,
      },
    });

    expect(attr('holding', 'locked')).toBe('');
  });

  it('names a Holding missing from an account row as nothing', () => {
    renderFlow({ transaction: { item: accountRowOf({ kind: 'investment_tax', holdingId: 'x' }) } });

    expect(attr('holding', 'locked')).toBe('');
  });
});

describe('a transfer between own accounts (OQ-222)', () => {
  it('asks only on a transfer, and turns the drawer to From → To with no category', async () => {
    renderFlow();
    expect(screen.queryByTestId('own')).toBeNull();

    await press('kind transfer_received');
    expect(attr('own', 'on')).toBe('false');
    expect(screen.getByTestId('category')).toBeDefined();

    await press('between accounts');
    expect(attr('own', 'on')).toBe('true');
    expect(attr('kind', 'kind')).toBe('transfer_sent');
    expect(attr('kind', 'kinds-hidden')).toBe('true');
    expect(screen.queryByTestId('category')).toBeNull();
  });

  it('asks what arrived across currencies, refusing it empty, then records the pair', async () => {
    const { onRecord } = renderFlow();
    await press('kind transfer_sent');
    await press('between accounts');
    await press('account itau');
    await press('amount');
    await press('Record Transaction');
    expect(attr('targets', 'to-error')).toBe('Choose the account it goes to.');
    expect(screen.queryByTestId('received')).toBeNull();

    await press('to chase');
    expect(attr('received', 'account')).toBe('chase');
    await press('Record Transaction');
    expect(attr('received', 'error')).toBe('Enter the amount received.');
    expect(onRecord).not.toHaveBeenCalled();

    await press('received');
    await press('Record Transaction');
    expect(onRecord).toHaveBeenCalledExactlyOnceWith({
      kind: 'transfer_sent',
      date: '2026-09-14',
      amount: 5_000,
      currency: 'BRL',
      accountId: 'itau',
      toAccountId: 'chase',
      receivedAmount: 950,
    });
  });

  it('edits a pair from its received side as sent, the switch locked', async () => {
    const { onSave } = renderFlow({
      transaction: {
        item: accountRowOf({
          id: 'r',
          kind: 'transfer_received',
          effect: 'transfer',
          accountId: 'chase',
          amount: 900,
          currency: 'USD',
          categoryId: null,
          transfer: { accountId: 'itau', amount: 4_000, currency: 'BRL' },
        }),
      },
    });
    expect(attr('own', 'locked')).toBe('true');
    expect(attr('received', 'value')).toBe('900');

    await press('received');
    await press('Save changes');
    expect(onSave).toHaveBeenCalledExactlyOnceWith('r', { receivedAmount: 950 });
  });
});

describe('editing a fixed-term buy (D8)', () => {
  const BUY = {
    item: accountRowOf({
      kind: 'investment_buy',
      holdingId: 'cdb1',
      quantity: 100_000_000,
      amount: 1_000_000,
      holding: { ticker: 'CDB', assetType: 'cdb' },
    }),
    holding: CDB,
  };

  it('waits on the schedule, then locks amount, date, units and terms once started', async () => {
    const answer = deferred<DataOutcome<readonly InvestmentScheduleEntry[]>>();
    const { onLoadSchedule, onSave } = renderFlow({ transaction: BUY }, (requests) => {
      requests.onLoadSchedule.mockReturnValue(answer.promise);
    });

    expect(onLoadSchedule).toHaveBeenCalledWith('cdb1');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save changes' }).disabled)
      .toBe(true);
    await act(async () => answer.settle({ ok: true, data: [{ postedAt: '2026-10-01T00:00Z' }] }));
    await act(async () => {});

    expect(screen.getByText(/has started paying out/)).toBeDefined();
    expect(attr('amount', 'disabled')).toBe('true');
    expect(attr('details', 'disabled')).toBe('true');
    expect(JSON.parse(attr('buy', 'editable')!)).toMatchObject({ quantity: false, terms: false });
    await press('amount');
    await press('subcategory');
    await press('Save changes');
    expect(onSave).toHaveBeenCalledWith('t1', { subcategoryId: 'market' });
  });

  it('leaves everything open before the schedule starts, or when its read fails', async () => {
    renderFlow({ transaction: BUY }, (requests) => {
      requests.onLoadSchedule.mockResolvedValue({ ok: false, error: OFFLINE });
    });
    await act(async () => {});

    expect(screen.queryByText(/has started paying out/)).toBeNull();
    expect(attr('amount', 'disabled')).toBe('false');
    expect(JSON.parse(attr('buy', 'editable')!)).toMatchObject({ quantity: true, terms: true });
  });

  it('sends nothing while the schedule is read', async () => {
    const answer = deferred<DataOutcome<readonly InvestmentScheduleEntry[]>>();
    const { onSave, onClose } = renderFlow({ transaction: BUY }, (requests) => {
      requests.onLoadSchedule.mockReturnValue(answer.promise);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
