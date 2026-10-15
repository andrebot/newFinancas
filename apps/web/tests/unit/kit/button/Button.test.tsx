import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  BUTTON_BASE, Button, buttonClasses, contentClasses, guardClick, type ButtonVariant,
} from '../../../../src/kit/button/Button';

// Kit component (BDT: Interaction tier → unit): only the caller's click and
// submit handlers are stand-ins; the real Icon draws the glyphs.

const VARIANTS: readonly ButtonVariant[] = [
  'primary', 'tonal', 'secondary', 'ghost', 'danger', 'danger-ghost', 'danger-solid',
];

/**
 * Builds a stand-in mouse event whose `preventDefault` can be watched.
 *
 * @returns The event cast to the handler's type.
 */
const fakeClick = () => ({ preventDefault: vi.fn() }) as unknown as
  Parameters<ReturnType<typeof guardClick>>[0];

describe('buttonClasses', () => {
  it('draws a medium secondary button by default', () => {
    expect(buttonClasses()).toBe([
      BUTTON_BASE,
      'border border-line font-medium text-ink enabled:hover:bg-ink/5',
      'h-9 px-4 type-body',
    ].join(' '));
  });

  it('starts every variant from the shared rounded, focus-ringed base', () => {
    for (const variant of VARIANTS) {
      expect(buttonClasses({ variant })).toMatch(new RegExp(`^${BUTTON_BASE} `));
    }
  });

  it('fills the solid variants with their ink on top', () => {
    expect(buttonClasses({ variant: 'primary' })).toContain('bg-mint font-semibold text-onmint');
    expect(buttonClasses({ variant: 'danger-solid' }))
      .toContain('bg-coral font-semibold text-oncoral');
    expect(buttonClasses({ variant: 'tonal' })).toContain('bg-mint/10 font-semibold text-mint');
  });

  it('rings the danger button in coral and leaves the danger ghost bare', () => {
    expect(buttonClasses({ variant: 'danger' })).toContain('border border-coral/40');
    expect(buttonClasses({ variant: 'danger-ghost' })).not.toContain('border');
  });

  it('sets the height of each size', () => {
    expect(buttonClasses({ size: 'sm' })).toContain('h-8 px-4 type-body');
    expect(buttonClasses({ size: 'lg' })).toContain('h-10 px-5 type-body-lg');
    expect(buttonClasses({ size: 'xl' })).toContain('h-[46px] px-6 type-body-lg');
  });

  it('adds the glow and then the caller\'s layout classes', () => {
    expect(buttonClasses({ variant: 'primary', elevated: true, className: 'w-full' }))
      .toMatch(/ shadow-glow w-full$/);
  });
});

describe('contentClasses', () => {
  it('spaces the label row and sizes its icons per button size', () => {
    expect(contentClasses('md', false)).toBe('inline-flex items-center gap-1.5 [&_svg]:size-4');
    expect(contentClasses('xl', false)).toBe('inline-flex items-center gap-2 [&_svg]:size-4.5');
  });

  it('hides the label row, keeping its space, while busy', () => {
    expect(contentClasses('sm', true)).toMatch(/ invisible$/);
  });
});

describe('guardClick', () => {
  it('passes the click on while idle', () => {
    const onClick = vi.fn();
    const event = fakeClick();

    guardClick(false, onClick)(event);

    expect(onClick).toHaveBeenCalledWith(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('drops the click and its default action while busy', () => {
    const onClick = vi.fn();
    const event = fakeClick();

    guardClick(true, onClick)(event);

    expect(onClick).not.toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('copes with no handler', () => {
    expect(() => guardClick(false, undefined)(fakeClick())).not.toThrow();
  });
});

describe('Button', () => {
  it('is a plain button named by its label, never a form submit by default', () => {
    render(<Button>Cancelar</Button>);
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Cancelar' });

    expect(button.type).toBe('button');
    expect(button.className).toBe(buttonClasses());
    expect(button.hasAttribute('aria-busy')).toBe(false);
  });

  it('calls the click handler', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('draws decorative icons around the label without changing the name', () => {
    const { container } = render(
      <Button leadingIcon="add" trailingIcon="arrow-forward">Entrar</Button>,
    );

    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Entrar' })).not.toBeNull();
  });

  it('passes native props and the ref through', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} aria-expanded="false" disabled variant="primary" size="xl">
        Continuar
      </Button>,
    );
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Continuar' });

    expect(ref.current).toBe(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.disabled).toBe(true);
    expect(button.className).toBe(buttonClasses({ variant: 'primary', size: 'xl' }));
  });

  it('keeps the caller\'s aria-disabled while idle', () => {
    render(<Button aria-disabled>Exportar</Button>);

    const button = screen.getByRole('button', { name: 'Exportar' });

    expect(button.getAttribute('aria-disabled')).toBe('true');
  });

  it('covers the label with a spinner and stays focusable while busy', () => {
    const onClick = vi.fn();
    const { container } = render(<Button busy onClick={onClick}>Salvar</Button>);
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Salvar' });

    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(container.querySelector('.invisible')?.textContent).toBe('Salvar');
    expect(container.querySelector('.motion-safe\\:animate-spin')).not.toBeNull();
  });

  it('ripples on a press, and not while busy or disabled', () => {
    const { container, rerender } = render(<Button>Salvar</Button>);
    const button = screen.getByRole('button', { name: 'Salvar' });

    fireEvent.pointerDown(button);
    expect(container.querySelectorAll('.animate-ripple')).toHaveLength(1);

    rerender(<Button busy>Salvar</Button>);
    fireEvent.pointerDown(button);
    rerender(<Button disabled>Salvar</Button>);
    fireEvent.pointerDown(button);
    expect(container.querySelectorAll('.animate-ripple')).toHaveLength(1);
  });

  it('does not submit its form while busy', () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const { container } = render(
      <form>
        <Button type="submit" busy>Entrar</Button>
      </form>,
    );
    container.querySelector('form')!.addEventListener('submit', onSubmit);

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits its form when idle', () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    const { container } = render(
      <form>
        <Button type="submit">Entrar</Button>
      </form>,
    );
    container.querySelector('form')!.addEventListener('submit', onSubmit);

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
