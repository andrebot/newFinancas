import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { AppHeader } from '../../../../src/shell/interactions/AppHeader';
import { renderInLocale } from '../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out).

describe('AppHeader', () => {
  it('draws the brand and a menu button that controls the drawer', () => {
    const onToggleMenu = vi.fn();
    renderInLocale(<AppHeader menuOpen={false} drawerId="drawer-1" onToggleMenu={onToggleMenu} />);

    const button = screen.getByRole('button', { name: 'Open navigation menu' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('drawer-1');
    expect(screen.getByText('Finance APP')).toBeTruthy();
    fireEvent.click(button);
    expect(onToggleMenu).toHaveBeenCalledOnce();
  });

  it('turns the button into the close button while the drawer is open', () => {
    renderInLocale(<AppHeader menuOpen drawerId="drawer-1" onToggleMenu={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Close navigation menu' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('hosts the bell when there is one', () => {
    renderInLocale(
      <AppHeader menuOpen={false} drawerId="d" onToggleMenu={vi.fn()} bell={<span>bell</span>} />,
    );
    expect(screen.getByText('bell')).toBeTruthy();
  });

  it('speaks pt-BR', () => {
    renderInLocale(<AppHeader menuOpen={false} drawerId="d" onToggleMenu={vi.fn()} />, 'pt-BR');
    expect(screen.getByRole('button', { name: 'Abrir o menu de navegação' })).toBeTruthy();
  });
});
