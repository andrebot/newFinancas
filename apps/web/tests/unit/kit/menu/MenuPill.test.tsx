import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { MenuPill, StaticPill } from '../../../../src/kit/menu/MenuPill';

// Kit component (BDT: Interaction tier → unit, nothing mocked but the
// caller's handler): the role pill, as a menu trigger and as a static label.

describe('MenuPill', () => {
  it('is a plain button showing the choice and a chevron', () => {
    render(<MenuPill label="Membro" />);

    const pill = screen.getByRole<HTMLButtonElement>('button', { name: 'Membro' });
    expect(pill.type).toBe('button');
    expect(pill.querySelector('svg')!.getAttribute('class'))
      .toContain('group-aria-expanded:rotate-180');
  });

  it('takes native props such as the ARIA a menu hands its trigger', () => {
    const onClick = vi.fn();
    render(<MenuPill label="Admin" aria-label="Papel de Alex" aria-expanded onClick={onClick} />);

    const pill = screen.getByRole('button', { name: 'Papel de Alex' });
    fireEvent.click(pill);

    expect(pill.getAttribute('aria-expanded')).toBe('true');
    expect(pill.className).toContain('aria-expanded:border-mint/60');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('can be disabled', () => {
    render(<MenuPill label="Leitor" disabled />);

    expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(true);
  });
});

describe('StaticPill', () => {
  it('is a mint label with its icon, not a button', () => {
    const { container } = render(<StaticPill label="Dono" icon="crown-outline" />);

    const pill = container.firstElementChild!;
    expect(pill.tagName).toBe('SPAN');
    expect(pill.textContent).toBe('Dono');
    expect(pill.className).toContain('bg-mintdeep');
    expect(pill.querySelector('svg')).not.toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws no icon when given none', () => {
    const { container } = render(<StaticPill label="Dono" />);

    expect(container.querySelector('svg')).toBeNull();
  });
});
