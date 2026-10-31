import { describe, expect, it } from 'vitest';
import {
  applyRefused, deleteAsked, deleteCancelled, deleteEnded, deleteStarted, draftChanged,
  draftOpened, INITIAL_BROWSE_STATE, rowToggled,
} from '../../../../../../src/experiences/manageFinances/flows/browseTransactions/browseState';
import {
  holdingFilters, NO_FILTERS,
} from '../../../../../../src/experiences/manageFinances/flows/browseTransactions/ledgerFilters';

// The Flow's own state (BDT: Flow rules, unit — pure).

const FAILURE = { code: 'transaction.schedule_started' };

describe('rows', () => {
  it('keeps one row open, and a toggle drops the confirm and its failure', () => {
    const open = rowToggled(INITIAL_BROWSE_STATE, 'account:t1', true);
    expect(open.openRow).toBe('account:t1');

    const failed = { ...deleteAsked(open), deleteFailure: FAILURE };
    const other = rowToggled(failed, 'card:c1', true);
    expect(other).toMatchObject({
      openRow: 'card:c1', confirming: false, deleteFailure: undefined,
    });
    expect(rowToggled(other, 'card:c1', false).openRow).toBeUndefined();
  });

  it('stays put while a delete is out', () => {
    const deleting = deleteStarted(deleteAsked(rowToggled(INITIAL_BROWSE_STATE, 'a', true)));

    expect(rowToggled(deleting, 'b', true)).toBe(deleting);
    expect(deleteCancelled(deleting)).toBe(deleting);
  });
});

describe('the delete', () => {
  const asked = deleteAsked(rowToggled(INITIAL_BROWSE_STATE, 'a', true));

  it('asks, then cancels', () => {
    expect(asked.confirming).toBe(true);
    expect(deleteCancelled(asked)).toMatchObject({ confirming: false, openRow: 'a' });
  });

  it('keeps a failure in the confirm, and asking again clears it', () => {
    const failed = deleteEnded(deleteStarted(asked), FAILURE);

    expect(failed).toMatchObject({ deleting: false, confirming: true, deleteFailure: FAILURE });
    expect(deleteAsked(failed).deleteFailure).toBeUndefined();
    expect(deleteStarted(failed).deleteFailure).toBeUndefined();
  });

  it('closes the row on success', () => {
    expect(deleteEnded(deleteStarted(asked), undefined)).toMatchObject({
      deleting: false, confirming: false, openRow: undefined,
    });
  });
});

describe('the draft', () => {
  it('starts from the applied filters, its errors hidden', () => {
    const refused = applyRefused(INITIAL_BROWSE_STATE);
    expect(refused.showRangeErrors).toBe(true);

    const opened = draftOpened(refused, holdingFilters('bbas3'));
    expect(opened).toMatchObject({ draft: holdingFilters('bbas3'), showRangeErrors: false });
    expect(draftChanged(opened, NO_FILTERS).draft).toBe(NO_FILTERS);
  });
});

describe('the initial state (review V4)', () => {
  it('opens nothing, confirms nothing and shows no range error', () => {
    expect(INITIAL_BROWSE_STATE).toEqual({
      confirming: false, deleting: false, draft: NO_FILTERS, showRangeErrors: false,
    });
  });
});
