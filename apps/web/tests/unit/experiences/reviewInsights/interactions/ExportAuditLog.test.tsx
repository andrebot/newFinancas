import { fireEvent, screen } from '@testing-library/react';
import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import {
  ExportAuditLog, rangeProblemsOf, type ExportAuditLogProps,
} from '../../../../../src/experiences/reviewInsights/interactions/ExportAuditLog';
import { renderInLocale } from '../../../../support/renderInLocale';

// Export Audit Log (BDT: Interaction, unit): the dialog, its range and what
// it checks before emitting the download. Nothing to mock — the kit's Dialog
// and date range picker and the translator stay real; the clock is fixed.

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 29, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Renders the dialog, open.
 *
 * @param over - Props to change.
 * @param locale - The locale.
 * @returns The props.
 */
const renderDialog = (
  over: Partial<ExportAuditLogProps> = {},
  locale: 'en-US' | 'pt-BR' = 'en-US',
) => {
  const props: ExportAuditLogProps = {
    open: true,
    householdName: 'The Doe Household',
    busy: false,
    onClose: vi.fn(),
    onDownload: vi.fn(),
    ...over,
  };
  renderInLocale(<ExportAuditLog {...props} />, locale);
  return props;
};

/**
 * Replaces a date input's text as the browser does when typing at the end.
 *
 * @param name - `From` or `To`.
 * @param text - Its text after the edit.
 */
const typeDate = (name: string, text: string) => {
  const input = screen.getByRole<HTMLInputElement>('textbox', { name });
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setValue?.call(input, text);
  input.setSelectionRange(text.length, text.length);
  fireEvent.input(input);
};

/**
 * Reads the error under a date.
 *
 * @param name - `From` or `To`.
 * @returns Its text, if any.
 */
const errorUnder = (name: string) => {
  const input = screen.getByRole('textbox', { name });
  const id = input.getAttribute('aria-describedby');
  return id ? document.getElementById(id)?.textContent : undefined;
};

describe('rangeProblemsOf', () => {
  it('needs both days, real ones, the last not before the first', () => {
    expect(rangeProblemsOf({ from: '2026-09-01', to: '2026-09-30' }))
      .toEqual({ from: undefined, to: undefined });
    expect(rangeProblemsOf({ from: '2026-09-01', to: '2026-09-01' }))
      .toEqual({ from: undefined, to: undefined });
    expect(rangeProblemsOf({ from: '', to: '' }))
      .toEqual({ from: { code: 'field.required' }, to: { code: 'field.required' } });
    expect(rangeProblemsOf({ from: '2026-09-02', to: '2026-09-01' }).to)
      .toEqual({ code: 'date.before_start' });
    expect(rangeProblemsOf({ from: '2026-13', to: '2026-09-01' }).from)
      .toEqual({ code: 'string.format', params: { format: 'date' } });
  });
});

describe('ExportAuditLog', () => {
  it('asks for the household\'s log over the last 30 days at first (mockup 24)', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Export audit log' })).toBeTruthy();
    expect(screen.getByText('The Doe Household · CSV')).toBeTruthy();
    // The range's label is hidden: it is the chips' and dates' only name.
    expect(screen.getByRole('group', { name: 'Date range' })).toBeTruthy();
    const chips = screen.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent);
    expect(chips).toEqual(['Last 30 days', 'Last 90 days', 'This year', 'Custom']);
    const first = screen.getByRole<HTMLInputElement>('radio', { name: 'Last 30 days' });
    expect(first.checked).toBe(true);
    expect(screen.getByText(/^Who did what and when/)).toBeTruthy();
  });

  it('emits the chosen range on Download CSV', () => {
    const props = renderDialog();

    fireEvent.click(screen.getByRole('radio', { name: 'This year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    expect(props.onDownload)
      .toHaveBeenCalledWith({ startDate: '2026-01-01', endDate: '2026-10-29' });
  });

  it('shows what is wrong, and emits nothing, until the range holds', () => {
    const props = renderDialog();

    typeDate('From', '10/30/2026');
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    expect(errorUnder('To')).toBe('Can\'t be before the start date.');
    expect(errorUnder('From')).toBeFalsy();
    expect(props.onDownload).not.toHaveBeenCalled();

    typeDate('From', '10/01/2026');
    expect(errorUnder('To')).toBeFalsy();
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(props.onDownload)
      .toHaveBeenCalledWith({ startDate: '2026-10-01', endDate: '2026-10-29' });
  });

  it('needs both days', () => {
    const props = renderDialog();

    typeDate('From', '');
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    expect(errorUnder('From')).toBe('Required.');
    expect(props.onDownload).not.toHaveBeenCalled();
  });

  it('waits while a download runs, and closes on Cancel', () => {
    const props = renderDialog({ busy: true });

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Download CSV' }).disabled)
      .toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('draws nothing while closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('speaks pt-BR', () => {
    renderDialog({}, 'pt-BR');

    expect(screen.getByRole('dialog', { name: 'Exportar log de auditoria' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Baixar CSV' })).toBeTruthy();
  });
});
