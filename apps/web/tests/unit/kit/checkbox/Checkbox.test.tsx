import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { boxClasses, Checkbox, joinIds } from '../../../../src/kit/checkbox/Checkbox';
import FOCUS_RING from '../../../../src/kit/focusRing';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handler is a stand-in; the real Icon draws the check.

/**
 * Finds the checkbox by its accessible name.
 *
 * @param name - The checkbox's accessible name.
 * @returns The checkbox input.
 */
const checkboxNamed = (name: string) => screen.getByRole<HTMLInputElement>('checkbox', { name });

describe('Checkbox', () => {
  it('is a native checkbox named by its label only', () => {
    render(
      <Checkbox
        checked={false}
        onChange={vi.fn()}
        label="Guardei os códigos"
        description="Uma vez só"
      />,
    );

    const checkbox = checkboxNamed('Guardei os códigos');
    expect(checkbox.type).toBe('checkbox');
    expect(checkbox.className).toBe('sr-only');
  });

  it('reflects the checked state it is given', () => {
    const { rerender } = render(<Checkbox checked={false} onChange={vi.fn()} label="Aceito" />);
    expect(checkboxNamed('Aceito').checked).toBe(false);

    rerender(<Checkbox checked onChange={vi.fn()} label="Aceito" />);
    expect(checkboxNamed('Aceito').checked).toBe(true);
  });

  it('reports the new value when the text is clicked and leaves the state to the caller', () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Aceito" />);

    fireEvent.click(screen.getByText('Aceito'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(checkboxNamed('Aceito').checked).toBe(false);
  });

  it('reports false when a ticked box is clicked', () => {
    const onChange = vi.fn();
    render(<Checkbox checked onChange={onChange} label="Aceito" />);

    fireEvent.click(checkboxNamed('Aceito'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('keeps links in the label and names the box by the whole label', () => {
    render(
      <Checkbox
        checked={false}
        onChange={vi.fn()}
        label={(
          <>
            Aceito os
            {' '}
            <a href="#termos">Termos</a>
          </>
        )}
      />,
    );

    expect(checkboxNamed('Aceito os Termos')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Termos' }).getAttribute('href')).toBe('#termos');
  });

  it('draws a decorative check inside the box, which holds the input and the focus ring', () => {
    render(<Checkbox checked onChange={vi.fn()} label="Aceito" />);
    const box = checkboxNamed('Aceito').parentElement!;

    expect(box.className).toBe(boxClasses(false));
    expect(box.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('describes the box by its description and has no description without one', () => {
    const { rerender } = render(
      <Checkbox checked={false} onChange={vi.fn()} label="Aceito" description="Obrigatório" />,
    );
    expect(screen.getByRole('checkbox', { description: 'Obrigatório' })).toBeDefined();

    rerender(<Checkbox checked={false} onChange={vi.fn()} label="Aceito" />);
    expect(checkboxNamed('Aceito').hasAttribute('aria-describedby')).toBe(false);
    expect(checkboxNamed('Aceito').hasAttribute('aria-invalid')).toBe(false);
  });

  it('marks an error: invalid, described by the message, coral box', () => {
    render(
      <Checkbox
        checked={false}
        onChange={vi.fn()}
        label="Aceito"
        description="Obrigatório"
        error="Aceite para continuar"
      />,
    );
    const checkbox = screen.getByRole('checkbox', {
      description: 'Obrigatório Aceite para continuar',
    });

    expect(checkbox.getAttribute('aria-invalid')).toBe('true');
    expect(checkbox.parentElement!.className).toBe(boxClasses(true));
    expect(screen.getByText('Aceite para continuar').closest('label')).toBeNull();
  });

  it('cannot be toggled when disabled', () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} onChange={onChange} label="Aceito" disabled />);

    fireEvent.click(screen.getByText('Aceito'));

    expect(checkboxNamed('Aceito').disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('boxClasses', () => {
  it('outlines the box in faint, or in coral when invalid, and carries the focus ring', () => {
    expect(boxClasses(false)).toContain('border-faint');
    expect(boxClasses(false)).not.toContain('border-coral');
    expect(boxClasses(true)).toContain('border-coral');
    expect(boxClasses(true)).not.toContain('border-faint');
    expect(boxClasses(true)).toContain(FOCUS_RING);
  });
});

describe('joinIds', () => {
  it('joins the present ids and skips absent ones', () => {
    expect(joinIds('a-description', undefined, 'a-error')).toBe('a-description a-error');
    expect(joinIds(undefined, 'a-error')).toBe('a-error');
  });

  it('returns undefined when no id is present', () => {
    expect(joinIds(undefined, undefined)).toBeUndefined();
    expect(joinIds()).toBeUndefined();
  });
});
