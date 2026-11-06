import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { LineChart, type LinePoint } from '../../../../src/kit/lineChart/LineChart';
import { renderInLocale } from '../../../support/renderInLocale';

// Kit component (BDT: Interaction tier → unit): the translator, the geometry
// and the hook run for real. jsdom lays nothing out, so a test gives the plot
// its box.

/**
 * Builds a value at month's end.
 *
 * @param key - Its key, also the label's seed.
 * @param date - Its day.
 * @param value - Its value.
 * @param selectable - Whether it can be picked.
 * @returns The point.
 */
const point = (key: string, date: string, value: number, selectable?: boolean): LinePoint => ({
  key,
  date,
  value,
  selectable,
  valueLabel: `R$${value}`,
  dateLabel: `day ${date}`,
});

const POINTS = [
  point('apr', '2026-04-30', 100),
  point('jun', '2026-06-30', 300),
  point('aug', '2026-08-31', 200),
];

/** Where the plot starts on the page, so a test's pointer is read relative to it. */
const PLOT_LEFT = 50;

/**
 * Puts the pointer a distance across the plot.
 *
 * @param across - The distance from the plot's left edge, in px.
 * @returns The event's position.
 */
const at = (across: number) => ({ clientX: PLOT_LEFT + across });

/**
 * Takes the plot, with a 200px-wide box starting 50px into the page.
 *
 * @returns The plot.
 */
const plot = () => {
  const element = screen.getByRole('group', { name: 'Value history' });
  element.getBoundingClientRect = () => ({ left: PLOT_LEFT, width: 200 }) as DOMRect;
  return element;
};

/**
 * Checks an element's inline style.
 *
 * @param element - The element.
 * @param expected - The properties it must have.
 */
const expectStyle = (element: HTMLElement | null, expected: Record<string, string>) => {
  Object.entries(expected).forEach(([property, value]) => {
    expect(element?.style.getPropertyValue(property)).toBe(value);
  });
};

/**
 * Reads the chip's text.
 *
 * @returns The chip's text, or null without one.
 */
const chip = () => screen.queryByTestId('line-chart-readout')?.textContent ?? null;

