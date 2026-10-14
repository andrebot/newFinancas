import { useId, type ReactNode } from 'react';
import FOCUS_RING from '../focusRing';
import { Icon, type IconName } from '../icons/Icon';

// The kit's option cards (K14, OQ-129): pick one value out of a few when each
// choice needs a description or a picture — the MFA method, the account type,
// the theme. Like the segmented control (K13), each card is a visually hidden
// native radio inside its label, so the browser supplies arrow-key movement,
// focus and the radio semantics; the selected look comes from `has-checked`.

/** One card: its value, its translated texts and optional pictures. */
export interface OptionCard<Value extends string> {
  readonly value: Value;
  /** The card's title, already translated. */
  readonly label: string;
  /** A line under the title, already translated. */
  readonly description?: string | undefined;
  readonly icon?: IconName | undefined;
  /**
   * A picture drawn by the caller above the title, in tiles only (e.g. the
   * theme thumbnails). It is decoration: the label names the card.
   */
  readonly preview?: ReactNode;
}

/** Stacked rows with a radio dot, or equal-width tiles. */
export type OptionCardLayout = 'list' | 'tiles';

/** The option card group's props. */
export interface OptionCardGroupProps<Value extends string> {
  /** The group's accessible name, already translated. */
  readonly label: string;
  readonly options: readonly OptionCard<Value>[];
  readonly value: Value;
  readonly onChange: (value: Value) => void;
  /** `list` by default. */
  readonly layout?: OptionCardLayout | undefined;
}

const CARD = [
  'group flex cursor-pointer gap-3 rounded-2xl border border-line text-left',
  'transition-[border-color,background-color,box-shadow] duration-150 hover:border-faint',
  'has-checked:border-mint/60 has-checked:bg-mint/6 has-checked:ring-3 has-checked:ring-mint/12',
  FOCUS_RING,
];

/** The classes for the group and each card, per layout. */
export const OPTION_CARD_STYLES: Readonly<Record<OptionCardLayout, {
  readonly group: string;
  readonly card: string;
}>> = {
  list: {
    group: 'flex flex-col gap-3',
    card: [...CARD, 'items-start p-4'].join(' '),
  },
  tiles: {
    group: 'grid grid-cols-2 gap-3 sm:grid-flow-col sm:grid-cols-none sm:auto-cols-fr',
    card: [...CARD, 'flex-col gap-1.5 p-3.5'].join(' '),
  },
};

/** What a card's content needs: the card and the ids its texts carry. */
interface ContentProps<Value extends string> {
  readonly option: OptionCard<Value>;
  /** The base for the title's (`-label`) and description's (`-description`) ids. */
  readonly id: string;
}

/**
 * Draws a list row's content: the icon chip, the texts and the radio dot.
 *
 * @param props - The card to draw and the base of its texts' ids.
 * @returns The row's content.
 */
function ListContent<Value extends string>({ option, id }: ContentProps<Value>) {
  return (
    <>
      {option.icon && (
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-mint/15 text-mint">
          <Icon name={option.icon} className="size-5.5" />
        </span>
      )}
      <span className="flex flex-1 flex-col gap-0.5">
        <span id={`${id}-label`} className="type-body font-semibold">{option.label}</span>
        {option.description && (
          <span id={`${id}-description`} className="type-body-sm text-muted">
            {option.description}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={[
          'mt-1 size-5 shrink-0 rounded-full border-2 border-faint',
          'group-has-checked:border-6 group-has-checked:border-mint',
        ].join(' ')}
      />
    </>
  );
}

/**
 * Draws a tile's content. With a preview, the preview sits on top and the
 * icon goes before the title; without one, the icon sits on top.
 *
 * @param props - The card to draw and the base of its texts' ids.
 * @returns The tile's content.
 */
function TileContent<Value extends string>({ option, id }: ContentProps<Value>) {
  const hasPreview = option.preview !== undefined;
  const icon = option.icon && (
    <Icon
      name={option.icon}
      className={`${hasPreview ? 'size-4' : 'size-5.5'} text-muted group-has-checked:text-mint`}
    />
  );

  return (
    <>
      {hasPreview && <span aria-hidden="true" className="block">{option.preview}</span>}
      {!hasPreview && icon}
      <span className="flex items-center gap-1.5 type-body-sm font-semibold">
        {hasPreview && icon}
        <span id={`${id}-label`}>{option.label}</span>
      </span>
      {option.description && (
        <span id={`${id}-description`} className="type-caption text-faint">
          {option.description}
        </span>
      )}
    </>
  );
}

/**
 * Renders a single-choice group of option cards. It holds no state: the
 * caller passes the selected value and gets the new one through `onChange`.
 *
 * @param props - The group's label, options, selected value, change handler
 *   and layout.
 * @returns The radio group.
 */
export function OptionCardGroup<Value extends string>({
  label, options, value, onChange, layout = 'list',
}: OptionCardGroupProps<Value>) {
  const name = useId();
  const style = OPTION_CARD_STYLES[layout];
  const Content = layout === 'list' ? ListContent : TileContent;

  return (
    <div role="radiogroup" aria-label={label} className={style.group}>
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        return (
          <label key={option.value} htmlFor={id} className={style.card}>
            <input
              id={id}
              type="radio"
              aria-labelledby={`${id}-label`}
              aria-describedby={option.description ? `${id}-description` : undefined}
              className="sr-only"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <Content option={option} id={id} />
          </label>
        );
      })}
    </div>
  );
}
