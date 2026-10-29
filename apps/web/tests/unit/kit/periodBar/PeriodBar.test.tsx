import { fireEvent, screen } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  PeriodBar, barColor, centreSelected, monthClasses, reachable, yearArrow,
} from '../../../../src/kit/periodBar/PeriodBar';
import type { Period, PeriodMonth } from '../../../../src/kit/periodBar/periodBar';
import { formatMoney } from '../../../../src/utilities/formatting';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit component (BDT: Interaction tier → unit): display and events only; the
// translator, the formatter and today's date (pinned) run for real. jsdom
// has no layout, so the strip's geometry is stood in for and `scrollTo` spied on.

const MONTHS: readonly PeriodMonth[] = [
  { month: 1, in: 320000, out: 260000 },
  { month: 8, in: 340000, out: 240000 },
  { month: 9, in: 320000, out: 83139 },
];

const SEPTEMBER: Period = { year: 2026, month: 9 };

/**
 * Renders the bar with September 2026 selected unless told otherwise.
 *
 * @param overrides - Props to replace.
 * @param locale - The interface language.
 * @returns The change handler and the render result.
 */
const renderBar = (
  overrides: Partial<Parameters<typeof PeriodBar>[0]> = {},
  locale: 'en-US' | 'pt-BR' = 'en-US',
) => {
  const onChange = vi.fn();
  const view = renderInLocale(
    <PeriodBar
      period={SEPTEMBER}
      periodLabel="September/2026"
      months={MONTHS}
      currency="USD"
      firstYear={2024}
      onChange={onChange}
      {...overrides}
    />,
    locale,
  );
  return { onChange, ...view };
};

/**
 * Finds a month's button by the start of its name.
 *
 * @param name - E.g. "Sep".
 * @returns The button.
 */
