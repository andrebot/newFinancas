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

/**
 * Takes the plot, with a 200px-wide box starting at the page's edge.
 *
 * @returns The plot.
 */
const plot = () => {
  const element = screen.getByRole('group', { name: 'Value history' });
  element.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect;
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
      expect(container.querySelectorAll('.border-t')).toHaveLength(3);
    });

    it('labels the lowest and highest values on the range', () => {
      const { container } = renderInLocale(
        <LineChart points={POINTS} ariaLabel="Value history" showRange />,
      );
      expect(container.querySelector('.top-0')?.textContent).toBe('R$300');
      expect(container.querySelector('.bottom-0')?.textContent).toBe('R$100');
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
      expectStyle(label.parentElement, { top: '13%' });
    });
  });

  describe('reading a value', () => {
    it('reads the value nearest the pointer, and ends when the pointer leaves', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      expect(chip()).toBeNull();
      fireEvent.pointerMove(element, { clientX: 190 });
      expect(chip()).toBe('day 2026-08-31R$200');
      fireEvent.pointerMove(element, { clientX: 5 });
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
      fireEvent.pointerDown(element, { clientX: 190, pointerType: 'touch' });
      fireEvent.pointerLeave(element, { pointerType: 'touch' });
      expect(chip()).toBe('day 2026-08-31R$200');
      fireEvent.pointerDown(element, { clientX: 5, pointerType: 'touch' });
      expect(chip()).toBe('day 2026-04-30R$100');
      fireEvent.pointerDown(document.body);
      expect(chip()).toBeNull();
    });

    it('stops listening for presses once the readout ends', () => {
      const remove = vi.spyOn(document, 'removeEventListener');
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      fireEvent.pointerMove(plot(), { clientX: 190 });
      fireEvent.pointerLeave(plot(), { pointerType: 'mouse' });
      expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function));
      remove.mockRestore();
    });

    it('starts at the newest on focus, moves with the arrows and announces it', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      fireEvent.focus(element);
      expect(chip()).toBe('day 2026-08-31R$200');
      fireEvent.keyDown(element, { key: 'ArrowLeft' });
      expect(chip()).toBe('day 2026-06-30R$300');
      expect(screen.getByText('day 2026-06-30 R$300')?.getAttribute('aria-live')).toBe('polite');
      fireEvent.keyDown(element, { key: 'Home' });
      expect(chip()).toBe('day 2026-04-30R$100');
      fireEvent.keyDown(element, { key: 'End' });
      expect(chip()).toBe('day 2026-08-31R$200');
    });

    it('keeps the value already read when focus arrives', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      fireEvent.pointerDown(element, { clientX: 5 });
      fireEvent.focus(element);
      expect(chip()).toBe('day 2026-04-30R$100');
    });

    it('ends on Escape and picks up again from the newest', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      fireEvent.focus(element);
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
      fireEvent.focus(element);
      fireEvent.blur(element, { relatedTarget: screen.getAllByRole('button')[0] });
      expect(chip()).toBe('day 2026-08-31R$200');
      fireEvent.blur(element, { relatedTarget: document.body });
      expect(chip()).toBeNull();
    });

    it('drops the readout when its value leaves the series', () => {
      const { rerenderInLocale } = renderInLocale(
        <LineChart points={POINTS} ariaLabel="Value history" />,
      );
      fireEvent.focus(plot());
      rerenderInLocale(<LineChart points={POINTS.slice(0, 2)} ariaLabel="Value history" />);
      expect(chip()).toBeNull();
    });

    it('keeps the chip inside the plot, and away from its point', () => {
      renderInLocale(<LineChart points={POINTS} ariaLabel="Value history" />);
      const element = plot();
      fireEvent.pointerMove(element, { clientX: 0 });
      expectStyle(screen.getByTestId('line-chart-readout'), { left: '0%', top: '0px' });
      fireEvent.pointerMove(element, { clientX: 200 });
      expectStyle(
        screen.getByTestId('line-chart-readout'),
        { left: '100%', transform: 'translateX(-100%)' },
      );
      fireEvent.pointerMove(element, { clientX: 100 });
      expectStyle(
        screen.getByTestId('line-chart-readout'),
        { transform: 'translateX(-50%)', bottom: '0px' },
      );
    });
  });

  describe('picking a value', () => {
    const MIXED = [point('apr', '2026-04-30', 100, false), point('aug', '2026-08-31', 200)];

    it('picks a marker on a click', () => {
      const onSelect = vi.fn();
      renderInLocale(<LineChart points={MIXED} ariaLabel="Value history" onSelect={onSelect} />);
      fireEvent.click(screen.getByRole('button', { name: 'day 2026-08-31 R$200' }));
      expect(onSelect).toHaveBeenCalledWith('aug');
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

    it('picks the value being read with Enter or Space', () => {
      const onSelect = vi.fn();
      renderInLocale(<LineChart points={MIXED} ariaLabel="Value history" onSelect={onSelect} />);
      const element = plot();
      fireEvent.focus(element);
      fireEvent.keyDown(element, { key: 'Enter' });
      fireEvent.keyDown(element, { key: ' ' });
      expect(onSelect.mock.calls).toEqual([['aug'], ['aug']]);
    });

    it('won\'t pick from the keyboard what can\'t be picked', () => {
      const onSelect = vi.fn();
      renderInLocale(<LineChart points={MIXED} ariaLabel="Value history" onSelect={onSelect} />);
      const element = plot();
      fireEvent.focus(element);
      fireEvent.keyDown(element, { key: 'Home' });
      fireEvent.keyDown(element, { key: 'Enter' });
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('does nothing on Enter with nothing being read, or without a callback', () => {
      const onSelect = vi.fn();
      const { rerenderInLocale } = renderInLocale(
        <LineChart points={MIXED} ariaLabel="Value history" onSelect={onSelect} />,
      );
      fireEvent.keyDown(plot(), { key: 'Enter' });
      expect(onSelect).not.toHaveBeenCalled();
      rerenderInLocale(<LineChart points={MIXED} ariaLabel="Value history" />);
      fireEvent.focus(plot());
      expect(() => fireEvent.keyDown(plot(), { key: 'Enter' })).not.toThrow();
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

    it('draws no pill without a label, and gives way to a readout', () => {
      const { container, rerenderInLocale } = renderInLocale(
        <LineChart points={POINTS} ariaLabel="Value history" selectedKey="jun" />,
      );
      expect(container.querySelectorAll('.border-l.border-mint')).toHaveLength(1);
      expect(container.querySelector('.bg-mintdeep')).toBeNull();
      rerenderInLocale(
        <LineChart
          points={POINTS}
          ariaLabel="Value history"
          selectedKey="jun"
          selectedLabel="Jun"
        />,
      );
      fireEvent.pointerMove(plot(), { clientX: 190 });
      expect(screen.queryByText('Jun', { selector: '.bg-mintdeep' })).toBeNull();
      expect(container.querySelectorAll('.border-l.border-mint')).toHaveLength(0);
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
      expect(screen.getByText('Aug')?.classList.contains('text-faint')).toBe(true);
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
      fireEvent.pointerMove(image, { clientX: 5 });
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
