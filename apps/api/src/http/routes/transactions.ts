import {
  zDeleteTransactionPath, zEditTransactionBody, zEditTransactionPath, zGetTransactionPath,
  zListTransactionsPath, zListTransactionsQuery, zRecordTransactionBody, zRecordTransactionPath,
} from '@financas/api-types/zod';
import { Hono } from 'hono';
import { z } from 'zod';
import type { TransactionListFilter, TransactionManager } from '../../managers/transaction';
import type { AppEnv } from '../errorHandler';
import { validate } from '../validation';
import { toLedgerItemJson } from './transactionJson';
import { signedInContextOf } from './requestContext';

// Transactions (M3, VBD §3.1): one entry point for every cash-flow event —
// record on either ledger, edit and delete as its inverse, browse & filter over
// both merged newest-first. Every path sits under `/households/:householdId`
// (OQ-174); the household role checks are TransactionManager's (OQ-111).

const LIST_PATH = '/households/:householdId/transactions';
const ITEM_PATH = `${LIST_PATH}/:transactionId`;

/** The filter fields of the contract's list query, in the order the Manager reads them. */
const FILTER_FIELDS = [
  'kinds', 'accountIds', 'creditCardIds', 'categoryIds', 'holdingId', 'from', 'to',
] as const;

/**
 * The Manager's list filter from the validated query — only the fields it sent
 * (an absent field, never an explicit `undefined`).
 *
 * @param query - The contract-validated query.
 * @returns The filter.
 */
const listFilterOf = (query: z.infer<typeof zListTransactionsQuery>): TransactionListFilter => {
  const filter: Record<string, unknown> = {};
  for (const field of FILTER_FIELDS) {
    if (query[field] !== undefined) filter[field] = query[field];
  }
  return filter;
};

/**
 * Builds the transaction routes.
 *
 * @param transaction - The Manager.
 * @returns The routes, relative to `/api/v1`.
 */
const createTransactionRoutes = (transaction: TransactionManager) => new Hono<AppEnv>()
  .post(
    LIST_PATH,
    validate('param', zRecordTransactionPath),
    validate('json', zRecordTransactionBody),
    async (httpContext) => {
      const { householdId } = httpContext.req.valid('param');
      const request = httpContext.req.valid('json');
      const recorded = await transaction.recordTransaction(
        signedInContextOf(httpContext),
        householdId,
        request,
      );
      return httpContext.json(toLedgerItemJson(recorded), 201);
    },
  )
  .get(
    LIST_PATH,
    validate('param', zListTransactionsPath),
    validate('query', zListTransactionsQuery),
    async (httpContext) => {
      const { householdId } = httpContext.req.valid('param');
      const query = httpContext.req.valid('query');
      // The validated query is the Manager's filter, field for field.
      const page = await transaction.listTransactions(
        signedInContextOf(httpContext),
        householdId,
        listFilterOf(query),
        query.cursor,
        query.limit,
      );
      return httpContext.json({
        ...page, items: page.items.map((item) => toLedgerItemJson(item.transaction)),
      });
    },
  )
  .get(ITEM_PATH, validate('param', zGetTransactionPath), async (httpContext) => {
    const { householdId, transactionId } = httpContext.req.valid('param');
    const row = await transaction.getTransaction(
      signedInContextOf(httpContext),
      householdId,
      transactionId,
    );
    return httpContext.json(toLedgerItemJson(row.transaction));
  })
  .patch(
    ITEM_PATH,
    validate('param', zEditTransactionPath),
    validate('json', zEditTransactionBody),
    async (httpContext) => {
      const { householdId, transactionId } = httpContext.req.valid('param');
      const update = httpContext.req.valid('json');
      const edited = await transaction.editTransaction(
        signedInContextOf(httpContext),
        householdId,
        transactionId,
        update,
      );
      return httpContext.json(toLedgerItemJson(edited.transaction));
    },
  )
  .delete(ITEM_PATH, validate('param', zDeleteTransactionPath), async (httpContext) => {
    const { householdId, transactionId } = httpContext.req.valid('param');
    await transaction.deleteTransaction(signedInContextOf(httpContext), householdId, transactionId);
    return httpContext.body(null, 204);
  });

export default createTransactionRoutes;
