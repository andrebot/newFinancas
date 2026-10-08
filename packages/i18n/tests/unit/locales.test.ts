import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, isSupportedLocale, SUPPORTED_LOCALES } from '../../src';

describe('isSupportedLocale', () => {
  it.each(SUPPORTED_LOCALES)('accepts %s', (locale) => {
    expect(isSupportedLocale(locale)).toBe(true);
  });

  it.each(['pt', 'en', 'es-ES', 'pt-br', ''])('rejects %j', (value) => {
    expect(isSupportedLocale(value)).toBe(false);
  });

  it('has a supported default locale', () => {
    expect(isSupportedLocale(DEFAULT_LOCALE)).toBe(true);
  });
});
