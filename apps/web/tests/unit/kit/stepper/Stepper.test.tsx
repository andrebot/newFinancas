import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Stepper,
  connectorClasses,
  dotClasses,
  labelClasses,
  stepState,
  type StepperProps,
} from '../../../../src/kit/stepper/Stepper';

// Kit component (BDT: Interaction tier → unit): it only displays; nothing to
// stand in for.

const STEPS: StepperProps['steps'] = [
  { label: 'Add an account', hint: 'Where your money lives' },
  { label: 'Review categories', hint: 'What spending gets tagged with' },
  { label: 'Set a budget' },
];

/**
 * Renders the setup's three steps with the given current one.
 *
 * @param overrides - Props to change from the default stepper.
 * @returns The render result.
 */
const renderStepper = (overrides: Partial<StepperProps> = {}) => render(
  <Stepper
    steps={STEPS}
    current={1}
    ariaLabel="Setup steps"
    completedLabel="completed"
    {...overrides}
  />,
);

/**
 * Finds the steps' list items.
 *
 * @returns The items, in order.
 */
const stepItems = () => (
  within(screen.getByRole('list', { name: 'Setup steps' })).getAllByRole('listitem')
);

describe('stepState', () => {
  it('marks the steps before the current one done and the ones after it next', () => {
    expect(stepState(0, 1)).toBe('done');
    expect(stepState(1, 1)).toBe('current');
    expect(stepState(2, 1)).toBe('next');
  });
});

describe('dotClasses', () => {
  it('fills a done dot mint, rings the current one and outlines the next ones', () => {
    expect(dotClasses('done')).toContain('bg-mint text-onmint');
    expect(dotClasses('current')).toContain('bg-mintdeep text-mint ring-2 ring-mint');
    expect(dotClasses('next')).toContain('border border-line text-muted');
  });

  it('draws every dot as a 32px circle', () => {
    expect(dotClasses('next')).toContain('size-8 shrink-0 place-items-center rounded-full');
  });
});

describe('labelClasses', () => {
  it('writes the current label in ink, a done one muted and the next ones muted too', () => {
    expect(labelClasses('current')).toBe('text-sm font-semibold text-ink');
    expect(labelClasses('done')).toBe('text-sm font-semibold text-muted');
    expect(labelClasses('next')).toBe('text-sm font-semibold text-muted');
  });
});

describe('connectorClasses', () => {
  it('draws the connector mint after a done step and as a line otherwise', () => {
    expect(connectorClasses('done')).toContain('bg-mint');
    expect(connectorClasses('current')).toContain('bg-line');
    expect(connectorClasses('next')).toContain('bg-line');
  });

  it('runs across below lg and down under the dot from lg', () => {
    expect(connectorClasses('next')).toContain('h-px w-6 lg:ml-[15px] lg:h-8 lg:w-px');
  });
});

describe('Stepper', () => {
  it('lists every step in order under its accessible name', () => {
    renderStepper();
    expect(stepItems().map((item) => item.textContent)).toEqual([
      expect.stringContaining('Add an account'),
      expect.stringContaining('Review categories'),
      expect.stringContaining('Set a budget'),
    ]);
  });

  it('marks only the current step aria-current="step"', () => {
    renderStepper();
    const marks = stepItems().map((item) => item.getAttribute('aria-current'));
    expect(marks).toEqual([null, 'step', null]);
  });

  it('tells a screen reader a done step is completed, and no other', () => {
    renderStepper();
    const [done, current, next] = stepItems();
    expect(done?.textContent).toContain('Add an account (completed)');
    expect(current?.textContent).not.toContain('completed');
    expect(next?.textContent).not.toContain('completed');
  });

  it('numbers the steps not yet done and puts a check on the done ones', () => {
    const { container } = renderStepper();
    const dots = container.querySelectorAll('li > div > span[aria-hidden="true"]');
    expect(dots[0]?.querySelector('svg')).not.toBeNull();
    expect(dots[1]?.textContent).toContain('2');
    expect(dots[2]?.textContent).toContain('3');
  });

  it('shows the hints it is given', () => {
    renderStepper();
    expect(screen.getByText('Where your money lives').className).toContain('text-xs text-muted');
    expect(stepItems()[2]?.querySelectorAll('.text-xs')).toHaveLength(0);
  });

  it('keeps the step text for screen readers only below lg', () => {
    renderStepper();
    const text = screen.getByText('Review categories').parentElement;
    expect(text?.className).toContain('sr-only lg:not-sr-only');
  });

  it('draws a connector after every step but the last', () => {
    const { container } = renderStepper({ current: 2 });
    const connectors = container.querySelectorAll('li > div[aria-hidden="true"]');
    expect(connectors).toHaveLength(2);
    expect(connectors[0]?.className).toContain('bg-mint');
    expect(connectors[1]?.className).toContain('bg-mint');
  });

  it('shows the caption above the steps when given one', () => {
    renderStepper({ caption: 'Getting started · step 2 of 3' });
    const caption = screen.getByText('Getting started · step 2 of 3');
    expect(caption.className).toContain('type-label text-muted');
  });

  it('draws no caption without one', () => {
    const { container } = renderStepper();
    expect(container.querySelector('p')).toBeNull();
  });
});
