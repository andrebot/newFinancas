import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { createLocaleController, type LocaleController } from '../../../src/utilities/i18n';
import { I18nProvider } from '../../../src/utilities/I18nProvider';
import useFormatter from '../../../src/utilities/useFormatter';

// FormattingUtility's React binding (BDT: Utility → unit). The locale
// controller is the real one over in-memory storage; nothing is mocked.

/**
 * A controller over in-memory storage and jsdom's <html>, starting in pt-BR.
 *
 * @returns The controller.
 */
const controllerOf = (): LocaleController => {
  let saved: string | null = 'pt-BR';
  return createLocaleController({
    root: document.documentElement,
    languages: [],
    storage: {
      read: () => saved,
      write: (value) => {
        saved = value;
      },
    },
  });
};

describe('useFormatter', () => {
  it('formats in the current locale and follows a locale change', () => {
    const controller = controllerOf();
    /**
     * Provides the controller's locale.
     *
     * @param props - The hook's tree.
     * @returns The provider.
     */
    const wrapper = ({ children }: { children: ReactNode }) => (
      <I18nProvider controller={controller}>{children}</I18nProvider>
    );
    const { result } = renderHook(() => useFormatter(), { wrapper });

    expect(result.current.date('2026-09-30')).toBe('30/09/2026');

    act(() => controller.apply('en-US'));

    expect(result.current.date('2026-09-30')).toBe('09/30/2026');
  });
});
