import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PALETTE_TOKENS } from '@financas/reference';
import { describe, expect, it } from 'vitest';

// The theme is CSS, so its contract is checked on the source file itself:
// the two themes stay in step, every token reaches Tailwind, and text stays
// readable (NFR-UX-2: ≥ 4.5:1 in both themes).

const css = readFileSync(resolve(import.meta.dirname, '../../../src/styles/theme.css'), 'utf8');

const MIN_TEXT_CONTRAST = 4.5;
const TEXT_TOKENS = ['ink', 'muted', 'mint', 'coral', 'sky', 'sun', 'lilac', 'peach'];
const TEXT_SURFACES = ['bg', 'card', 'raised'];
const FILLED_PAIRS = [
  ['onmint', 'mint'],
  ['onmint2', 'mint'],
  ['oncoral', 'coral'],
  ['onsky', 'sky'],
  ['mint', 'mintdeep'],
  ['coral', 'coraldeep'],
];

/**
 * Reads the `--c-*` hex values declared inside one selector's block.
 *
 * @param selector - The block's selector exactly as written in theme.css.
 * @returns Token name (without `--c-`) → hex value.
 */
const tokensOf = (selector: string): Record<string, string> => {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  const matches = block.matchAll(/--c-([a-z0-9-]+):\s*(#[0-9A-F]{6});/gi);

  return Object.fromEntries([...matches].map(([, name, hex]) => [name, hex]));
};

/**
 * WCAG relative luminance of a `#RRGGBB` colour.
 *
 * @param hex - The colour.
 * @returns Luminance between 0 (black) and 1 (white).
 */
const luminance = (hex: string): number => {
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

/**
 * WCAG contrast ratio between two colours.
 *
 * @param first - One colour.
 * @param second - The other colour.
 * @returns The ratio, from 1 to 21.
 */
const contrast = (first: string, second: string): number => {
  const [lighter, darker] = [luminance(first), luminance(second)]
    .sort((left, right) => right - left);
  return (lighter! + 0.05) / (darker! + 0.05);
};

/**
 * Lists the category palette tokens a theme declares, without `cat-`.
 *
 * @param tokens - One theme's tokens.
 * @returns The palette token names, in declaration order.
 */
const categoryTokens = (tokens: Record<string, string>) => Object.keys(tokens)
  .filter((name) => name.startsWith('cat-'))
  .map((name) => name.slice('cat-'.length));

const themes = { dark: tokensOf(':root'), light: tokensOf("[data-theme='light']") };

describe('theme.css tokens', () => {
  it('declares the same tokens in the dark and the light theme', () => {
    expect(Object.keys(themes.light)).toEqual(Object.keys(themes.dark));
    expect(Object.keys(themes.dark)).toHaveLength(21 + PALETTE_TOKENS.length);
  });

  it('declares exactly the 18 category palette tokens', () => {
    expect(categoryTokens(themes.dark)).toEqual([...PALETTE_TOKENS]);
  });

  it('maps every token to a Tailwind colour read at runtime', () => {
    Object.keys(themes.dark).forEach((name) => {
      expect(css).toContain(`--color-${name}: var(--c-${name});`);
    });
  });

  it('removes Tailwind\'s default palette so only tokens are utilities', () => {
    expect(css).toContain('--color-*: initial;');
  });
});

describe.each(Object.entries(themes))('%s theme contrast', (_, tokens) => {
  const textCases = TEXT_TOKENS.flatMap((text) => TEXT_SURFACES.map((surface) => [text, surface]));

  it.each(textCases)('%s text on %s reaches 4.5:1', (text, surface) => {
    expect(contrast(tokens[text]!, tokens[surface]!)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each(FILLED_PAIRS)('%s on a %s fill reaches 4.5:1', (text, fill) => {
    expect(contrast(tokens[text]!, tokens[fill]!)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it.each([...PALETTE_TOKENS])('category %s on card reaches 4.5:1', (token) => {
    const ratio = contrast(tokens[`cat-${token}`]!, tokens.card!);
    expect(ratio).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });
});
