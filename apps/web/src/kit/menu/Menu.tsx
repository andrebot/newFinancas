import {
  FloatingFocusManager, FloatingPortal, type Placement,
} from '@floating-ui/react';
import type { ReactNode } from 'react';
import { OVERLAY_SURFACE } from '../popover/overlay';
import type { MenuEntry } from './entries';
import { MenuSections } from './MenuRows';
import { useMenuList } from './useMenuList';

// The kit's menu (K23, OQ-140): a list of choices that opens from a button —
// a member's role (mockup 60) or a row's actions. It mixes commands, radio
// groups and separators. It opens on a click, Enter, Space or the arrow keys,
// starting on the current choice; Esc, a click outside or tabbing away closes
// it and focus goes back to the trigger. It renders in a portal, so a card or
// drawer with hidden overflow never clips it.

export type {
  MenuAction, MenuEntry, MenuRadioGroup, MenuRadioOption, MenuSeparator,
} from './entries';

/** What the trigger must spread on its button: the ref and the ARIA / click props. */
export type MenuTriggerProps = Record<string, unknown> & {
  readonly ref: (node: Element | null) => void;
};

/** The menu's props. */
export interface MenuProps<Value extends string> {
  /** Draws the button that opens the menu (a `MenuPill`, an `IconButton`), spreading its props. */
  readonly trigger: (props: MenuTriggerProps) => ReactNode;
  /** The menu's accessible name, already translated, e.g. "Sam Costa's role". */
  readonly label: string;
  /** Actions, radio groups and separators, in display order. */
  readonly entries: readonly MenuEntry<Value>[];
  /** Where the panel sits relative to the trigger; it flips when out of room. */
  readonly placement?: Placement | undefined;
  /** The panel's width in px; the viewport still caps it. Content width when absent. */
  readonly width?: number | undefined;
}

/**
 * Renders a trigger and, while open, its floating menu. The open state lives
 * here; the caller holds any radio group's value and gets each pick.
 *
 * @param props - The trigger, label, entries, placement and width.
 * @returns The trigger, plus the menu in a portal while open.
 */
export function Menu<Value extends string>({
  trigger, label, entries, placement = 'bottom-end', width,
}: MenuProps<Value>) {
  const menu = useMenuList({ entries, placement });
  const { style, ...panelProps } = menu.panelProps;

  return (
    <>
      {trigger(menu.triggerProps)}
      {menu.open && (
        <FloatingPortal>
          <FloatingFocusManager context={menu.context} modal={false} initialFocus={0}>
            <div
              {...panelProps}
              aria-label={label}
              className={`flex flex-col p-1.5 ${OVERLAY_SURFACE}`}
              style={{ ...style, width }}
            >
              <MenuSections
                sections={menu.sections}
                activeIndex={menu.activeIndex}
                itemPropsOf={menu.itemPropsOf}
              />
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}
