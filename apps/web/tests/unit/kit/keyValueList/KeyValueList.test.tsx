import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_VALUE,
  KV_CAPTION,
  KV_SUFFIX,
  KeyValueList,
  valueClasses,
} from '../../../../src/kit/keyValueList/KeyValueList';

// Kit component (BDT: Interaction tier → unit): display only, nothing to
// stand in for.

/**
 * Finds a pair's value by its caption.
 *
 * @param label - The pair's caption.
 * @returns The `<dd>` beside that caption.
 */
const valueOf = (label: string) => screen.getByText(label).nextElementSibling!;

describe('valueClasses', () => {
  it('sets a small value in the ink, on one truncated line', () => {
    expect(valueClasses({ label: 'Kind', value: 'Charge' }, 'sm'))
      .toBe('m-0 truncate type-body-sm text-ink');
  });

  it('sets a large value in display type, in its tone, with tabular figures', () => {
    expect(valueClasses({
      label: 'Payout', value: 'R$890.00', tone: 'mint', numeric: true,
    }, 'lg')).toBe('m-0 truncate type-heading-sm text-mint tabular-nums');
    expect(valueClasses({ label: 'Expected taxes', value: '−R$10,830.00', tone: 'coral' }, 'lg'))
      .toBe('m-0 truncate type-heading-sm text-coral');
  });

  it('mutes a missing value, whatever its tone', () => {
    expect(valueClasses({ label: 'Maturity', tone: 'mint' }, 'sm'))
      .toBe('m-0 truncate type-body-sm text-muted');
    expect(valueClasses({ label: 'Maturity', value: '' }, 'lg'))
      .toBe('m-0 truncate type-heading-sm text-muted');
  });
});

describe('KeyValueList', () => {
  it('pairs each caption with its value inside one group, in order', () => {
    const { container } = render(
      <KeyValueList
        items={[{ label: 'Kind', value: 'Charge' }, { label: 'Date', value: '12/09/2026' }]}
      />,
    );

    const pairs = Array.from(container.querySelectorAll('dl > div'));
    expect(pairs.map((pair) => Array.from(pair.children).map((child) => child.tagName)))
      .toEqual([['DT', 'DD'], ['DT', 'DD']]);
    expect(pairs.map((pair) => pair.textContent)).toEqual(['KindCharge', 'Date12/09/2026']);
    expect(screen.getByText('Kind').className).toBe(KV_CAPTION);
  });

  it('defaults to two columns at the small size', () => {
    const { container } = render(<KeyValueList items={[{ label: 'Kind', value: 'Charge' }]} />);

    expect(container.querySelector('dl')!.className)
      .toBe('m-0 grid grid-cols-2 gap-x-3 gap-y-3 md:gap-x-6');
    expect(container.querySelector('dl > div')!.className).toBe('flex min-w-0 flex-col gap-1');
  });

  it('lays three columns at the large size when asked', () => {
    const { container } = render(
      <KeyValueList size="lg" columns={3} items={[{ label: 'Invested', value: 'R$140,000.00' }]} />,
    );

    expect(container.querySelector('dl')!.className).toBe('m-0 grid grid-cols-3 gap-x-4 gap-y-3');
    expect(container.querySelector('dl > div')!.className).toBe('flex min-w-0 flex-col');
  });

  it('puts the suffix after the value and the full value in the title', () => {
    render(<KeyValueList items={[{ label: 'Payout', value: 'R$890.00', suffix: '/mo' }]} />);

    const value = valueOf('Payout');
    expect(value.textContent).toBe('R$890.00/mo');
    expect(value.getAttribute('title')).toBe('R$890.00');
    expect(screen.getByText('/mo').className).toBe(KV_SUFFIX);
  });

  it('shows a dash for a missing value, without its suffix or a title', () => {
    render(
      <KeyValueList
        items={[{ label: 'Payout', suffix: '/mo' }, { label: 'Maturity', value: '' }]}
      />,
    );

    expect(valueOf('Payout').textContent).toBe(EMPTY_VALUE);
    expect(valueOf('Payout').hasAttribute('title')).toBe(false);
    expect(valueOf('Maturity').textContent).toBe(EMPTY_VALUE);
  });
});
