import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import {
  EMPTY_CARD_FORM, CardFields, cardDraftOf, dayOption, type CardFormState,
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

  it('refuses a card whose days or expiration are not picked', () => {
    const number = form({ digits: VISA });
    expect(cardDraftOf(form({ ...number, closingDay: 10 }))).toBeUndefined();
    expect(cardDraftOf(form({ ...number, closingDay: 10, dueDay: 20 }))).toBeUndefined();
    expect(cardDraftOf(form({
      ...number, closingDay: 10, dueDay: 20, expirationMonth: 8,
    }))).toBeUndefined();
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

  it('names the network as its number is typed, and reports the digits', () => {
    const onChange = renderFields();
    const input = screen.getByRole('textbox', { name: 'Card number' });
    fireEvent.change(input, { target: { value: VISA } });
    expect(onChange).toHaveBeenCalledWith({ digits: VISA });
  });

  it('shows a picked day on its combobox and reports the pick', async () => {
    const onChange = renderFields(form({ closingDay: 10 }));
    await act(async () => {
      fireEvent.click(screen.getByRole('combobox', { name: 'Due day' }));
    });
    fireEvent.click(screen.getByRole('option', { name: '20' }));
    expect(onChange).toHaveBeenCalledWith({ dueDay: 20 });
  });

  it('labels a day’s option by its number', () => {
    expect(dayOption(5)).toEqual({ value: '5', label: '5' });
  });
});
