import { fireEvent, render, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { DangerZone, type DangerZoneProps } from '../../../../src/kit/card/DangerZone';

// Kit component (BDT: Interaction tier → unit): pure rendering, only the
// caller's handler is a stand-in.

/**
 * Renders the danger zone with a stand-in handler.
 *
 * @param props - The props to set or override.
 * @returns The handler and the render result.
 */
const renderZone = (props: Partial<DangerZoneProps> = {}) => {
  const onAction = vi.fn();
  const view = render(
    <DangerZone
      title="Delete account"
      description="Permanently deletes your data."
      actionLabel="Delete Account"
      onAction={onAction}
      {...props}
    />,
  );
  return { onAction, view };
};

const actionButton = () => screen.queryByRole('button', { name: 'Delete Account' });

describe('DangerZone', () => {
  it('renders a region named by its title, with the description and the button', () => {
    renderZone();

    expect(screen.getByRole('region', { name: 'Delete account' })).toBeTruthy();
    expect(screen.getByText('Permanently deletes your data.')).toBeTruthy();
    expect(actionButton()).toBeTruthy();
  });

  it('emits onAction from its button', () => {
    const { onAction } = renderZone();

    fireEvent.click(actionButton() as HTMLButtonElement);

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("shows the caller's confirm in the button's place", () => {
    renderZone({ confirm: <p>the confirm</p> });

    expect(screen.getByText('the confirm')).toBeTruthy();
    expect(actionButton()).toBeNull();
  });

  it('leaves the focus alone on first show', () => {
    renderZone();

    expect(document.activeElement).toBe(document.body);
  });

  it('focuses its button when back after a cancel', () => {
    const { view } = renderZone({ confirm: <p>the confirm</p> });

    view.rerender(
      <DangerZone
        title="Delete account"
        description="Permanently deletes your data."
        actionLabel="Delete Account"
        onAction={vi.fn()}
        returnFocus
      />,
    );

    expect(document.activeElement).toBe(actionButton());
  });
});
