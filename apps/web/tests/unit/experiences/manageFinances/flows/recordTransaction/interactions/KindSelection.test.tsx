import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { KindSelection } from '../../../../../../../src/experiences/manageFinances/flows/recordTransaction/interactions/KindSelection';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Kind Group & Kind Selection (BDT: Interaction → unit): renders the groups
// and the group's kinds, emits picks; the real kit and catalog.

describe('KindSelection', () => {
  it('draws the four groups and the chosen group\'s kinds', () => {
    renderInLocale(
      <KindSelection
        kind="pix_payment"
        onGroupChange={vi.fn()}
        onKindChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('radio', { name: /Cash|Transfer|Credit card|Investment/ }))
      .toHaveLength(4);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Cash' }).checked).toBe(true);
    const kinds = screen.getByRole('radiogroup', { name: 'Kind' });
    expect(kinds.textContent).toBe('DepositWithdrawalBoletoPix paymentPix receipt');
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Pix payment' }).checked).toBe(true);
  });

  it('emits the group and the kind picked', () => {
    const onGroupChange = vi.fn();
    const onKindChange = vi.fn();
    renderInLocale(
      <KindSelection
        kind="pix_payment"
        onGroupChange={onGroupChange}
        onKindChange={onKindChange}
      />,
    );

    fireEvent.click(screen.getByText('Investment'));
    fireEvent.click(screen.getByText('Boleto'));

    expect(onGroupChange).toHaveBeenCalledWith('investment');
    expect(onKindChange).toHaveBeenCalledWith('boleto_payment');
  });

  it('shows an edit\'s kind locked, in Portuguese too', () => {
    renderInLocale(
      <KindSelection
        kind="investment_redemption"
        locked
        onGroupChange={vi.fn()}
        onKindChange={vi.fn()}
      />,
      'pt-BR',
    );

    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByText('Tipo')).toBeDefined();
    expect(screen.getByText('Resgate')).toBeDefined();
  });
});
