import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Amount, amountClasses } from '../../../../src/kit/amount/Amount';

// Kit component (BDT: Interaction tier → unit): pure rendering, nothing mocked
// — FormattingUtility is pure and its own suite pins the text.

/** `Intl` puts a no-break space between `R$` and the amount. */
const NBSP = ' ';

describe('amountClasses', () => {
  it('sets tabular figures on one line', () => {
    expect(amountClasses(100, 'plain')).toBe('tabular-nums whitespace-nowrap');
  });

  it('keeps the surrounding colour on a plain amount, whatever its sign', () => {
    expect(amountClasses(-100, 'plain')).toBe('tabular-nums whitespace-nowrap');
    expect(amountClasses(100, 'plain')).toBe('tabular-nums whitespace-nowrap');
  });

  it('colours a signed amount mint when positive and coral when negative', () => {
    expect(amountClasses(100, 'signed')).toBe('tabular-nums whitespace-nowrap text-mint');
    expect(amountClasses(-100, 'signed')).toBe('tabular-nums whitespace-nowrap text-coral');
  });

  it('colours an inflow amount mint when positive only', () => {
    expect(amountClasses(100, 'inflow')).toBe('tabular-nums whitespace-nowrap text-mint');
    expect(amountClasses(-100, 'inflow')).toBe('tabular-nums whitespace-nowrap');
  });

  it('keeps the surrounding colour on a coloured zero', () => {
    expect(amountClasses(0, 'signed')).toBe('tabular-nums whitespace-nowrap');
    expect(amountClasses(0, 'inflow')).toBe('tabular-nums whitespace-nowrap');
  });

  it('appends the caller’s classes', () => {
    expect(amountClasses(-1, 'signed', 'font-semibold'))
      .toBe('tabular-nums whitespace-nowrap text-coral font-semibold');
  });
});

describe('Amount', () => {
  it('writes the minor units in the currency’s conventions, plain by default', () => {
    const { container } = render(<Amount amount={123456} currency="BRL" />);

    // Read raw: the text queries fold the no-break space into a plain one.
    const amount = container.firstElementChild!;
    expect(amount.textContent).toBe(`R$${NBSP}1.234,56`);
    expect(amount.tagName).toBe('SPAN');
    expect(amount.className).toBe('tabular-nums whitespace-nowrap');
  });

  it('writes the true minus sign on a negative amount', () => {
    render(<Amount amount={-4599} currency="USD" />);

    expect(screen.getByText('−$45.99')).toBeTruthy();
  });

  it('writes no + on a plain positive amount by default', () => {
    render(<Amount amount={320000} currency="USD" />);

    expect(screen.getByText('$3,200.00')).toBeTruthy();
  });

  it('writes + on a positive amount when the sign always shows', () => {
    render(<Amount amount={320000} currency="USD" sign="always" />);

    expect(screen.getByText('+$3,200.00')).toBeTruthy();
  });

  it('writes + on a coloured positive amount by default, so colour isn’t the only cue', () => {
    render(
      <>
        <Amount amount={320000} currency="USD" tone="signed" />
        <Amount amount={15000} currency="USD" tone="inflow" />
      </>,
    );

    expect(screen.getByText('+$3,200.00')).toBeTruthy();
    expect(screen.getByText('+$150.00')).toBeTruthy();
  });

  it('lets the caller drop the + on a coloured amount', () => {
    render(<Amount amount={320000} currency="USD" tone="signed" sign="auto" />);

    expect(screen.getByText('$3,200.00')).toBeTruthy();
  });

  it('takes its tone and the caller’s classes', () => {
    render(<Amount amount={-4599} currency="USD" tone="signed" className="font-semibold" />);

    expect(screen.getByText('−$45.99').className)
      .toBe('tabular-nums whitespace-nowrap text-coral font-semibold');
  });
});
