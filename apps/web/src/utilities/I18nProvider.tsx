import {
  createContext, useContext, useMemo, useSyncExternalStore, type ReactNode,
} from 'react';
import { createTranslator, type LocaleController, type Translator } from './i18n';

// I18nUtility's React binding (FU5): the provider follows the page's locale
// controller, so applying a new locale re-renders every text. Components read
// the translator with `useI18n()`; the App Shell and Edit Preferences apply the
// user's language through `useLocaleController()`.

interface I18nContextValue {
  readonly translator: Translator;
  readonly controller: LocaleController;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** The provider's props. */
export interface I18nProviderProps {
  /** The page's locale controller, created and restored in `main.tsx`. */
  readonly controller: LocaleController;
  readonly children: ReactNode;
}

/**
 * Makes the current locale's translator available below it.
 *
 * @param props - The page's locale controller and the subtree.
 * @returns The subtree, rendered in the controller's locale.
 */
export function I18nProvider({ controller, children }: I18nProviderProps) {
  const locale = useSyncExternalStore(controller.subscribe, controller.current);
  const value = useMemo(
    () => ({ translator: createTranslator(locale), controller }),
    [locale, controller],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Reads the provider's value.
 *
 * @returns The value.
 * @throws {Error} Outside an `I18nProvider` — a wiring bug, not a runtime state.
 */
const useI18nContext = (): I18nContextValue => {
  const value = useContext(I18nContext);
  if (value === null) {
    throw new Error('useI18n must be used inside an I18nProvider');
  }
  return value;
};

/**
 * The translator for the current locale.
 *
 * @returns The translator.
 */
export const useI18n = (): Translator => useI18nContext().translator;

/**
 * The page's locale controller, to apply the user's language.
 *
 * @returns The controller.
 */
export const useLocaleController = (): LocaleController => useI18nContext().controller;
