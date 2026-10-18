import { INDEX_CODES, type IndexCode, type IndexCodeValue } from '@financas/reference';
import type { DatedRate, IndexRateValue } from '../../accessors/indexRateAccessor';
import type { DataAction } from '../../utilities/authorization';
import { dateWithin } from '../../utilities/validation';
import { accessToOwned, requireAccess } from '../access';
import type { SignedInContext } from '../requestContext';
import requireValidFields from '../validation';
import { requestLogger, todayOf, type AccountDeps } from './context';
import { indexRateDuplicateDay, indexRateNotFound } from './errors';

// Index Reference Rates (track-investments/uc-08..10, FR-11.6, OQ-59): a
// household's manual, dated history per index, which InvestmentProductEngine
// reads for index-linked projections. Shared data whose recorder counts as its
// creator: any member but a Viewer records a value; Owner/Admin, or the Member
// who recorded it, corrects or deletes it (OQ-178).

/** A value as the route validated it. */
export interface IndexRateInput {
  /** Percent × 10,000 (OQ-86). */
  readonly value: number;
  /** `YYYY-MM-DD`. */
  readonly asOf: string;
}

/** A correction: either field may be left out. */
export interface IndexRateEdit {
  readonly value?: number | undefined;
  readonly asOf?: string | undefined;
}

/** One index with its history — the Rates tab's card. */
export interface IndexRateSeries {
  readonly index: IndexCodeValue;
  readonly unit: IndexCode['unit'];
  /** Newest first. */
  readonly values: readonly IndexRateValue[];
}

/** The household, the index and the value a request names. */
interface RateIds {
  readonly householdId: string;
  readonly indexCode: IndexCodeValue;
  readonly valueId: string;
}

/**
 * Groups a household's values into one series per index, in the in-code order;
 * an index with no value has an empty history (OQ-172, OQ-178).
 *
 * @param values - Every value, by index and newest first.
 * @returns One series per index.
 */
export const seriesOf = (values: readonly IndexRateValue[]): IndexRateSeries[] => (
  INDEX_CODES.map(({ code, unit }) => ({
    index: code, unit, values: values.filter((value) => value.indexCode === code),
  }))
);

/**
 * The fields a correction changes, in IndexRateAccessor's names.
 *
 * @param edit - The correction.
 * @returns What `update` writes; fields not sent are left out.
 */
export const rateChangesOf = (edit: IndexRateEdit): Partial<DatedRate> => ({
  ...(edit.value === undefined ? {} : { value: edit.value }),
  ...(edit.asOf === undefined ? {} : { asOfDate: edit.asOf }),
});

/**
 * Refuses a value dated after today: `latest` is simply the highest date (OQ-172).
 *
 * @param deps - The clock.
 * @param asOf - The date, if one is sent.
 * @throws {ApiError} 422 `validation.failed` (`date.max` on `asOf`).
 */
const requirePastDate = (deps: AccountDeps, asOf: string | undefined): void => (
  requireValidFields({ asOf }, { asOf: dateWithin({ max: todayOf(deps) }) })
);

/**
 * Loads a value the caller may correct or delete: its recorder counts as its
 * creator (OQ-178).
 *
 * @param deps - The tier below.
 * @param context - The signed-in request.
 * @param ids - The household, the index and the value.
 * @param action - `data.edit` or `data.delete`.
 * @returns The value.
 * @throws {ApiError} 404 `household.not_found` / `index_rate.not_found`; 403 `auth.forbidden`.
 */
const loadRate = async (
  deps: AccountDeps,
  context: SignedInContext,
  ids: RateIds,
  action: DataAction,
): Promise<IndexRateValue> => {
  const rate = await deps.indexRates.findById(ids.householdId, ids.indexCode, ids.valueId);
  await requireAccess(deps.authorization, context.actor.userId, ids.householdId, accessToOwned(
    rate && { visibility: 'shared', ownerUserId: rate.createdByUserId },
    action,
  ), indexRateNotFound);
  if (!rate) throw indexRateNotFound();
  return rate;
};

