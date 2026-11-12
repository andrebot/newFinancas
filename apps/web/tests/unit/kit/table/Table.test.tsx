import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Amount } from '../../../../src/kit/amount/Amount';
import {
  Table, gridTemplateOf, type TableColumn, type TableGroup,
} from '../../../../src/kit/table/Table';

// Kit component (BDT: Interaction tier → unit): it renders the caller's
// columns, groups and rows on K42's real expandable; nothing to stand in for.

/** A sample holding, as mockup 51 draws one. */
interface SampleHolding {
  readonly id: string;
  readonly ticker: string;
  readonly name: string;
  readonly value: number;
}

const SELIC: SampleHolding = {
  id: 'selic', ticker: 'SELIC29', name: 'Tesouro Selic 2029', value: 14_000_000,
};
const IPCA: SampleHolding = {
  id: 'ipca', ticker: 'IPCA35', name: 'Tesouro IPCA+ 2035', value: 6_000_000,
};
const XPML: SampleHolding = {
  id: 'xpml', ticker: 'XPML11', name: 'XP FII Fund', value: 11_000_000,
};
const KNRI: SampleHolding = {
  id: 'knri', ticker: 'KNRI11', name: 'Kinea Renda Imobiliária', value: 4_500_000,
};
const VALE: SampleHolding = {
  id: 'vale', ticker: 'VALE3', name: 'Vale S.A.', value: 360_000,
};

/** The table's columns, as the holdings page passes them (mockup 51's tracks). */
const COLUMNS: readonly TableColumn[] = [
  { label: 'Investment', track: 'minmax(0,2.2fr)' },
  { label: 'Type', track: '110px' },
  { label: 'Value', track: '140px', className: 'text-right' },
];

/** The two groups of mockup 51's XP Investimentos account. */
const GROUPS: readonly TableGroup<SampleHolding>[] = [
  {
    label: 'Fixed income',
    aside: <Amount amount={20_000_000} currency="BRL" />,
    items: [SELIC,
      IPCA],
  },
  {
    label: 'Variable income',
    aside: <Amount amount={15_860_000} currency="BRL" />,
    items: [XPML,
      KNRI, VALE],
  },
];

/** The one account with a single group and no asides or footer. */
const ONE_GROUP: readonly TableGroup<SampleHolding>[] = [
  { label: 'Fixed income', items: [SELIC, IPCA] },
];

/**
 * Renders the sample table.
 *
 * @param groups - The groups to show; defaults to both of mockup 51's.
 * @param footer - What sits at the table's end, when it has one.
 * @returns The rendered table.
 */
const renderTable = (groups: readonly TableGroup<SampleHolding>[] = GROUPS, footer?: ReactNode) => (
  render(
    <Table<SampleHolding>
      columns={COLUMNS}
      groups={groups}
      keyOf={(holding) => holding.id}
      renderItem={(holding) => (
        <>
          <span>{holding.ticker}</span>
          <span>{holding.name}</span>
          <Amount amount={holding.value} currency="BRL" />
        </>
      )}
      renderPanel={(holding) => (
        <p>
          Panel for
          {' '}
          {holding.name}
        </p>
      )}
      footer={footer}
    />,
  )
);

/**
 * Finds the row's list item by a piece of its cells' text.
 *
 * @param name - The holding's name, in the row's cells.
 * @returns The row's `li`.
 */
const listItemOf = (name: string) => screen.getByText(name).closest('li') as HTMLLIElement;

describe('gridTemplateOf', () => {
  it('joins every column\'s track as given, in order', () => {
    expect(gridTemplateOf(COLUMNS)).toBe('minmax(0,2.2fr) 110px 140px');
  });

  it('takes every track as given and leaves none out', () => {
    const template = gridTemplateOf([{ label: 'A', track: '110px' }, {
      label: 'B',
      track: 'minmax(0,1fr)',
    }]);
    expect(template).toBe('110px minmax(0,1fr)');
  });

  it('normalizes a bare fraction to a zero minimum, so it sizes content-independently', () => {
    const template = gridTemplateOf([
      { label: 'A', track: '1fr' },
      { label: 'B', track: '2.5fr' },
      { label: 'C', track: 'minmax(0,1fr)' },
    ]);
    expect(template).toBe('minmax(0,1fr) minmax(0,2.5fr) minmax(0,1fr)');
  });

  it('wraps a padded bare fraction, and only a whole one (R4 V9)', () => {
    expect(gridTemplateOf([{ label: 'A', track: ' 1fr ' }])).toBe('minmax(0,1fr)');
    expect(gridTemplateOf([{ label: 'A', track: 'auto 1fr' }])).toBe('auto 1fr');
    expect(gridTemplateOf([{ label: 'A', track: '1fr auto' }])).toBe('1fr auto');
  });
});

