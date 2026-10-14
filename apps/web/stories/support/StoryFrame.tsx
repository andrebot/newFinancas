import type { Locale } from '@financas/i18n';
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import type { LocaleController } from '../../src/utilities/i18n';
import { I18nProvider } from '../../src/utilities/I18nProvider';
import type { Theme } from '../../src/utilities/theme';

// What every story renders inside (N14, OQ-128): the toolbar's theme and
// locale applied the way the app applies them — `data-theme` on <html> as
// ThemeUtility sets it, the translator through `I18nProvider` — on the
// theme's own background. The locale never touches the app's saved one.

/** The frame's props: the toolbar's choices and the story. */
export interface StoryFrameProps {
  readonly theme: Theme;
  readonly locale: Locale;
  readonly children: ReactNode;
}

/**
 * A locale controller fixed to one locale, for the provider. The toolbar is
 * the only way to change it, so applying and restoring do nothing.
 *
 * @param locale - The toolbar's locale.
 * @returns A controller that always shows that locale.
 */
export const fixedLocaleController = (locale: Locale): LocaleController => ({
  current: () => locale,
  apply: () => {},
  restore: () => {},
  subscribe: () => () => {},
});

/**
 * Renders a story in the toolbar's theme and locale.
 *
 * @param props - The theme, the locale and the story.
 * @returns The story, framed.
 */
export function StoryFrame({ theme, locale, children }: StoryFrameProps) {
  const controller = useMemo(() => fixedLocaleController(locale), [locale]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.lang = locale;
  }, [theme, locale]);

  return (
    <I18nProvider controller={controller}>
      <div className="bg-bg p-6 text-ink type-body">{children}</div>
    </I18nProvider>
  );
}
