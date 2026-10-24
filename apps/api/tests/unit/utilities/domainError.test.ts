import { describe, expect, it } from 'vitest';
import {
  createDomainError, failureDetails, isDomainError, validationFailed,
} from '../../../src/utilities/domainError';

describe('createDomainError', () => {
  it('creates an Error carrying the refusal, with no status of its own', () => {
    const init = {
      code: 'goal.allocation_exceeds_100',
      message: 'Over 100%',
      params: { current: 85 },
    } as const;

    const error = createDomainError(init);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Over 100%');
    expect(error.domainError).toEqual(init);
  });
});

describe('isDomainError', () => {
  it('recognizes errors made by createDomainError', () => {
    const error = createDomainError({ code: 'route.not_found', message: 'm' });

    expect(isDomainError(error)).toBe(true);
  });

  it.each([
    ['a plain Error', new Error('boom')],
    ['a non-error object', { domainError: {} }],
    ['a string', 'boom'],
    ['null', null],
  ])('rejects %s', (_case, value) => {
    expect(isDomainError(value)).toBe(false);
  });
});

describe('validationFailed', () => {
  it('refuses with validation.failed and the field details', () => {
    const details = [{ field: 'name', code: 'string.min', params: { min: 1 } }] as const;

    const error = validationFailed(details);

    expect(error.domainError).toEqual({
      code: 'validation.failed', message: 'Request validation failed', details,
    });
  });
});

describe('failureDetails', () => {
  it('keeps a refusal\'s code and params beside its text', () => {
    const error = createDomainError({
      code: 'goal.allocation_exceeds_100', message: 'Over', params: { current: 85 },
    });

    expect(failureDetails(error)).toEqual({
      error: 'Error: Over', code: 'goal.allocation_exceeds_100', params: { current: 85 },
    });
  });

  it('leaves params out when a refusal has none', () => {
    expect(failureDetails(createDomainError({ code: 'goal.not_found', message: 'Gone' })))
      .toEqual({ error: 'Error: Gone', code: 'goal.not_found' });
  });

  it('records anything else as text', () => {
    expect(failureDetails(new Error('boom'))).toEqual({ error: 'Error: boom' });
    expect(failureDetails('plain')).toEqual({ error: 'plain' });
  });
});
