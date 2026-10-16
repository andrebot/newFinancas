import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  EditPreferences, type EditPreferencesProps,
} from '../../../../../src/experiences/manageProfile/interactions/EditPreferences';
import { renderInLocale } from '../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit and
// translator; only the Experience's handlers are stand-ins.

/**
 * Renders the panel with stand-in handlers, in a locale.
 *
 * @param props - The props to set or override.
 * @param locale - The locale; en-US by default.
 * @returns The handlers.
 */
const renderPanel = (
  props: Partial<EditPreferencesProps> = {},
  locale: 'en-US' | 'pt-BR' = 'en-US',
) => {
  const onTheme = vi.fn();
  const onLanguage = vi.fn();
  const view = renderInLocale(
    <EditPreferences
      theme="dark"
      language="en-US"
      onTheme={onTheme}
      onLanguage={onLanguage}
      {...props}
    />,
    locale,
  );
  return { onTheme, onLanguage, container: view.container };
};

/**
 * Finds a radio by its visible name.
 *
 * @param name - The option's label.
 * @returns The radio input.
 */
const radio = (name: string) => screen.getByRole<HTMLInputElement>('radio', { name });

describe('EditPreferences', () => {
  it("renders mockup 70's panel: three themes and two languages, the saved ones picked", () => {
    renderPanel({ theme: 'system', language: 'pt-BR' });

    expect(screen.getByRole('heading', { level: 2, name: 'Preferences' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeTruthy();
    expect(radio('Dark').checked).toBe(false);
    expect(radio('Light').checked).toBe(false);
    expect(radio('System').checked).toBe(true);
    expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeTruthy();
    expect(radio('🇺🇸 English').checked).toBe(false);
    expect(radio('🇧🇷 Português').checked).toBe(true);
  });

  it('lists English first, as the mockup does', () => {
    renderPanel();

    const languages = screen.getAllByRole('radio').slice(3)
      .map((input) => input.getAttribute('value'));
    expect(languages).toEqual(['en-US', 'pt-BR']);
  });

  it('draws each thumbnail in its own theme’s tokens', () => {
    const { container } = renderPanel();

    const themed = [...container.querySelectorAll('[data-theme]')]
      .map((element) => element.getAttribute('data-theme'));
    expect(themed).toEqual(['dark', 'light', 'dark', 'light']);
  });

  it('emits a picked theme at once', () => {
    const { onTheme, onLanguage } = renderPanel();

    fireEvent.click(radio('Light'));

    expect(onTheme).toHaveBeenCalledWith('light');
    expect(onLanguage).not.toHaveBeenCalled();
  });

  it('emits a picked language at once', () => {
    const { onTheme, onLanguage } = renderPanel();

    fireEvent.click(radio('🇧🇷 Português'));

    expect(onLanguage).toHaveBeenCalledWith('pt-BR');
    expect(onTheme).not.toHaveBeenCalled();
  });

  it('reads every text from the catalog (pt-BR); language names stay their own', () => {
    renderPanel({}, 'pt-BR');

    expect(screen.getByRole('heading', { name: 'Preferências' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeTruthy();
    expect(radio('Escuro')).toBeTruthy();
    expect(radio('Claro')).toBeTruthy();
    expect(radio('Sistema')).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Idioma' })).toBeTruthy();
    expect(radio('🇺🇸 English')).toBeTruthy();
  });
});
