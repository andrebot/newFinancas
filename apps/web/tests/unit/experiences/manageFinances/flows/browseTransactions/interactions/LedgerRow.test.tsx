import { cleanup, fireEvent, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import {
  LedgerRow, type LedgerRowProps,
} from '../../../../../../../src/experiences/manageFinances/flows/browseTransactions/interactions/LedgerRow';
import { renderInLocale } from '../../../../../../support/renderInLocale';
import {
  LOOKUP, accountRowOf, cardRowOf, omit,
} from '../fixtures';

// Expanded Row and Delete Confirm (BDT: Interaction → unit): renders the row,
// its details and actions, emits up; the real kit and catalog.

/**
 * Renders a row with handlers to watch.
 *
 * @param over - The props to change.
 * @returns The handlers.
 */
const renderRow = (over: Partial<LedgerRowProps> = {}) => {
  const handlers = {
    onExpandedChange: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onConfirmDelete: vi.fn(),
    onCancelDelete: vi.fn(),
  };
  renderInLocale(
    <ul>
      <li>
        <LedgerRow
          item={cardRowOf()}
          lookup={LOOKUP}
          access="manage"
          expanded={false}
          confirming={false}
          deleting={false}
          {...handlers}
          {...over}
        />
      </li>
    </ul>,
  );
  return handlers;
};

describe('LedgerRow', () => {
  it('draws the title, meta line and signed amount, and asks to open', () => {
    const { onExpandedChange } = renderRow();

    const trigger = screen.getByRole('button', { expanded: false });
    expect(trigger.textContent).toContain('Netflix');
    expect(trigger.textContent).toContain('Visa •••• 1111 · Housing · Charge');
    expect(trigger.textContent).toMatch(/−R\$\s39,90/);
    fireEvent.click(trigger);
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });

  it("draws an uncategorized row with its kind's glyph", () => {
    renderRow({ item: omit(accountRowOf({ categoryId: null }), 'currency') });

    expect(screen.getByRole('button').textContent).toContain('Itaú Conta · Pix payment');
  });

  it('opens to its details, and emits Edit and Delete', () => {
    const { onEdit, onDelete } = renderRow({ expanded: true });

    const details = screen.getByRole('region');
    expect(details.textContent).toContain('Kind');
    expect(details.textContent).toContain('Charge');
    expect(details.textContent).toContain('09/12/2026');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('notes an archived account instead of the actions', () => {
    renderRow({ expanded: true, access: 'archived' });

    expect(screen.getByText("Its account is archived, so this transaction can't be changed."))
      .toBeDefined();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('offers nothing when the user may not change it', () => {
    renderRow({ expanded: true, access: 'none' });

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByText(/archived/)).toBeNull();
  });

  it('draws a row\'s Category disc, else its kind\'s glyph (review V4)', () => {
    renderRow();
    expect(document.querySelector('li [style]')).not.toBeNull();
    cleanup();

    renderRow({ item: cardRowOf({ categoryId: null }) });
    expect(document.querySelector('li [style]')).toBeNull();
  });

  it('tags no row the user wrote (review V4)', () => {
    renderRow({ expanded: true, item: accountRowOf({ source: 'manual' }) });

    expect(screen.queryByText('Posted automatically')).toBeNull();
  });

  it('tags a row the schedule posted', () => {
    renderRow({ expanded: true, item: accountRowOf({ source: 'schedule' }) });

    expect(screen.getByText('Posted automatically')).toBeDefined();
  });

  it('shows no failure banner while nothing failed (review V10)', () => {
    renderRow({ expanded: true, confirming: true });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('asks before deleting, in place of the actions, with the last failure', () => {
    const { onConfirmDelete, onCancelDelete } = renderRow({
      expanded: true, confirming: true, failure: 'This buy has started paying out.',
    });

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.getByText('This buy has started paying out.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Delete transaction' }));
    expect(onConfirmDelete).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancelDelete).toHaveBeenCalled();
  });

  it('holds the confirm busy while the delete is out', () => {
    renderRow({ expanded: true, confirming: true, deleting: true });

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(true);
  });
});
