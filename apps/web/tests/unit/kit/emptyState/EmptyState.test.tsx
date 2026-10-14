import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '../../../../src/kit/emptyState/EmptyState';

// Kit component (BDT: Interaction tier → unit): nothing mocked; the real Icon
// draws the glyph.

describe('EmptyState', () => {
  it('shows the title under a decorative icon', () => {
    const { container } = render(
      <EmptyState icon="receipt-long-outline" title="Nenhuma transação ainda" />,
    );

    expect(screen.getByText('Nenhuma transação ainda').className).toContain('type-heading-sm');
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('leaves out the description and the action when none are given', () => {
    const { container } = render(<EmptyState icon="search" title="Sem resultados" />);

    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.firstElementChild!.children).toHaveLength(2);
  });

  it('shows the description as a quieter line', () => {
    render(<EmptyState icon="search" title="Sem resultados" description="Tente outros filtros." />);

    expect(screen.getByText('Tente outros filtros.').className).toContain('text-muted');
  });

  it('shows the action it is given', () => {
    render(
      <EmptyState
        icon="search"
        title="Sem resultados"
        action={<button type="button">Limpar filtros</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeTruthy();
  });
});
