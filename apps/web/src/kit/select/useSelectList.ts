import {
  autoUpdate,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
  useTypeahead,
} from '@floating-ui/react';
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import { disabledIndicesOf, pickHandlers, typeaheadLabelsOf } from '../floatingList/listItems';
import { overlayMiddleware } from '../popover/overlay';
import {
  filterSections, flattenSections, toSections, type SelectEntry, type SelectOption,
} from './options';

// The select's behaviour (K11, OQ-138), apart from its looks: the panel's
// open state, the search, the keyboard position, and the Floating UI wiring
// that positions the panel and makes the trigger, listbox and options
// accessible. The arrow keys skip disabled options; typing letters jumps to
// an option (and, while closed, picks it, as a native select does).

/** What the hook needs: the options, the chosen value and where picks go. */
export interface SelectListInput<Value extends string> {
  readonly options: readonly SelectEntry<Value>[];
  readonly value: Value | null;
  readonly onChange: (value: Value) => void;
  /** Whether the panel has a search box; typeahead is off then, typing goes to the box. */
  readonly searchable: boolean;
}

/**
 * Finds where an option sits in the list drawn.
 *
 * @param options - The options drawn, in display order.
 * @param value - The value to look for.
 * @returns Its position, or `null` when it isn't drawn.
 */
export const indexOfValue = <Value extends string>(
  options: readonly SelectOption<Value>[],
  value: Value | null,
) => {
  const index = options.findIndex((option) => option.value === value);
  return index === -1 ? null : index;
};

/**
 * Runs the select: opens and closes the panel, narrows it to the search,
 * tracks the keyboard position and hands out the props each part spreads.
 *
 * @param input - The options, the chosen value, the change handler and whether it searches.
 * @returns The state to draw and the props for the trigger, panel, listbox and options.
 */
export const useSelectList = <Value extends string>({
  options, value, onChange, searchable,
}: SelectListInput<Value>) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const sections = useMemo(() => filterSections(toSections(options), query), [options, query]);
  const shown = flattenSections(sections);
  const selectedIndex = indexOfValue(shown, value);
  const listRef = useRef<(HTMLElement | null)[]>([]);
  const labelsRef = useRef<(string | null)[]>([]);
  useEffect(() => {
    labelsRef.current = typeaheadLabelsOf(shown);
  });

  const changeOpen = (next: boolean) => {
    setOpen(next);
    setQuery('');
  };
  const pick = (option: SelectOption<Value>) => {
    onChange(option.value);
    changeOpen(false);
  };
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: changeOpen,
    placement: 'bottom-start',
    middleware: overlayMiddleware({ matchReferenceWidth: true }),
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'select' }),
    useListNavigation(context, {
      listRef,
      activeIndex,
      selectedIndex,
      onNavigate: setActiveIndex,
      loop: true,
      disabledIndices: disabledIndicesOf(shown),
    }),
    useTypeahead(context, {
      listRef: labelsRef,
      activeIndex,
      selectedIndex,
      onMatch: (index) => (open ? setActiveIndex(index) : onChange(shown[index]!.value)),
      enabled: !searchable,
    }),
  ]);
  // The listbox is the list inside the panel, not the panel: the search box
  // sits in the panel too, and a listbox may hold only options.
  const { role, id, ...panelProps } = getFloatingProps();

  return {
    open,
    query,
    setQuery,
    sections,
    shown,
    activeIndex,
    context,
    triggerProps: { ref: refs.setReference, ...getReferenceProps() },
    panelProps: { ref: refs.setFloating, style: floatingStyles, ...panelProps },
    listboxProps: { role: role as string, id: id as string },
    itemPropsOf: (option: SelectOption<string>, index: number) => getItemProps({
      ref: (node: HTMLElement | null) => {
        listRef.current[index] = node;
      },
      active: index === activeIndex,
      selected: index === selectedIndex,
      tabIndex: index === activeIndex ? 0 : -1,
      ...pickHandlers(option as SelectOption<Value>, pick),
    }),
  };
};
