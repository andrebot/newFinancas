import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  RemoveMemberConfirm,
} from '../../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/RemoveMemberConfirm';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit confirm
// and translator; only the Flow's handlers are stand-ins.

describe('RemoveMemberConfirm', () => {
  it('names the member and emits confirm and cancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderInLocale(
      <RemoveMemberConfirm
        name="Sam Costa"
        busy={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText(
      'Remove Sam Costa from the household? They lose access to its shared data.',
    )).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('locks cancel while the remove is out', () => {
    renderInLocale(
      <RemoveMemberConfirm name="Sam Costa" busy onConfirm={vi.fn()} onCancel={vi.fn()} />,
      'pt-BR',
    );
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancelar' }).disabled)
      .toBe(true);
  });
});
