import {
  act, fireEvent, screen, waitFor,
} from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  RateUpdateEntry, type RateUpdateEntryProps,
} from '../../../../../../../src/experiences/trackInvestments/flows/ratesMaintenance/interactions/RateUpdateEntry';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import typeInto from '../../../../../../support/typeInto';

// Rate Update Entry (BDT: Interaction, unit; nothing mocked but the caller's
// handlers — the inputs, K46's checks and the translator run for real).

/**
 * Renders Selic's form on September 30th, 2026, with one saved value.
 *
 * @param over - Props to change.
 * @returns The props.
 */
const renderEntry = (over: Partial<RateUpdateEntryProps> = {}) => {
  const props: RateUpdateEntryProps = {
    name: 'Update Selic',
    valueLabel: 'New value (% a year)',
    entries: [{ key: 'aug', date: '2026-08-31', value: 105000 }],
    today: '2026-09-30',
    hint: 'Payouts for 1 holding are projected from the latest value.',
    onSave: vi.fn().mockResolvedValue('done'),
    onCancel: vi.fn(),
    ...over,
  };
  renderInLocale(<RateUpdateEntry {...props} />);
  return props;
};

/**
 * Finds a button by its name.
 *
 * @param name - Its name.
 * @returns The button.
 */
const button = (name: string) => screen.getByRole('button', { name });

describe('RateUpdateEntry', () => {
  it('opens named, focused on the value, dated today, with the hint', async () => {
    renderEntry();

    expect(screen.getByRole('form', { name: 'Update Selic' })).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'As of' }).value)
      .toBe('09/30/2026');
    expect(screen.getByText('Payouts for 1 holding are projected from the latest value.'))
      .toBeTruthy();
    await waitFor(() => expect(document.activeElement)
      .toBe(screen.getByRole('textbox', { name: 'New value (% a year)' })));
  });

  it('saves the value typed for the day typed, a negative one too', async () => {
    const { onSave } = renderEntry();

    typeInto('New value (% a year)', '-0.25');
    typeInto('As of', '09/15/2026');
    await act(async () => fireEvent.click(button('Save')));

    expect(onSave).toHaveBeenCalledWith({ date: '2026-09-15', value: -2500 });
  });

  it('never reloads the page on a submit (R4 V5)', () => {
    renderEntry();

    expect(fireEvent.submit(button('Save').closest('form') as HTMLFormElement)).toBe(false);
  });

  it('sends nothing without a value, and shows why only after Save', async () => {
    const { onSave } = renderEntry();

    expect(document.querySelector('[aria-invalid="true"]')).toBeNull();
    fireEvent.click(button('Save'));

    expect(onSave).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement)
      .toBe(screen.getByRole('textbox', { name: 'New value (% a year)' })));
    expect(screen.getByRole('textbox', { name: 'New value (% a year)' })
      .getAttribute('aria-invalid')).toBe('true');
  });

  it('refuses a day that already has a value, focused on the date', async () => {
    const { onSave } = renderEntry();

    typeInto('New value (% a year)', '10.25');
    typeInto('As of', '08/31/2026');
    fireEvent.click(button('Save'));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('This day already has a value.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement)
      .toBe(screen.getByRole('textbox', { name: 'As of' })));
  });

  it('keeps what was typed and wakes again when the save is refused or fails', async () => {
    const onSave = vi.fn().mockResolvedValueOnce('refused').mockRejectedValueOnce(new Error('x'));
    renderEntry({ onSave });

    typeInto('New value (% a year)', '10.25');
    await act(async () => fireEvent.click(button('Save')));
    await act(async () => fireEvent.click(button('Save')));

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'New value (% a year)' }).value)
      .toBe('10.25');
    expect(button('Cancel').hasAttribute('disabled')).toBe(false);
  });

  it('waits while a save runs: Cancel and Escape do nothing', async () => {
    const onCancel = vi.fn();
    renderEntry({ onSave: () => new Promise(() => {}), onCancel });

    typeInto('New value (% a year)', '10.25');
    await act(async () => fireEvent.click(button('Save')));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'As of' }), { key: 'Escape' });

    expect(button('Cancel').hasAttribute('disabled')).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels from the button or on Escape, which goes no further', () => {
    const onKeyDown = vi.fn();
    const onCancel = vi.fn();
    renderInLocale(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <div onKeyDown={onKeyDown}>
        <RateUpdateEntry
          name="Update Selic"
          valueLabel="New value (% a year)"
          entries={[]}
          today="2026-09-30"
          hint=""
          onSave={vi.fn()}
          onCancel={onCancel}
        />
      </div>,
    );

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'As of' }), { key: 'Escape' });
    fireEvent.click(button('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onKeyDown).not.toHaveBeenCalled();
  });
});
