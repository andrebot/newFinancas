import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card, cardClasses } from '../../../../src/kit/card/Card';

// Kit component (BDT: Interaction tier → unit): pure rendering, nothing mocked.

describe('cardClasses', () => {
  it('draws the bordered surface at every size', () => {
    for (const size of ['none', 'sm', 'md', 'lg'] as const) {
      expect(cardClasses(size)).toContain('border border-line bg-card');
    }
  });

  it('rounds tighter cards less', () => {
    expect(cardClasses('sm')).toContain('rounded-2xl p-4');
    expect(cardClasses('md')).toContain('rounded-card p-5');
    expect(cardClasses('lg')).toContain('rounded-3xl p-7');
  });

  it('clips flush content and adds no padding at size none', () => {
    expect(cardClasses('none')).toBe('border border-line bg-card overflow-hidden rounded-card');
  });

  it("appends the caller's classes", () => {
    expect(cardClasses('md', 'flex flex-col gap-4')).toMatch(/ flex flex-col gap-4$/);
  });
});

describe('Card', () => {
  it('renders a medium section by default', () => {
    const { container } = render(<Card>Membros</Card>);
    const card = container.firstElementChild!;

    expect(card.tagName).toBe('SECTION');
    expect(card.className).toBe(cardClasses('md'));
    expect(card.textContent).toBe('Membros');
  });

  it('renders the element and size it is given', () => {
    const { container } = render(<Card as="article" size="sm" className="gap-3">Contrato</Card>);
    const card = container.firstElementChild!;

    expect(card.tagName).toBe('ARTICLE');
    expect(card.className).toBe(cardClasses('sm', 'gap-3'));
  });
});
