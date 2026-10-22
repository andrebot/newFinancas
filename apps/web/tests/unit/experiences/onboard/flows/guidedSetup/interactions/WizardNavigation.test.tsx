import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  WizardNavigation,
} from '../../../../../../../src/experiences/onboard/flows/guidedSetup/interactions/WizardNavigation';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Wizard Navigation (BDT: Interaction, unit): the real kit and translator;
// only the step's handlers are stand-ins.

describe('the foot', () => {
  it('shows the note where Back would be, and emits its primary action', () => {
    const onClick = vi.fn();
    renderInLocale(
      <WizardNavigation note="An account is required." primary={{ label: 'Go', onClick }} />,
    );
    expect(screen.getByText('An account is required.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('emits Back and the secondary action', () => {
    const onBack = vi.fn();
    const onSecondary = vi.fn();
    renderInLocale(
      <WizardNavigation
        onBack={onBack}
        secondary={{ label: 'Create budget', onClick: onSecondary }}
        primary={{ label: 'Finish setup', onClick: vi.fn() }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create budget' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onSecondary).toHaveBeenCalledOnce();
  });

  it('holds Back and a disabled action while a request is out', () => {
    renderInLocale(
      <WizardNavigation
        onBack={vi.fn()}
        backDisabled
        primary={{ label: 'Finish setup', onClick: vi.fn(), disabled: true }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Back' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Finish setup' })).toHaveProperty('disabled', true);
  });

  it('shows what to confirm above the buttons', () => {
    renderInLocale(
      <WizardNavigation confirm={<p>Discard it?</p>} primary={{ label: 'Go', onClick: vi.fn() }} />,
    );
    expect(screen.getByText('Discard it?')).toBeTruthy();
  });
});
