import { act, screen } from '@testing-library/react';
import {
  describe, expect, it, vi,
} from 'vitest';
import { AuditLogExport } from '../../../../src/experiences/reviewInsights/AuditLogExport';
import { createDialogSwitch } from '../../../../src/experiences/reviewInsights/dialogSwitch';
import type { ExportAuditLogProps } from '../../../../src/experiences/reviewInsights/interactions/ExportAuditLog';
import { householdChosen } from '../../../../src/shell/shellState';
import { AlertProvider } from '../../../../src/utilities/AlertProvider';
import { createAlertQueue } from '../../../../src/utilities/alerts';
import downloadTextFile from '../../../../src/utilities/downloadTextFile';
import { envelope, jsonResponse } from '../../api/fakes';
import {
  deferred, fakeFetch, press, settle, settleWith, shownBy, Stub, type Answers,
} from '../experienceFakes';
import { fakeStore, renderWithShell } from '../../shell/shellFakes';

// The audit-log export host (BDT: integration at the Experience tier). The
// Export Audit Log Interaction is a stub; beneath it, the real store and API
// client — only `fetch` is fake — and the download Utility's sink, the one
// external boundary it touches, is a spy.

vi.mock('../../../../src/utilities/downloadTextFile', () => ({ default: vi.fn() }));

vi.mock('../../../../src/experiences/reviewInsights/interactions/ExportAuditLog', () => ({
  /**
   * The dialog's stand-in.
   *
   * @param props - What the host passes.
   * @returns The stub.
   */
  ExportAuditLog: ({
    open, householdName, busy, onClose, onDownload,
  }: ExportAuditLogProps) => (
    <Stub
      name="export"
      shows={{ open, householdName, busy }}
      events={{
        close: onClose,
        download: () => {
          onDownload({ startDate: '2026-09-01', endDate: '2026-09-30' });
        },
      }}
    />
  ),
}));

const DOE = {
  id: 'doe', name: 'The Doe Household', createdAt: '2025-03-01T00:00:00Z', role: 'Owner',
};

/** Answers for a signed-in Owner of Doe whose export works. */
const LOADED: Answers = {
  'GET /users/me': () => jsonResponse(200, {
    id: 'jane',
    email: 'j@x.com',
    firstName: 'Jane',
    lastName: 'Doe',
    createdAt: '2024-01-01T00:00:00Z',
  }),
  'GET /households': () => jsonResponse(200, { data: [DOE] }),
  'GET /households/doe/audit-log/export': () => new Response('timestamp\r\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="audit-log-2026-09-01-2026-09-30.csv"',
    },
  }),
};

/**
 * Renders the host over the real store, signed in with Doe active, its dialog open.
 *
 * @param answers - The API's answers, over the usual ones.
 * @returns The dialog's switch and the fake `fetch`.
 */
const renderHost = async (answers: Answers = {}) => {
  const fetchFn = fakeFetch({ ...LOADED, ...answers });
  const { store } = fakeStore({ fetchFn, refreshToken: 'r-0' });
  store.dispatch(householdChosen('doe'));
  const dialog = createDialogSwitch();
  dialog.open();
  renderWithShell(
    <AlertProvider queue={createAlertQueue(3)}>
      <AuditLogExport dialog={dialog} />
    </AlertProvider>,
    store,
  );
  await settle();
  await settle();
  return { dialog, fetchFn };
};

describe('AuditLogExport (FR-7.2, OQ-243)', () => {
  it('shows the dialog for the active household while its switch is on', async () => {
    const { dialog } = await renderHost();

    expect(shownBy('export')).toEqual({
      open: true, householdName: 'The Doe Household', busy: false,
    });
    await act(async () => dialog.close());
    expect(shownBy('export')).toEqual(expect.objectContaining({ open: false }));
  });

  it('downloads the CSV under the API\'s name, says so and closes', async () => {
    const { dialog, fetchFn } = await renderHost();

    await press('download');

    const [input] = fetchFn.mock.calls.at(-1)!;
    expect(new URL((input as Request).url).search).toBe('?startDate=2026-09-01&endDate=2026-09-30');
    expect(downloadTextFile).toHaveBeenCalledWith(
      'audit-log-2026-09-01-2026-09-30.csv',
      'timestamp\r\n',
      'text/csv',
    );
    expect(screen.getByText('Audit log downloaded.')).toBeTruthy();
    expect(dialog.isOpen()).toBe(false);
  });

  it('waits while the download runs', async () => {
    const pending = deferred();
    await renderHost({ 'GET /households/doe/audit-log/export': () => pending.promise });

    await press('download');
    expect(shownBy('export')).toEqual(expect.objectContaining({ busy: true }));

    const csv = new Response('a', { status: 200, headers: { 'Content-Type': 'text/csv' } });
    await settleWith(pending, csv);
    expect(shownBy('export')).toEqual(expect.objectContaining({ busy: false }));
  });

  it('toasts a refusal in the user\'s language and stays open', async () => {
    const { dialog } = await renderHost({
      'GET /households/doe/audit-log/export': () => jsonResponse(403, envelope('auth.forbidden')),
    });

    await press('download');

    expect(screen.getByText('You don\'t have permission to do that.')).toBeTruthy();
    expect(dialog.isOpen()).toBe(true);
  });

  it('closes on the dialog\'s close', async () => {
    const { dialog } = await renderHost();

    await press('close');

    expect(dialog.isOpen()).toBe(false);
  });

  it('draws nothing until the household is known', async () => {
    await renderHost({ 'GET /users/me': () => new Promise(() => {}) });

    expect(screen.queryByTestId('export')).toBeNull();
  });
});