/**
 * Builds the index rate use cases.
 *
 * @param deps - The tier below.
 * @returns `listIndexRates`, `recordIndexRate`, `editIndexRate`, `deleteIndexRate`.
 */
const createIndexRates = (deps: AccountDeps) => ({
  /**
   * Every index with its value history — the Rates tab (FR-11.6, OQ-172).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @returns One series per index.
   * @throws {ApiError} 404 `household.not_found`.
   */
  listIndexRates: async (
    context: SignedInContext,
    householdId: string,
  ): Promise<IndexRateSeries[]> => {
    await requireAccess(deps.authorization, context.actor.userId, householdId, accessToOwned(
      undefined,
      'data.view',
    ));
    return seriesOf(await deps.indexRates.list(householdId));
  },

  /**
   * Records a value of an index (uc-08, FR-11.6): one per index per day.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param indexCode - The index, from the route.
   * @param input - The value and its date, not after today.
   * @returns The value.
   * @throws {ApiError} 404 `household.not_found`; 403 `auth.forbidden`; 409
   *   `index_rate.duplicate_day`; 422 `validation.failed`.
   */
  recordIndexRate: async (
    context: SignedInContext,
    householdId: string,
    indexCode: IndexCodeValue,
    input: IndexRateInput,
  ): Promise<IndexRateValue> => {
    const { userId } = context.actor;
    await requireAccess(deps.authorization, userId, householdId, {
      action: 'data.create', visibility: 'shared', ownerUserId: userId,
    });
    requirePastDate(deps, input.asOf);
    const rate = await deps.indexRates.insert(householdId, {
      indexCode, value: input.value, asOfDate: input.asOf,
    }, userId);
    if (rate === 'duplicate_day') throw indexRateDuplicateDay();
    requestLogger(context).audit('RecordIndexRate', {
      entityType: 'IndexRate', entityId: rate.id, householdId,
    });
    return rate;
  },

  /**
   * Corrects a value and/or its date (uc-09, FR-11.6). An empty edit reads it
   * back, unaudited.
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param indexCode - The index, from the route.
   * @param valueId - The value.
   * @param edit - The fields to change; a date not after today.
   * @returns The value as it now stands.
   * @throws {ApiError} 404 `household.not_found` / `index_rate.not_found`; 403
   *   `auth.forbidden`; 409 `index_rate.duplicate_day`; 422 `validation.failed`.
   */
  editIndexRate: async (
    context: SignedInContext,
    householdId: string,
    indexCode: IndexCodeValue,
    valueId: string,
    edit: IndexRateEdit,
  ): Promise<IndexRateValue> => {
    const rate = await loadRate(deps, context, { householdId, indexCode, valueId }, 'data.edit');
    requirePastDate(deps, edit.asOf);
    const changes = rateChangesOf(edit);
    if (Object.keys(changes).length === 0) return rate;
    const edited = await deps.indexRates.update(householdId, indexCode, valueId, changes);
    if (edited === 'not_found') throw indexRateNotFound();
    if (edited === 'duplicate_day') throw indexRateDuplicateDay();
    requestLogger(context).audit('EditIndexRate', {
      entityType: 'IndexRate', entityId: valueId, householdId,
    });
    return edited;
  },

  /**
   * Deletes a value; the index's previous one becomes its latest (uc-10).
   *
   * @param context - The signed-in request.
   * @param householdId - The household.
   * @param indexCode - The index, from the route.
   * @param valueId - The value.
   * @throws {ApiError} 404 `household.not_found` / `index_rate.not_found`; 403 `auth.forbidden`.
   */
  deleteIndexRate: async (
    context: SignedInContext,
    householdId: string,
    indexCode: IndexCodeValue,
    valueId: string,
  ): Promise<void> => {
    await loadRate(deps, context, { householdId, indexCode, valueId }, 'data.delete');
    if (await deps.indexRates.remove(householdId, indexCode, valueId) === 'not_found') {
      throw indexRateNotFound();
    }
    requestLogger(context).audit('DeleteIndexRate', {
      entityType: 'IndexRate', entityId: valueId, householdId,
    });
  },
});

export default createIndexRates;
