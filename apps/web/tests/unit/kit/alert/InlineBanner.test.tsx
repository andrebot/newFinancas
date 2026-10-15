import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { InlineBanner } from '../../../../src/kit/alert/InlineBanner';

// Kit component (BDT: Interaction tier → unit): nothing mocked; the real Icon
// and IconButton draw the glyph and the close button.

describe('InlineBanner', () => {
  it('announces an error at once, tinted coral', () => {
    render(<InlineBanner tone="error" message="Não foi possível salvar." />);

    const banner = screen.getByRole('alert');
    expect(banner.textContent).toBe('Não foi possível salvar.');
    expect(banner.className).toContain('bg-coral/10');
    expect(banner.querySelector('svg')!.getAttribute('class')).toContain('text-coral');
  });

  it('announces the other tones politely', () => {
    render(<InlineBanner tone="info" message="Os saldos são atualizados à noite." />);

    expect(screen.getByRole('status').className).toContain('border-sky/30');
  });

  it('shows the title in bold above the message', () => {
    render(<InlineBanner tone="warning" title="Atenção" message="Esta conta tem saldo." />);

    const title = screen.getByText('Atenção');
    expect(title.className).toContain('font-semibold');
    expect(title.nextElementSibling!.textContent).toBe('Esta conta tem saldo.');
  });

  it('shows the action it is given', () => {
    render(
      <InlineBanner
        tone="error"
        message="Falhou."
        action={<button type="button">Tentar de novo</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
  });

  it('has no close button unless it can be dismissed', () => {
    render(<InlineBanner tone="success" message="Salvo." />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('closes through its named close button', () => {
    const onDismiss = vi.fn();
    render(
      <InlineBanner tone="success" message="Salvo." dismiss={{ label: 'Dispensar', onDismiss }} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dispensar' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
