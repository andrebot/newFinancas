import {
  autoUpdate,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
  useTypeahead,
  type Placement,
} from '@floating-ui/react';
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { disabledIndicesOf, pickHandlers, typeaheadLabelsOf } from '../floatingList/listItems';
import { overlayMiddleware } from '../popover/overlay';
import {
  checkedIndexOf, rowsOf, toMenuSections, type MenuEntry, type MenuRow,
} from './entries';

// The menu's behaviour (K23, OQ-140), apart from its looks: the open state,
// the keyboard position, and the Floating UI wiring that positions the panel
// and makes the trigger, menu and rows accessible. The arrow keys loop and
// skip disabled rows; typing letters jumps to a row; opening starts on the
// current choice. Picking a row closes the menu, then runs it.

/** What the hook needs: the entries and where the panel sits. */
export interface MenuListInput<Value extends string> {
  readonly entries: readonly MenuEntry<Value>[];
  readonly placement: Placement;
}

/**
 * Runs the menu: opens and closes the panel, tracks the keyboard position and
 * hands out the props each part spreads.
 *
 * @param input - The entries and the panel's placement.
 * @returns The state to draw and the props for the trigger, panel and rows.
 */
export const useMenuList = <Value extends string>({ entries, placement }: MenuListInput<Value>) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const sections = useMemo(() => toMenuSections(entries), [entries]);
  const rows = rowsOf(sections);
  const listRef = useRef<(HTMLElement | null)[]>([]);
  const labelsRef = useRef<(string | null)[]>([]);
  useEffect(() => {
    labelsRef.current = typeaheadLabelsOf(rows);
  });

  const pick = (row: MenuRow) => {
    setOpen(false);
    row.select();
  };
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    middleware: overlayMiddleware(),
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'menu' }),
    useListNavigation(context, {
      listRef,
      activeIndex,
      selectedIndex: checkedIndexOf(rows),
      onNavigate: setActiveIndex,
      loop: true,
      disabledIndices: disabledIndicesOf(rows),
    }),
    useTypeahead(context, {
      listRef: labelsRef,
      activeIndex,
      onMatch: setActiveIndex,
      enabled: open,
    }),
  ]);
  // Floating UI names the menu after its trigger, whose text is the current
  // choice ("Member"); the Menu names it with its own label instead.
  const { 'aria-labelledby': triggerLabel, ...panelProps } = getFloatingProps();

  return {
    open,
    sections,
    activeIndex,
    context,
    triggerProps: { ref: refs.setReference, ...getReferenceProps() },
    panelProps: { ref: refs.setFloating, style: floatingStyles, ...panelProps },
    itemPropsOf: (row: MenuRow) => getItemProps({
      ref: (node: HTMLElement | null) => {
        listRef.current[row.index] = node;
      },
      active: row.index === activeIndex,
      tabIndex: row.index === activeIndex ? 0 : -1,
      ...pickHandlers(row, pick),
    }),
  };
};
