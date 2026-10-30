import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { PeriodSummary } from '../../../../../../../src/experiences/manageFinances/flows/monthOverview/interactions/PeriodSummary';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// The period bar's summary (BDT: Interaction, unit; only the Flow's callback
// is a spy).

/**
 * Reads a line's figure.
 *
 * @param label - The line's label.
 * @returns Its figure's text.
 */
const figureOf = (label: string) => screen.getByText(label).nextElementSibling!.textContent;

describe('PeriodSummary', () => {
  it('shows in, out and the total in the chosen currency', () => {
    renderInLocale(
      <PeriodSummary
        period="September/2026"
        currency="USD"
        onCurrencyChange={() => {}}
        figures={{ in: 320000, out: 83139, net: 236861 }}
      />,
    );
    expect(screen.getByText('September/2026')).toBeTruthy();
    expect(figureOf('In')).toBe('+$3,200.00');
    expect(figureOf('Out')).toBe('−$831.39');
    expect(figureOf('Total')).toBe('+$2,368.61');
  });

  it('colours in mint and out coral, the total plain', () => {
    renderInLocale(
      <PeriodSummary
        period="September/2026"
        currency="USD"
        onCurrencyChange={() => {}}
        figures={{ in: 100, out: 300, net: -200 }}
      />,
    );
    expect(screen.getByText('+$1.00').className).toContain('text-mint');
    expect(screen.getByText('−$3.00').className).toContain('text-coral');
    expect(screen.getByText('−$2.00').className).not.toMatch(/text-(mint|coral)/);
  });

  it('writes an empty month as zeros, out with no sign', () => {
    renderInLocale(
      <PeriodSummary
        period="setembro/2026"
        currency="BRL"
        onCurrencyChange={() => {}}
        figures={{ in: 0, out: 0, net: 0 }}
      />,
      'pt-BR',
    );
    expect(figureOf('Saídas')).toBe('R$\u00a00,00');
  });

  it('shows dashes until the month is known', () => {
    renderInLocale(
      <PeriodSummary
        period="September/2026"
        currency="BRL"
        onCurrencyChange={() => {}}
        figures={undefined}
      />,
    );
    expect([figureOf('In'), figureOf('Out'), figureOf('Total')])
      .toEqual(['—Not available', '—Not available', '—Not available']);
    screen.getAllByText('—').forEach((dash) => {
      expect(dash.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('marks the figures busy while the month loads, and not otherwise', () => {
    const { rerenderInLocale } = renderInLocale(
      <PeriodSummary
        period="September/2026"
        currency="BRL"
        onCurrencyChange={() => {}}
        figures={undefined}
        loading
      />,
    );
    expect(document.querySelector('dl')!.getAttribute('aria-busy')).toBe('true');
    rerenderInLocale(
      <PeriodSummary
        period="September/2026"
        currency="BRL"
        onCurrencyChange={() => {}}
        figures={undefined}
      />,
    );
    expect(document.querySelector('dl')!.hasAttribute('aria-busy')).toBe(false);
  });

  it('shows the month\'s label only from `xl`; on a phone the bar names it', () => {
    renderInLocale(
      <PeriodSummary
        period="September/2026"
        currency="BRL"
        onCurrencyChange={() => {}}
        figures={undefined}
      />,
    );
    expect(screen.getByText('September/2026').className).toContain('hidden');
    expect(screen.getByText('September/2026').className).toContain('xl:inline');
  });

  it('offers R$ then $, and emits the currency picked', () => {
    const onCurrencyChange = vi.fn();
    renderInLocale(
      <PeriodSummary
        period="September/2026"
        currency="BRL"
        onCurrencyChange={onCurrencyChange}
        figures={undefined}
      />,
    );
    const group = screen.getByRole('radiogroup', { name: 'Summary currency' });
    const options = screen.getAllByRole('radio');
    expect(group).toBeTruthy();
    expect(options.map((option) => option.closest('label')!.textContent)).toEqual(['R$', '$']);
    expect((options[0] as HTMLInputElement).checked).toBe(true);
    fireEvent.click(options[1]!);
    expect(onCurrencyChange).toHaveBeenCalledWith('USD');
  });
});
