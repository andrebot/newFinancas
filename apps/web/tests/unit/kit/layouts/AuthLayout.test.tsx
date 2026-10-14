import type { Locale } from '@financas/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthLayout, previewGoalPercent } from '../../../../src/kit/layouts/AuthLayout';
import { brand } from '../../../../src/config/constants';
import { createTranslator, type LocaleController } from '../../../../src/utilities/i18n';
import { I18nProvider } from '../../../../src/utilities/I18nProvider';

// Kit layout (BDT: Interaction tier → unit): nothing mocked; the real
// translator renders the shared catalog through a fixed-locale provider.

/**
 * A locale controller fixed to one locale.
 *
 * @param locale - The locale to show.
 * @returns The controller.
 */
const fixedLocale = (locale: Locale): LocaleController => ({
  current: () => locale,
  apply: () => {},
  restore: () => {},
  subscribe: () => () => {},
});

/**
 * Renders the layout in a locale around a sign-in heading.
 *
 * @param locale - The locale to show.
 * @returns The render result.
 */
const renderLayout = (locale: Locale = 'pt-BR') => render(
  <I18nProvider controller={fixedLocale(locale)}>
    <AuthLayout><h1>Bem-vindo de volta</h1></AuthLayout>
  </I18nProvider>,
);

describe('previewGoalPercent', () => {
  it("formats the preview goal's share in the locale", () => {
    expect(previewGoalPercent(createTranslator('en-US'))).toBe('57%');
    expect(previewGoalPercent(createTranslator('pt-BR'))).toBe('57%');
  });
});

describe('AuthLayout', () => {
  it('centres the page content in the main region', () => {
    renderLayout();

    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1 }).textContent)
      .toBe('Bem-vindo de volta');
  });

  it("shows the brand panel's headline and feature lines in the locale", () => {
    renderLayout('en-US');
    const panel = screen.getByRole('complementary');

    expect(within(panel).getByRole('heading', { level: 2 }).textContent)
      .toBe('Household money, shared clearly.');
    expect(within(panel).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Track spending together, with clear ownership',
      'Grow shared savings and investment goals',
      'See your net worth at a glance — in R$ and $',
    ]);
  });

  it('hides the product preview from screen readers', () => {
    renderLayout('en-US');
    const preview = screen.getByText('Main Checking').closest('[aria-hidden="true"]');

    expect(preview).not.toBeNull();
    expect(preview!.textContent).toContain('57%');
    expect(preview!.textContent).toContain('House Down Payment');
  });

  it('signs the panel with this year and the product name', () => {
    renderLayout();

    expect(screen.getByText(`© ${new Date().getFullYear()} ${brand.name}`)).toBeTruthy();
  });

  it('shows the mark above the form for small screens', () => {
    renderLayout();

    const mark = within(screen.getByRole('main')).getByText(brand.name);

    expect(mark.closest('.lg\\:hidden')).not.toBeNull();
  });
});
