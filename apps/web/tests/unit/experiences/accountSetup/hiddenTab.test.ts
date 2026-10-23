import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import useDrawerClosedOnHide from '../../../../src/experiences/accountSetup/hiddenTab';

// The hidden-tab rule (OQ-197): a hook over a Flow's own state; nothing mocked.

interface FakeState {
  readonly drawer?: string | undefined;
  readonly out?: string;
}

/**
 * Closes the fake state's drawer as a Flow's own transition does: not while
 * a request is out.
 *
 * @param state - The state.
 * @returns It with no drawer, or as it was.
 */
const drawerClosed = (state: FakeState): FakeState => (
  state.out ? state : { ...state, drawer: undefined }
);

/**
 * Runs the hook over a fake Flow state, its tab first open.
 *
 * @param initial - The Flow's state.
 * @returns The hook's harness.
 */
const renderRule = (initial: FakeState) => renderHook(({ active }) => {
  const [state, setState] = useState(initial);
  useDrawerClosedOnHide(active, setState, drawerClosed);
  return { state, setState };
}, { initialProps: { active: true } });

describe('useDrawerClosedOnHide', () => {
  it('leaves the drawer while the tab is open, and closes it as the tab is hidden', () => {
    const rule = renderRule({ drawer: 'create' });
    expect(rule.result.current.state.drawer).toBe('create');
    rule.rerender({ active: false });
    expect(rule.result.current.state.drawer).toBeUndefined();
  });

  it('keeps a drawer whose request is out, through its answer, until the tab is back', () => {
    const rule = renderRule({ drawer: 'create', out: 'create' });
    rule.rerender({ active: false });
    expect(rule.result.current.state.drawer).toBe('create');
    act(() => rule.result.current.setState({ drawer: 'create' }));
    rule.rerender({ active: false });
    expect(rule.result.current.state.drawer).toBe('create');
    rule.rerender({ active: true });
    expect(rule.result.current.state.drawer).toBe('create');
  });
});
