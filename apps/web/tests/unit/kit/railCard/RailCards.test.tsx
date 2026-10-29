import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BalanceRailCard } from '../../../../src/kit/railCard/BalanceRailCard';
import { BudgetRailCard } from '../../../../src/kit/railCard/BudgetRailCard';
import { GoalRailCard } from '../../../../src/kit/railCard/GoalRailCard';
import { StatusLine, railCardClasses } from '../../../../src/kit/railCard/RailCard';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit components (BDT: Interaction tier → unit): display only; the
// translator and the formatter run for real.

/**
 * Finds a card's ring by the name it carries.
 *
 * @param name - The budget's or goal's name.
 * @returns The progress ring.
 */
const ringNamed = (name: string) => screen.getByRole('progressbar', { name });

/**
 * Takes a card's ring fill, the circle drawn in the ring's tone.
 *
 * @param name - The budget's or goal's name.
 * @returns The fill circle.
 */
const fillOf = (name: string) => ringNamed(name).querySelectorAll('circle')[1];

/**
 * Expects an element to carry every one of some classes.
 *
 * @param element - The element, or nothing.
 * @param names - The classes it must carry.
 */
const expectClasses = (element: Element | null | undefined, ...names: string[]) => {
  expect(Array.from(element?.classList ?? [])).toEqual(expect.arrayContaining(names));
};

describe('railCardClasses', () => {
  it('sets the kind\'s widths, phone first', () => {
    expect(railCardClasses('balance')).toContain('w-37.5');
    expect(railCardClasses('balance')).toContain('md:w-49');
    expect(railCardClasses('ring')).toContain('w-57.5');
    expect(railCardClasses('ring')).toContain('md:w-68');
  });

  it('rings the card in coral only on an alert', () => {
    expect(railCardClasses('ring')).not.toContain('ring-coral');
    expect(railCardClasses('ring', true)).toContain('ring-1 ring-coral/50');
  });
});

describe('StatusLine', () => {
  it('is muted by default, with no icon', () => {
    const { container } = renderInLocale(<StatusLine>$154.50 left</StatusLine>);
    expectClasses(container.firstElementChild, 'text-muted');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('takes a tone, a decorative icon and extra classes', () => {
    const { container } = renderInLocale(
      <StatusLine tone="coral" icon="warning-outline" className="italic">Over</StatusLine>,
    );
    expectClasses(container.firstElementChild, 'text-coral', 'italic');
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('BalanceRailCard', () => {
  it('shows an account\'s name and balance, with no caption', () => {
    renderInLocale(
      <BalanceRailCard
        name="Main Checking"
        icon="account-balance-outline"
        color="mint"
        amount={324050}
        currency="USD"
      />,
    );
    expect(screen.getByText('Main Checking')).toBeTruthy();
    expect(screen.getByText('$3,240.50')).toBeTruthy();
    expect(screen.queryByText('Outstanding')).toBeNull();
  });

  it('captions a card\'s outstanding, in the interface language', () => {
    renderInLocale(
      <BalanceRailCard
        name="Nubank"
        icon="credit-card-outline"
        color="peach"
        amount={45000}
        currency="BRL"
        outstanding
      />,
      'pt-BR',
    );
    expect(screen.getByText('Em aberto')).toBeTruthy();
    expect(screen.getByText('R$ 450,00')).toBeTruthy();
  });

  it('tints the icon\'s disc in its palette colour', () => {
    const { container } = renderInLocale(
      <BalanceRailCard
        name="Savings"
        icon="savings-outline"
        color="sky"
        amount={0}
        currency="USD"
      />,
    );
    const disc = container.querySelector<HTMLElement>('span[style]')!;
    expect(disc.style.color).toBe('var(--c-cat-sky)');
  });
});

describe('BudgetRailCard', () => {
  it('shows spend over target and what is left, in mint', () => {
    renderInLocale(<BudgetRailCard name="Fun Money" spend={14550} target={30000} currency="USD" />);
    expect(ringNamed('Fun Money').getAttribute('aria-valuetext')).toBe('48%');
    expectClasses(fillOf('Fun Money'), 'stroke-mint');
    expect(screen.getByText('$145.50')).toBeTruthy();
    expect(screen.getByText('/ $300.00')).toBeTruthy();
    expect(screen.getByText('$154.50 left')).toBeTruthy();
  });

  it('is sun near its limit', () => {
    renderInLocale(
      <BudgetRailCard
        name="Dining Out"
        spend={31200}
        target={40000}
        currency="USD"
      />,
    );
    expectClasses(fillOf('Dining Out'), 'stroke-sun');
  });

  it('reads "Over by" in coral, the card ringed, once over', () => {
    const { container } = renderInLocale(
      <BudgetRailCard name="Household Essentials" spend={425000} target={400000} currency="USD" />,
    );
    expect(ringNamed('Household Essentials').getAttribute('aria-valuetext')).toBe('106%');
    expectClasses(screen.getByText('Over by $250.00').parentElement, 'text-coral');
    expectClasses(container.firstElementChild, 'ring-coral/50');
  });

  it('writes its lines in the interface language', () => {
    renderInLocale(
      <BudgetRailCard
        name="Lazer"
        spend={14550}
        target={30000}
        currency="BRL"
      />,
      'pt-BR',
    );
    expect(screen.getByText('Restam R$ 154,50')).toBeTruthy();
  });
});

describe('GoalRailCard', () => {
  it('shows funded over target and what is to go, in sky', () => {
    renderInLocale(
      <GoalRailCard
        name="Emergency Fund"
        funded={320000}
        target={1000000}
        currency="USD"
      />,
    );
    expect(ringNamed('Emergency Fund').getAttribute('aria-valuetext')).toBe('32%');
    expectClasses(fillOf('Emergency Fund'), 'stroke-sky');
    expect(screen.getByText('/ $10,000.00')).toBeTruthy();
    expect(screen.getByText('$6,800.00 to go')).toBeTruthy();
  });

  it('says it is reached, in mint', () => {
    renderInLocale(<GoalRailCard name="Trip" funded={1100000} target={1000000} currency="USD" />);
    expect(ringNamed('Trip').getAttribute('aria-valuetext')).toBe('110%');
    expectClasses(screen.getByText('Goal reached').parentElement, 'text-mint');
  });

  it('reads "Not funded yet" while nothing funds it, with no figures', () => {
    renderInLocale(
      <GoalRailCard
        name="New Laptop Fund"
        funded={0}
        target={500000}
        currency="USD"
      />,
    );
    expectClasses(screen.getByText('Not funded yet'), 'text-muted', 'italic');
    expect(screen.queryByText('/ $5,000.00')).toBeNull();
  });

  it('notes the rate in place of "to go" when other currencies fund it', () => {
    renderInLocale(
      <GoalRailCard name="House" funded={0} target={15000000} currency="BRL" needsRate />,
      'pt-BR',
    );
    expect(screen.getByText('/ R$ 150.000,00')).toBeTruthy();
    expect(screen.getByText('Outras moedas precisam de cotação')).toBeTruthy();
    expect(screen.queryByText(/Faltam/)).toBeNull();
  });

  it('says it is reached even when other currencies fund it too', () => {
    renderInLocale(
      <GoalRailCard
        name="Car"
        funded={500000}
        target={500000}
        currency="USD"
        needsRate
      />,
    );
    expect(screen.getByText('Goal reached')).toBeTruthy();
    expect(screen.queryByText('Other currencies need a rate')).toBeNull();
  });
});
