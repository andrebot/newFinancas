import { act, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  RoleMenu, roleOptions, type RoleMenuProps,
} from '../../../../../../../src/experiences/manageHousehold/flows/membershipManagement/interactions/RoleMenu';
import { createTranslator } from '../../../../../../../src/utilities/i18n';
import { renderInLocale } from '../../../../../../support/renderInLocale';

// Interaction (BDT: unit, display state in, events out): the real kit menu
// and translator; only the Flow's handler is a stand-in.

/**
 * Renders the role with a stand-in handler, in en-US.
 *
 * @param props - The props to set or override.
 * @returns The handler.
 */
const renderRole = (props: Partial<RoleMenuProps> = {}) => {
  const onChange = vi.fn();
  renderInLocale(
    <RoleMenu
      name="Sam Costa"
      current="Member"
      editable
      disabled={false}
      onChange={onChange}
      {...props}
    />,
  );
  return onChange;
};

describe('RoleMenu', () => {
  it('lists the assignable roles with what each may do', () => {
    expect(roleOptions(createTranslator('en-US'))).toEqual([
      {
        value: 'Admin',
        label: 'Admin',
        description: 'Manage members, roles, and all shared data',
        icon: 'shield-person-outline',
      },
      {
        value: 'Member',
        label: 'Member',
        description: 'Record transactions and manage shared data they created',
        icon: 'edit-note-outline',
      },
      {
        value: 'Viewer',
        label: 'Viewer',
        description: 'Read-only access to shared data',
        icon: 'visibility-outline',
      },
    ]);
  });

  it('opens the roles from the pill, the current one checked, and emits the pick', async () => {
    const onChange = renderRole();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Sam Costa's role: Member" }));
    });

    expect(screen.getByRole('menu', { name: "Sam Costa's role" })).toBeTruthy();
    expect(screen.getByRole('menuitemradio', { name: /Member/ }).getAttribute('aria-checked'))
      .toBe('true');
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: /Viewer/ }));
    });
    expect(onChange).toHaveBeenCalledWith('Viewer');
  });

  it('waits while a request is out', () => {
    renderRole({ disabled: true });
    expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(true);
  });

  it("shows the Owner's role as the crowned pill, never a menu", () => {
    renderRole({ current: 'Owner' });
    expect(screen.getByText('Owner')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a role nobody here may change as a plain label', () => {
    renderInLocale(
      <RoleMenu
        name="Sam Costa"
        current="Viewer"
        editable={false}
        disabled={false}
        onChange={vi.fn()}
      />,
      'pt-BR',
    );
    expect(screen.getByText('Visualizador')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
