import { render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import useFocusFirstInvalid from '../../../src/utilities/useFocusFirstInvalid';

// A Utility hook (BDT: unit, nothing mocked): the real DOM in jsdom.

/** The hook's props in its host. */
interface HostProps {
  readonly refusals: number;
  readonly scoped?: boolean;
}

/**
 * Renders two invalid fields — one outside the scope, one inside — and runs the hook.
 *
 * @param props - The refusals so far and whether to look inside the scope only.
 * @returns The fields.
 */
function Host({ refusals, scoped = false }: HostProps) {
  const scope = useRef<HTMLDivElement>(null);
  useFocusFirstInvalid(refusals, scoped ? scope : undefined);
  return (
    <>
      <input aria-label="valid" />
      <input aria-label="outside" aria-invalid="true" />
      <div ref={scope}>
        <input aria-label="inside" aria-invalid="true" />
      </div>
    </>
  );
}

describe('useFocusFirstInvalid', () => {
  it('moves nothing before a submit is refused', () => {
    render(<Host refusals={0} />);
    expect(document.activeElement).toBe(document.body);
  });

  it('focuses the first invalid field on each refusal', () => {
    const { rerender } = render(<Host refusals={1} />);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'outside' }));

    screen.getByRole('textbox', { name: 'valid' }).focus();
    rerender(<Host refusals={2} />);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'outside' }));
  });

  it('looks only inside its scope when given one', () => {
    const { rerender } = render(<Host refusals={0} scoped />);
    rerender(<Host refusals={1} scoped />);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'inside' }));
  });

  it('looks over the page when its scope isn\'t mounted', () => {
    function Unmounted() {
      const scope = useRef<HTMLDivElement>(null);
      useFocusFirstInvalid(1, scope);
      return <input aria-label="page" aria-invalid="true" />;
    }
    render(<Unmounted />);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'page' }));
  });

  it('moves nothing when no field is invalid', () => {
    render(<input aria-label="alone" />);
    function Lone() {
      useFocusFirstInvalid(1);
      return null;
    }
    render(<Lone />);
    expect(document.activeElement).toBe(document.body);
  });
});
