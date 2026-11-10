import type { HistoryOutcome } from '../../kit/historyEditor/historyModel';
import type { Alerts } from '../../utilities/AlertProvider';
import type { RequestFailure, RequestOutcome } from '../../utilities/requestOutcome';

// How a Track Investments Flow answers K46/K47 (OQ-232, OQ-234): the
// Experience's request comes back ok or with a failure's code; the Flow turns
// that into `done` or `refused` and a toast either way. Shared by Holding
// Maintenance (FL19) and Rates Maintenance (FL20), so neither imports the other.

/**
 * Turns a request's answer into K46's outcome, with a toast either way.
 *
 * @param request - The request.
 * @param doneText - The success toast.
 * @param alerts - The page's toasts.
 * @param errorText - Writes a failure's code.
 * @returns `done` on success, `refused` otherwise.
 */
const answerOf = async (
  request: Promise<RequestOutcome>,
  doneText: string,
  alerts: Alerts,
  errorText: (failure: RequestFailure) => string,
): Promise<HistoryOutcome> => {
  const outcome = await request;
  if (outcome.ok) {
    alerts.success(doneText);
    return 'done';
  }
  alerts.error(errorText(outcome.error));
  return 'refused';
};

export default answerOf;
