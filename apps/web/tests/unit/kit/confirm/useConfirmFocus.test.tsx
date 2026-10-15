import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useConfirmFocus } from '../../../../src/kit/confirm/useConfirmFocus';

// Kit hook (BDT: Interaction tier → unit): nothing mocked; a tiny host gives
// the hook a real cancel button in jsdom.

/**
 * Hosts the hook: its cancel button gives focus back when clicked.
 *
 * @returns The host's cancel button.
 */
function Host() {
  const { cancelRef, restoreFocus } = useConfirmFocus();
  return <button ref={cancelRef} type="button" onClick={restoreFocus}>Cancelar</button>;
}

describe('useConfirmFocus', () => {
  it('focuses cancel on open and gives focus back to the earlier holder', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    render(<Host />);

    const cancel = screen.getByRole('button', { name: 'Cancelar' });
    expect(document.activeElement).toBe(cancel);
    fireEvent.click(cancel);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
