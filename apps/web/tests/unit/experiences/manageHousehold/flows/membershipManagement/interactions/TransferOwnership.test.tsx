import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  TransferOwnershipButton, TransferOwnershipConfirm,
} from '../../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/TransferOwnership';
import type {
  HouseholdMember,
} from '../../../../../../../src/experiences/manageHousehold/flows/membershipManagement/membershipState';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit menu,
// confirm and translator; only the Flow's handlers are stand-ins.

const ALEX: HouseholdMember = {
  userId: 'alex',
  firstName: 'Alex',
  lastName: 'Rivera',
  email: 'alex@example.com',
  role: 'Admin',
  joinedAt: '2024-03-01T00:00:00Z',
};
const PRIYA: HouseholdMember = {
  ...ALEX, userId: 'priya', firstName: 'Priya', lastName: 'Shah', role: 'Viewer',
};

describe('TransferOwnershipButton', () => {
  it('lists every candidate, any role, and emits the one picked', async () => {
    const onPick = vi.fn();
    renderInLocale(
      <TransferOwnershipButton candidates={[ALEX, PRIYA]} disabled={false} onPick={onPick} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Transfer ownership' }));
    });

    expect(screen.getByRole('menuitem', { name: /Alex Rivera/ }).textContent).toContain('Admin');
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Priya Shah/ }));
    });
    expect(onPick).toHaveBeenCalledWith('priya');
  });

  it('waits while a request is out', () => {
    renderInLocale(<TransferOwnershipButton candidates={[ALEX]} disabled onPick={vi.fn()} />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Transfer ownership' }).disabled)
      .toBe(true);
  });
});

describe('TransferOwnershipConfirm', () => {
  it('names the future Owner and emits confirm and cancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderInLocale(
      <TransferOwnershipConfirm
        name="Alex Rivera"
        busy={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText('Make Alex Rivera the Owner? You will become an Admin.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Transfer ownership' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
