import { describe, expect, it } from 'vitest';
import {
  awaitsSchedule, editableNow, formChanged, hasStarted, holdingsLoaded, holdingsRetried,
  holdingsToLoad, loadedHoldingsOf, openedWith, requestEnded, requestStarted, scheduleToLoad,
  splitRowsOf, splitToLoad, submitRefused, type RecordTransactionState,
} from '../../../../../../src/experiences/manageFinances/flows/recordTransaction/recordTransactionState';
import {
  CLOSED, GOALS, STOCK, formOf,
} from './fixtures';

// The Record Transaction Flow's state (BDT: Flow tier, pure → unit): what it
// asks the Experience to read, the edit's schedule lock, the request and the
// refusals — no mocks.

const FAILURE = { code: 'network.unavailable' };
const SELL = formOf({ kind: 'investment_sell', accountId: 'itau' });
const SPLIT_READ = { holdingId: 'h1', load: { status: 'loaded', data: null } } as const;
const CDB_BUY = formOf({ kind: 'investment_buy', assetType: 'cdb', holdingId: 'cdb1' });

describe('openedWith', () => {
  it('opens a new form with nothing read or out', () => {
    expect(openedWith(SELL, false)).toEqual({
      form: SELL, original: undefined, holdings: {}, out: false, problems: {}, refusals: 0,
    });
  });

  it('keeps an edit\'s form as it opened', () => {
    expect(openedWith(SELL, true).original).toBe(SELL);
  });
});

describe('formChanged', () => {
  it('sets the form and clears only the refusals named', () => {
    const state = {
      ...openedWith(SELL, false),
      problems: { amount: { code: 'amount' }, holding: { code: 'holding' } },
    };

    expect(formChanged(state, CDB_BUY, ['amount'])).toMatchObject({
      form: CDB_BUY, problems: { holding: { code: 'holding' } },
    });
  });

  it('keeps a split read while the form holds its Holding\'s rows', () => {
    const onHolding = { ...SELL, holdingId: 'h1' };
    const state = { ...openedWith(onHolding, false), split: SPLIT_READ };
    const quantity = { ...onHolding, quantity: 5 };
    const redemption = { ...onHolding, kind: 'investment_redemption' };

    expect(formChanged(state, quantity, []).split).toBe(SPLIT_READ);
    expect(formChanged(state, redemption, []).split).toBe(SPLIT_READ);
  });

  it('forgets a split read once its rows are dropped, so the round-trip reads again', () => {
    const onHolding = { ...SELL, holdingId: 'h1' };
    const state = { ...openedWith(onHolding, false), split: SPLIT_READ };
    const dividend = formChanged(state, { ...onHolding, kind: 'investment_dividend' }, []);
    const otherHolding = formChanged(state, { ...onHolding, holdingId: 'h2' }, []);

    expect(dividend.split).toBeUndefined();
    expect(otherHolding.split).toBeUndefined();
    expect(splitToLoad(formChanged(dividend, onHolding, []), true)).toBe('h1');
  });
});

describe('the Holdings read', () => {
  it('asks once for the chosen account\'s Holdings, only when the kind picks one', () => {
    const state = openedWith(SELL, false);

    expect(holdingsToLoad(state, true)).toBe('itau');
    expect(holdingsToLoad(state, false)).toBeUndefined();
    expect(holdingsToLoad(openedWith(formOf(), false), true)).toBeUndefined();
    expect(holdingsToLoad(holdingsLoaded(state, 'itau', { status: 'loading' }), true))
      .toBeUndefined();
  });

  it('lists the loaded Holdings without the archived ones, none otherwise', () => {
    const state = openedWith(SELL, false);
    const loaded = holdingsLoaded(state, 'itau', { status: 'loaded', data: [STOCK, CLOSED] });

    expect(loadedHoldingsOf(loaded)).toEqual([STOCK]);
    expect(loadedHoldingsOf(holdingsLoaded(state, 'itau', { status: 'loading' }))).toEqual([]);
    expect(loadedHoldingsOf(openedWith(formOf(), false))).toEqual([]);
  });

  it('forgets one account\'s read on a retry', () => {
    const state = holdingsLoaded(
      holdingsLoaded(openedWith(SELL, false), 'itau', { status: 'failed', error: FAILURE }),
      'chase',
      { status: 'loading' },
    );

    expect(Object.keys(holdingsRetried(state, 'itau').holdings)).toEqual(['chase']);
  });
});