const month = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name} `) });

/**
 * Takes a month's two bars.
 *
 * @param name - The month's short name.
 * @returns Its in and out bars.
 */
const barsOf = (name: string) => {
  const bars = month(name).querySelectorAll<HTMLElement>('[aria-hidden] > span');
  const [inBar, outBar] = Array.from(bars);
  return { inBar: inBar!, outBar: outBar! };
};

/**
 * Tells whether a button, found by its name, is disabled.
 *
 * @param name - The button's accessible name.
 * @returns Whether every button so named is disabled.
 */
const isDisabled = (name: string) => screen.getAllByRole('button', { name })
  .every((button) => button.hasAttribute('disabled'));

describe('centreSelected', () => {
  it('does nothing before the strip mounts or without a selected month', () => {
    const strip = document.createElement('div');
    strip.scrollTo = vi.fn();
    expect(() => centreSelected(null, 'instant')).not.toThrow();
    centreSelected(strip, 'instant');
    expect(strip.scrollTo).not.toHaveBeenCalled();
  });
});

describe('barColor', () => {
  it('greys an empty bar', () => {
    expect(barColor('mint', 0, true)).toBe('bg-line');
  });

  it('draws the selected month in full and the others softened', () => {
    expect(barColor('mint', 40, true)).toBe('bg-mint');
    expect(barColor('coral', 40, false)).toBe('bg-coral/60');
  });
});

describe('monthClasses', () => {
  it('rings the selected month in mint, the others quiet', () => {
    expect(monthClasses(true)).toContain('bg-mintdeep ring-1 ring-mint/50');
    expect(monthClasses(false)).toContain('enabled:hover:bg-ink/5');
    expect(monthClasses(false)).not.toContain('bg-mintdeep');
  });
});

describe('reachable', () => {
  it('keeps a month from the first year to today\'s', () => {
    expect(reachable({ year: 2024, month: 1 }, 2024, '2026-09-17'))
      .toEqual({ year: 2024, month: 1 });
  });

  it('drops a month before the first year or in a year still ahead', () => {
    expect(reachable({ year: 2023, month: 12 }, 2024, '2026-09-17')).toBeUndefined();
    expect(reachable({ year: 2027, month: 1 }, 2024, '2026-09-17')).toBeUndefined();
  });
});

describe('yearArrow', () => {
  it('keeps the month in a year already past', () => {
    expect(yearArrow({ year: 2026, month: 11 }, 2025, 2024, '2026-09-17'))
      .toEqual({ year: 2025, month: 11 });
  });

  it('holds the month back to today\'s in this year', () => {
    expect(yearArrow({ year: 2025, month: 11 }, 2026, 2024, '2026-09-17'))
      .toEqual({ year: 2026, month: 9 });
  });

  it('leads nowhere past this year or before the first one', () => {
    expect(yearArrow({ year: 2026, month: 9 }, 2027, 2024, '2026-09-17')).toBeUndefined();
    expect(yearArrow({ year: 2024, month: 9 }, 2023, 2024, '2026-09-17')).toBeUndefined();
  });
});

describe('PeriodBar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 17, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('names itself and its year\'s twelve months', () => {
    renderBar();
    expect(screen.getByRole('region', { name: 'Period' })).toBeTruthy();
    const months = screen.getByRole('group', { name: 'Months of 2026' });
    expect(months.querySelectorAll('button')).toHaveLength(12);
  });

  it('shows the year from `xl` and the formatted month below it', () => {
    renderBar();
    const year = screen.getByText('2026', { selector: '.type-heading-lg' });
    expect(year.parentElement!.className).toContain('xl:flex');
    expect(screen.getByText('September/2026').parentElement!.className).toContain('xl:hidden');
  });

  it('marks the selected month and reads each month\'s money in and out', () => {
    renderBar();
    expect(month('Sep').getAttribute('aria-current')).toBe('true');
    expect(month('Sep').textContent).toBe('Sep 2026: in $3,200.00, out $831.39');
    expect(month('Aug').hasAttribute('aria-current')).toBe(false);
  });

  it('reads a month with no money moved as zero, with grey bars', () => {
    renderBar();
    expect(month('Mar').textContent).toBe('Mar 2026: in $0.00, out $0.00');
    expect(barsOf('Mar').inBar.className).toContain('bg-line');
  });

  it('scales the bars against the year\'s largest figure', () => {
    renderBar();
    const { inBar, outBar } = barsOf('Aug');
    expect(inBar.style.height).toBe('100%');
    expect(outBar.style.height).toBe(`${(240000 / 340000) * 100}%`);
    expect(inBar.className).toContain('bg-mint/60');
    expect(barsOf('Sep').inBar.classList.contains('bg-mint')).toBe(true);
  });

  it('disables the months after today\'s, with empty bars and only the year heard', () => {
    renderBar({ months: [...MONTHS, { month: 10, in: 5000, out: 0 }] });
    expect(month('Oct').textContent).toBe('Oct 2026');
    expect(month('Oct').hasAttribute('disabled')).toBe(true);
    expect(barsOf('Oct').inBar.style.height).toBe('0%');
  });

  it('reports a month picked', () => {
    const { onChange } = renderBar();
    fireEvent.click(month('Mar'));
    expect(onChange).toHaveBeenCalledWith({ year: 2026, month: 3 });
  });

  it('switches year keeping the month, and stops at the first year and this one', () => {
    const { onChange, rerenderInLocale } = renderBar({ firstYear: 2025 });
    expect(isDisabled('Next year')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Previous year' }));
    expect(onChange).toHaveBeenLastCalledWith({ year: 2025, month: 9 });

    rerenderInLocale(
      <PeriodBar
        period={{ year: 2025, month: 11 }}
        periodLabel="November/2025"
        months={[]}
        currency="USD"
        firstYear={2025}
        onChange={onChange}
      />,
    );
    expect(isDisabled('Previous year')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next year' }));
    expect(onChange).toHaveBeenLastCalledWith({ year: 2026, month: 9 });
  });

  it('steps a month at a time across years, and stops at today\'s month', () => {
    const { onChange } = renderBar({ period: { year: 2026, month: 1 } });
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(onChange).toHaveBeenLastCalledWith({ year: 2025, month: 12 });
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(onChange).toHaveBeenLastCalledWith({ year: 2026, month: 2 });
  });

  it('disables the month arrows at their ends', () => {
    renderBar();
    expect(isDisabled('Next month')).toBe(true);
    renderBar({ period: { year: 2024, month: 1 } });
    expect(screen.getAllByRole('button', { name: 'Previous month' })[1]!.hasAttribute('disabled'))
      .toBe(true);
  });

  it('lays out the caller\'s summary, and nothing without one', () => {
    renderBar({ summary: <p>In / Out / Total</p> });
    expect(screen.getByText('In / Out / Total').parentElement!.className).toContain('xl:border-l');
    const { container } = renderBar();
    expect(container.querySelector('.xl\\:border-l')).toBeNull();
  });

  it('centres the selected month on the swiped strip', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(52);
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(200);
    const scrollTo = vi.spyOn(Element.prototype, 'scrollTo');
    const { onChange, rerenderInLocale } = renderBar();
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ left: 226, behavior: 'instant' });

    rerenderInLocale(
      <PeriodBar
        period={{ year: 2026, month: 3 }}
        periodLabel="March/2026"
        months={MONTHS}
        currency="USD"
        firstYear={2024}
        onChange={onChange}
      />,
    );
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 226, behavior: 'auto' });
  });

  it('announces the month and year the arrows move to', () => {
    renderBar();
    expect(screen.getByText('September/2026').getAttribute('aria-live')).toBe('polite');
    const year = screen.getByText('2026', { selector: '.type-heading-lg' });
    expect(year.getAttribute('aria-live')).toBe('polite');
  });

  it('writes the months and their figures in pt-BR', () => {
    renderBar({ currency: 'BRL' }, 'pt-BR');
    expect(screen.getByRole('region', { name: 'Período' })).toBeTruthy();
    const figures = `entradas ${formatMoney(320000, 'BRL')}, saídas ${formatMoney(83139, 'BRL')}`;
    expect(screen.getByRole('button', { name: /^set\. / }).textContent)
      .toBe(`set. 2026: ${figures}`);
  });
});
