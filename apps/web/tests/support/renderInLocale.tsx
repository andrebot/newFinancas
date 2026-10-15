import type { Locale } from '@financas/i18n';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { LocaleController } from '../../src/utilities/i18n';
import { I18nProvider } from '../../src/utilities/I18nProvider';

// Renders UI that reads the catalog (useI18n) through the real translator,
// fixed to one locale — the provider is a Utility, not a boundary to mock.

/**
 * A locale controller fixed to one locale.
 *
 * @param locale - The locale to show.
 * @returns The controller.
 */
export const fixedLocale = (locale: Locale): LocaleController => ({
  current: () => locale,
  apply: () => {},
  restore: () => {},
  subscribe: () => () => {},
});

/**
 * Renders an element inside an I18nProvider fixed to a locale.
 *
 * @param element - What to render.
 * @param locale - The locale; en-US by default.
 * @returns The render result, whose `rerenderInLocale` keeps the provider.
 */
export const renderInLocale = (element: ReactElement, locale: Locale = 'en-US') => {
  const controller = fixedLocale(locale);
  const view = render(<I18nProvider controller={controller}>{element}</I18nProvider>);
  return {
    ...view,
    /**
     * Renders a new element in the same place and locale.
     *
     * @param next - The element.
     */
    rerenderInLocale: (next: ReactElement) => view.rerender(
      <I18nProvider controller={controller}>{next}</I18nProvider>,
    ),
  };
};
