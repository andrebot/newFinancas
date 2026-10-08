import {
  isPluralElement, isSelectElement, isTagElement, parse, TYPE, type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';
import { describe, expect, it } from 'vitest';
import { catalogs, SUPPORTED_LOCALES, type Catalog } from '../../src';

const NAMED_TYPES = new Set([
  TYPE.argument, TYPE.number, TYPE.date, TYPE.time, TYPE.select, TYPE.plural,
]);

/**
 * Collects the argument names an ICU message uses, including inside select/plural branches.
 *
 * @param elements - A parsed ICU message.
 * @returns The sorted, de-duplicated argument names.
 */
const argumentsOf = (elements: MessageFormatElement[]): string[] => {
  const names = elements.flatMap((element): string[] => {
    const own = NAMED_TYPES.has(element.type) ? [(element as { value: string }).value] : [];
    if (isSelectElement(element) || isPluralElement(element)) {
      const branches = Object.values(element.options)
        .flatMap((option) => argumentsOf(option.value));
      return [...own, ...branches];
    }
    return isTagElement(element) ? argumentsOf(element.children) : own;
  });
  return [...new Set(names)].sort();
};

/**
 * Lists every `[section, key, message]` entry of a catalog.
 *
 * @param catalog - The catalog to walk.
 * @returns One row per message.
 */
const entriesOf = (catalog: Catalog): [string, string, string][] => (
  Object.entries(catalog).flatMap(([section, messages]) => (
    Object.entries(messages as Record<string, string>).map(
      ([key, message]): [string, string, string] => [section, key, message],
    )
  ))
);

const primary = catalogs['pt-BR'];

describe.each(SUPPORTED_LOCALES)('catalog %s', (locale) => {
  const catalog = catalogs[locale];

  it('has exactly the sections and keys of the primary (pt-BR) catalog', () => {
    const keysOf = (c: Catalog) => entriesOf(c).map(([section, key]) => `${section}:${key}`).sort();

    expect(keysOf(catalog)).toEqual(keysOf(primary));
  });

  it.each(entriesOf(catalog))('%s › %s is a valid ICU message', (_section, _key, message) => {
    expect(message.trim()).not.toBe('');
    expect(() => parse(message)).not.toThrow();
  });

  it.each(entriesOf(catalog))('%s › %s has the arguments of pt-BR', (section, key, message) => {
    const primaryMessage = (primary as Record<string, Record<string, string>>)[section]![key]!;

    expect(argumentsOf(parse(message))).toEqual(argumentsOf(parse(primaryMessage)));
  });
});

describe('catalog contents', () => {
  it('covers every notification type in the API contract, plus a fallback', () => {
    expect(Object.keys(primary.notifications).sort())
      .toEqual(['fallback', 'holding.matured', 'invitation.received']);
  });

  it('has a subject and a body for every email', () => {
    const keys = Object.keys(primary.emails);
    const types = new Set(keys.map((key) => key.replace(/\.(subject|body)$/, '')));

    types.forEach((type) => {
      expect(keys).toEqual(expect.arrayContaining([`${type}.subject`, `${type}.body`]));
    });
  });

  it('has fallbacks for unknown error codes and notification types', () => {
    expect(primary.errors.fallback).toBeTruthy();
    expect(primary.notifications.fallback).toBeTruthy();
  });
});

describe('argumentsOf', () => {
  it('finds arguments in plain, formatted, select, plural and tag elements', () => {
    const message = '{a} {b, number} {c, select, x {{d}} other {}} '
      + '{e, plural, one {#} other {{f}}} <b>{g}</b>';

    expect(argumentsOf(parse(message))).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  });
});
