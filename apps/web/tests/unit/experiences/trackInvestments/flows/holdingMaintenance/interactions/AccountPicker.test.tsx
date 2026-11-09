import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { accountCardsOf } from '../../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/holdingMaintenance';
import { AccountPicker } from '../../../../../../../src/experiences/trackInvestments/flows/holdingMaintenance/interactions/AccountPicker';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import { HOLDINGS, INVESTMENT_ACCOUNTS, OVERVIEW } from '../../../../portfolioFixtures';

// Account Picker (BDT: Interaction, unit; nothing mocked but the handler).

const CARDS = accountCardsOf(INVESTMENT_ACCOUNTS, HOLDINGS, OVERVIEW.allocations);

describe('AccountPicker', () => {
  it('draws each account with its value and open holdings, the chosen one pressed', () => {
    renderInLocale(<AccountPicker cards={CARDS} selectedId="xp" onSelect={vi.fn()} />);

    const group = screen.getByRole('group', { name: 'Account' });
    const buttons = screen.getAllByRole('button');
    expect(group.contains(buttons[0]!)).toBe(true);
    expect(buttons.map((button) => button.getAttribute('aria-pressed')))
      .toEqual(['true', 'false', 'false']);
    expect(buttons[0]!.textContent).toBe('XP InvestimentosR$ 158.600,004 holdings · BRL');
    expect(buttons[2]!.textContent).toContain('1 holding · USD');
  });

  it('emits the account chosen', () => {
    const onSelect = vi.fn();
    renderInLocale(<AccountPicker cards={CARDS} selectedId="xp" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /Main Checking/ }));

    expect(onSelect).toHaveBeenCalledWith('checking');
  });
});