describe('LineChart', () => {
  it('draws nothing with nothing to draw', () => {
    const { container } = renderInLocale(<LineChart points={[]} ariaLabel="Value history" />);
    expect(container.childElementCount).toBe(0);
  });

  it('draws a pending value alone, the first one being saved', () => {
    renderInLocale(
      <LineChart
        points={[]}
        ariaLabel="Value history"
        pending={{ date: '2026-09-30', value: 9 }}
      />,
    );
    expectStyle(screen.getByTestId('line-chart-pending'), { left: '50%', top: '50%' });
  });

  it('sorts the series, joins it with straight segments and fills under it', () => {
    const { container } = renderInLocale(
      <LineChart points={[...POINTS].reverse()} ariaLabel="Value history" />,
    );
    const [area, line] = [...container.querySelectorAll('path')];
    expect(line?.getAttribute('d')).toMatch(/^M0,87 L.*L100,50$/);
    expect(area?.getAttribute('d')).toMatch(/L100,100 L0,100 Z$/);
  });

  it('draws a smooth curve with only its latest point marked, as a trend', () => {
    const { container } = renderInLocale(
      <LineChart points={POINTS} ariaLabel="Value history" shape="trend" onSelect={() => {}} />,
    );
    expect(container.querySelectorAll('path')[1]?.getAttribute('d')).toContain('C');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'day 2026-08-31 R$200' })).not.toBeNull();
  });

  it('marks every value as history, drawing plain dots without a callback', () => {
    const { container } = renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelectorAll('.bg-sky')).toHaveLength(3);
  });

  it('fills under the line with its own gradient', () => {
    const { container } = renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
    const gradientId = container.querySelector('linearGradient')?.id;
    expect(gradientId).toBeTruthy();
    expect(container.querySelector('path')?.getAttribute('fill')).toBe(`url(#${gradientId})`);
  });

  it.each(['mint', 'sky', 'sun', 'lilac'] as const)('wears the %s tone', (tone) => {
    const { container } = renderInLocale(
      <LineChart points={POINTS} ariaLabel="Value history" tone={tone} />,
    );
    expect(container.querySelector('svg')?.classList.contains(`text-${tone}`)).toBe(true);
    expect(container.querySelectorAll(`.bg-${tone}`)).toHaveLength(3);
  });

  it('matches the markers\' halo to the surface it sits on', () => {
    const { container, rerenderInLocale } = renderInLocale(
      <LineChart points={POINTS} ariaLabel="Value history" />,
    );
    expect(container.querySelectorAll('.border-card')).toHaveLength(3);
    rerenderInLocale(<LineChart points={POINTS} ariaLabel="Value history" surface="bg" />);
    expect(container.querySelectorAll('.border-bg')).toHaveLength(3);
    expect(container.querySelectorAll('.border-card')).toHaveLength(0);
  });

  it('labels in a colour that passes text contrast, never the faint token', () => {
    const { container } = renderInLocale(
      <LineChart
        points={POINTS}
        ariaLabel="Value history"
        showRange
        reference={{ value: 150, label: 'invested' }}
      />,
    );
    expect(container.querySelector('.text-faint')).toBeNull();
    expect(screen.getByText('invested').classList.contains('text-muted')).toBe(true);
    expect(screen.getByText('Apr').classList.contains('text-muted')).toBe(true);
    expect(screen.getAllByText('R$300')[0]?.classList.contains('text-muted')).toBe(true);
  });

  it('colours the newest month in the series\' tone on a trend, not on a history', () => {
    const { rerenderInLocale } = renderInLocale(
      <LineChart points={POINTS} ariaLabel="Value history" shape="trend" tone="sun" />,
    );
    expect(screen.getByText('Aug').classList.contains('text-sun')).toBe(true);
    expect(screen.getByText('Jun').classList.contains('text-muted')).toBe(true);
    rerenderInLocale(<LineChart points={POINTS} ariaLabel="Value history" tone="sun" />);
    expect(screen.getByText('Aug').classList.contains('text-muted')).toBe(true);
  });

  it('colours the edited value\'s month mint, and keeps its label on a long history', () => {
    const long = Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      return point(month, `2026-${month}-15`, index);
    });
    renderInLocale(<LineChart points={long} ariaLabel="Value history" selectedKey="03" />);
    expect(screen.getByText('Mar').classList.contains('text-mint')).toBe(true);
  });

  it('names the year on a history of a year or more', () => {
    const years = [point('first', '2025-01-31', 1), point('last', '2026-03-31', 2)];
    renderInLocale(<LineChart points={years} ariaLabel="Value history" />);
    expect(screen.getByText('Jan 25')).not.toBeNull();
    expect(screen.getByText('Mar 26')).not.toBeNull();
  });

  it('wears the tone it is given', () => {
    const { container } = renderInLocale(
      <LineChart points={POINTS} ariaLabel="Value history" tone="lilac" />,
    );
    expect(container.querySelector('svg')?.classList.contains('text-lilac')).toBe(true);
    expect(container.querySelectorAll('.bg-lilac')).toHaveLength(3);
  });

  it('takes the height it is given, or the default', () => {
    const { rerenderInLocale } = renderInLocale(
      <LineChart points={POINTS} ariaLabel="Value history" heightPx={150} />,
    );
    expectStyle(plot(), { height: '150px' });
    rerenderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
    expectStyle(plot(), { height: '110px' });
  });

  it('labels the months in the interface language', () => {
    renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />, 'pt-BR');
    expect(screen.getByText('abr.')).not.toBeNull();
    expect(screen.getByText('ago.')).not.toBeNull();
  });

  it('lists the values for assistive tech, with translated headers', () => {
    renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />, 'pt-BR');
    const table = screen.getByRole('table', { name: 'Value history' });
    expect(table.classList.contains('sr-only')).toBe(true);
    expect(screen.getByRole('columnheader', { name: 'Data' })).not.toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Valor' })).not.toBeNull();
    expect(screen.getByRole('cell', { name: 'R$300' })).not.toBeNull();
  });

  describe('guides', () => {
    it('draws the grid only when asked', () => {
      const { container, rerenderInLocale } = renderInLocale(
        <LineChart points={POINTS} ariaLabel="Value history" />,
      );
      expect(container.querySelectorAll('.border-t')).toHaveLength(0);
      rerenderInLocale(<LineChart points={POINTS} ariaLabel="Value history" grid />);
      const lines = [...container.querySelectorAll<HTMLElement>('.border-t')];
      expect(lines.map((line) => line.style.top)).toEqual(['25%', '56%', '88%']);
    });

    it('labels the lowest and highest values on the range', () => {
      const { container } = renderInLocale(
        <LineChart points={POINTS} ariaLabel="Value history" showRange />,
      );
      expect(container.querySelector('.top-0')?.textContent).toBe('R$300');
      expect(container.querySelector('.bottom-0')?.textContent).toBe('R$100');
      const lines = [...container.querySelectorAll<HTMLElement>('.border-t')];
      expect(lines.map((line) => line.style.top)).toEqual(['13%', '87%']);
    });

    it('gives a flat series one range label', () => {
      const flat = [point('apr', '2026-04-30', 5), point('may', '2026-05-31', 5)];
      const { container } = renderInLocale(
        <LineChart points={flat} ariaLabel="Value history" showRange />,
      );
      expect(container.querySelector('.top-0')?.textContent).toBe('R$5');
      expect(container.querySelector('.bottom-0')).toBeNull();
    });

    it('asks for no range on a series with no saved values', () => {
      const { container } = renderInLocale(
        <LineChart
          points={[]}
          ariaLabel="Value history"
          showRange
          pending={{ date: '2026-09-30', value: 9 }}
        />,
      );
      expect(container.querySelector('.top-0')).toBeNull();
    });

    it('widens the scale to hold the reference level, and labels it', () => {
      renderInLocale(
        <LineChart
          points={POINTS}
          ariaLabel="Value history"
          reference={{ value: 500, label: 'invested R$500' }}
        />,
      );
      const label = screen.getByText('invested R$500');
      expect(label.parentElement?.classList.contains('border-muted')).toBe(true);
      expectStyle(label.parentElement, { top: '13%' });
    });
  });

  describe('reading a value', () => {
    it('reads the value nearest the pointer, and ends when the pointer leaves', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      expect(chip()).toBeNull();
      fireEvent.pointerMove(element, at(190));
      expect(chip()).toBe('day 2026-08-31R$200');
      fireEvent.pointerMove(element, at(5));
      expect(chip()).toBe('day 2026-04-30R$100');
      fireEvent.pointerLeave(element, { pointerType: 'mouse' });
      expect(chip()).toBeNull();
    });

    it('reads the first value before the plot has a width', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = screen.getByRole('group', { name: 'Value history' });
      element.getBoundingClientRect = () => ({ left: 0, width: 0 }) as DOMRect;
      fireEvent.pointerMove(element, { clientX: 190 });
      expect(chip()).toBe('day 2026-04-30R$100');
    });

    it('keeps a tapped value after the finger lifts, until a tap elsewhere', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      fireEvent.pointerDown(element, { ...at(190), pointerType: 'touch' });
      fireEvent.pointerLeave(element, { pointerType: 'touch' });
      expect(chip()).toBe('day 2026-08-31R$200');
      fireEvent.pointerDown(element, { ...at(5), pointerType: 'touch' });
      expect(chip()).toBe('day 2026-04-30R$100');
      fireEvent.pointerDown(document.body);
      expect(chip()).toBeNull();
    });

    it('stops listening for presses once the readout ends', () => {
      const remove = vi.spyOn(document, 'removeEventListener');
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      fireEvent.pointerMove(plot(), at(190));
      fireEvent.pointerLeave(plot(), { pointerType: 'mouse' });
      expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      remove.mockRestore();
    });

    it('starts nothing on focus: a drawer may open onto the plot', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      element.focus();
      expect(document.activeElement).toBe(element);
      expect(chip()).toBeNull();
    });

    it('starts at the newest with the arrows, moves and announces it', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      fireEvent.keyDown(element, { key: 'ArrowLeft' });
      expect(chip()).toBe('day 2026-08-31R$200');
      fireEvent.keyDown(element, { key: 'ArrowLeft' });
      expect(chip()).toBe('day 2026-06-30R$300');
      expect(screen.getByText('day 2026-06-30 R$300').getAttribute('aria-live')).toBe('polite');
      fireEvent.keyDown(element, { key: 'Home' });
      expect(chip()).toBe('day 2026-04-30R$100');
      fireEvent.keyDown(element, { key: 'End' });
      expect(chip()).toBe('day 2026-08-31R$200');
    });

    it('leaves a modified key to the browser', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'].forEach((modifier) => {
        expect(fireEvent.keyDown(element, { key: 'ArrowLeft', [modifier]: true })).toBe(true);
      });
      expect(chip()).toBeNull();
    });

    it('takes the arrows from the page, so they do not scroll it', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      expect(fireEvent.keyDown(plot(), { key: 'ArrowLeft' })).toBe(false);
    });

    it('leaves Enter and Space to the page on a chart with nothing to pick', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      fireEvent.keyDown(element, { key: 'ArrowLeft' });
      expect(fireEvent.keyDown(element, { key: ' ' })).toBe(true);
      expect(fireEvent.keyDown(element, { key: 'Enter' })).toBe(true);
      expect(chip()).toBe('day 2026-08-31R$200');
    });

    it('ends when the browser takes a touch over to scroll', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      fireEvent.pointerDown(element, { ...at(190), pointerType: 'touch' });
      expect(chip()).not.toBeNull();
      fireEvent.pointerCancel(element);
      expect(chip()).toBeNull();
    });

    it('stays on a press inside the plot', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      fireEvent.pointerMove(element, at(190));
      fireEvent.pointerDown(element.firstElementChild as Element, at(190));
      expect(chip()).toBe('day 2026-08-31R$200');
    });

    it('reads the same-day value that counts, whichever order the day came in', () => {
      const sameDay = [
        point('jun', '2026-06-30', 300),
        point('earlier', '2026-08-31', 150),
        point('later', '2026-08-31', 200),
      ];
      const { container } = renderInLocale(
        <LineChart points={sameDay} ariaLabel="Value history" shape="trend" />,
      );
      const element = plot();
      fireEvent.pointerMove(element, at(199));
      expect(chip()).toBe('day 2026-08-31R$200');
      fireEvent.pointerLeave(element, { pointerType: 'mouse' });
      fireEvent.keyDown(element, { key: 'ArrowLeft' });
      expect(chip()).toBe('day 2026-08-31R$200');
      expect(container.querySelectorAll('path')[1]?.getAttribute('d')).toMatch(/ 100,\d+(\.\d+)?$/);
    });

    it('ends on Escape and picks up again from the newest', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      fireEvent.keyDown(element, { key: 'ArrowRight' });
      fireEvent.keyDown(element, { key: 'Escape' });
      expect(chip()).toBeNull();
      fireEvent.keyDown(element, { key: 'ArrowLeft' });
      expect(chip()).toBe('day 2026-08-31R$200');
    });

    it('ignores any other key', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      fireEvent.keyDown(element, { key: 'a' });
      expect(chip()).toBeNull();
    });

    it('ends on blur, but not when focus moves to one of its markers', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" onSelect={() => {}} />);
      const element = plot();
      fireEvent.keyDown(element, { key: 'End' });
      fireEvent.blur(element, { relatedTarget: screen.getAllByRole('button')[0] });
      expect(chip()).toBe('day 2026-08-31R$200');
      fireEvent.blur(element, { relatedTarget: document.body });
      expect(chip()).toBeNull();
    });

    it('drops the readout when its value leaves the series', () => {
      const { rerenderInLocale } = renderInLocale(
        <LineChart points={POINTS} ariaLabel="Value history" />,
      );
      fireEvent.keyDown(plot(), { key: 'End' });
      expect(chip()).not.toBeNull();
      rerenderInLocale(<LineChart points={POINTS.slice(0, 2)} ariaLabel="Value history" />);
      expect(chip()).toBeNull();
    });

    it('puts the crosshair on the value being read', () => {
      const { container } = renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      fireEvent.pointerMove(plot(), at(90));
      const crosshair = container.querySelector<HTMLElement>('.border-l.border-faint');
      expect(crosshair?.style.left).toBe('49.59%');
    });

    it('keeps the chip inside the plot, and away from its point', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      fireEvent.pointerMove(element, at(0));
      expectStyle(
        screen.getByTestId('line-chart-readout'),
        { left: '0%', top: '0px', transform: '' },
      );
      fireEvent.pointerMove(element, at(200));
      expectStyle(
        screen.getByTestId('line-chart-readout'),
        { left: '100%', transform: 'translateX(-100%)' },
      );
      fireEvent.pointerMove(element, at(100));
      expectStyle(
        screen.getByTestId('line-chart-readout'),
        { left: '49.59%', transform: 'translateX(-50%)', bottom: '0px' },
      );
    });
  });

  describe('picking a value', () => {
    const MIXED = [point('apr', '2026-04-30', 100, false), point('aug', '2026-08-31', 200)];

    it('picks a marker its assistive-tech way, and only that once', () => {
      const onSelect = vi.fn();
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" onSelect={onSelect} />);
      fireEvent.click(screen.getByRole('button', { name: 'day 2026-08-31 R$200' }));
      expect(onSelect.mock.calls).toEqual([['aug']]);
    });

    it('takes pointers off the markers, so overlapping ones can\'t win a press', () => {
      renderInLocale(<LineChart points={MIXED} ariaLabel="Value history" onSelect={() => {}} />);
      expect(screen.getByRole('button').classList.contains('pointer-events-none')).toBe(true);
    });

    it('picks what the chip shows on a press anywhere in the plot', () => {
      const onSelect = vi.fn();
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" onSelect={onSelect} />);
      const element = plot();
      fireEvent.pointerMove(element, at(90));
      expect(chip()).toBe('day 2026-06-30R$300');
      fireEvent.click(element, at(90));
      expect(onSelect.mock.calls).toEqual([['jun']]);
    });

    it('picks the chip\'s value even if the click\'s own position differs', () => {
      const onSelect = vi.fn();
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" onSelect={onSelect} />);
      const element = plot();
      fireEvent.pointerMove(element, at(90));
      fireEvent.click(element, at(190));
      expect(onSelect.mock.calls).toEqual([['jun']]);
    });

    it('picks the nearest value on a press with no chip showing', () => {
      const onSelect = vi.fn();
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" onSelect={onSelect} />);
      fireEvent.click(plot(), at(190));
      expect(onSelect.mock.calls).toEqual([['aug']]);
    });

    it('ends the readout on a pick, so the editing state shows', () => {
      renderInLocale(
        <LineChart
          points={POINTS}
          ariaLabel="Value history"
          selectedKey="jun"
          selectedLabel="editing"
          onSelect={() => {}}
        />,
      );
      const element = plot();
      fireEvent.pointerDown(element, { ...at(90), pointerType: 'touch' });
      expect(screen.queryByText('editing')).toBeNull();
      fireEvent.click(element, at(90));
      expect(chip()).toBeNull();
      expect(screen.queryByText('editing')).not.toBeNull();
    });

    it('has nothing to pick with only a value about to be saved', () => {
      const onSelect = vi.fn();
      renderInLocale(
        <LineChart
          points={[]}
          ariaLabel="Value history"
          pending={{ date: '2026-09-30', value: 9 }}
          onSelect={onSelect}
        />,
      );
      fireEvent.click(plot(), at(100));
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('keeps the readout on a press that picks nothing', () => {
      const onSelect = vi.fn();
      const { rerenderInLocale } = renderInLocale(
        <LineChart points={MIXED} ariaLabel="Value history" onSelect={onSelect} />,
      );
      const element = plot();
      fireEvent.pointerDown(element, at(0));
      fireEvent.click(element, at(0));
      expect(onSelect).not.toHaveBeenCalled();
      expect(chip()).toBe('day 2026-04-30R$100');
      rerenderInLocale(<LineChart points={MIXED} ariaLabel="Value history" />);
      fireEvent.click(plot(), at(190));
      expect(chip()).toBe('day 2026-04-30R$100');
    });

    it('shows a pickable plot with the pointer cursor', () => {
      const { rerenderInLocale } = renderInLocale(
        <LineChart points={MIXED} ariaLabel="Value history" onSelect={() => {}} />,
      );
      expect(plot().classList.contains('cursor-pointer')).toBe(true);
      rerenderInLocale(<LineChart points={MIXED} ariaLabel="Value history" />);
      expect(plot().classList.contains('cursor-pointer')).toBe(false);
    });

    it('offers no button for a value that can\'t be picked', () => {
      renderInLocale(<LineChart points={MIXED} ariaLabel="Value history" onSelect={() => {}} />);
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('keeps the markers out of the tab order: the plot is the one stop', () => {
      renderInLocale(<LineChart points={MIXED} ariaLabel="Value history" onSelect={() => {}} />);
      expect(screen.getByRole('button')?.getAttribute('tabindex')).toBe('-1');
      expect(plot()?.getAttribute('tabindex')).toBe('0');
    });

    it('picks the value being read with Enter or Space, once each', () => {
      const onSelect = vi.fn();
      renderInLocale(<LineChart points={MIXED} ariaLabel="Value history" onSelect={onSelect} />);
      const element = plot();
      fireEvent.keyDown(element, { key: 'End' });
      expect(fireEvent.keyDown(element, { key: 'Enter' })).toBe(false);
      expect(chip()).toBeNull();
      fireEvent.keyDown(element, { key: 'End' });
      expect(fireEvent.keyDown(element, { key: ' ' })).toBe(false);
      expect(onSelect.mock.calls).toEqual([['aug'], ['aug']]);
    });

    it('picks nothing with any other key, Tab included', () => {
      const onSelect = vi.fn();
      renderInLocale(<LineChart points={MIXED} ariaLabel="Value history" onSelect={onSelect} />);
      const element = plot();
      fireEvent.keyDown(element, { key: 'End' });
      fireEvent.keyDown(element, { key: 'Tab' });
      fireEvent.keyDown(element, { key: 'a' });
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('won\'t pick from the keyboard what can\'t be picked', () => {
      const onSelect = vi.fn();
      renderInLocale(<LineChart points={MIXED} ariaLabel="Value history" onSelect={onSelect} />);
      const element = plot();
      fireEvent.keyDown(element, { key: 'Home' });
      expect(fireEvent.keyDown(element, { key: 'Enter' })).toBe(true);
      expect(onSelect).not.toHaveBeenCalled();
      expect(chip()).toBe('day 2026-04-30R$100');
    });

    it('does nothing on Enter with nothing being read', () => {
      const onSelect = vi.fn();
      renderInLocale(<LineChart points={MIXED} ariaLabel="Value history" onSelect={onSelect} />);
      expect(fireEvent.keyDown(plot(), { key: 'Enter' })).toBe(true);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('draws the value being edited with a crosshair and its pill', () => {
      renderInLocale(
        <LineChart
          points={POINTS}
          ariaLabel="Value history"
          selectedKey="jun"
          selectedLabel="Jun · editing"
          onSelect={() => {}}
        />,
      );
      expect(screen.getByText('Jun · editing')).not.toBeNull();
      const picked = screen.getByRole('button', { name: 'day 2026-06-30 R$300' });
      expect(picked.getAttribute('aria-current')).toBe('true');
      const other = screen.getByRole('button', { name: 'day 2026-08-31 R$200' });
      expect(other.getAttribute('aria-current')).toBe('false');
    });

    it('keeps the pill off a value at the top of the plot', () => {
      const selecting = (selectedKey: string) => (
        <LineChart
          points={POINTS}
          ariaLabel="Value history"
          selectedKey={selectedKey}
          selectedLabel="editing"
        />
      );
      const pill = () => screen.getByText('editing', { selector: '.bg-mintdeep' });
      const { rerenderInLocale } = renderInLocale(selecting('aug'));
      expectStyle(pill(), { top: '0px', bottom: '' });
      rerenderInLocale(selecting('jun'));
      expectStyle(pill(), { bottom: '0px', top: '' });
    });

    it('draws no pill without a label', () => {
      const { container } = renderInLocale(
        <LineChart points={POINTS} ariaLabel="Value history" selectedKey="jun" />,
      );
      expect(container.querySelectorAll('.border-l.border-mint')).toHaveLength(1);
      expect(container.querySelector('.bg-mintdeep')).toBeNull();
    });

    it('keeps the crosshair and marker on the edited value while another is read', () => {
      const { container } = renderInLocale(
        <LineChart
          points={POINTS}
          ariaLabel="Value history"
          selectedKey="jun"
          selectedLabel="editing"
          onSelect={() => {}}
        />,
      );
      fireEvent.pointerMove(plot(), at(190));
      expect(screen.queryByText('editing')).toBeNull();
      const crosshair = container.querySelector<HTMLElement>('.border-l.border-mint');
      expect(crosshair?.style.left).toBe('49.59%');
      expect(screen.getByRole('button', { name: 'day 2026-06-30 R$300' }).querySelector('.bg-mint'))
        .not.toBeNull();
    });

    it('reads the edited value in its own colour', () => {
      const { container } = renderInLocale(
        <LineChart points={POINTS} ariaLabel="Value history" selectedKey="jun" />,
      );
      fireEvent.pointerMove(plot(), at(90));
      const readoutDot = screen.getByTestId('line-chart-readout').previousElementSibling;
      expect(readoutDot?.querySelector('.bg-mint')).not.toBeNull();
      fireEvent.pointerMove(plot(), at(190));
      const otherDot = screen.getByTestId('line-chart-readout').previousElementSibling;
      expect(otherDot?.querySelector('.bg-sky')).not.toBeNull();
      expect(container.querySelector('.bg-mint')).not.toBeNull();
    });

    it('ignores a selected key that is not in the series', () => {
      const { container } = renderInLocale(
        <LineChart
          points={POINTS}
          ariaLabel="Value history"
          selectedKey="gone"
          selectedLabel="X"
        />,
      );
      expect(container.querySelector('.bg-mintdeep')).toBeNull();
    });
  });

  describe('a value about to be saved', () => {
    it('extends the axis, draws a dashed segment and highlights its month', () => {
      const { container } = renderInLocale(
        <LineChart
          points={POINTS}
          ariaLabel="Value history"
          pending={{ date: '2026-09-30', value: 400 }}
        />,
      );
      expectStyle(screen.getByTestId('line-chart-pending'), { left: '100%', top: '13%' });
      expect(container.querySelector('.stroke-mint')?.getAttribute('d'))
        .toMatch(/^M.* L100,13$/);
      expect(screen.getByText('Sep')?.classList.contains('text-mint')).toBe(true);
      expect(screen.getByText('Aug')?.classList.contains('text-muted')).toBe(true);
    });

    it('joins the value before it when backdated', () => {
      const { container } = renderInLocale(
        <LineChart
          points={POINTS}
          ariaLabel="Value history"
          pending={{ date: '2026-05-15', value: 400 }}
        />,
      );
      const segment = container.querySelector('.stroke-mint')?.getAttribute('d');
      expect(segment?.startsWith('M0,')).toBe(true);
    });

    it('centres the ring on its value, and draws no segment without one', () => {
      const { container, rerenderInLocale } = renderInLocale(
        <LineChart
          points={POINTS}
          ariaLabel="Value history"
          pending={{ date: '2026-09-30', value: 400 }}
        />,
      );
      expect(screen.getByTestId('line-chart-pending').style.transform)
        .toBe('translate(-50%, -50%)');
      rerenderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      expect(container.querySelector('.stroke-mint')?.getAttribute('d')).toBe('');
    });

    it('draws no segment on an empty series', () => {
      const { container } = renderInLocale(
        <LineChart
          points={[]}
          ariaLabel="Value history"
          pending={{ date: '2026-09-30', value: 9 }}
        />,
      );
      expect(container.querySelector('.stroke-mint')?.getAttribute('d')).toBe('');
    });
  });

  describe('compact', () => {
    it('is the line alone: one image, no labels, table or readout', () => {
      const { container } = renderInLocale(
        <LineChart points={POINTS} ariaLabel="Net worth" compact shape="trend" />,
      );
      const image = screen.getByRole('img', { name: 'Net worth' });
      expectStyle(image, { height: '40px' });
      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.queryByRole('group')).toBeNull();
      expect(container.querySelectorAll('.bg-sky')).toHaveLength(0);
      fireEvent.pointerMove(image, at(5));
      expect(chip()).toBeNull();
    });

    it('takes the height it is given', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Net worth" compact heightPx={24} />);
      expectStyle(screen.getByRole('img'), { height: '24px' });
    });

    it('shows a dot for a lone value, which has no line', () => {
      const { container } = renderInLocale(
        <LineChart points={POINTS.slice(0, 1)} ariaLabel="Net worth" compact />,
      );
      expect(container.querySelectorAll('.bg-sky')).toHaveLength(1);
    });
  });
});
