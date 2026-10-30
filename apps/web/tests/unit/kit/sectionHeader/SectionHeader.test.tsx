import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionHeader } from '../../../../src/kit/sectionHeader/SectionHeader';

// Kit component (BDT: Interaction tier → unit): pure rendering, nothing mocked.

describe('SectionHeader', () => {
  it('renders the title as an h2 and nothing else by default', () => {
    const { container } = render(<SectionHeader title="Membros" />);
    const heading = screen.getByRole('heading', { level: 2 });

    expect(heading.textContent).toBe('Membros');
    expect(heading.className).toContain('type-heading-sm');
    expect(container.querySelector('p')).toBeNull();
    expect(container.firstElementChild!.children).toHaveLength(1);
  });

  it('renders the heading level it is given', () => {
    render(<SectionHeader title="Contrato" as="h3" />);

    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Contrato');
  });

  it('shows the period as a mint chip inside the heading', () => {
    render(<SectionHeader title="Saldos" period="Setembro/2026" />);
    const chip = screen.getByText('Setembro/2026');

    expect(chip.className).toContain('bg-mintdeep');
    expect(chip.className).toContain('inline-block');
    expect(chip.className).not.toContain('hidden');
    expect(screen.getByRole('heading').textContent).toBe('SaldosSetembro/2026');
  });

  it('shows the period only from `xl` when asked', () => {
    render(<SectionHeader title="Saldos" period="Setembro/2026" periodFromXl />);
    expect(screen.getByText('Setembro/2026').className).toContain('hidden xl:inline-block');
  });

  it('shows the hint as quiet text inside the heading', () => {
    render(<SectionHeader title="Todas as transações" hint="mais recentes primeiro" />);

    expect(screen.getByText('mais recentes primeiro').className).toContain('text-muted');
  });

  it('shows the description under the heading', () => {
    render(<SectionHeader title="Proventos" description="Dividendos e juros recebidos" />);
    const description = screen.getByText('Dividendos e juros recebidos');

    expect(description.tagName).toBe('P');
    expect(description.className).toContain('type-caption');
  });

  it('places the actions on the right', () => {
    const { container } = render(
      <SectionHeader title="Saldos" actions={<button type="button">Rolar</button>} />,
    );

    expect(container.firstElementChild!.lastElementChild!.textContent).toBe('Rolar');
    expect(screen.getByRole('button', { name: 'Rolar' })).toBeTruthy();
  });

  it('centres the actions on a one-line header', () => {
    const { container } = render(
      <SectionHeader title="Saldos" actions={<button type="button">Rolar</button>} />,
    );

    expect(container.firstElementChild!.className).toContain('items-center');
  });

  it('top-aligns the actions beside a title with a description', () => {
    const { container } = render(
      <SectionHeader title="Proventos" description="Últimos 12 meses" actions={<p>R$1,00</p>} />,
    );

    expect(container.firstElementChild!.className).toContain('items-start');
  });
});
