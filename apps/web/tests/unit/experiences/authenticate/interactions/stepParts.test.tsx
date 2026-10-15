import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  BackButton, StepAlert, StepHeading, TextAction,
} from '../../../../../src/experiences/authenticate/interactions/stepParts';
import { renderInLocale } from '../../../../support/renderInLocale';

// Display pieces of the Authenticate entries (BDT: Interaction tier → unit):
// nothing mocked but the click handlers.

describe('Authenticate step parts', () => {
  it('StepHeading draws the title and subtitle, with the icon tile only when given', () => {
    const { container, rerenderInLocale } = renderInLocale(
      <StepHeading title="Welcome back" subtitle="Sign in." />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeTruthy();
    expect(screen.getByText('Sign in.')).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();

    rerenderInLocale(<StepHeading icon="key-outline" title="Backup" subtitle="Once." />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('StepAlert shows an error banner only when there is a message', () => {
    const { rerenderInLocale } = renderInLocale(<StepAlert />);
    expect(screen.queryByRole('alert')).toBeNull();

    rerenderInLocale(<StepAlert message="Invalid verification code." />);
    expect(screen.getByRole('alert').textContent).toContain('Invalid verification code.');
  });

  it('TextAction is a plain button that emits its click', () => {
    const onClick = vi.fn();
    renderInLocale(<TextAction onClick={onClick} className="font-semibold">Create</TextAction>);
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Create' });

    fireEvent.click(button);

    expect(button.type).toBe('button');
    expect(button.className).toContain('font-semibold');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('BackButton is a named button that emits going back', () => {
    const onBack = vi.fn();
    renderInLocale(<BackButton label="Back" onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
