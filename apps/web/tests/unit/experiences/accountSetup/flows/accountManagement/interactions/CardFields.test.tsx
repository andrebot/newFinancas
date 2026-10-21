import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import { creditCard } from '../../../../../../../src/config/constants';
import {
  EMPTY_CARD_FORM, CardFields, cardDraftOf, dayOption, draftsOf, expirationYears, expiryOf,
  selectValue, type CardFormState,
} from '../../../../../../../src/experiences/accountSetup/flows/accountManagement/interactions/CardFields';

// One card's fields (BDT: unit): the pure read of a draft and the form's
// display; only the caller's change handler is a stand-in.

const VISA = '4111111111111111';

/**
 * Builds a filled form over the empty one.
 *
 * @param over - What to set besides the defaults.
 * @returns The form state.
 */
const form = (over: Partial<CardFormState> = {}): CardFormState => ({
  ...EMPTY_CARD_FORM, ...over,
});

describe('cardDraftOf', () => {
  it('reads a valid number and its fields into a draft', () => {
    expect(cardDraftOf(form({
      digits: VISA, closingDay: 10, dueDay: 20, expirationMonth: 8, expirationYear: 2030,
    })))
      .toEqual({
        network: 'visa',
        last4: '1111',
        closingDay: 10,
        dueDay: 20,
        expirationMonth: 8,
        expirationYear: 2030,
      });
  });

  it('refuses a number that fails its checks', () => {
    expect(cardDraftOf(form({
      digits: '4111111111111112',
      closingDay: 10,
      dueDay: 20,
      expirationMonth: 8,
      expirationYear: 2030,
    })))
      .toBeUndefined();
    expect(cardDraftOf(EMPTY_CARD_FORM)).toBeUndefined();
  });

  it('refuses a card with any one of its picks missing', () => {
    const complete = form({
      digits: VISA, closingDay: 10, dueDay: 20, expirationMonth: 8, expirationYear: 2030,
    });
    expect(cardDraftOf({ ...complete, closingDay: null })).toBeUndefined();
    expect(cardDraftOf({ ...complete, dueDay: null })).toBeUndefined();
    expect(cardDraftOf({ ...complete, expirationMonth: null })).toBeUndefined();
    expect(cardDraftOf({ ...complete, expirationYear: null })).toBeUndefined();
  });
});

describe('draftsOf', () => {
  it('reads every passing form and names each failing one', () => {
    const good = form({
      digits: VISA, closingDay: 10, dueDay: 20, expirationMonth: 8, expirationYear: 2030,
    });
    const { drafts, errors } = draftsOf([EMPTY_CARD_FORM, good], 'incomplete');
    expect(drafts).toEqual([cardDraftOf(good)]);
    expect(drafts[0]?.last4).toBe('1111');
    expect(errors).toEqual(['incomplete', undefined]);
  });

  it('reads nothing from no forms', () => {
    expect(draftsOf([], 'incomplete')).toEqual({ drafts: [], errors: [] });
  });
});

describe('expirationYears', () => {
  it('offers the first year and the configured window after it', () => {
    const years = expirationYears(2026);
    expect(years[0]).toBe(2026);
    expect(years).toHaveLength(creditCard.expirationYearsAhead + 1);
  });

  it('keeps a year inside the window once', () => {
    expect(expirationYears(2026, 2027)).toEqual(expirationYears(2026));
  });

  it('adds a saved card’s year outside the window, in order', () => {
    const years = expirationYears(2026, 2020);
    expect(years[0]).toBe(2020);
    expect(years[1]).toBe(2026);
  });
});

describe('expiryOf', () => {
  it('writes MM/YY once both are picked', () => {
    expect(expiryOf(8, 2030)).toBe('08/30');
    expect(expiryOf(12, 2105)).toBe('12/05');
  });

  it('writes nothing until both are picked', () => {
    expect(expiryOf(null, 2030)).toBeUndefined();
    expect(expiryOf(8, null)).toBeUndefined();
  });
});

describe('the fields', () => {
  /**
   * Renders the fields with a stand-in handler.
   *
   * @param state - What is typed and picked.
   * @returns The change spy.
   */
  const renderFields = (state: CardFormState = EMPTY_CARD_FORM) => {
    const onChange = vi.fn();
    renderInLocale(<CardFields form={state} onChange={onChange} />);
    return onChange;
  };

  it('opens with its number and four picks, all empty', () => {
    renderFields();
    expect(screen.getByRole('textbox', { name: 'Card number' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Closing day' }).textContent).toBe('Pick a day');
    expect(screen.getByRole('combobox', { name: 'Due day' }).textContent).toBe('Pick a day');
    expect(screen.getByRole('combobox', { name: 'Expires month' }).textContent).toBe('Month');
    expect(screen.getByRole('combobox', { name: 'Expires year' }).textContent).toBe('Year');
  });

  it('reports the digits as they are typed', () => {
    const onChange = renderFields();
    const input = screen.getByRole('textbox', { name: 'Card number' });
    fireEvent.change(input, { target: { value: VISA } });
    expect(onChange).toHaveBeenCalledWith({ digits: VISA });
  });

  it('draws the live preview: the detected network, the billing and the expiry', () => {
    renderFields(form({
      digits: VISA, closingDay: 10, dueDay: 20, expirationMonth: 8, expirationYear: 2030,
    }));
    expect(screen.getByText('Visa detected from the number')).toBeTruthy();
    expect(screen.getByText('Closes 10 · Due 20')).toBeTruthy();
    expect(screen.getByText('08/30')).toBeTruthy();
  });

  it('names no network while the number is empty or objected to', () => {
    renderInLocale(
      <CardFields form={form({ digits: VISA })} digitsError="Bad" onChange={vi.fn()} />,
    );
    expect(screen.queryByText(/detected from the number/)).toBeNull();
  });

  it('shows a picked day on its combobox and reports the pick', async () => {
    const onChange = renderFields(form({ closingDay: 10 }));
    await act(async () => {
      fireEvent.click(screen.getByRole('combobox', { name: 'Due day' }));
    });
    fireEvent.click(screen.getByRole('option', { name: '20' }));
    expect(onChange).toHaveBeenCalledWith({ dueDay: 20 });
  });

  it('turns a pick into its Select value, null for nothing picked', () => {
    expect(selectValue(7)).toBe('7');
    expect(selectValue(null)).toBeNull();
  });

  it('labels a day’s option by its number', () => {
    expect(dayOption(5)).toEqual({ value: '5', label: '5' });
  });
});
