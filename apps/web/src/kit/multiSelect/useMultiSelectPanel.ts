import {
  autoUpdate, useClick, useDismiss, useFloating, useInteractions, useRole,
} from '@floating-ui/react';
import { useMemo, useState } from 'react';
import { overlayMiddleware } from '../popover/overlay';
import { filterSections, toSections, type SelectEntry } from '../select/options';

// The multi-select's panel behaviour (K12, OQ-214), apart from its looks: the
// open state, the search and the Floating UI wiring. The trigger is a
// disclosure for a non-modal dialog of checkboxes, not a listbox, so Tab and
// Space reach every row natively (OQ-130); Esc, a click outside or tabbing
// away close it. The search clears whenever the panel opens or closes.

/**
 * Runs the multi-select's panel: opens and closes it, narrows the sections
 * to the search, and hands out the props the trigger and the panel spread.
 *
 * @param options - The caller's list.
 * @returns The state to draw, a way to close, and the trigger's and panel's props.
 */
const useMultiSelectPanel = <Value extends string>(
  options: readonly SelectEntry<Value>[],
) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const sections = useMemo(() => filterSections(toSections(options), query), [options, query]);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    setQuery('');
  };
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: changeOpen,
    placement: 'bottom-start',
    middleware: overlayMiddleware({ matchReferenceWidth: true }),
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ]);

  return {
    open,
    close: () => changeOpen(false),
    query,
    setQuery,
    sections,
    context,
    triggerProps: { ref: refs.setReference, ...getReferenceProps() },
    panelProps: { ref: refs.setFloating, style: floatingStyles, ...getFloatingProps() },
  };
};

export default useMultiSelectPanel;
