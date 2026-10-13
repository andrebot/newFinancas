import { act, render, screen } from '@testing-library/react';
import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import { createLocaleController, type LocaleController } from '../../../src/utilities/i18n';
import { I18nProvider, useI18n, useLocaleController } from '../../../src/utilities/I18nProvider';

// I18nUtility's React binding (BDT: Utility → unit). The controller is the real
// one over in-memory storage; nothing else is mocked.

/**
 * A controller over in-memory storage and jsdom's <html>.
 *
 * @returns The controller.
 */
const controllerOf = (): LocaleController => {
  let saved: string | null = null;
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

/**
 * Shows a translated label and the provided controller's locale.
 *
 * @returns The probe element.
 */
function Probe() {
  const translator = useI18n();
  const controller = useLocaleController();
  return (
    <p>
      {translator.text('passwordStrength', 'level.weak')}
      {' / '}
      {controller.current()}
    </p>
  );
}

describe('I18nProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute('lang');
  });

  it('renders in the controller’s locale and re-renders when a new one is applied', () => {
    const controller = controllerOf();
    render(<I18nProvider controller={controller}><Probe /></I18nProvider>);

    expect(screen.getByText('Fraca / pt-BR')).toBeDefined();

    act(() => controller.apply('en-US'));

    expect(screen.getByText('Weak / en-US')).toBeDefined();
  });

  it('keeps the same translator while the locale is unchanged', () => {
    const controller = controllerOf();
    const seen = new Set<unknown>();

    /**
     * Records each translator it renders with.
     *
     * @returns Nothing visible.
     */
    function Recorder() {
      seen.add(useI18n());
      return null;
    }

    const { rerender } = render(<I18nProvider controller={controller}><Recorder /></I18nProvider>);
    rerender(<I18nProvider controller={controller}><Recorder /></I18nProvider>);

    expect(seen.size).toBe(1);
  });

  it('fails loudly when a component reads it outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow('useI18n must be used inside an I18nProvider');
  });
});
