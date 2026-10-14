import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WizardLayout } from '../../../../src/kit/layouts/WizardLayout';
import { brand } from '../../../../src/config/constants';

// Kit layout (BDT: Interaction tier → unit): nothing mocked; the real
// BrandMark draws the bar.

describe('WizardLayout', () => {
  it('shows the brand mark in a bar with no navigation', () => {
    render(<WizardLayout>Passo</WizardLayout>);

    expect(screen.getByRole('banner').textContent).toBe(brand.name);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('centres the step in a narrow column without an aside', () => {
    render(<WizardLayout><h1>Dê um nome à casa</h1></WizardLayout>);
    const main = screen.getByRole('main');

    expect(main.className).toContain('max-w-[560px]');
    expect(main.className).toContain('text-center');
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('widens the centred column when asked', () => {
    render(<WizardLayout width="wide">Resumo</WizardLayout>);

    expect(screen.getByRole('main').className).toContain('max-w-[760px]');
  });

  it('puts the aside beside the step', () => {
    render(<WizardLayout aside={<p>Passo 1 de 3</p>}><h1>Adicione uma conta</h1></WizardLayout>);
    const aside = screen.getByRole('complementary');

    expect(aside.textContent).toBe('Passo 1 de 3');
    expect(screen.getByRole('main').className).toContain('lg:grid-cols-[260px_minmax(0,1fr)]');
    expect(aside.nextElementSibling!.textContent).toBe('Adicione uma conta');
  });
});
