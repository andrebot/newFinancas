import { useId, type CSSProperties } from 'react';
import { PALETTE_TOKENS, type PaletteToken } from '@financas/reference';
import { categoryColor } from '../../utilities/theme';

// The kit's colour swatch picker (K19, OQ-186): the category form's colour
// choice (mockup 41). Every palette colour shows at once, in palette order,
// as a radio group of visually hidden native radios, so the browser supplies
// arrow keys and the radio semantics. Each swatch is filled inline from
// ThemeUtility, so a new palette colour needs no kit change. It holds no
// state, and the caller translates every name.

/** The colour swatch picker's props. */
export interface ColorSwatchPickerProps {
  /** The group's accessible name, already translated, e.g. "Colour". */
  readonly label: string;
  /** The selected palette colour. */
  readonly value: PaletteToken;
  /** Told the colour the user picks. */
  readonly onChange: (color: PaletteToken) => void;
  /** A colour's accessible name, already translated (the `paletteColors` catalog section). */
  readonly colorLabel: (color: PaletteToken) => string;
}

/**
 * A swatch's classes: a 26px disc; the selected one gets the mockup's double
 * ring — a gap in the card's colour, then the swatch's own colour — from
 * `has-checked`. The keyboard ring sits outside it.
 */
export const SWATCH = [
  'block size-6.5 cursor-pointer rounded-full transition-shadow duration-150',
  'has-checked:ring-2 has-checked:ring-current',
  'has-checked:ring-offset-2 has-checked:ring-offset-card',
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-mint',
].join(' ');

/**
 * Builds a swatch's colours: the fill, and `color` so the ring takes it too.
 *
 * @param color - The palette token.
 * @returns The swatch's inline style.
 */
export const swatchStyle = (color: PaletteToken): CSSProperties => ({
  color: categoryColor(color),
  backgroundColor: categoryColor(color),
});

/**
 * Renders every palette colour as a swatch. It holds no state: the caller
 * passes the selected colour and gets the new one through `onChange`.
 *
 * @param props - The label, the selected colour, the change handler and the namer.
 * @returns The group of swatches.
 */
export function ColorSwatchPicker({
  label, value, onChange, colorLabel,
}: ColorSwatchPickerProps) {
  const name = useId();

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2.5">
      {PALETTE_TOKENS.map((color) => (
        <label
          key={color}
          htmlFor={`${name}-${color}`}
          className={SWATCH}
          style={swatchStyle(color)}
        >
          <input
            id={`${name}-${color}`}
            type="radio"
            className="sr-only"
            name={name}
            value={color}
            aria-label={colorLabel(color)}
            checked={color === value}
            onChange={() => onChange(color)}
          />
        </label>
      ))}
    </div>
  );
}
