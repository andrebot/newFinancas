import {
  act, fireEvent, render, screen,
} from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router';
import useLinkedHolding from '../../../../src/experiences/trackInvestments/useLinkedHolding';
import { LocationProbe } from '../../shell/shellFakes';

// The Holding a link opened the Holdings tab on (BDT: unit over a memory
// router; nothing mocked) — OQ-243, PR #172 review.

/**
 * Shows the linked Holding and its visit, with buttons that follow links.
 *
 * @returns The probe.
 */
function Probe() {
  const linked = useLinkedHolding();
  const navigate = useNavigate();
  const visited = linked.visit === 'none' ? 'none' : 'visit';
  return (
    <>
      <output data-testid="linked">{`${linked.holdingId ?? '-'}@${visited}`}</output>
      <output data-testid="visit">{linked.visit}</output>
      <button type="button" onClick={() => navigate('/investments?tab=holdings&holding=h-2')}>
        h-2
      </button>
      <button type="button" onClick={() => navigate('/investments?tab=rates')}>rates</button>
    </>
  );
}

/**
 * Renders the probe at an address.
 *
 * @param path - Where it opens.
 */
const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Probe />
    <LocationProbe />
  </MemoryRouter>,
);

/**
 * Follows one of the probe's links.
 *
 * @param name - The button.
 */
const follow = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

describe('useLinkedHolding', () => {
  it('links nothing without the parameter', () => {
    renderAt('/investments?tab=holdings');

    expect(screen.getByTestId('linked').textContent).toBe('-@none');
  });

  it('takes the Holding the address names, then drops it from the address', () => {
    renderAt('/investments?tab=holdings&holding=h-1');

    expect(screen.getByTestId('linked').textContent).toBe('h-1@visit');
    expect(screen.getByTestId('location').textContent).toBe('/investments?tab=holdings');
    expect(screen.getByTestId('location').dataset.navigation).toBe('REPLACE');
  });

  it('takes a link followed while open, as a new visit', async () => {
    renderAt('/investments?tab=holdings&holding=h-1');
    const first = screen.getByTestId('visit').textContent;

    await follow('h-2');

    expect(screen.getByTestId('linked').textContent).toBe('h-2@visit');
    expect(screen.getByTestId('visit').textContent).not.toBe(first);
    expect(screen.getByTestId('location').textContent).toBe('/investments?tab=holdings');
  });

  it('takes the same link again as a new visit, so its row opens again', async () => {
    renderAt('/investments?tab=holdings');
    await follow('h-2');
    const first = screen.getByTestId('visit').textContent;

    await follow('h-2');

    expect(screen.getByTestId('visit').textContent).not.toBe(first);
  });

  it('keeps the Holding taken across other changes of address', async () => {
    renderAt('/investments?tab=holdings&holding=h-1');

    await follow('rates');

    expect(screen.getByTestId('linked').textContent).toBe('h-1@visit');
  });
});
