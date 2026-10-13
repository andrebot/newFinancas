import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { compile } from 'tailwindcss';
import {
  beforeAll, describe, expect, it,
} from 'vitest';

// Typography is CSS, so its contract is checked on what Tailwind actually
// generates from the real stylesheet: the 14 roles exist with the approved
// sizes, the default scale and families are gone, and the fonts are local.

const requireFrom = createRequire(import.meta.url);
const entry = resolve(import.meta.dirname, '../../../src/styles/theme.css');

const ROOT_FONT_PX = 16;
const MIN_FONT_PX = 10;

// Role → [family, font size in px, line height in px], the approved scale.
const ROLES: Record<string, ['display' | 'sans', number, number]> = {
  'display-xl': ['display', 40, 44],
  'display-lg': ['display', 34, 40],
  'display-md': ['display', 30, 36],
  'display-sm': ['display', 26, 32],
  'display-xs': ['display', 22, 28],
  'heading-lg': ['display', 24, 32],
  'heading-md': ['display', 20, 28],
  'heading-sm': ['display', 18, 26],
  'body-lg': ['sans', 15, 22],
  body: ['sans', 14, 20],
  'body-sm': ['sans', 13, 18],
  caption: ['sans', 12, 16],
  label: ['sans', 11, 14],
  micro: ['sans', 10, 12],
};

type Build = (candidates: string[]) => string;

/**
 * Loads a stylesheet Tailwind meets in an `@import`: relative paths from
 * the importing file, packages through Node resolution.
 *
 * @param id - The import as written (`./typography.css`, `tailwindcss`).
 * @param base - The importing file's directory.
 * @returns The resolved file's path, directory and content.
 */
const loadStylesheet = async (id: string, base: string) => {
  const request = id === 'tailwindcss' ? 'tailwindcss/index.css' : id;
  const path = id.startsWith('.')
    ? resolve(base, id)
    : requireFrom.resolve(request, { paths: [base] });

  return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
};

/**
 * Compiles the app's stylesheet with Tailwind, as the Vite plugin does.
 *
 * @returns A function generating the CSS for a set of class names.
 */
const compileStylesheet = async (): Promise<Build> => {
  const compiler = await compile(readFileSync(entry, 'utf8'), {
    base: dirname(entry),
    loadStylesheet,
  });

  return (candidates) => compiler.build(candidates);
};

/**
 * Reads the declarations of one rule in generated CSS. When the selector
 * appears more than once (preflight also styles `body`), the last rule —
 * the one that wins — is read.
 *
 * @param css - The generated CSS.
 * @param selector - The rule's selector, e.g. `.type-body`.
 * @returns Property → value, empty when the rule is absent.
 */
const declarationsOf = (css: string, selector: string): Record<string, string> => {
  const start = css.lastIndexOf(`${selector} {`);
  if (start === -1) return {};

  const block = css.slice(start, css.indexOf('}', start));
  const matches = block.matchAll(/([a-z-]+):\s*([^;]+);/g);

  return Object.fromEntries([...matches].map(([, property, value]) => [property, value]));
};

/**
 * Converts a `rem` length to pixels at the browser's default root size.
 *
 * @param length - A length such as `0.875rem`.
 * @returns The length in pixels.
 */
const remToPx = (length: string): number => Number.parseFloat(length) * ROOT_FONT_PX;

let build: Build;

beforeAll(async () => {
  build = await compileStylesheet();
});

describe('typography roles', () => {
  it.each(Object.entries(ROLES))('type-%s has its family, size and line height', (role, spec) => {
    const [family, sizePx, lineHeightPx] = spec;
    const declarations = declarationsOf(build([`type-${role}`]), `.type-${role}`);

    expect(declarations['font-family']).toBe(`var(--font-${family})`);
    expect(remToPx(declarations['font-size']!)).toBe(sizePx);
    expect(remToPx(declarations['line-height']!)).toBe(lineHeightPx);
  });

  it(`keeps every role at ${MIN_FONT_PX}px or larger`, () => {
    const sizes = Object.values(ROLES).map(([, sizePx]) => sizePx);

    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(MIN_FONT_PX);
  });

  it('sets display text in extra bold and headings in bold', () => {
    const weightOf = (role: string) => (
      declarationsOf(build([`type-${role}`]), `.type-${role}`)['font-weight']
    );

    expect(weightOf('display-lg')).toBe('800');
    expect(weightOf('heading-sm')).toBe('700');
    expect(weightOf('body')).toBeUndefined();
  });

  it('sets labels uppercase and widely tracked', () => {
    const declarations = declarationsOf(build(['type-label']), '.type-label');

    expect(declarations['text-transform']).toBe('uppercase');
    expect(declarations['letter-spacing']).toBe('0.05em');
  });

  it('lets a weight utility override a role', () => {
    const css = build(['font-bold', 'type-label']);

    expect(css.indexOf('.font-bold {')).toBeGreaterThan(css.indexOf('.type-label {'));
  });
});

describe('typography tokens', () => {
  it.each(['text-xs', 'text-sm', 'text-lg', 'text-2xl', 'font-serif'])(
    'removes Tailwind\'s default %s',
    (candidate) => {
      expect(build([candidate])).not.toContain(`.${candidate} {`);
    },
  );

  it.each([
    ['font-sans', "'Inter Variable'"],
    ['font-display', "'Manrope Variable'"],
    ['font-mono', 'ui-monospace'],
  ])('maps %s to %s', (candidate, firstFamily) => {
    const css = build([candidate]);
    const variable = candidate.replace('font-', '--font-');

    expect(css).toContain(`.${candidate} {`);
    expect(css).toMatch(new RegExp(`${variable}: ${firstFamily},`));
  });

  it('keeps tabular figures available as a utility', () => {
    expect(build(['tabular-nums'])).toContain('.tabular-nums {');
  });
});

describe('typography fonts', () => {
  it.each(['Manrope Variable', 'Inter Variable'])('self-hosts %s', (family) => {
    expect(build([])).toContain(`font-family: '${family}';`);
  });

  it('never loads a font from another origin', () => {
    const sources = build([]).match(/url\([^)]*\)/g) ?? [];

    expect(sources.length).toBeGreaterThan(0);
    sources.forEach((source) => expect(source).not.toMatch(/url\(["']?(https?:)?\/\//));
  });

  it('starts the page in body text', () => {
    const declarations = declarationsOf(build([]), 'body');

    expect(remToPx(declarations['font-size']!)).toBe(ROLES.body![1]);
    expect(remToPx(declarations['line-height']!)).toBe(ROLES.body![2]);
  });
});
