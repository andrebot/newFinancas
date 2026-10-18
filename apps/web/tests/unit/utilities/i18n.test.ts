import { catalogs, DEFAULT_LOCALE, type Catalog } from '@financas/i18n';
import { captureLogs } from '@financas/logging/browser';
import {
  afterEach, beforeEach, describe, expect, it,
} from 'vitest';
import { i18n } from '../../../src/config/constants';
import {
  browserLocaleEnvironment,
  createLocaleController,
  createTranslator,
  formatMessage,
  matchLocale,
  type LocaleEnvironment,
} from '../../../src/utilities/i18n';
import type { PreferenceStorage } from '../../../src/utilities/safeStorage';

// I18nUtility (BDT: Utility → unit). Mocked: only what it touches outside —
// the catalog it is given and storage. The logger is read with captureLogs;
// <html> is jsdom's own.

let capture: ReturnType<typeof captureLogs>;

beforeEach(() => {
  capture = captureLogs();
});

afterEach(() => capture.stop());

describe('formatMessage', () => {
  it('applies the locale’s plural rules and number format', () => {
    const message = '{count, plural, one {# item} other {# items}} · {total, number}';

    expect(formatMessage(message, 'en-US', { count: 1, total: 1234.5 })).toBe('1 item · 1,234.5');
    expect(formatMessage(message, 'pt-BR', { count: 2, total: 1234.5 })).toBe('2 items · 1.234,5');
  });

  it('returns null when an argument is missing or the message is malformed', () => {
    expect(formatMessage('{name} joined', 'en-US')).toBeNull();
    expect(formatMessage('{broken', 'en-US', {})).toBeNull();
  });
});

describe('createTranslator', () => {
  it('renders copy by section and key, with ICU plurals, per locale', () => {
    expect(createTranslator('pt-BR').text('passwordStrength', 'minimum', { min: 12 }))
      .toBe('pelo menos 12 caracteres');
    expect(createTranslator('en-US').text('passwordStrength', 'minimum', { min: 1 }))
      .toBe('at least 1 character');
    expect(createTranslator('pt-BR').text('passwordStrength', 'level.weak')).toBe('Fraca');
  });

  it('renders an API error code with its parameters', () => {
    const translator = createTranslator('pt-BR');

    expect(translator.error('auth.too_many_attempts', { retryAfterMinutes: 1 }))
      .toBe('Muitas tentativas de entrar. Tente de novo em 1 minuto.');
    expect(translator.error('goal.allocation_exceeds_100', { current: 80, requested: 130 }))
      .toBe('Estas alocações somam 130%; um investimento pode ter no máximo 100% alocado.');
    expect(capture.events).toEqual([]);
  });

  it('renders a field code and a notification type (ICU select)', () => {
    const translator = createTranslator('en-US');

    expect(translator.field('string.min', { min: 12 })).toBe('Use at least 12 characters.');
    expect(translator.notification('invitation.received', {
      inviterName: 'Ana', householdName: 'Casa', role: 'Viewer',
    })).toBe('Ana invited you to Casa as a viewer.');
    expect(translator.notification('holding.matured', {
      holdingId: 'h1', assetType: 'tesouro_direto', ticker: null, dueDate: '2026-10-01',
    })).toBe('Your Tesouro Direto matured on 2026-10-01. Archive it?');
    expect(createTranslator('pt-BR').notification('holding.matured', {
      holdingId: 'h1', assetType: 'cdb', ticker: null, dueDate: '2026-10-01',
    })).toBe('Seu investimento CDB venceu em 2026-10-01. Arquivar?');
  });

  it('shows each section’s generic message for an unknown code, and logs it', () => {
    const translator = createTranslator('pt-BR');

    expect(translator.error('budget.new_code')).toBe(catalogs['pt-BR'].errors.fallback);
    expect(translator.field('string.new_code')).toBe(catalogs['pt-BR'].fields['field.invalid']);
    expect(translator.notification('new.type')).toBe(catalogs['pt-BR'].notifications.fallback);
    expect(capture.events.map(({
      level, message, section, key,
    }) => ({
      level, message, section, key,
    }))).toEqual([
      {
        level: 'warn', message: 'unknown message key', section: 'errors', key: 'budget.new_code',
      },
      {
        level: 'warn', message: 'unknown message key', section: 'fields', key: 'string.new_code',
      },
      {
        level: 'warn', message: 'unknown message key', section: 'notifications', key: 'new.type',
      },
    ]);
  });

  it('never treats an inherited property as a code', () => {
    expect(createTranslator('en-US').error('toString')).toBe(catalogs['en-US'].errors.fallback);
  });

  it('shows the generic message when a known message fails to format; logs argument names', () => {
    const text = createTranslator('en-US').notification('holding.matured', { ticker: 'CDB' });

    expect(text).toBe(catalogs['en-US'].notifications.fallback);
    expect(capture.events).toEqual([expect.objectContaining({
      message: 'message failed to format',
      locale: 'en-US',
      section: 'notifications',
      key: 'holding.matured',
      params: ['ticker'],
    })]);
  });

  it('shows the key’s name when typed copy is missing its arguments', () => {
    expect(createTranslator('en-US').text('passwordStrength', 'minimum')).toBe('minimum');
    expect(capture.events).toEqual([expect.objectContaining({
      message: 'message failed to format', key: 'minimum', params: [],
    })]);
  });

  it('reads the catalogs it is given', () => {
    const custom = {
      ...catalogs,
      'en-US': { ...catalogs['en-US'], errors: { ...catalogs['en-US'].errors, fallback: 'Oops.' } },
    } satisfies Record<string, Catalog>;
    const translator = createTranslator('en-US', custom);

    expect(translator.locale).toBe('en-US');
    expect(translator.error('unknown.code')).toBe('Oops.');
  });
});

