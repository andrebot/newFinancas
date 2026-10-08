import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import { z, type core } from 'zod';
import { createApiError, type ApiError } from './apiError';
import { toFieldDetail } from './fieldDetail';
import { coerceQuery } from './queryCoercion';

/**
 * The validator's parse result, typed loosely on purpose: the library's own
 * types are conditional on the schema and do not resolve for a generic one.
 * A failure always carries a Zod error.
 */
interface ValidationResult {
  success: boolean;
  error?: unknown;
  data: unknown;
}

/**
 * Builds the 422 `validation.failed` error for a failed request validation.
 *
 * @param issues - The Zod issues.
 * @param input - The raw request value the issues refer to.
 * @returns The error, with one `details[]` entry per issue.
 */
export const validationError = (issues: readonly core.$ZodIssue[], input: unknown): ApiError => (
  createApiError({
    status: 422,
    code: 'validation.failed',
    message: 'Request validation failed',
    details: issues.map((issue) => toFieldDetail(issue, input)),
  })
);

/**
 * `zValidator` hook: turns a failed validation into a thrown API error, so every
 * failure leaves through the one error handler and matches the contract.
 *
 * @param result - The validator's parse result.
 * @throws {ApiError} 422 `validation.failed` when validation failed.
 */
export const throwOnInvalid = (result: ValidationResult): void => {
  if (!result.success) {
    throw validationError((result.error as core.$ZodError).issues, result.data);
  }
};

/**
 * Validates one request part against a schema generated from the spec
 * (`@financas/api-types/zod`). Query values arrive as text, so a `query`
 * target is first converted using the schema's field types.
 *
 * @param target - Which part of the request: `json`, `query`, `param`, `header`, …
 * @param schema - The generated Zod schema for that part.
 * @returns Hono middleware exposing the typed value via `c.req.valid(target)`.
 */
export const validate = <Schema extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: Schema,
) => zValidator(
  target,
  target === 'query' ? z.preprocess((value) => coerceQuery(schema, value), schema) : schema,
  throwOnInvalid,
);
