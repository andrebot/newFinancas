import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LockedField } from '../../../../../../../src/experiences/accountSetup/flows/accountManagement/interactions/LockedField';

// A locked field (BDT: unit, display only): its label and its value, nothing to change.

describe('LockedField', () => {
  it('shows its label and value, and no input', () => {
    const { container } = render(<LockedField label="Visibility" value="Personal" />);
    expect(screen.getByText('Visibility')).toBeTruthy();
    expect(screen.getByText('Personal')).toBeTruthy();
    expect(container.querySelector('input')).toBeNull();
  });
});
