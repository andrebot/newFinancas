import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import { failureOf } from '../../api/outcome';
import type { HandlerOutcome, NotificationHandler } from '../../shell/notificationRouting';
import { selectActiveHouseholdId, type ThunkExtra } from '../../shell/shellState';
import type { RootState } from '../../store';
import type { Alerts } from '../../utilities/AlertProvider';
import type { Translator } from '../../utilities/i18n';
import { assetTypeName } from '../holdingNames';
import { trackInvestmentsApi } from './api';

// Archive Matured Holding (task 141, OQ-245; FR-5.8, uc-03): Track
// Investments' standalone action, started only by the bell's "Archive holding"
// on a `holding.matured` notice, which the App Shell routes here. The notice
// is the question ("…still has a position. Archive it?"), so nothing asks
// again. The Holding is archived in the household the notice names — the
// bell is the user's, not a household's — or, for a notice without one, in the
// active household. The archive refreshes the Holdings, the overview and the
// Goals by tag; the shell deletes the notice once this reports `done`.

/** How the action tells the user what happened: the page's toasts, in their language. */
export interface ArchiveFeedback {
  readonly alerts: Alerts;
  readonly translator: Translator;
}

/** The matured Holding a notice names. */
export interface MaturedHolding {
  readonly holdingId: string;
  /** The notice's household; undefined for a notice sent without one. */
  readonly householdId: string | undefined;
  readonly ticker: string | null;
  readonly assetType: string | undefined;
}

/** The Archive Matured Holding thunk. */
type ArchiveThunk = ThunkAction<Promise<HandlerOutcome>, RootState, ThunkExtra, UnknownAction>;

/**
 * Reads a param as text.
 *
 * @param params - The notification's params.
 * @param key - The param.
 * @returns Its text, or undefined when it isn't one.
 */
const textParam = (params: Readonly<Record<string, unknown>>, key: string) => {
  const value = params[key];
  return typeof value === 'string' ? value : undefined;
};

/**
 * Reads the Holding a `holding.matured` notice names.
 *
 * @param params - The notification's params.
 * @returns The Holding, or undefined when the notice names none.
 */
export const maturedHoldingOf = (
  params: Readonly<Record<string, unknown>>,
): MaturedHolding | undefined => {
  const holdingId = textParam(params, 'holdingId');
  if (holdingId === undefined) return undefined;
  return {
    holdingId,
    householdId: textParam(params, 'householdId'),
    ticker: textParam(params, 'ticker') ?? null,
    assetType: textParam(params, 'assetType'),
  };
};

/**
 * Names a Holding as the notice did: its ticker, else its asset type.
 *
 * @param holding - The Holding.
 * @param translator - The current locale's translator.
 * @returns Its name.
 */
export const maturedHoldingName = (holding: MaturedHolding, translator: Translator) => (
  holding.ticker ?? assetTypeName(translator, holding.assetType)
);

/**
 * Archives a matured Holding and toasts the result.
 *
 * @param holding - The Holding the notice names.
 * @param feedback - The page's toasts and translator.
 * @returns The thunk; it resolves `done` once archived, else `failed`.
 */
export const archiveMaturedHolding = (
  holding: MaturedHolding,
  feedback: ArchiveFeedback,
): ArchiveThunk => async (dispatch, getState) => {
  const householdId = holding.householdId ?? selectActiveHouseholdId(getState());
  if (householdId === null) return 'failed';
  const request = dispatch(trackInvestmentsApi.endpoints.archiveHolding.initiate({
    householdId, holdingId: holding.holdingId,
  }));
  const result = await request;
  request.reset();
  const { alerts, translator } = feedback;
  if (result.error !== undefined) {
    const failure = failureOf(result.error);
    alerts.error(translator.error(failure.code, failure.params));
    return 'failed';
  }
  alerts.success(translator.text('trackInvestments', 'archive.done', {
    name: maturedHoldingName(holding, translator),
  }));
  return 'done';
};

/**
 * Builds the App Shell's route for `holding.matured`: the bell's Archive
 * holding, carrying the Holding (and its household) in the notice's params.
 *
 * @param dispatch - The page's store dispatch.
 * @param feedback - The page's toasts and translator.
 * @returns The handler; an action it can't read is `failed`.
 */
export const maturedHoldingRoute = (
  dispatch: (thunk: ArchiveThunk) => Promise<HandlerOutcome>,
  feedback: ArchiveFeedback,
): NotificationHandler => async (action) => {
  const holding = maturedHoldingOf(action.params);
  if (holding === undefined || action.action !== 'archive') return 'failed';
  return dispatch(archiveMaturedHolding(holding, feedback));
};