describe('the split read (OQ-206)', () => {
  it('asks for a new sell\'s Holding split, once per Holding', () => {
    const state = openedWith({ ...SELL, holdingId: 'bbas3' }, false);

    expect(splitToLoad(state, true)).toBe('bbas3');
    expect(splitToLoad(state, false)).toBeUndefined();
    const loading = { status: 'loading' } as const;
    expect(splitToLoad({ ...state, split: { holdingId: 'bbas3', load: loading } }, true))
      .toBeUndefined();
    expect(splitToLoad({ ...state, split: { holdingId: 'other', load: loading } }, true))
      .toBe('bbas3');
  });

  it('never asks before a Holding is picked, nor on an edit', () => {
    expect(splitToLoad(openedWith(SELL, false), true)).toBeUndefined();
    expect(splitToLoad(openedWith({ ...SELL, holdingId: 'bbas3' }, true), true)).toBeUndefined();
  });

  it('names each visible Goal\'s share, the server keeping the others', () => {
    const rows = splitRowsOf([
      { goalId: 'house', percentage: 40 }, { goalId: 'hidden', percentage: 10 },
      { goalId: 'trip', percentage: 5 },
    ], GOALS);

    expect(rows).toEqual([
      {
        goalId: 'house', name: 'House', percent: 40, progress: 57, completed: false,
      },
      {
        goalId: 'trip', name: 'Trip', percent: 5, progress: 100, completed: true,
      },
    ]);
  });
});

describe('the schedule read (D8)', () => {
  it('asks once for an edited fixed-term buy\'s schedule', () => {
    const edit = openedWith(CDB_BUY, true);

    expect(scheduleToLoad(edit)).toBe('cdb1');
    expect(scheduleToLoad({ ...edit, schedule: { status: 'loading' } })).toBeUndefined();
    expect(scheduleToLoad(openedWith(CDB_BUY, false))).toBeUndefined();
    expect(scheduleToLoad(openedWith(SELL, true))).toBeUndefined();
  });

  it('tells a started schedule by a posted entry', () => {
    expect(hasStarted([{ postedAt: null }, { postedAt: '2026-10-01T00:00:00Z' }])).toBe(true);
    expect(hasStarted([{ postedAt: null }, {}])).toBe(false);
  });

  it('locks the amount, date, units and terms once started, not while unread or failed', () => {
    const edit = openedWith(CDB_BUY, true);
    const started: RecordTransactionState = { ...edit, schedule: { status: 'loaded', data: true } };
    const failed: RecordTransactionState = {
      ...edit, schedule: { status: 'failed', error: FAILURE },
    };

    expect(editableNow(started)).toEqual({ amountAndDate: false, quantity: false, terms: false });
    expect(editableNow(failed)).toEqual({ amountAndDate: true, quantity: true, terms: true });
    expect(editableNow({ ...edit, schedule: { status: 'loaded', data: false } }).terms).toBe(true);
  });

  it('waits only while the read is out', () => {
    const edit = openedWith(CDB_BUY, true);

    expect(awaitsSchedule({ ...edit, schedule: { status: 'loading' } })).toBe(true);
    expect(awaitsSchedule(edit)).toBe(false);
  });
});

describe('the submit', () => {
  it('counts a refused submit and shows its refusals', () => {
    const refused = submitRefused(openedWith(SELL, false), { amount: { code: 'amount' } });

    expect(refused).toMatchObject({ refusals: 1, problems: { amount: { code: 'amount' } } });
  });

  it('starts a request clean and ends it with its failure, if any', () => {
    const started = requestStarted({
      ...openedWith(SELL, false), lastError: FAILURE, problems: { amount: { code: 'amount' } },
    });

    expect(started).toMatchObject({ out: true, lastError: undefined, problems: {} });
    expect(requestEnded(started, FAILURE)).toMatchObject({ out: false, lastError: FAILURE });
    expect(requestEnded(started, undefined).lastError).toBeUndefined();
  });
});
