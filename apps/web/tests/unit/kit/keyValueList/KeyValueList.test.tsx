import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_VALUE,
  KV_CAPTION,
  KV_SUFFIX,
  KeyValueList,
  type KeyValueListProps,
  fullValue,
  valueClasses,
} from '../../../../src/kit/keyValueList/KeyValueList';

// Kit component (BDT: Interaction tier → unit): display only, nothing to
// stand in for.

/**
 * Renders a list with a fixed spoken label for missing values.
 *
 * @param props - The list's props, but the empty label.
 * @returns The render result.
 */
const renderList = (props: Omit<KeyValueListProps, 'emptyLabel'>) => render(
  <KeyValueList emptyLabel="Not set" {...props} />,
);

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

describe('fullValue', () => {
  it('spells the value out with its suffix', () => {
    expect(fullValue({ label: 'Payout', value: 'R$890.00', suffix: '/mo' })).toBe('R$890.00/mo');
    expect(fullValue({ label: 'Kind', value: 'Charge' })).toBe('Charge');
  });

  it('has nothing to spell out for a missing or empty value', () => {
    expect(fullValue({ label: 'Payout', suffix: '/mo' })).toBeUndefined();
    expect(fullValue({ label: 'Payout', value: '', suffix: '/mo' })).toBeUndefined();
  });
});

describe('KeyValueList', () => {
  it('pairs each caption with its value inside one group, in order', () => {
    const { container } = renderList({
      items: [{ label: 'Kind', value: 'Charge' }, { label: 'Date', value: '12/09/2026' }],
    });

    const pairs = Array.from(container.querySelectorAll('dl > div'));
    expect(pairs.map((pair) => Array.from(pair.children).map((child) => child.tagName)))
      .toEqual([['DT', 'DD'], ['DT', 'DD']]);
    expect(pairs.map((pair) => pair.textContent)).toEqual(['KindCharge', 'Date12/09/2026']);
    expect(screen.getByText('Kind').className).toBe(KV_CAPTION);
  });

  it('renders pairs that share a caption', () => {
    const { container } = renderList({
      items: [{ label: 'Card', value: 'Visa' }, { label: 'Card', value: 'Mastercard' }],
    });

    expect(Array.from(container.querySelectorAll('dd')).map((value) => value.textContent))
      .toEqual(['Visa', 'Mastercard']);
  });

  it('defaults to two columns at the small size', () => {
    const { container } = renderList({ items: [{ label: 'Kind', value: 'Charge' }] });

    expect(container.querySelector('dl')!.className)
      .toBe('m-0 grid grid-cols-2 gap-x-3 gap-y-3 md:gap-x-6');
    expect(container.querySelector('dl > div')!.className).toBe('flex min-w-0 flex-col gap-1');
  });

  it('lays three columns at the large size when asked', () => {
    const { container } = renderList({
      size: 'lg', columns: 3, items: [{ label: 'Invested', value: 'R$140,000.00' }],
    });

    expect(container.querySelector('dl')!.className).toBe('m-0 grid grid-cols-3 gap-x-4 gap-y-3');
    expect(container.querySelector('dl > div')!.className).toBe('flex min-w-0 flex-col');
  });

  it('puts the suffix after the value, and both in the title', () => {
    renderList({ items: [{ label: 'Payout', value: 'R$890.00', suffix: '/mo' }] });

    const value = valueOf('Payout');
    expect(value.textContent).toBe('R$890.00/mo');
    expect(value.getAttribute('title')).toBe('R$890.00/mo');
    expect(screen.getByText('/mo').className).toBe(KV_SUFFIX);
  });

  it('shows a dash for a missing value, its spoken label to screen readers only', () => {
    renderList({ items: [{ label: 'Payout', suffix: '/mo' }] });

    const value = valueOf('Payout');
    const [dash, spoken] = Array.from(value.children);
    expect(dash!.textContent).toBe(EMPTY_VALUE);
    expect(dash!.getAttribute('aria-hidden')).toBe('true');
    expect(spoken!.textContent).toBe('Not set');
    expect(spoken!.className).toBe('sr-only');
    expect(value.textContent).toBe(`${EMPTY_VALUE}Not set`);
    expect(value.hasAttribute('title')).toBe(false);
  });

  it('treats an empty value as missing, with no title', () => {
    renderList({ items: [{ label: 'Maturity', value: '' }] });

    const value = valueOf('Maturity');
    expect(value.textContent).toBe(`${EMPTY_VALUE}Not set`);
    expect(value.hasAttribute('title')).toBe(false);
  });
});
