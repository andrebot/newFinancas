import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { BUTTON_BASE } from '../../../../src/kit/button/Button';
import { IconButton, iconButtonClasses } from '../../../../src/kit/button/IconButton';
import { CountBadge } from '../../../../src/kit/countBadge/CountBadge';

// Kit component (BDT: Interaction tier → unit): only the caller's click
// handler is a stand-in; the real Icon and CountBadge render.

describe('iconButtonClasses', () => {
  it('builds on the shared base', () => {
    expect(iconButtonClasses('ghost', 'sm')).toBe([
      BUTTON_BASE,
      'text-faint enabled:hover:bg-ink/5 enabled:hover:text-ink',
      'size-8 [&>svg]:size-4.5',
    ].join(' '));
  });

  it('rings the outline tone', () => {
    expect(iconButtonClasses('outline', 'sm')).toContain('border border-line text-muted');
  });

  it('sets the diameter of each size', () => {
    expect(iconButtonClasses('ghost', 'xs')).toContain('size-7 [&>svg]:size-4');
    expect(iconButtonClasses('ghost', 'md')).toContain('size-9 [&>svg]:size-5');
    expect(iconButtonClasses('ghost', 'lg')).toContain('size-10 [&>svg]:size-5.5');
  });

  it("appends the caller's layout classes", () => {
    expect(iconButtonClasses('ghost', 'sm', 'ml-auto')).toMatch(/ ml-auto$/);
  });
});

describe('IconButton', () => {
  it('is a small ghost button named by its label', () => {
    const { container } = render(<IconButton icon="close" label="Fechar" />);
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Fechar' });

    expect(button.type).toBe('button');
    expect(button.className).toBe(iconButtonClasses('ghost', 'sm'));
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('adds the badge label to its name', () => {
    render(
      <IconButton
        icon="notifications-outline"
        label="Notificações"
        size="lg"
        badge={<CountBadge count={2} label="2 não vistas" className="absolute top-1.5 right-1.5" />}
      />,
    );

    expect(screen.getByRole('button', { name: 'Notificações 2 não vistas' })).not.toBeNull();
  });

  it('passes native props, the ref and clicks through', () => {
    const ref = createRef<HTMLButtonElement>();
    const onClick = vi.fn();
    render(
      <IconButton
        ref={ref}
        icon="chevron-right"
        label="Próximo"
        tone="outline"
        aria-controls="rail"
        onClick={onClick}
      />,
    );
    const button = screen.getByRole('button', { name: 'Próximo' });

    fireEvent.click(button);

    expect(ref.current).toBe(button);
    expect(button.getAttribute('aria-controls')).toBe('rail');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ripples on a press, and not while disabled', () => {
    const onPointerDown = vi.fn();
    const { container, rerender } = render(
      <IconButton icon="close" label="Fechar" onPointerDown={onPointerDown} />,
    );
    const button = screen.getByRole('button', { name: 'Fechar' });

    fireEvent.pointerDown(button);
    rerender(<IconButton icon="close" label="Fechar" disabled />);
    fireEvent.pointerDown(button);

    expect(container.querySelectorAll('.animate-ripple')).toHaveLength(1);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });
});
