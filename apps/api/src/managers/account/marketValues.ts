import { isFixedTerm } from '@financas/reference';
import type {
  DateRange, ManualRefusal, Valuation, ValuationSnapshot,
} from '../../accessors/valuationSnapshotAccessor';
import { dateWithin } from '../../utilities/validation';
import type { SignedInContext } from '../requestContext';
import requireValidFields from '../validation';
import { requestLogger, todayOf, type AccountDeps } from './context';
import { holdingNotMarketPriced, snapshotRefused } from './errors';
import { loadHolding, requireOpenHolding, type HoldingIds } from './holdingAccess';

// A market-priced Holding's manual market values (track-investments/uc-05..07,
// FR-5.2, OQ-56): Valuation Snapshots the user records, corrects or deletes. A
// fixed-term Holding is valued by its contract, never by a snapshot (OQ-51);
// an automatic snapshot changes only with its transaction.

/** A market value as the route validated it. */
export interface MarketValueInput {
  /** Minor units of the Holding's Account currency, zero or more. */
  readonly value: number;
  /** `YYYY-MM-DD`. */
  readonly asOf: string;
}

/** A market value correction: either field may be left out. */
export interface MarketValueEdit {
  readonly value?: number | undefined;
  readonly asOf?: string | undefined;
}

/**
 * The fields a correction changes, in ValuationSnapshotAccessor's names.
 *
 * @param edit - The correction.
 * @returns What `updateManual` writes; fields not sent are left out.
 */
export const valuationChangesOf = (edit: MarketValueEdit): Partial<Valuation> => ({
  ...(edit.value === undefined ? {} : { valuation: edit.value }),
  ...(edit.asOf === undefined ? {} : { asOfDate: edit.asOf }),
});

/**
 * Loads an open, market-priced Holding the caller may maintain, refusing a
 * date after today.
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param ids - The household and the Holding.
 * @param asOf - The value's date, if one is sent.
 * @throws {DomainError} `household.not_found` / `holding.not_found`;
 *   `auth.forbidden`; `holding.archived` / `holding.not_market_priced`;
 *   `validation.failed`.
 */
const requireMaintainable = async (
  deps: AccountDeps,
  context: SignedInContext,
  ids: HoldingIds,
  asOf: string | undefined,
): Promise<void> => {
  const { holding } = await loadHolding(deps, context, ids, 'data.edit');
  requireOpenHolding(holding);
  if (isFixedTerm(holding.assetType)) throw holdingNotMarketPriced();
  requireValidFields({ asOf }, { asOf: dateWithin({ max: todayOf(deps) }) });
};

/**
 * Reads a manual snapshot back for an empty correction, answering as a write
 * would: another Holding's is `not_found`, an automatic one `automatic`.
 *
 * @param deps - The tier below.
 * @param holdingId - The Holding.
 * @param snapshotId - The snapshot.
 * @returns The snapshot, or why a write would be refused.
 */
const readBack = async (
  deps: AccountDeps,
  holdingId: string,
  snapshotId: string,
): Promise<ValuationSnapshot | ManualRefusal> => {
  const found = (await deps.valuations.list(holdingId)).find(({ id }) => id === snapshotId);
  if (!found) return 'not_found';
  return found.source === 'manual' ? found : 'automatic';
};

/**
 * Builds the market value use cases.
 *
 * @param deps - The tier below.
 * @returns `listValuationSnapshots`, `recordMarketValue`, `editMarketValue`,
 *   `deleteMarketValue`.
 */
const createMarketValues = (deps: AccountDeps) => ({
  /**
   * A Holding's value history, manual and automatic (FR-5.2/5.4); a fixed-term
   * one has none (OQ-51).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param holdingId - The Holding.
   * @param range - Optional inclusive date bounds.
   * @returns The snapshots, newest first.
   * @throws {DomainError} `household.not_found` / `holding.not_found`.
   */
  listValuationSnapshots: async (
    context: SignedInContext,
    householdId: string,
    holdingId: string,
    range: DateRange,
  ): Promise<ValuationSnapshot[]> => {
    await loadHolding(deps, context, { householdId, holdingId }, 'data.view');
    return deps.valuations.list(holdingId, range);
  },

  /**
   * Records a market value (uc-05, FR-5.2).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param holdingId - The Holding.
   * @param input - The value and its date, not after today.
   * @returns The snapshot.
   * @throws {DomainError} `household.not_found` / `holding.not_found`;
   *   `auth.forbidden`; `holding.archived` / `holding.not_market_priced`;
   *   `validation.failed`.
   */
  recordMarketValue: async (
    context: SignedInContext,
    householdId: string,
    holdingId: string,
    input: MarketValueInput,
  ): Promise<ValuationSnapshot> => {
    await requireMaintainable(deps, context, { householdId, holdingId }, input.asOf);
    const snapshot = await deps.valuations.insertManual(holdingId, {
      valuation: input.value, asOfDate: input.asOf,
    });
    requestLogger(context).audit('RecordMarketValue', {
      entityType: 'ValuationSnapshot', entityId: snapshot.id, householdId,
    });
    return snapshot;
  },

  /**
   * Corrects a manual market value's amount and/or date (uc-06, OQ-56). An empty
   * edit reads it back, unaudited.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param holdingId - The Holding.
   * @param snapshotId - The snapshot.
   * @param edit - The fields to change; a date not after today.
   * @returns The snapshot as it now stands.
   * @throws {DomainError} `household.not_found` / `holding.not_found` /
   *   `snapshot.not_found`; `auth.forbidden`; `holding.archived` /
   *   `holding.not_market_priced` / `snapshot.automatic_not_editable`;
   *   `validation.failed`.
   */
  editMarketValue: async (
    context: SignedInContext,
    householdId: string,
    holdingId: string,
    snapshotId: string,
    edit: MarketValueEdit,
  ): Promise<ValuationSnapshot> => {
    await requireMaintainable(deps, context, { householdId, holdingId }, edit.asOf);
    const changes = valuationChangesOf(edit);
    if (Object.keys(changes).length === 0) {
      const found = await readBack(deps, holdingId, snapshotId);
      if (typeof found === 'string') throw snapshotRefused(found);
      return found;
    }
    const result = await deps.valuations.updateManual(holdingId, snapshotId, changes);
    if (typeof result === 'string') throw snapshotRefused(result);
    requestLogger(context).audit('EditMarketValue', {
      entityType: 'ValuationSnapshot', entityId: snapshotId, householdId,
    });
    return result;
  },

  /**
   * Deletes a manual market value; the previous snapshot is the Holding's value
   * again (uc-07, OQ-56).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param holdingId - The Holding.
   * @param snapshotId - The snapshot.
   * @throws {DomainError} `household.not_found` / `holding.not_found` /
   *   `snapshot.not_found`; `auth.forbidden`; `holding.archived` /
   *   `holding.not_market_priced` / `snapshot.automatic_not_editable`.
   */
  deleteMarketValue: async (
    context: SignedInContext,
    householdId: string,
    holdingId: string,
    snapshotId: string,
  ): Promise<void> => {
    await requireMaintainable(deps, context, { householdId, holdingId }, undefined);
    const result = await deps.valuations.deleteManual(holdingId, snapshotId);
    if (result !== 'deleted') throw snapshotRefused(result);
    requestLogger(context).audit('DeleteMarketValue', {
      entityType: 'ValuationSnapshot', entityId: snapshotId, householdId,
    });
  },
});

export default createMarketValues;
