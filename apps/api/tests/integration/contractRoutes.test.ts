import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  beforeAll, describe, expect, it,
} from 'vitest';
import { appWithMocks } from '../support/app';

// The contract against the routes actually mounted (code review A1): the web
// client is generated from openapi.yaml, so an operation it can call but the
// API doesn't route fails only in the real app — every other test fakes
// `fetch` or the Manager. Operations still on the plan are listed below, with
// where they land; an entry leaves when its route does.

const SPEC = path.resolve(import.meta.dirname, '../../../../docs/architecture/api/openapi.yaml');
const BASE = '/api/v1';

/** Contract operations whose backend is still on the plan (03-pd-execution-order.md). */
const NOT_YET_ROUTED: readonly { readonly matches: RegExp; readonly lands: string }[] = [
  {
    matches: /^GET \/households\/\{householdId\}\/(goal-progress|goals\/\{goalId\}\/progress)$/,
    lands: 'task 104 (M4, InsightsManager — OQ-177)',
  },
  {
    matches: /^GET \/households\/[^/]+\/(holdings\/[^/]+|accounts\/[^/]+\/holdings)$/,
    lands: 'task 104 (M4, InsightsManager — Holdings carry projections, OQ-178)',
  },
  {
    matches: /^GET \/households\/\{householdId\}\/reports\/\{reportType\}$/,
    lands: 'task 104 (M4, month-overview); investments-overview, payouts: task 133 (OQ-201)',
  },
  {
    matches: /^\w+ \/households\/\{householdId\}\/(dashboard|reports\/transactions)(\/|$)/,
    lands: 'slice 5',
  },
  { matches: /^\w+ \/notifications(\/|$)/, lands: 'slice 5' },
  { matches: /^GET \/households\/\{householdId\}\/audit-log(\/|$)/, lands: 'slice 5' },
  { matches: /^DELETE \/users\/me$/, lands: 'task 136 (M1D, the Delete User cascade)' },
];

/**
 * Reads the operations of the contract: `METHOD /path` with `{param}`s, from
 * the `paths:` block (one path per two-space-indented key, its methods below).
 *
 * @param yaml - The OpenAPI document.
 * @returns Every operation it defines.
 */
const contractOperations = (yaml: string): string[] => {
  const operations: string[] = [];
  let current: string | undefined;
  yaml.split('\n').forEach((line) => {
    const pathKey = /^ {2}(\/\S*):\s*$/.exec(line);
    const methodKey = /^ {4}(get|post|put|patch|delete):/.exec(line);
    if (pathKey) [, current] = pathKey;
    else if (methodKey && current) operations.push(`${methodKey[1]!.toUpperCase()} ${current}`);
    else if (/^\S/.test(line)) current = undefined;
  });
  return operations;
};

/**
 * Lists the operations the app mounts under the API base, in contract form.
 *
 * @returns `METHOD /path` with `{param}`s; middleware and `/health` left out.
 */
const mountedOperations = (): string[] => [...new Set(appWithMocks().app.routes
  .filter(({ method, path: route }) => method !== 'ALL' && route.startsWith(BASE))
  .map(({ method, path: route }) => (
    `${method} ${route.slice(BASE.length).replace(/:(\w+)/g, '{$1}')}`
  )))];

/**
 * Finds the plan entry for an operation not routed yet.
 *
 * @param operation - `METHOD /path`.
 * @returns Where it lands, or `undefined` when it should be routed now.
 */
const plannedFor = (operation: string) => NOT_YET_ROUTED
  .find(({ matches }) => matches.test(operation))?.lands;

describe('the contract and the mounted routes', () => {
  let contract: string[];
  const mounted = mountedOperations();

  beforeAll(async () => {
    contract = contractOperations(await readFile(SPEC, 'utf8'));
  });

  it('reads both sides', () => {
    expect(contract.length).toBeGreaterThan(80);
    expect(mounted).toContain('POST /auth/login');
  });

  it('routes every operation the contract defines, except those still on the plan', () => {
    const missing = contract.filter((operation) => (
      !mounted.includes(operation) && plannedFor(operation) === undefined
    ));

    expect(missing).toEqual([]);
  });

  it('keeps the plan list honest: nothing on it is routed already', () => {
    expect(mounted.filter((operation) => plannedFor(operation) !== undefined)).toEqual([]);
  });

  it('mounts nothing the contract does not define', () => {
    expect(mounted.filter((operation) => !contract.includes(operation))).toEqual([]);
  });
});
