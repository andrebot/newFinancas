import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import {
  describe, expect, it, vi,
} from 'vitest';
import { MainNav, navLinkClasses } from '../../../../src/shell/interactions/MainNav';
import { I18nProvider } from '../../../../src/utilities/I18nProvider';
import { fixedLocale } from '../../../support/renderInLocale';

// Interaction (BDT: unit). A memory router stands in for the address bar.

/**
 * Renders the nav at an address.
 *
 * @param path - The current page.
 * @param onNavigate - The follow handler.
 * @param locale - The locale.
 */
const renderAt = (path: string, onNavigate = vi.fn(), locale: 'en-US' | 'pt-BR' = 'en-US') => {
  render(
    <I18nProvider controller={fixedLocale(locale)}>
      <MemoryRouter initialEntries={[path]}>
        <MainNav onNavigate={onNavigate} />
      </MemoryRouter>
    </I18nProvider>,
  );
};

describe('MainNav', () => {
  it('links every main page in order', () => {
    renderAt('/');
    const links = screen.getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Dashboard', '/'],
      ['Transactions', '/transactions'],
      ['Account Setup', '/account-setup'],
      ['Investments', '/investments'],
      ['Household', '/household'],
    ]);
  });

  it('marks only the current page, the Dashboard not matching every address', () => {
    renderAt('/transactions');
    const current = screen.getByRole('link', { name: 'Transactions' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBeNull();
  });

  it('reports a followed link', () => {
    const onNavigate = vi.fn();
    renderAt('/', onNavigate);
    fireEvent.click(screen.getByRole('link', { name: 'Investments' }));
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it('draws the current page in mint', () => {
    expect(navLinkClasses({ isActive: true })).toContain('text-mint');
    expect(navLinkClasses({ isActive: false })).toContain('text-muted');
  });

  it('speaks pt-BR', () => {
    renderAt('/', vi.fn(), 'pt-BR');
    expect(screen.getByRole('link', { name: 'Painel' })).toBeTruthy();
  });
});
