import { fireEvent, render, screen } from '@testing-library/react';
import { catalogs, SUPPORTED_LOCALES } from '@financas/i18n';
import { PALETTE_TOKENS, type PaletteToken } from '@financas/reference';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  ColorSwatchPicker,
  SWATCH,
  swatchStyle,
  type ColorSwatchPickerProps,
} from '../../../../src/kit/colorSwatchPicker/ColorSwatchPicker';

// Kit component (BDT: Interaction tier → unit): only the caller's handlers
// are stand-ins.

const names = catalogs['en-US'].paletteColors;

/**
 * Names a colour as the en-US catalog does.
 *
 * @param color - The palette token.
 * @returns Its English name.
 */
const colorLabel = (color: PaletteToken) => names[color];

/**
 * Renders the picker with test labels and the given overrides.
 *
 * @param overrides - Props replacing the defaults.
 * @returns The change handler the picker reports to.
 */
const renderPicker = (overrides: Partial<ColorSwatchPickerProps> = {}) => {
  const onChange = vi.fn();
  render(
    <ColorSwatchPicker
      label="Colour"
      value="lilac"
      onChange={onChange}
      colorLabel={colorLabel}
      {...overrides}
    />,
  );
  return onChange;
};

describe('the paletteColors catalog section', () => {
  it.each(SUPPORTED_LOCALES)('names every palette colour, in palette order, in %s', (locale) => {
    expect(Object.keys(catalogs[locale].paletteColors)).toEqual([...PALETTE_TOKENS]);
  });
});

describe('SWATCH', () => {
  it('draws the mockup’s 26px disc', () => {
    expect(SWATCH).toContain('block size-6.5 cursor-pointer rounded-full');
  });

  it('rings the selected swatch in its own colour, off the card', () => {
    expect(SWATCH).toContain('has-checked:ring-2 has-checked:ring-current');
    expect(SWATCH).toContain('has-checked:ring-offset-2 has-checked:ring-offset-card');
  });

  it('puts the keyboard ring outside the selection ring', () => {
    expect(SWATCH).toContain('has-focus-visible:outline-offset-4 has-focus-visible:outline-mint');
  });
});

describe('swatchStyle', () => {
  it('fills the swatch and colours its ring from the palette variable', () => {
    expect(swatchStyle('teal')).toEqual({
      color: 'var(--c-cat-teal)',
      backgroundColor: 'var(--c-cat-teal)',
    });
  });
});

describe('ColorSwatchPicker', () => {
  it('draws a named radio group of every palette colour, in palette order', () => {
    renderPicker();

    expect(screen.getByRole('radiogroup', { name: 'Colour' })).toBeTruthy();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([...PALETTE_TOKENS]);
  });

  it('checks the selected colour only', () => {
    renderPicker();

    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Lilac' }).checked).toBe(true);
    expect(screen.getAllByRole<HTMLInputElement>('radio').filter((radio) => radio.checked))
      .toHaveLength(1);
  });

  it('fills each swatch with its own colour', () => {
    renderPicker();

    const swatch = screen.getByRole('radio', { name: 'Coral' }).parentElement!;
    expect(swatch.getAttribute('style')).toContain('var(--c-cat-coral)');
  });

  it('reports a colour the user picks', () => {
    const onChange = renderPicker();

    fireEvent.click(screen.getByRole('radio', { name: 'Sky' }));

    expect(onChange).toHaveBeenCalledWith('sky');
  });
});
