import { describe, expect, it } from 'vitest';
import {
  isValidCorrelationId, newCorrelationId, resolveCorrelationId,
} from '../../../src/utilities/correlationId';

const V4 = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const V7 = '0199c5a0-1b2c-7d3e-8f40-123456789abc';

describe('isValidCorrelationId', () => {
  it.each([V4, V7, V7.toUpperCase()])('accepts the UUID %s', (value) => {
    expect(isValidCorrelationId(value)).toBe(true);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['not a UUID', 'req-123'],
    ['a log-injection attempt', `${V4}\nFAKE LOG LINE`],
    ['an invalid variant', '3f2504e0-4f89-41d3-7a0c-0305e82c3301'],
    ['version 0', '3f2504e0-4f89-01d3-9a0c-0305e82c3301'],
    ['too long', `${V4}0`],
  ])('rejects %s', (_case, value) => {
    expect(isValidCorrelationId(value)).toBe(false);
  });
});

describe('newCorrelationId', () => {
  it('uses the generator and lower-cases the result', () => {
    expect(newCorrelationId(() => V7.toUpperCase())).toBe(V7);
  });

  it('defaults to a random v4 UUID', () => {
    const first = newCorrelationId();

    expect(isValidCorrelationId(first)).toBe(true);
    expect(newCorrelationId()).not.toBe(first);
  });
});

describe('resolveCorrelationId', () => {
  const generate = () => V4;

  it('keeps a well-formed incoming ID, lower-cased', () => {
    expect(resolveCorrelationId(V7.toUpperCase(), generate)).toBe(V7);
  });

  it.each([undefined, '', 'req-123', `${V7} `])('replaces %j with a new ID', (incoming) => {
    expect(resolveCorrelationId(incoming, generate)).toBe(V4);
  });

  it('generates a random ID by default', () => {
    expect(isValidCorrelationId(resolveCorrelationId(undefined))).toBe(true);
  });
});
