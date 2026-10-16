import { screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { DrawerIdentity } from '../../../../src/shell/interactions/DrawerIdentity';
import { renderInLocale } from '../../../support/renderInLocale';
import { JANE } from '../shellFakes';

// Interaction (BDT: unit, display state in).

describe('DrawerIdentity', () => {
  it('greets the user by first name, with their initials and email', () => {
    renderInLocale(<DrawerIdentity identity={{ status: 'ready', data: JANE }} />);
    expect(screen.getByText('Hello, Jane')).toBeTruthy();
    expect(screen.getByText('jane.doe@example.com')).toBeTruthy();
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('announces the loading profile', () => {
    renderInLocale(<DrawerIdentity identity={{ status: 'loading' }} />);
    expect(screen.getByRole('status').textContent).toBe('Loading your profile');
  });

  it('goes without the identity when the profile failed', () => {
    const { container } = renderInLocale(
      <DrawerIdentity identity={{ status: 'failed', retry: vi.fn() }} />,
    );
    expect(container.textContent).toBe('');
  });

  it('speaks pt-BR', () => {
    renderInLocale(<DrawerIdentity identity={{ status: 'ready', data: JANE }} />, 'pt-BR');
    expect(screen.getByText('Olá, Jane')).toBeTruthy();
  });
});