describe('Table', () => {
  it('renders the column headers in order over the shared grid', () => {
    renderTable();
    const labelGrid = screen.getByText('Investment').parentElement as HTMLElement;
    expect(labelGrid.style.gridTemplateColumns).toBe('minmax(0,2.2fr) 110px 140px');
    expect(screen.getByText('Type')).toBeTruthy();
    expect(screen.getByText('Value').className).toContain('text-right');
  });

  it('mirrors K42\'s trigger box in the header, reserving its chevron slot', () => {
    renderTable();
    const labelGrid = screen.getByText('Investment').parentElement as HTMLElement;
    const headerRow = labelGrid.parentElement as HTMLElement;
    expect(headerRow.className).toContain('flex');
    expect(headerRow.children).toHaveLength(2);
    const slot = headerRow.children.item(1) as HTMLElement;
    expect(slot.getAttribute('aria-hidden')).toBe('true');
    expect(slot.className).toContain('size-5');
  });

  it('renders each group under its small-caps row with the caller\'s aside at its end', () => {
    renderTable();
    const fixed = screen.getByText('Fixed income').parentElement as HTMLElement;
    expect(fixed.className).toContain('type-label');
    expect(fixed.querySelector('.tabular-nums')).not.toBeNull();
  });

  it('leaves a group row bare when the caller passes no aside', () => {
    renderTable(ONE_GROUP);
    const fixed = screen.getByText('Fixed income').parentElement as HTMLElement;
    expect(fixed.textContent).toBe('Fixed income');
    expect(fixed.querySelector('.tabular-nums')).toBeNull();
  });

  it('renders each holding\'s cells in column order over the shared grid', () => {
    renderTable();
    const cellGrid = screen.getByText(SELIC.name).closest('[style]') as HTMLElement;
    expect(cellGrid.style.gridTemplateColumns).toBe('minmax(0,2.2fr) 110px 140px');
    // The seam with K42: the row's grid sits in its summary box (min-w-0 flex-1),
    // so it gets exactly the width the header's label grid does.
    expect((cellGrid.parentElement as HTMLElement).className).toContain('min-w-0 flex-1');
    expect(screen.getAllByText(SELIC.ticker)).toHaveLength(1);
  });

  it('closes every row at first: no panel, the trigger unexpanded', () => {
    renderTable();
    expect(screen.queryByText(/Panel for/)).toBeNull();
    const trigger = screen.getByRole('button', { name: /Tesouro Selic 2029/ });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a row on its trigger and closes it again, the panel only while open', () => {
    renderTable();
    const trigger = screen.getByRole('button', { name: /Tesouro Selic 2029/ });
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Panel for Tesouro Selic 2029')).toBeTruthy();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(/Panel for/)).toBeNull();
  });

  it('lets two rows stay open at once, as mockup 51 draws them', () => {
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: /Tesouro Selic 2029/ }));
    fireEvent.click(screen.getByRole('button', { name: /XP FII Fund/ }));
    expect(screen.getByText('Panel for Tesouro Selic 2029')).toBeTruthy();
    expect(screen.getByText('Panel for XP FII Fund')).toBeTruthy();
  });

  it('keeps a hairline under closed rows but not the table\'s last one', () => {
    renderTable();
    expect(listItemOf(SELIC.name).className).toContain('border-b');
    expect(listItemOf(IPCA.name).className).toContain('border-b');
    expect(listItemOf(VALE.name).className).not.toContain('border-b');
  });

  it('drops the hairline under an opened row, which is edged in mint instead', () => {
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: /Tesouro Selic 2029/ }));
    expect(listItemOf(SELIC.name).className).not.toContain('border-b');
  });

  it('renders the caller\'s footer at its end, and nothing when it passes none', () => {
    const { rerender } = renderTable(GROUPS, <span>5 holdings</span>);
    expect(screen.getByText('5 holdings')).toBeTruthy();
    rerender(
      <Table<SampleHolding>
        columns={COLUMNS}
        groups={GROUPS}
        keyOf={(holding) => holding.id}
        renderItem={() => null}
        renderPanel={() => null}
      />,
    );
    expect(screen.queryByText('5 holdings')).toBeNull();
    expect(document.querySelector('[class*="bg-raised/40"]')).toBeNull();
  });

  it(
    'keeps a row open across re-renders, so an account switched away from comes back as left',
    () => {
      const { rerender } = renderTable(GROUPS);
      fireEvent.click(screen.getByRole('button', { name: /Tesouro Selic 2029/ }));
      rerender(
        <Table<SampleHolding>
          columns={COLUMNS}
          groups={[{ label: 'Variable income', items: [XPML] }]}
          keyOf={(holding) => holding.id}
          renderItem={() => null}
          renderPanel={() => null}
        />,
      );
      rerender(
        <Table<SampleHolding>
          columns={COLUMNS}
          groups={GROUPS}
          keyOf={(holding) => holding.id}
          renderItem={(holding) => <span>{holding.name}</span>}
          renderPanel={() => null}
        />,
      );
      const trigger = screen.getByRole('button', { name: /Tesouro Selic 2029/ });
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
    },
  );

  it('renders only its headers when the caller passes no groups', () => {
    renderTable([]);
    expect(screen.getByText('Investment')).toBeTruthy();
    expect(document.querySelectorAll('li')).toHaveLength(0);
  });
});
