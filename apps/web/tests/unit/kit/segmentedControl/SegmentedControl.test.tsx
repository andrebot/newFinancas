import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  SegmentedControl,
  segmentStyle,
  type SegmentedOption,
} from '../../../../src/kit/segmentedControl/SegmentedControl';

// Kit component (BDT: Interaction tier → unit): only the caller's change
// handler is a stand-in; the real Icon draws the glyphs.

type Currency = 'USD' | 'BRL';

const CURRENCIES: readonly SegmentedOption<Currency>[] = [
  { value: 'USD', label: '$' },
  { value: 'BRL', label: 'R$' },
];

describe('SegmentedControl', () => {
  it('is a radio group named by its label, one radio per option', () => {
    render(<SegmentedControl label="Moeda" options={CURRENCIES} value="BRL" onChange={vi.fn()} />);

    const group = screen.getByRole('radiogroup', { name: 'Moeda' });
    const radios = screen.getAllByRole('radio');
    expect(group).toBeDefined();
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['USD', 'BRL']);
    expect(new Set(radios.map((radio) => radio.getAttribute('name'))).size).toBe(1);
  });

  it('checks only the selected value', () => {
    render(<SegmentedControl label="Moeda" options={CURRENCIES} value="BRL" onChange={vi.fn()} />);

    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'R$' }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: '$' }).checked).toBe(false);
  });

  it('reports the picked value and leaves the selection to the caller', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Moeda" options={CURRENCIES} value="BRL" onChange={onChange} />);

    fireEvent.click(screen.getByText('$'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('USD');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'R$' }).checked).toBe(true);
  });

  it('gives separate groups separate radio names', () => {
    render(
      <>
        <SegmentedControl label="A" options={CURRENCIES} value="USD" onChange={vi.fn()} />
        <SegmentedControl label="B" options={CURRENCIES} value="USD" onChange={vi.fn()} />
      </>,
    );
    const [first, second] = screen.getAllByRole('radiogroup');

    expect(first!.querySelector('input')!.name).not.toBe(second!.querySelector('input')!.name);
  });

  it('draws an option’s icon as decoration and its count after the text', () => {
    const goals: readonly SegmentedOption<'active' | 'completed'>[] = [
      {
        value: 'active', label: 'Ativas', icon: 'flag-outline', count: 4,
      },
      { value: 'completed', label: 'Concluídas', count: 0 },
    ];
    render(
      <SegmentedControl
        label="Status"
        options={goals}
        value="active"
        onChange={vi.fn()}
        size="sm"
      />,
    );
    const [active, completed] = screen.getAllByRole('radio')
      .map((radio) => radio.closest('label')!);

    expect(active!.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(active!.textContent).toBe('Ativas4');
    expect(completed!.querySelector('svg')).toBeNull();
    expect(completed!.textContent).toBe('Concluídas0');
  });

  it('styles the group and segments from the layout', () => {
    render(
      <SegmentedControl
        label="Tipo"
        options={CURRENCIES}
        value="USD"
        onChange={vi.fn()}
        layout="tiles"
      />,
    );
    const group = screen.getByRole('radiogroup');

    expect(group.className).toBe(segmentStyle({ layout: 'tiles' }).group);
    expect(group.querySelector('label')!.className).toBe(segmentStyle({ layout: 'tiles' }).segment);
  });
});

describe('segmentStyle', () => {
  it('defaults to medium pills', () => {
    expect(segmentStyle({})).toBe(segmentStyle({ layout: 'pills', size: 'md' }));
    expect(segmentStyle({}).segment).toContain('h-9');
  });

  it('shrinks pills by size', () => {
    expect(segmentStyle({ size: 'sm' }).segment).toContain('h-7.5');
    expect(segmentStyle({ size: 'xs' }).segment).toContain('h-6.5');
  });

  it('lays tiles out in equal columns with the icon on top', () => {
    const tiles = segmentStyle({ layout: 'tiles' });

    expect(tiles.group).toContain('grid-flow-col');
    expect(tiles.segment).toContain('flex-col');
  });
});
