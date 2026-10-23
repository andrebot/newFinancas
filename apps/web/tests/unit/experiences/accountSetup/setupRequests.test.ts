import { describe, expect, it } from 'vitest';
import {
  listsToRefresh, listViewOf,
} from '../../../../src/experiences/accountSetup/setupRequests';

// The setup requests' pure helpers (BDT: unit). The hooks themselves are
// covered through the Experiences that call them — Account Setup's and
// Onboard's integration tests.

describe('listViewOf', () => {
  it('reads a list under its field, its latest failure beside it, or its first failure', () => {
    const failure = {
      status: 500, code: 'internal.unexpected', params: {}, details: [], correlationId: 'c',
    };
    expect(listViewOf('budgets', {})).toEqual({ status: 'loading' });
    expect(listViewOf('budgets', { data: [] })).toEqual({ status: 'loaded', budgets: [] });
    expect(listViewOf('budgets', { data: [], error: failure })).toEqual({
      status: 'loaded', budgets: [], refreshError: { code: 'internal.unexpected', params: {} },
    });
    expect(listViewOf('budgets', { error: failure })).toEqual({
      status: 'failed', error: { code: 'internal.unexpected', params: {} },
    });
  });
});

describe('listsToRefresh', () => {
  it('fetches the budgets again after a success', () => {
    expect(listsToRefresh({ ok: true })).toEqual({ budgets: true, categories: false });
  });

  it.each([
    ['budget.target_already_claimed', { budgets: true, categories: false }],
    ['budget.not_found', { budgets: true, categories: false }],
    ['validation.failed', { budgets: true, categories: true }],
    ['auth.forbidden', { budgets: false, categories: false }],
  ])('after a %s, fetches what moved (OQ-194)', (code, lists) => {
    expect(listsToRefresh({ ok: false, error: { code } })).toEqual(lists);
  });
});