describe('matchLocale', () => {
  it.each([
    [['en-US', 'pt-BR'], 'en-US'],
    [['pt-br'], 'pt-BR'],
    [['pt-PT'], 'pt-BR'],
    [['pt'], 'pt-BR'],
    [['en-GB'], 'en-US'],
    [['fr-FR', 'en'], 'en-US'],
    [['fr-FR', 'de'], null],
    [[], null],
  ])('%j → %s', (tags, expected) => {
    expect(matchLocale(tags)).toBe(expected);
  });
});

/** In-memory storage whose remembered value the test can read. */
type MemoryStorage = PreferenceStorage & { value: string | null };

/**
 * Storage held in memory, as the controller sees it.
 *
 * @param initial - The remembered value, if any.
 * @returns The storage, with its `value` exposed for assertions.
 */
const memoryStorage = (initial: string | null = null): MemoryStorage => {
  const storage = {
    value: initial,
    read: () => storage.value,
    write: (value: string) => {
      storage.value = value;
    },
  };
  return storage;
};

/**
 * Builds a controller environment on jsdom's <html>.
 *
 * @param storage - The remembered locale.
 * @param languages - The browser's languages.
 * @returns The environment.
 */
const environmentOf = (
  storage: PreferenceStorage,
  languages: readonly string[] = [],
): LocaleEnvironment => ({ root: document.documentElement, languages, storage });

describe('createLocaleController', () => {
  afterEach(() => document.documentElement.removeAttribute('lang'));

  it('starts in the default locale', () => {
    expect(createLocaleController(environmentOf(memoryStorage())).current()).toBe(DEFAULT_LOCALE);
  });

  it('applies a locale: <html lang>, current, remembered', () => {
    const storage = memoryStorage();
    const controller = createLocaleController(environmentOf(storage));
    controller.apply('en-US');

    expect(document.documentElement.lang).toBe('en-US');
    expect(controller.current()).toBe('en-US');
    expect(storage.value).toBe('en-US');
  });

  it('restores the remembered locale over the browser’s, without rewriting storage', () => {
    const storage = memoryStorage('en-US');
    const write = { count: 0 };
    const counting = {
      ...storage,
      write: () => {
        write.count += 1;
      },
    };
    const controller = createLocaleController(environmentOf(counting, ['pt-BR']));
    controller.restore();

    expect(controller.current()).toBe('en-US');
    expect(document.documentElement.lang).toBe('en-US');
    expect(write.count).toBe(0);
  });

  it('restores the browser’s language when nothing (or something unknown) is remembered', () => {
    const fresh = createLocaleController(environmentOf(memoryStorage(), ['en-GB']));
    fresh.restore();
    const edited = createLocaleController(environmentOf(memoryStorage('fr-FR'), ['en']));
    edited.restore();

    expect(fresh.current()).toBe('en-US');
    expect(edited.current()).toBe('en-US');
  });

  it('restores the default when neither storage nor the browser gives a supported locale', () => {
    const controller = createLocaleController(environmentOf(memoryStorage(), ['fr-FR']));
    controller.restore();

    expect(controller.current()).toBe(DEFAULT_LOCALE);
    expect(document.documentElement.lang).toBe(DEFAULT_LOCALE);
  });

  it('notifies subscribers on each change until they unsubscribe', () => {
    const controller = createLocaleController(environmentOf(memoryStorage()));
    const seen: string[] = [];
    const unsubscribe = controller.subscribe(() => seen.push(controller.current()));
    controller.apply('en-US');
    controller.restore();
    unsubscribe();
    controller.apply('pt-BR');

    expect(seen).toEqual(['en-US', 'en-US']);
  });
});

describe('browserLocaleEnvironment', () => {
  afterEach(() => localStorage.clear());

  it('uses <html>, navigator.languages and the configured storage key', () => {
    const environment = browserLocaleEnvironment(window);
    environment.storage.write('en-US');

    expect(environment.root).toBe(document.documentElement);
    expect(environment.languages).toBe(navigator.languages);
    expect(localStorage.getItem(i18n.storageKey)).toBe('en-US');
  });
});
