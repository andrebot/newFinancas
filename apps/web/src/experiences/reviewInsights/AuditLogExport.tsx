import { failureOf } from '../../api/outcome';
import { useActiveHousehold } from '../../shell/activeHousehold';
import { useAlerts } from '../../utilities/AlertProvider';
import { useI18n } from '../../utilities/I18nProvider';
import downloadTextFile from '../../utilities/downloadTextFile';
import { useExportAuditLogMutation } from './api';
import { useDialogOpen, type DialogSwitch } from './dialogSwitch';
import { ExportAuditLog, type ExportRange } from './interactions/ExportAuditLog';

// The audit-log export (task 139; mockup 24; FR-7.2, OQ-243), Review
// Insights' part of the App Shell's chrome: the drawer opens the dialog
// through its switch; this host asks the API for the active household's log
// over the range, saves the CSV under the name the API gave it and closes the
// dialog. A refusal — Owner/Admin only, both days, the end not before the
// start — is a toast in the user's language; the dialog stays open.

/** The host's props. */
export interface AuditLogExportProps {
  /** Opened by the drawer's "Export audit log". */
  readonly dialog: DialogSwitch;
}

/**
 * Renders the export dialog for the active household.
 *
 * @param props - The dialog's switch.
 * @returns The dialog, or nothing until the household is known.
 */
export function AuditLogExport({ dialog }: AuditLogExportProps) {
  const translator = useI18n();
  const alerts = useAlerts();
  const open = useDialogOpen(dialog);
  const active = useActiveHousehold();
  const [exportLog, { isLoading }] = useExportAuditLogMutation();
  if (active.status !== 'ready') return null;
  const { household } = active.data;

  /**
   * Downloads the log over a range.
   *
   * @param range - The days, both included.
   */
  const download = async (range: ExportRange) => {
    const result = await exportLog({ householdId: household.id, ...range });
    if (result.error !== undefined) {
      const failure = failureOf(result.error);
      alerts.error(translator.error(failure.code, failure.params));
      return;
    }
    downloadTextFile(result.data.filename, result.data.csv, 'text/csv');
    alerts.success(translator.text('auditExport', 'done'));
    dialog.close();
  };

  return (
    <ExportAuditLog
      open={open}
      householdName={household.name}
      busy={isLoading}
      onClose={dialog.close}
      onDownload={download}
    />
  );
}
