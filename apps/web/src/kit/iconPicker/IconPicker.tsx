import { useId } from 'react';
import { CATEGORY_ICONS, type CategoryIcon } from '@financas/reference';
import { iconPicker } from '../../config/constants';
import FOCUS_RING from '../focusRing';
import { Icon } from '../icons/Icon';
import { Popover, type PopoverTriggerProps } from '../popover/Popover';

// The kit's icon picker (K18, OQ-185): the category form's icon choice
// (mockup 41). A row of quick picks is a radio group of visually hidden
// native radios, so the browser supplies arrow keys and the radio semantics;
// the selected icon always shows there, in front of the quick picks when it
// isn't one of them. "More icons" opens a popover with every category icon:
// each is a button that picks the icon and closes the panel. It holds no
// state, and the caller translates every name.

/** The icon picker's props. */
export interface IconPickerProps {
  /** The group's accessible name, already translated, e.g. "Icon". */
  readonly label: string;
  /** The "More icons" button's name, also the panel's, already translated. */
  readonly moreLabel: string;
  /** The selected icon. */
  readonly value: CategoryIcon;
  /** Told the icon the user picks. */
  readonly onChange: (icon: CategoryIcon) => void;
  /** An icon's accessible name, already translated (the `categoryIcons` catalog section). */
  readonly iconLabel: (icon: CategoryIcon) => string;
}

const TILE = [
  'grid size-9 cursor-pointer place-items-center rounded-xl border border-line text-muted',
  'transition-colors duration-150 hover:text-ink',
].join(' ');

/** A row tile's classes: the selected look comes from `has-checked`. */
export const ROW_TILE = [
  TILE,
  'has-checked:border-mint/60 has-checked:bg-mintdeep has-checked:text-mint',
  FOCUS_RING,
].join(' ');

/** A panel tile's classes: the selected look comes from `aria-pressed`. */
export const PANEL_TILE = [
  TILE,
  'aria-pressed:border-mint/60 aria-pressed:bg-mintdeep aria-pressed:text-mint',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint',
].join(' ');

/**
 * Lists the row's icons: the quick picks, or — when the selected icon isn't
 * one of them — the selected icon followed by all but the last, so the row
 * keeps its length.
 *
 * @param value - The selected icon.
 * @param quickIcons - The icons always offered.
 * @returns The icons the row shows, in order.
 */
export const rowIcons = (
  value: CategoryIcon,
  quickIcons: readonly CategoryIcon[] = iconPicker.quickIcons,
): readonly CategoryIcon[] => (
  quickIcons.includes(value) ? quickIcons : [value, ...quickIcons.slice(0, -1)]
);

/**
 * Builds the "More icons" trigger for the popover.
 *
 * @param moreLabel - The button's accessible name.
 * @returns A function drawing the button with the popover's props spread on it.
 */
export const moreButton = (moreLabel: string) => function MoreButton(
  props: PopoverTriggerProps,
) {
  return (
    <button type="button" aria-label={moreLabel} className={PANEL_TILE} {...props}>
      <Icon name="more-horiz" className="size-4.5" />
    </button>
  );
};

/**
 * Renders the panel's grid of every category icon.
 *
 * @param props - The selected icon, the change handler, the namer and `close`.
 * @returns The grid of icon buttons.
 */
export function IconGrid({
  value, onChange, iconLabel, close,
}: Pick<IconPickerProps, 'value' | 'onChange' | 'iconLabel'> & { readonly close: () => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 p-3">
      {CATEGORY_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          aria-label={iconLabel(icon)}
          aria-pressed={icon === value}
          className={PANEL_TILE}
          onClick={() => {
            onChange(icon);
            close();
          }}
        >
          <Icon name={icon} className="size-4.5" />
        </button>
      ))}
    </div>
  );
}

/**
 * Renders the quick-pick row and the "More icons" popover. It holds no state:
 * the caller passes the selected icon and gets the new one through `onChange`.
 *
 * @param props - The labels, the selected icon, the change handler and the namer.
 * @returns The row of icons.
 */
export function IconPicker({
  label, moreLabel, value, onChange, iconLabel,
}: IconPickerProps) {
  const name = useId();

  return (
    <div className="flex flex-wrap gap-1.5">
      <div role="radiogroup" aria-label={label} className="contents">
        {rowIcons(value).map((icon) => (
          <label key={icon} htmlFor={`${name}-${icon}`} className={ROW_TILE}>
            <input
              id={`${name}-${icon}`}
              type="radio"
              className="sr-only"
              name={name}
              value={icon}
              aria-label={iconLabel(icon)}
              checked={icon === value}
              onChange={() => onChange(icon)}
            />
            <Icon name={icon} className="size-4.5" />
          </label>
        ))}
      </div>
      <Popover
        label={moreLabel}
        placement="bottom-start"
        width={iconPicker.panelWidth}
        trigger={moreButton(moreLabel)}
      >
        {(close) => (
          <IconGrid value={value} onChange={onChange} iconLabel={iconLabel} close={close} />
        )}
      </Popover>
    </div>
  );
}
