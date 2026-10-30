import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  AmountField, CategoryFields, DetailFields, NO_CATEGORY, OwnTransferSwitch, ReceivedAmountField,
  TargetFields, categoryChoicesOf,
} from '../../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/TransactionEntry';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import {
  ACCOUNTS, CATEGORIES, CHASE, accountOf, formOf,
} from '../fixtures';

// Transaction Entry (BDT: Interaction → unit): the amount, the targets, the
// date and description, the category — rendered from the form, each change
// emitted; the real kit and catalog.

describe('AmountField', () => {
  it('signs a money-out kind and names the account\'s currency', () => {
    renderInLocale(
      <AmountField
        form={formOf({ kind: 'pix_payment', amount: 8_690 })}
        currency="BRL"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Amount')).toBeDefined();
    expect(screen.getByText('Money out · currency follows the account (BRL)')).toBeDefined();
    expect(screen.getByText('−R$')).toBeDefined();
  });

  it('says the card\'s currency for a card kind, and none before a target is chosen', () => {
    const { rerenderInLocale } = renderInLocale(
      <AmountField form={formOf({ kind: 'refund' })} currency="USD" onChange={vi.fn()} />,
    );
    expect(screen.getByText('Money in · currency follows the card (USD)')).toBeDefined();

    rerenderInLocale(
      <AmountField
        form={formOf({ kind: 'deposit' })}
        currency={undefined}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Money in · currency follows the account')).toBeDefined();
  });

  it('names what a buy invests and a sell receives', () => {
    const { rerenderInLocale } = renderInLocale(
      <AmountField form={formOf({ kind: 'investment_buy' })} currency="BRL" onChange={vi.fn()} />,
    );
    expect(screen.getByText('Amount invested')).toBeDefined();
    expect(screen.getByText('Leaves the account · becomes a Holding')).toBeDefined();

    rerenderInLocale(
      <AmountField
        form={formOf({ kind: 'investment_redemption' })}
        currency="BRL"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Amount received')).toBeDefined();
    expect(screen.getByText('Enters the account · leaves the Holding')).toBeDefined();
  });

  it('shows the error and the lock', () => {
    const onChange = vi.fn();
    renderInLocale(
      <AmountField
        form={formOf({ kind: 'deposit' })}
        currency="BRL"
        error="Enter an amount."
        disabled
        onChange={onChange}
      />,
    );
    const input = screen.getByRole<HTMLInputElement>('textbox');

    expect(screen.getByText('Enter an amount.')).toBeDefined();
    expect(input.disabled).toBe(true);
  });

  it('emits what is typed', () => {
    const onChange = vi.fn();
    renderInLocale(
      <AmountField
        form={formOf({ kind: 'deposit' })}
        currency="BRL"
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12' } });

    expect(onChange).toHaveBeenCalledWith(12);
  });
});

describe('TargetFields', () => {
  const handlers = { onAccount: vi.fn(), onCard: vi.fn(), onToAccount: vi.fn() };

  it('offers the open, non-card-only accounts with their currency, for money out', () => {
    renderInLocale(
      <TargetFields
        form={formOf({ kind: 'withdrawal' })}
        accounts={ACCOUNTS}
        {...handlers}
      />,
    );

    expect(screen.getByRole('group', { name: 'From account' })).toBeDefined();
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('value')))
      .toEqual(['itau', 'chase']);
    expect(screen.getByRole('radio', { name: 'Main Checking USD' })).toBeDefined();
  });

  it('names where money in lands and an investment\'s account', () => {
    const { rerenderInLocale } = renderInLocale(
      <TargetFields form={formOf({ kind: 'pix_receipt' })} accounts={ACCOUNTS} {...handlers} />,
    );
    expect(screen.getByRole('group', { name: 'To account' })).toBeDefined();

    rerenderInLocale(
      <TargetFields
        form={formOf({ kind: 'investment_tax' })}
        accounts={ACCOUNTS}
        {...handlers}
      />,
    );
    expect(screen.getByRole('group', { name: 'Account' })).toBeDefined();
  });

  it('emits the account picked', () => {
    const onAccount = vi.fn();
    renderInLocale(
      <TargetFields
        form={formOf({ kind: 'deposit' })}
        accounts={ACCOUNTS}
        onAccount={onAccount}
        onCard={vi.fn()}
        onToAccount={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Main Checking'));

    expect(onAccount).toHaveBeenCalledWith('chase');
  });

  it('offers a card kind its cards alone, each with its account, and emits the pick', () => {
    const onCard = vi.fn();
    renderInLocale(
      <TargetFields
        form={formOf({ kind: 'charge' })}
        accounts={ACCOUNTS}
        cardError="Choose a card."
        onAccount={vi.fn()}
        onCard={onCard}
        onToAccount={vi.fn()}
      />,
    );

    expect(screen.getByRole('group', { name: 'Card' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'Visa •••• 2222 Nubank' })).toBeDefined();
    expect(screen.queryByRole('group', { name: /account/i })).toBeNull();
    expect(screen.getByText('Choose a card.')).toBeDefined();
    fireEvent.click(screen.getByText('Visa •••• 1111'));
    expect(onCard).toHaveBeenCalledWith('visa1');
  });

  it('asks a bill payment for its card, then a payer in its currency (OQ-219)', () => {
    renderInLocale(
      <TargetFields
        form={formOf({ kind: 'credit_card_bill_payment', creditCardId: 'nu1' })}
        accounts={ACCOUNTS}
        accountError="Choose an account."
        {...handlers}
      />,
    );

    expect(screen.getByRole('group', { name: 'Card' })).toBeDefined();
    const payer = screen.getByRole('group', { name: 'Paid from' });
    expect(payer.querySelectorAll('input')).toHaveLength(1);
    expect(screen.getByText('Choose an account.')).toBeDefined();
  });

  it('shows an edit\'s card and account locked', () => {
    renderInLocale(
      <TargetFields
        form={formOf({ kind: 'credit_card_bill_payment', creditCardId: 'nu1', accountId: 'itau' })}
        accounts={ACCOUNTS}
        locked
        {...handlers}
      />,
    );

    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('Visa •••• 2222')).toBeDefined();
    expect(screen.getByText('Paid from')).toBeDefined();
    expect(screen.getByText('Itaú Conta')).toBeDefined();
  });

  it('shows nothing locked for targets it can\'t find', () => {
    const { container } = renderInLocale(
      <TargetFields
        form={formOf({ kind: 'charge', creditCardId: 'gone' })}
        accounts={ACCOUNTS}
        locked
        {...handlers}
      />,
    );

    expect(container.textContent).toBe('');
  });
});

describe('a transfer between own accounts (OQ-222)', () => {
  const SAVINGS = accountOf('savings', { name: 'Poupança' });
  const MINE = [...ACCOUNTS, SAVINGS];
  const own = formOf({
    kind: 'transfer_sent', ownTransfer: true, accountId: 'itau', toAccountId: 'savings',
  });

  it('asks From and To, emitting the account it reaches', () => {
    const onToAccount = vi.fn();
    renderInLocale(
      <TargetFields
        form={own}
        accounts={MINE}
        toAccountError="Choose the account it goes to."
        onAccount={vi.fn()}
        onCard={vi.fn()}
        onToAccount={onToAccount}
      />,
    );
    expect(screen.getByRole('group', { name: 'From' })).toBeDefined();
    const to = screen.getByRole('group', { name: 'To' });
    expect([...to.querySelectorAll('input')].map((radio) => radio.value))
      .toEqual(['chase', 'savings']);
    expect(screen.getByText('Choose the account it goes to.')).toBeDefined();
    fireEvent.click(to.querySelector('input[value="chase"]')!);
    expect(onToAccount).toHaveBeenCalledWith('chase');
  });

  it('shows an edit\'s From and To locked', () => {
    renderInLocale(
      <TargetFields
        form={own}
        accounts={MINE}
        locked
        onAccount={vi.fn()}
        onCard={vi.fn()}
        onToAccount={vi.fn()}
      />,
    );
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('From')).toBeDefined();
    expect(screen.getByText('Poupança')).toBeDefined();
  });

  it('says what each answer to "Between your accounts?" means, and emits it', () => {
    const onChange = vi.fn();
    const { rerenderInLocale } = renderInLocale(
      <OwnTransferSwitch on={false} onChange={onChange} />,
    );
    expect(screen.getByText('Money from or to someone else — counted as income or expense.'))
      .toBeDefined();
    fireEvent.click(screen.getByRole('switch', { name: /Between your accounts\?/ }));
    expect(onChange).toHaveBeenCalledWith(true);

    rerenderInLocale(<OwnTransferSwitch on locked onChange={onChange} />);
    expect(screen.getByText(/not counted as income or expense/)).toBeDefined();
    expect(screen.getByRole<HTMLInputElement>('switch').disabled).toBe(true);
  });

  it('asks what arrived in the other account\'s currency', () => {
    const onChange = vi.fn();
    renderInLocale(
      <ReceivedAmountField
        account={CHASE}
        value={950}
        error="Enter the amount received."
        onChange={onChange}
      />,
    );
    expect(screen.getByText('Amount received')).toBeDefined();
    expect(screen.getByText('Enter the amount received.')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12' } });
    expect(onChange).toHaveBeenCalledWith(12);
  });
});

describe('DetailFields', () => {
  it('emits the date and the description, with the date\'s error and lock', () => {
    const onDate = vi.fn();
    const onDescription = vi.fn();
    renderInLocale(
      <DetailFields
        date="2026-09-14"
        description="Feira"
        dateError="Required."
        dateDisabled
        onDate={onDate}
        onDescription={onDescription}
      />,
    );

    expect(screen.getByText('Required.')).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>('Date').disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Mercado' } });
    expect(onDescription).toHaveBeenCalledWith('Mercado');
  });

  it('emits a typed date', () => {
    const onDate = vi.fn();
    renderInLocale(<DetailFields date="" description="" onDate={onDate} onDescription={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '09/14/2026' } });

    expect(onDate).toHaveBeenCalledWith('2026-09-14');
  });
});

describe('categoryChoicesOf', () => {
  it('lists "none" first, the open categories, and an archived one only when chosen', () => {
    expect(categoryChoicesOf(CATEGORIES, undefined, 'Uncategorized').map((chip) => chip.value))
      .toEqual([NO_CATEGORY, 'groceries', 'housing']);
    expect(categoryChoicesOf(CATEGORIES, 'retired', 'Uncategorized').map((chip) => chip.value))
      .toEqual([NO_CATEGORY, 'groceries', 'housing', 'retired']);
  });
});

describe('CategoryFields', () => {
  it('starts uncategorized, with the budget note, and emits a category', () => {
    const onCategory = vi.fn();
    renderInLocale(
      <CategoryFields
        categories={CATEGORIES}
        categoryId={undefined}
        subcategoryId={undefined}
        investment={false}
        onCategory={onCategory}
        onSubcategory={vi.fn()}
      />,
    );

    const note = "Category · optional — uncategorized isn't tracked by budgets";
    expect(screen.getByRole('group', { name: note }))
      .toBeDefined();
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Uncategorized' }).checked)
      .toBe(true);
    expect(screen.queryByRole('group', { name: /Subcategory/ })).toBeNull();
    fireEvent.click(screen.getByText('Groceries'));
    expect(onCategory).toHaveBeenCalledWith('groceries');
  });

  it('starts a category\'s subcategory on "None"', () => {
    renderInLocale(
      <CategoryFields
        categories={CATEGORIES}
        categoryId="groceries"
        subcategoryId={undefined}
        investment={false}
        onCategory={vi.fn()}
        onSubcategory={vi.fn()}
      />,
    );

    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'None' }).checked).toBe(true);
  });

  it('offers the chosen category\'s open subcategories, and emits "none" as nothing', () => {
    const onCategory = vi.fn();
    const onSubcategory = vi.fn();
    renderInLocale(
      <CategoryFields
        categories={CATEGORIES}
        categoryId="groceries"
        subcategoryId="market"
        investment
        onCategory={onCategory}
        onSubcategory={onSubcategory}
      />,
    );

    const note = 'Category · optional — counts in a Budget that claims it';
    expect(screen.getByRole('group', { name: note }))
      .toBeDefined();
    const subcategories = screen.getByRole('group', { name: 'Subcategory · optional' });
    expect(subcategories.textContent).toContain('Market');
    expect(subcategories.textContent).not.toContain('Gone');
    fireEvent.click(screen.getByText('None'));
    fireEvent.click(screen.getByText('Uncategorized'));
    expect(onSubcategory).toHaveBeenCalledWith(undefined);
    expect(onCategory).toHaveBeenCalledWith(undefined);
  });

  it('keeps an edit\'s archived subcategory, and emits a subcategory picked', () => {
    const onSubcategory = vi.fn();
    renderInLocale(
      <CategoryFields
        categories={CATEGORIES}
        categoryId="groceries"
        subcategoryId="gone"
        investment={false}
        onCategory={vi.fn()}
        onSubcategory={onSubcategory}
      />,
    );

    fireEvent.click(screen.getByText('Market'));

    expect(screen.getByText('Gone')).toBeDefined();
    expect(onSubcategory).toHaveBeenCalledWith('market');
  });

  it('shows no subcategories for a category without any, or one that is gone', () => {
    const { rerenderInLocale } = renderInLocale(
      <CategoryFields
        categories={CATEGORIES}
        categoryId="housing"
        subcategoryId={undefined}
        investment={false}
        onCategory={vi.fn()}
        onSubcategory={vi.fn()}
      />,
    );
    expect(screen.queryByRole('group', { name: /Subcategory/ })).toBeNull();

    rerenderInLocale(
      <CategoryFields
        categories={CATEGORIES}
        categoryId="deleted"
        subcategoryId={undefined}
        investment={false}
        onCategory={vi.fn()}
        onSubcategory={vi.fn()}
      />,
    );
    expect(screen.queryByRole('group', { name: /Subcategory/ })).toBeNull();
  });
});
