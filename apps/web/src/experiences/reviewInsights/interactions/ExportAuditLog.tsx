import { useState } from 'react';
import { auditExport as settings } from '../../../config/constants';
import { Button } from '../../../kit/button/Button';
import { Dialog } from '../../../kit/dialog/Dialog';
import { DateRangePicker } from '../../../kit/dateRangePicker/DateRangePicker';
import {
  choosePreset, type DateRange, type DateRangeValue,
} from '../../../kit/dateRangePicker/dateRangePresets';
import { useI18n } from '../../../utilities/I18nProvider';
import useToday from '../../../utilities/useToday';
import {
  dateRangeEnd, firstError, isoDate, required, type FieldError,
} from '../../../utilities/validation';

// Export Audit Log (task 139; mockup 24; FR-7.2, OQ-77, OQ-243): the small
// dialog that asks for the date range — Last 30 days, Last 90 days, This
// year or Custom — and starts the CSV download. Both days are required and
// the last not before the first, as the API checks them too. Only Owners and
// Admins reach it: the drawer shows the option to them alone. Display and
// the range it edits only: the Experience runs the download and closes it.

/** The days a download asks for, both included, `YYYY-MM-DD`. */
export interface ExportRange {
  readonly startDate: string;
  readonly endDate: string;
}

/** Export Audit Log's props. */
export interface ExportAuditLogProps {
  readonly open: boolean;
  /** The household the log is for, in the subtitle. */
  readonly householdName: string;
  /** Whether a download is running: Download CSV waits. */
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onDownload: (range: ExportRange) => unknown;
}

/** What is wrong with each end, if anything. */
interface RangeProblems {
  readonly from?: FieldError | undefined;
  readonly to?: FieldError | undefined;
}

/**
 * Checks a range: both days required, each a real date, the last not before the first.
 *
 * @param range - The days as the picker holds them.
 * @returns The problems; none when the range can be sent.
 */
export const rangeProblemsOf = ({ from, to }: DateRange): RangeProblems => ({
  from: firstError(required, isoDate())(from),
  to: firstError(required, dateRangeEnd(from))(to),
});

/**
 * Renders the dialog.
 *
 * @param props - Whether it is open, the household, whether a download runs and the handlers.
 * @returns The dialog.
 */
export function ExportAuditLog({
  open, householdName, busy, onClose, onDownload,
}: ExportAuditLogProps) {
  const translator = useI18n();
  const today = useToday();
  const [range, setRange] = useState<DateRangeValue>(() => (
    choosePreset({ preset: 'custom', from: '', to: '' }, settings.initialPreset, today)
  ));
  const [checked, setChecked] = useState(false);
  const problems = checked ? rangeProblemsOf(range) : {};
  const errorOf = (problem: FieldError | undefined) => (
    problem && translator.field(problem.code, problem.params)
  );

  /** Sends the range once it holds, else shows what is wrong. */
  const download = () => {
    const found = rangeProblemsOf(range);
    setChecked(true);
    if (found.from || found.to) return;
    onDownload({ startDate: range.from, endDate: range.to });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={translator.text('auditExport', 'title')}
      subtitle={translator.text('auditExport', 'subtitle', { household: householdName })}
      icon="download"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>
            {translator.text('auditExport', 'cancel')}
          </Button>
          <Button variant="primary" disabled={busy} onClick={download}>
            {translator.text('auditExport', 'download')}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-5">
        <DateRangePicker
          label={translator.text('auditExport', 'range')}
          labelHidden
          presets={settings.presets}
          value={range}
          onChange={setRange}
          errors={{ from: errorOf(problems.from), to: errorOf(problems.to) }}
        />
        <p className="type-caption text-faint">{translator.text('auditExport', 'note')}</p>
      </div>
    </Dialog>
  );
}
