import { useId } from 'react';
import { Icon, type IconName } from '../icons/Icon';

// The kit's segmented control (K13, OQ-127): pick one value out of a few,
// always visible — the $ / R$ switch, goal status, the Record drawer's kind
// groups. Each segment is a visually hidden native radio inside its label, so
// the browser supplies arrow-key movement, focus and the radio semantics; the
// selected look comes from `has-checked`, not from JavaScript.

/** One segment: its value, its translated text and optional extras. */
export interface SegmentedOption<Value extends string> {
  readonly value: Value;
  /** Visible text, already translated. */
  readonly label: string;
  readonly icon?: IconName | undefined;
  /** A small count after the text (e.g. how many goals are active). */
  readonly count?: number | undefined;
}

/** Pills in a track (`md`, `sm`, `xs`), or full-width tiles with the icon on top. */
export type SegmentedLayout = | { readonly layout?: 'pills'; readonly size?: 'md' | 'sm' | 'xs' }
  | { readonly layout: 'tiles' };

/** The segmented control's props. */
export type SegmentedControlProps<Value extends string> = SegmentedLayout & {
  /** The group's accessible name, already translated. */
  readonly label: string;
  readonly options: readonly SegmentedOption<Value>[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
};

interface SegmentStyle {
  readonly group: string;
  readonly segment: string;
  readonly icon: string;
}

const FOCUS = [
  'has-focus-visible:outline-2',
  'has-focus-visible:outline-offset-2',
  'has-focus-visible:outline-mint',
];
const SEGMENT = [
  'cursor-pointer font-medium text-muted transition-colors duration-150 hover:text-ink',
  'has-checked:bg-mintdeep has-checked:font-semibold has-checked:text-mint',
  ...FOCUS,
];
const PILL_GROUP = 'inline-flex gap-1 rounded-full border border-line bg-card p-1';

/**
 * Builds the classes of a pill-shaped segment.
 *
 * @param sizing - The height, padding and type role of the pill's size.
 * @returns The segment's classes.
 */
const pill = (sizing: string) => (
  ['inline-flex items-center gap-1.5 rounded-full', sizing, ...SEGMENT].join(' ')
);

const STYLES: Readonly<Record<'md' | 'sm' | 'xs' | 'tiles', SegmentStyle>> = {
  md: { group: PILL_GROUP, segment: pill('h-9 px-4 type-body'), icon: 'size-4.5' },
  sm: { group: PILL_GROUP, segment: pill('h-7.5 px-3 type-body-sm'), icon: 'size-4' },
  xs: { group: PILL_GROUP, segment: pill('h-6.5 px-2.5 type-caption'), icon: 'size-3.5' },
  tiles: {
    group: 'grid auto-cols-fr grid-flow-col gap-2',
    segment: [
      'flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-line',
      'type-caption has-checked:border-mint/60',
      ...SEGMENT,
    ].join(' '),
    icon: 'size-5.5',
  },
};

/**
 * Picks the classes for a layout.
 *
 * @param layout - The layout props: tiles, or pills of a size (`md` by default).
 * @returns The classes for the group, each segment and each segment's icon.
 */
export function segmentStyle(layout: SegmentedLayout): SegmentStyle {
  if (layout.layout === 'tiles') {
    return STYLES.tiles;
  }
  return STYLES[layout.size ?? 'md'];
}

/**
 * Renders a single-choice group of segments. It holds no state: the caller
 * passes the selected value and gets the new one through `onChange`.
 *
 * @param props - The group's label, options, selected value, change handler
 *   and layout.
 * @returns The radio group.
 */
export function SegmentedControl<Value extends string>(props: SegmentedControlProps<Value>) {
  const {
    label, options, value, onChange,
  } = props;
  const name = useId();
  const style = segmentStyle(props);

  return (
    <div role="radiogroup" aria-label={label} className={style.group}>
      {options.map((option) => (
        <label key={option.value} htmlFor={`${name}-${option.value}`} className={style.segment}>
          <input
            id={`${name}-${option.value}`}
            type="radio"
            className="sr-only"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.icon && <Icon name={option.icon} className={style.icon} />}
          {option.label}
          {option.count !== undefined && (
            <span className="type-caption opacity-70">{option.count}</span>
          )}
        </label>
      ))}
    </div>
  );
}
