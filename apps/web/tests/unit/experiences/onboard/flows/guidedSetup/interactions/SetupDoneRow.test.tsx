import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  SetupDoneRow,
} from '../../../../../../../src/experiences/onboard/flows/guidedSetup/interactions/SetupDoneRow';

// A done row (BDT: Interaction, unit): display only.

describe('a done row', () => {
  it('shows its title, its detail and what sits at its end', () => {
    render(
      <ul>
        <SetupDoneRow
          title="Fun Money"
          detail="Dining"
          trailing={<button type="button">Edit</button>}
        />
      </ul>,
    );
    expect(screen.getByText('Fun Money')).toBeTruthy();
    expect(screen.getByText('Dining')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('leaves the detail out when there is none', () => {
    render(<ul><SetupDoneRow title="Main" /></ul>);
    expect(screen.getByRole('listitem').textContent).toBe('Main');
  });
});
