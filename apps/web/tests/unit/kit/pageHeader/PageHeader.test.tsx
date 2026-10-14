import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from '../../../../src/kit/pageHeader/PageHeader';

// Kit component (BDT: Interaction tier → unit): pure rendering, nothing mocked.

describe('PageHeader', () => {
  it('renders only the title as the page h1 by default', () => {
    const { container } = render(<PageHeader title="Investimentos" />);
    const heading = screen.getByRole('heading', { level: 1 });

    expect(heading.textContent).toBe('Investimentos');
    expect(heading.className).toContain('type-display-lg');
    expect(container.querySelectorAll('p')).toHaveLength(0);
    expect(container.firstElementChild!.children).toHaveLength(1);
  });

  it('shows the eyebrow above the title and the description under it', () => {
    render(
      <PageHeader eyebrow="Configuração" title="Contas" description="Suas contas e cartões." />,
    );
    const eyebrow = screen.getByText('Configuração');
    const heading = screen.getByRole('heading', { level: 1 });

    expect(eyebrow.className).toContain('type-label');
    expect(eyebrow.nextElementSibling).toBe(heading);
    expect(heading.nextElementSibling!.textContent).toBe('Suas contas e cartões.');
  });

  it('places the leading slot before the title', () => {
    render(<PageHeader title="Jane Doe" leading={<span>JD</span>} />);

    const textBlock = screen.getByText('JD').nextElementSibling!;

    expect(textBlock.contains(screen.getByRole('heading'))).toBe(true);
  });

  it('renders the actions and the tabs', () => {
    const { container } = render(
      <PageHeader
        title="Contas"
        actions={<button type="button">Adicionar conta</button>}
        tabs={<nav aria-label="Seções">Contas</nav>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Adicionar conta' })).toBeTruthy();
    expect(container.firstElementChild!.lastElementChild!.textContent).toBe('Contas');
    expect(screen.getByRole('navigation', { name: 'Seções' })).toBeTruthy();
  });
});
