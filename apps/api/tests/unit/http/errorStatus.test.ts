import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import STATUS_OF from '../../../src/http/errorStatus';

// The status table against the contract (OQ-202): each shared error response in
// `openapi.yaml` is answered under one status and lists the codes it carries;
// every listed code the API emits must have that status here.

const SPEC = path.resolve(import.meta.dirname, '../../../../../docs/architecture/api/openapi.yaml');

/**
 * Reads which status each shared response is referenced under.
 *
 * @param yaml - The OpenAPI document.
 * @returns Response name → its statuses.
 */
const statusesOf = (yaml: string): Map<string, Set<number>> => {
  const statuses = new Map<string, Set<number>>();
  const references = yaml.matchAll(/"(\d{3})": \{ \$ref: "#\/components\/responses\/(\w+)" \}/g);
  [...references].forEach(([, status, name]) => {
    statuses.set(name!, (statuses.get(name!) ?? new Set()).add(Number(status)));
  });
  return statuses;
};

/**
 * Reads the codes each shared response's description lists.
 *
 * @param yaml - The OpenAPI document.
 * @returns Response name → the codes in backticks that the API emits.
 */
const codesOf = (yaml: string): Map<string, string[]> => {
  const block = yaml.slice(yaml.indexOf('\n  responses:\n'), yaml.indexOf('\n  schemas:\n'));
  const entries = block.matchAll(/^ {4}(\w+):\n {6}description: (.+)$/gm);
  return new Map([...entries].map(([, name, description]) => [
    name!,
    [...description!.matchAll(/`([\w.]+)`/g)]
      .map(([, code]) => code!)
      .filter((code) => code in STATUS_OF),
  ]));
};

describe('STATUS_OF', () => {
  it('answers each code the contract lists with that response\'s status', async () => {
    const yaml = await readFile(SPEC, 'utf8');
    const statuses = statusesOf(yaml);
    const listed = [...codesOf(yaml)].flatMap(([name, codes]) => codes.map((code) => ({
      code, contract: [...(statuses.get(name) ?? [])],
    })));

    // The check reads something: every shared response, and dozens of codes.
    expect(statuses.size).toBeGreaterThanOrEqual(9);
    expect(listed.length).toBeGreaterThan(30);
    listed.forEach(({ code, contract }) => {
      expect({ code, status: STATUS_OF[code as keyof typeof STATUS_OF] })
        .toEqual({ code, status: contract.length === 1 ? contract[0] : contract });
    });
  });

  it('answers every refusal with a client or server error status', () => {
    Object.values(STATUS_OF).forEach((status) => {
      expect(status).toBeGreaterThanOrEqual(400);
    });
  });
});
