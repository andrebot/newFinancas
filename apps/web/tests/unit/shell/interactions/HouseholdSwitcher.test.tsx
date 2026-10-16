import { fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  HouseholdSwitcher, householdRowClasses, switcherCardClasses, type HouseholdSwitcherProps,
} from '../../../../src/shell/interactions/HouseholdSwitcher';
import { renderInLocale } from '../../../support/renderInLocale';
import { HOUSEHOLDS } from '../shellFakes';

// Interaction (BDT: unit, display state in, events out).

/**
 * Renders the switcher with spies, Doe active, and unfolds it.
 *
 * @param props - Props to override.
 * @returns The spies.
 */
const renderOpen = (props: Partial<HouseholdSwitcherProps> = {}) => {
  const handlers = {
    onSwitch: vi.fn(), onOpenInvitations: vi.fn(), onCreateHousehold: vi.fn(),
  };
  renderInLocale(
    <HouseholdSwitcher
      households={HOUSEHOLDS}
      activeId="doe"
      pendingInvitationCount={0}
      {...handlers}
      {...props}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /^Household/ }));
  return handlers;
};

describe('HouseholdSwitcher', () => {
  it('names the active household while folded', () => {
    renderInLocale(
      <HouseholdSwitcher
        households={HOUSEHOLDS}
        activeId="rivera"
        pendingInvitationCount={0}
        onSwitch={vi.fn()}
        onOpenInvitations={vi.fn()}
        onCreateHousehold={vi.fn()}
      />,
    );
    const toggle = screen.getByRole('button', { name: 'Household The Rivera Household' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('lists every household with the role, the active one current, and emits a pick', () => {
    const { onSwitch } = renderOpen();

    const rows = screen.getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'The Doe Household Owner', 'The Rivera Household Member',
    ]);
    const doe = screen.getByRole('button', { name: 'The Doe Household Owner' });
    const rivera = screen.getByRole('button', { name: 'The Rivera Household Member' });
    expect(doe.getAttribute('aria-current')).toBe('true');
    expect(rivera.hasAttribute('aria-current')).toBe(false);
    // The active row alone carries the check mark beside its glyph.
    expect(doe.querySelectorAll('svg')).toHaveLength(2);
    expect(rivera.querySelectorAll('svg')).toHaveLength(1);
    fireEvent.click(rivera);
    expect(onSwitch).toHaveBeenCalledWith('rivera');
  });

  it('offers pending invitations only when some wait, and Create household always', () => {
    const { onOpenInvitations, onCreateHousehold } = renderOpen({ pendingInvitationCount: 2 });

    fireEvent.click(screen.getByRole('button', { name: 'Pending invitations 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create household' }));
    expect(onOpenInvitations).toHaveBeenCalledOnce();
    expect(onCreateHousehold).toHaveBeenCalledOnce();
  });

  it('hides pending invitations when none wait', () => {
    renderOpen();
    expect(screen.queryByRole('button', { name: /Pending invitations/ })).toBeNull();
  });

  it('folds back up', () => {
    renderOpen();
    fireEvent.click(screen.getByRole('button', { name: /^Household/ }));
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('tints the active row and the unfolded card in mint', () => {
    expect(householdRowClasses(true)).toContain('bg-mint/10');
    expect(householdRowClasses(false)).not.toContain('bg-mint/10');
    expect(switcherCardClasses(true)).toContain('border-mint/40');
    expect(switcherCardClasses(false)).toContain('border-line');
  });

  it('speaks pt-BR', () => {
    renderInLocale(
      <HouseholdSwitcher
        households={HOUSEHOLDS}
        activeId="doe"
        pendingInvitationCount={0}
        onSwitch={vi.fn()}
        onOpenInvitations={vi.fn()}
        onCreateHousehold={vi.fn()}
      />,
      'pt-BR',
    );
    fireEvent.click(screen.getByRole('button', { name: /^Casa/ }));
    expect(screen.getByRole('button', { name: 'The Doe Household Proprietário' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Criar casa' })).toBeTruthy();
  });
});
